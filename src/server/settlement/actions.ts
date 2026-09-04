"use server";
import { prisma } from "@/lib/prisma";
import { requireSession, getSession } from "@/server/auth/session";
import { calculateSettlement } from "@/domain/settlement";
import { generatePublicToken } from "@/lib/utils";
import { logEvent } from "@/server/audit";
import { revalidatePath } from "next/cache";

export async function generateSettlement(groupId: string) {
  const group = await prisma.group.findUnique({ where: { id: groupId }, include: { members: true } });
  if (!group) throw new Error("Group not found");

  const members = group.members.map(m => ({ userId: m.userId }));
  // Fetch display names
  const users = await prisma.user.findMany({ where: { id: { in: members.map(m => m.userId) } } });
  const userMap = new Map(users.map(u => [u.id, u.displayName]));

  const membersWithNames = members.map(m => ({ userId: m.userId, displayName: userMap.get(m.userId) }));

  const expenses = await prisma.expense.findMany({
    where: { groupId },
    include: { allocations: true, payments: true },
  });

  const expenseInputs = expenses.map(e => ({
    id: e.id,
    totalCentimes: e.totalCentimes,
    allocations: e.allocations.map(a => ({ userId: a.userId, amountCentimes: a.amountCentimes })),
    payments: e.payments.map(p => ({ userId: p.userId, amountCentimes: p.amountCentimes })),
  }));

  const contributions = group.members.map(m => ({ userId: m.userId, amountCentimes: m.contribution }));

  const result = calculateSettlement({
    members: membersWithNames,
    expenses: expenseInputs,
    contributions,
  });

  // Upsert settlement
  const existing = await prisma.settlement.findUnique({ where: { groupId } });
  const publicToken = existing?.publicToken || generatePublicToken();

  const settlement = await prisma.settlement.upsert({
    where: { groupId },
    update: {
      totalExpenses: result.totalExpenses,
      totalPaid: result.totalPaid,
      totalContributions: result.totalContributions,
      publicToken,
    },
    create: {
      groupId,
      totalExpenses: result.totalExpenses,
      totalPaid: result.totalPaid,
      totalContributions: result.totalContributions,
      publicToken,
    },
  });

  // Replace transfers
  await prisma.settlementTransfer.deleteMany({ where: { settlementId: settlement.id } });
  for (const t of result.transfers) {
    await prisma.settlementTransfer.create({
      data: {
        settlementId: settlement.id,
        fromUserId: t.fromUserId,
        toUserId: t.toUserId,
        amountCentimes: t.amountCentimes,
        status: "PENDING",
      },
    });
  }

  await prisma.group.update({ where: { id: groupId }, data: { status: "SETTLED" } });

  await logEvent({
    groupId,
    eventType: "SETTLEMENT_GENERATED",
    entityType: "Settlement",
    entityId: settlement.id,
    metadata: { totalExpenses: result.totalExpenses, transfers: result.transfers.length },
  });

  return { settlement, result };
}

export async function recalculateSettlementAction(groupId: string) {
  const session = await requireSession();
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) return { error: "Group not found" };
  if (group.ownerId !== session.userId) return { error: "Only owner" };
  await generateSettlement(groupId);
  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/groups/${groupId}/checkout`);
  return { success: true };
}

export async function markTransferPaidAction(transferId: string) {
  const session = await requireSession();
  const transfer = await prisma.settlementTransfer.findUnique({ where: { id: transferId } });
  if (!transfer) return { error: "Not found" };
  if (transfer.fromUserId !== session.userId) return { error: "Only debtor can mark as paid" };
  await prisma.settlementTransfer.update({ where: { id: transferId }, data: { status: "PAID", paidAt: new Date() } });
  const settlement = await prisma.settlement.findUnique({ where: { id: transfer.settlementId } });
  if (settlement) {
    await logEvent({ groupId: settlement.groupId, actorId: session.userId, eventType: "TRANSFER_PAID", entityId: transferId });
    revalidatePath(`/groups/${settlement.groupId}/checkout`);
    revalidatePath(`/s/${settlement.publicToken}`);
  }
  return { success: true };
}

export async function confirmTransferReceivedAction(transferId: string) {
  const session = await requireSession();
  const transfer = await prisma.settlementTransfer.findUnique({ where: { id: transferId } });
  if (!transfer) return { error: "Not found" };
  if (transfer.toUserId !== session.userId) return { error: "Only receiver can confirm" };
  await prisma.settlementTransfer.update({ where: { id: transferId }, data: { status: "CONFIRMED", confirmedAt: new Date() } });
  const settlement = await prisma.settlement.findUnique({ where: { id: transfer.settlementId } });
  if (settlement) {
    await logEvent({ groupId: settlement.groupId, actorId: session.userId, eventType: "TRANSFER_CONFIRMED", entityId: transferId });
    revalidatePath(`/groups/${settlement.groupId}/checkout`);
  }
  return { success: true };
}

export async function getSettlementForGroup(groupId: string) {
  const settlement = await prisma.settlement.findUnique({
    where: { groupId },
    include: { transfers: true },
  });
  if (!settlement) return null;
  // Enrich with user names
  const userIds = [...new Set([...settlement.transfers.map(t => t.fromUserId), ...settlement.transfers.map(t => t.toUserId)])];
  const users = await prisma.user.findMany({ where: { id: { in: userIds } } });
  const userMap = new Map(users.map(u => [u.id, u]));
  return { settlement, userMap };
}
