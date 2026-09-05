"use server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/server/auth/session";
import { logEvent } from "@/server/audit";
import { revalidatePath } from "next/cache";
import { calculateAllocations } from "@/domain/allocation";
import { parseDHToCentimes, formatDH } from "@/domain/money";
import { errMsg } from "@/lib/utils";

/** Parse a JSON array of DH amounts (strings or numbers) into centimes. */
function parseDHArray(raw: string | null, field: string): number[] {
  if (!raw || raw.trim() === "" || raw.trim() === "[]") return [];
  let arr: unknown;
  try {
    arr = JSON.parse(raw);
  } catch {
    throw new Error(`${field} must be a JSON list of DH amounts, e.g. [120] or [80, 40] (got invalid JSON).`);
  }
  if (!Array.isArray(arr)) throw new Error(`${field} must be a JSON list of DH amounts, e.g. [120].`);
  return arr.map((v, i) => {
    try {
      return parseDHToCentimes(v as string | number, { minCentimes: 0, field: `${field}[${i}]` });
    } catch (e: unknown) {
      throw new Error(errMsg(e));
    }
  });
}

export async function createExpenseAction(formData: FormData) {
  const session = await requireSession();

  const groupId = formData.get("groupId") as string;
  const activityId = (formData.get("activityId") as string) || null;
  const description = ((formData.get("description") as string) || "").trim();
  const productId = (formData.get("productId") as string) || null;
  const quantityRaw = ((formData.get("quantity") as string) || "1").trim();
  const allocationMode = (formData.get("allocationMode") as string) || "EQUAL";
  const participantIdsRaw = formData.get("participantIds") as string;
  const payerIdsRaw = formData.get("payerIds") as string;
  const payerAmountsRaw = formData.get("payerAmountsDH") as string;
  const percentagesRaw = formData.get("percentages") as string;
  const customAmountsRaw = formData.get("customAmountsDH") as string;
  const portionsRaw = formData.get("portions") as string;

  if (!groupId) return { error: "Group is required." };
  if (!description) return { error: "Description is required." };

  // All money inputs are DH-denominated (e.g. "120" or "7.50"), converted once here
  let totalCentimes: number;
  try {
    totalCentimes = parseDHToCentimes((formData.get("totalDH") as string) ?? "", { minCentimes: 1, field: "Total" });
  } catch (e: unknown) {
    return { error: errMsg(e) };
  }
  const quantity = /^\d+$/.test(quantityRaw) ? parseInt(quantityRaw, 10) : NaN;
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000000) {
    return { error: "Quantity must be a whole number of at least 1." };
  }
  const unitPriceRaw = ((formData.get("unitPriceDH") as string) || "").trim();
  let unitPrice = 0;
  if (unitPriceRaw !== "") {
    try {
      unitPrice = parseDHToCentimes(unitPriceRaw, { minCentimes: 0, field: "Unit price" });
    } catch (e: unknown) {
      return { error: errMsg(e) };
    }
  }

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) return { error: "Group not found" };
  if (group.status === "SETTLED" || group.status === "ARCHIVED") return { error: "Group settled, cannot add expenses" };
  if (group.status === "CHECKOUT") return { error: "Group in checkout, cannot add expenses" };
  if (group.ownerId !== session.userId) return { error: "Only owner can add expenses" };

  let participantIds: string[] = [];
  try { participantIds = JSON.parse(participantIdsRaw); } catch { return { error: "Invalid participants" }; }
  if (!Array.isArray(participantIds) || participantIds.length === 0) return { error: "Select at least one participant" };

  // Every participant and payer must actually be a group member (IDOR guard:
  // raw user IDs arrive from the client and must never be trusted blindly)
  const memberRows = await prisma.groupMember.findMany({ where: { groupId }, select: { userId: true } });
  const memberSet = new Set(memberRows.map(m => m.userId));
  for (const pid of participantIds) {
    if (typeof pid !== "string" || !memberSet.has(pid)) return { error: "Participants must be members of this group." };
  }

  // Payers are OPTIONAL — supports "who paid?" unknown vs 0 distinction
  // If omitted or empty, expense records responsibility only, settlement will be incomplete
  let payerIds: string[] = [];
  let payerAmounts: number[] = [];
  try {
    if (payerIdsRaw) {
      const parsed = JSON.parse(payerIdsRaw);
      payerIds = Array.isArray(parsed) ? parsed : [];
    }
    payerAmounts = parseDHArray(payerAmountsRaw, "Payer amounts");
  } catch (e: unknown) { return { error: errMsg(e) }; }
  // Allow empty => unknown payer (distinct from 0). If provided, validate.
  if (payerIds.length > 0) {
    if (payerIds.length !== payerAmounts.length) return { error: "Payer names and payer amounts must match one-to-one." };
    for (const pid of payerIds) {
      if (typeof pid !== "string" || !memberSet.has(pid)) return { error: "Payers must be members of this group." };
    }
    const paySum = payerAmounts.reduce((a, b) => a + b, 0);
    if (paySum !== totalCentimes) {
      return { error: `Payer amounts must add up to exactly ${formatDH(totalCentimes)} (got ${formatDH(paySum)}), or leave empty for unknown payer.` };
    }
  } else {
    // Ensure amounts also empty when no payer
    payerAmounts = [];
  }
  if (activityId) {
    const act = await prisma.activity.findUnique({ where: { id: activityId } });
    if (!act || act.groupId !== groupId) return { error: "Activity does not belong to this group." };
  }
  if (productId) {
    const prod = await prisma.product.findUnique({ where: { id: productId } });
    if (!prod) return { error: "Product not found." };
  }

  // Calculate allocations
  let allocations: { userId: string; amountCentimes: number; percentageBasisPoints?: number; portions?: number }[];
  try {
    const percentages = percentagesRaw ? JSON.parse(percentagesRaw) : undefined;
    const customAmounts = customAmountsRaw ? parseDHArray(customAmountsRaw, "Custom amounts") : undefined;
    const portions = portionsRaw ? JSON.parse(portionsRaw) : undefined;

    allocations = calculateAllocations({
      mode: allocationMode as "EQUAL" | "PERCENTAGE" | "CUSTOM_AMOUNT" | "PORTIONS",
      totalCentimes,
      participantIds,
      percentages,
      customAmounts: customAmounts && customAmounts.length > 0 ? customAmounts : undefined,
      portions,
    });
  } catch (e: unknown) {
    return { error: errMsg(e) };
  }

  // Validate sum
  const allocSum = allocations.reduce((s, a) => s + a.amountCentimes, 0);
  if (allocSum !== totalCentimes) {
    return { error: `Split amounts must add up to exactly ${formatDH(totalCentimes)} (got ${formatDH(allocSum)}).` };
  }

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
  if (group.status === "CHECKOUT") return { error: "Group in checkout, cannot delete expenses" };
  await prisma.expense.delete({ where: { id: expenseId } });
  revalidatePath(`/groups/${group.id}`);
  return { success: true };
}
