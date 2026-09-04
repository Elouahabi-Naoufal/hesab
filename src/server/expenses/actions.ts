"use server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/server/auth/session";
import { logEvent } from "@/server/audit";
import { revalidatePath } from "next/cache";
import { calculateAllocations } from "@/domain/allocation";

export async function createExpenseAction(formData: FormData) {
  const session = await requireSession();

  const groupId = formData.get("groupId") as string;
  const activityId = (formData.get("activityId") as string) || null;
  const description = formData.get("description") as string;
  const productId = (formData.get("productId") as string) || null;
  const quantity = parseInt((formData.get("quantity") as string) || "1", 10);
  const unitPrice = parseInt((formData.get("unitPriceCentimes") as string) || "0", 10);
  const totalCentimes = parseInt((formData.get("totalCentimes") as string) || "0", 10);
  const allocationMode = (formData.get("allocationMode") as string) || "EQUAL";
  const participantIdsRaw = formData.get("participantIds") as string;
  const payerIdsRaw = formData.get("payerIds") as string;
  const payerAmountsRaw = formData.get("payerAmounts") as string;
  const percentagesRaw = formData.get("percentages") as string;
  const customAmountsRaw = formData.get("customAmounts") as string;
  const portionsRaw = formData.get("portions") as string;

  if (!groupId || !description || !totalCentimes) return { error: "Missing fields" };

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) return { error: "Group not found" };
  if (group.status === "SETTLED" || group.status === "ARCHIVED") return { error: "Group settled, cannot add expenses" };
  if (group.status === "CHECKOUT") return { error: "Group in checkout, cannot add expenses" };
  if (group.ownerId !== session.userId) return { error: "Only owner can add expenses" };

  let participantIds: string[] = [];
  try { participantIds = JSON.parse(participantIdsRaw); } catch { return { error: "Invalid participants" }; }
  if (participantIds.length === 0) return { error: "Select at least one participant" };

  // Payers are OPTIONAL — supports "who paid?" unknown vs 0 distinction
  // If omitted or empty, expense records responsibility only, settlement will be incomplete
  let payerIds: string[] = [];
  let payerAmounts: number[] = [];
  const hasPayerData = payerIdsRaw && payerAmountsRaw && payerIdsRaw !== "[]" && payerAmountsRaw !== "";
  try {
    if (payerIdsRaw) payerIds = JSON.parse(payerIdsRaw);
    if (payerAmountsRaw) payerAmounts = JSON.parse(payerAmountsRaw);
    if (!Array.isArray(payerIds)) payerIds = [];
    if (!Array.isArray(payerAmounts)) payerAmounts = [];
  } catch { return { error: "Invalid payers format. Use [] for unknown or [id] + [amount]" }; }
  // Allow empty => unknown payer (distinct from 0). If provided, validate.
  if (payerIds.length > 0) {
    if (payerIds.length !== payerAmounts.length) return { error: "Payer ids and amounts must match" };
    const paySum = payerAmounts.reduce((a, b) => a + b, 0);
    if (paySum !== totalCentimes) return { error: `Payment amounts must equal exactly ${totalCentimes} centimes, got ${paySum} (or leave empty for unknown payer)` };
    // Validate each payer is a group member (optional but checked in domain)
  } else {
    // Ensure amounts also empty when no payer
    payerAmounts = [];
  }

  // Calculate allocations
  let allocations: { userId: string; amountCentimes: number; percentageBasisPoints?: number; portions?: number }[];
  try {
    const percentages = percentagesRaw ? JSON.parse(percentagesRaw) : undefined;
    const customAmounts = customAmountsRaw ? JSON.parse(customAmountsRaw) : undefined;
    const portions = portionsRaw ? JSON.parse(portionsRaw) : undefined;

    allocations = calculateAllocations({
      mode: allocationMode as any,
      totalCentimes,
      participantIds,
      percentages,
      customAmounts,
      portions,
    });
  } catch (e: any) {
    return { error: e.message };
  }

  // Validate sum
  const allocSum = allocations.reduce((s, a) => s + a.amountCentimes, 0);
  if (allocSum !== totalCentimes) return { error: `Allocation amounts must equal exactly ${totalCentimes} centimes, got ${allocSum}` };

  const expense = await prisma.expense.create({
    data: {
      groupId,
      activityId: activityId || null,
      productId: productId || null,
      description,
      quantity,
      unitPriceCentimes: unitPrice,
      totalCentimes,
      allocationMode,
      createdBy: session.userId,
    },
  });

  for (const alloc of allocations) {
    await prisma.expenseAllocation.create({
      data: {
        expenseId: expense.id,
        userId: alloc.userId,
        amountCentimes: alloc.amountCentimes,
        percentageBasisPoints: alloc.percentageBasisPoints ?? null,
        portions: alloc.portions ?? null,
      },
    });
  }

  for (let i = 0; i < payerIds.length; i++) {
    await prisma.expensePayment.create({
      data: {
        expenseId: expense.id,
        userId: payerIds[i],
        amountCentimes: payerAmounts[i],
      },
    });
  }

  await logEvent({
    groupId,
    actorId: session.userId,
    eventType: "EXPENSE_CREATED",
    entityType: "Expense",
    entityId: expense.id,
    metadata: { description, totalCentimes },
  });

  revalidatePath(`/groups/${groupId}`);
  return { success: true, id: expense.id };
}

export async function deleteExpenseAction(expenseId: string) {
  const session = await requireSession();
  const exp = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!exp) return { error: "Not found" };
  const group = await prisma.group.findUnique({ where: { id: exp.groupId } });
  if (!group) return { error: "Group not found" };
  if (group.ownerId !== session.userId) return { error: "Only owner" };
  if (group.status === "SETTLED" || group.status === "ARCHIVED") return { error: "Group settled" };
  await prisma.expense.delete({ where: { id: expenseId } });
  revalidatePath(`/groups/${group.id}`);
  return { success: true };
}
