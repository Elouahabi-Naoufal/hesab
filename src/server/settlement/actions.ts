"use server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/server/auth/session";
import { calculateSettlement, explainSettlement } from "@/domain/settlement";
import { generatePublicToken, errMsg } from "@/lib/utils";
import { logEvent } from "@/server/audit";
import { revalidatePath } from "next/cache";

/**
 * Generate settlement for an outing.
 * Aggregates from all activities (FIXED usage + VARIABLE line items + payments).
 */
export async function generateSettlement(outingId: string) {
  const outing = await prisma.outing.findUnique({ where: { id: outingId } });
  if (!outing) throw new Error("Outing not found");

  // Get all participants
  const participants = await prisma.outingParticipant.findMany({
    where: { outingId },
  });

  const users = await prisma.user.findMany({
    where: { id: { in: participants.map(p => p.userId) } },
  });
  const userMap = new Map(users.map(u => [u.id, u.displayName]));

  const members = participants.map(p => ({
    userId: p.userId,
    displayName: userMap.get(p.userId),
  }));

  // Get all activities
  const activities = await prisma.activity.findMany({
    where: { outingId },
    include: {
      usageRecords: {
        include: {
          participants: true,
        },
      },
      lineItems: true,
      payments: true,
    },
  });

  const activityInputs = activities.map(a => ({
    id: a.id,
    name: a.name,
    pricingModel: a.pricingModel as "FIXED" | "VARIABLE",
    status: a.status,
    usageRecords: a.usageRecords.map(r => ({
      id: r.id,
      totalCentimes: r.totalCentimes,
      status: r.status,
      participantIds: r.participants.map(p => p.userId),
    })),
    lineItems: a.lineItems.map(l => ({
      userId: l.userId,
      priceCentimes: l.priceCentimes,
    })),
    payments: a.payments.map(p => ({
      userId: p.userId,
      amountCentimes: p.amountCentimes,
    })),
  }));

  const result = calculateSettlement({
    members,
    activities: activityInputs,
  });

  // Upsert settlement
  const existing = await prisma.settlement.findFirst({ where: { outingId } });
  const publicToken = existing?.publicToken || generatePublicToken();

  const settlement = await prisma.settlement.upsert({
    where: { outingId: outingId! },
    update: {
      totalExpenses: result.totalExpenses,
      totalPaid: result.totalPaid,
      publicToken,
    },
    create: {
      outingId,
      totalExpenses: result.totalExpenses,
      totalPaid: result.totalPaid,
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

  // Update outing status
  await prisma.outing.update({
    where: { id: outingId },
    data: { status: "SETTLED" },
  });

  await logEvent({
    groupId: outing.groupId,
    outingId,
    eventType: "SETTLEMENT_GENERATED",
    entityType: "Settlement",
    entityId: settlement.id,
    metadata: JSON.stringify({
      totalExpenses: result.totalExpenses,
      transfers: result.transfers.length,
      isComplete: result.isComplete,
    }),
  });

  return { settlement, result };
}

/**
 * Owner-only finalize settlement for an outing.
 */
export async function finalizeSettlementAction(outingId: string) {
  const session = await requireSession();
  const outing = await prisma.outing.findUnique({ where: { id: outingId } });
  if (!outing) return { error: "Outing not found" };

  const participant = await prisma.outingParticipant.findUnique({
    where: { outingId_userId: { outingId, userId: session.userId } },
  });
  if (!participant || participant.role !== "OWNER") return { error: "Only owner can finalize" };

  if (outing.status === "SETTLED") return { error: "Already settled" };

  try {
    await generateSettlement(outingId);
  } catch (e: unknown) {
    return { error: errMsg(e) || "Finalize failed." };
  }

  revalidatePath(`/groups/${outing.groupId}/outings/${outingId}`);
  revalidatePath(`/groups/${outing.groupId}/outings/${outingId}/settlement`);
  return { success: true };
}

/**
 * Recalculate settlement (owner only).
 */
export async function recalculateSettlementAction(outingId: string) {
  const session = await requireSession();
  const outing = await prisma.outing.findUnique({ where: { id: outingId } });
  if (!outing) return { error: "Outing not found" };

  const participant = await prisma.outingParticipant.findUnique({
    where: { outingId_userId: { outingId, userId: session.userId } },
  });
  if (!participant || participant.role !== "OWNER") return { error: "Only owner" };

  try {
    await generateSettlement(outingId);
  } catch (e: unknown) {
    return { error: errMsg(e) };
  }

  revalidatePath(`/groups/${outing.groupId}/outings/${outingId}`);
  revalidatePath(`/groups/${outing.groupId}/outings/${outingId}/settlement`);
  return { success: true };
}

/**
 * Mark transfer as PAID. Only the debtor can mark.
 */
export async function markTransferPaidAction(transferId: string) {
  const session = await requireSession();
  const transfer = await prisma.settlementTransfer.findUnique({ where: { id: transferId } });
  if (!transfer) return { error: "Not found" };
  if (transfer.fromUserId !== session.userId) return { error: "Only debtor can mark as paid" };

  await prisma.settlementTransfer.update({
    where: { id: transferId },
    data: { status: "PAID", paidAt: new Date() },
  });

  const settlement = await prisma.settlement.findUnique({ where: { id: transfer.settlementId } });
  if (settlement?.outingId) {
    const outing = await prisma.outing.findUnique({ where: { id: settlement.outingId } });
    if (outing) {
      await logEvent({
        groupId: outing.groupId,
        outingId: settlement.outingId,
        actorId: session.userId,
        eventType: "TRANSFER_PAID",
        entityId: transferId,
      });
      revalidatePath(`/groups/${outing.groupId}/outings/${settlement.outingId}/settlement`);
    }
  }

  return { success: true };
}

/**
 * Confirm transfer received. Only the creditor can confirm.
 */
export async function confirmTransferReceivedAction(transferId: string) {
  const session = await requireSession();
  const transfer = await prisma.settlementTransfer.findUnique({ where: { id: transferId } });
  if (!transfer) return { error: "Not found" };
  if (transfer.toUserId !== session.userId) return { error: "Only receiver can confirm" };

  await prisma.settlementTransfer.update({
    where: { id: transferId },
    data: { status: "CONFIRMED", confirmedAt: new Date() },
  });

  const settlement = await prisma.settlement.findUnique({ where: { id: transfer.settlementId } });
  if (settlement?.outingId) {
    const outing = await prisma.outing.findUnique({ where: { id: settlement.outingId } });
    if (outing) {
      await logEvent({
        groupId: outing.groupId,
        outingId: settlement.outingId,
        actorId: session.userId,
        eventType: "TRANSFER_CONFIRMED",
        entityId: transferId,
      });
      revalidatePath(`/groups/${outing.groupId}/outings/${settlement.outingId}/settlement`);
    }
  }

  return { success: true };
}

/**
 * Get settlement for an outing with user names.
 */
export async function getSettlementForOuting(outingId: string) {
  const settlement = await prisma.settlement.findFirst({
    where: { outingId },
    include: { transfers: true },
  });
  if (!settlement) return null;

  const userIds = [
    ...new Set([
      ...settlement.transfers.map(t => t.fromUserId),
      ...settlement.transfers.map(t => t.toUserId),
    ]),
  ];
  const users = await prisma.user.findMany({ where: { id: { in: userIds } } });
  const userMap = new Map(users.map(u => [u.id, u]));

  return { settlement, userMap };
}
