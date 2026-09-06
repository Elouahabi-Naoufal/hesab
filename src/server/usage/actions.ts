"use server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/server/auth/session";
import { logEvent } from "@/server/audit";
import { revalidatePath } from "next/cache";
import { errMsg } from "@/lib/utils";

/**
 * Create a usage record for a fixed-price activity.
 * Only outing owner can create. Participants are the people who used the product.
 * Total = quantity × product pricePerUnitCt, divided equally among participants.
 */
export async function createUsageRecordAction(formData: FormData) {
  const session = await requireSession();
  const activityId = formData.get("activityId") as string;
  const productId = formData.get("productId") as string;
  const quantityRaw = (formData.get("quantity") as string) || "1";
  const participantIdsRaw = formData.get("participantIds") as string;

  if (!activityId) return { error: "Activity is required." };
  if (!productId) return { error: "Product is required." };

  const activity = await prisma.activity.findUnique({ where: { id: activityId } });
  if (!activity) return { error: "Activity not found" };
  if (activity.pricingModel !== "FIXED") return { error: "Usage records only for FIXED activities" };
  if (activity.status !== "OPEN") return { error: "Activity is not open" };

  const outing = await prisma.outing.findUnique({ where: { id: activity.outingId! } });
  if (!outing) return { error: "Outing not found" };

  const participant = await prisma.outingParticipant.findUnique({
    where: { outingId_userId: { outingId: activity.outingId!, userId: session.userId } },
  });
  if (!participant || participant.role !== "OWNER") return { error: "Only owner" };

  const product = await prisma.activityProduct.findUnique({ where: { id: productId } });
  if (!product || product.activityId !== activityId) return { error: "Product not found in this activity" };

  const quantity = parseInt(quantityRaw, 10);
  if (!Number.isSafeInteger(quantity) || quantity < 1) return { error: "Quantity must be at least 1" };

  let participantIds: string[];
  try {
    participantIds = JSON.parse(participantIdsRaw);
  } catch {
    return { error: "Invalid participants" };
  }
  if (!Array.isArray(participantIds) || participantIds.length === 0) {
    return { error: "Select at least one participant" };
  }

  const totalCentimes = product.pricePerUnitCt * quantity;

  const usageRecord = await prisma.usageRecord.create({
    data: {
      activityId,
      productId,
      quantity,
      totalCentimes,
      createdById: session.userId,
      status: "PENDING",
    },
  });

  // Create participant records
  for (const uid of participantIds) {
    await prisma.usageParticipant.create({
      data: { usageRecordId: usageRecord.id, userId: uid },
    });
    // Auto-create PENDING confirmation for each participant
    await prisma.usageConfirmation.create({
      data: { usageRecordId: usageRecord.id, userId: uid, status: "PENDING" },
    });
  }

  await logEvent({
    groupId: outing.groupId,
    outingId: activity.outingId!,
    actorId: session.userId,
    eventType: "USAGE_RECORD_CREATED",
    entityType: "UsageRecord",
    entityId: usageRecord.id,
    metadata: { product: product.name, quantity, totalCentimes, participants: participantIds.length },
  });

  revalidatePath(`/groups/${outing.groupId}/outings/${activity.outingId}`);
  return { success: true, id: usageRecord.id };
}

/**
 * Update a usage record. Owner only, while activity is open.
 * Changing quantity or product invalidates confirmations.
 */
export async function updateUsageRecordAction(
  usageRecordId: string,
  data: { quantity?: number; productId?: string }
) {
  const session = await requireSession();
  const record = await prisma.usageRecord.findUnique({ where: { id: usageRecordId } });
  if (!record) return { error: "Usage record not found" };

  const activity = await prisma.activity.findUnique({ where: { id: record.activityId } });
  if (!activity) return { error: "Activity not found" };

  const outing = await prisma.outing.findUnique({ where: { id: activity.outingId! } });
  if (!outing) return { error: "Outing not found" };
  if (outing.status === "SETTLED") return { error: "Outing is settled; activity data is locked." };

  const participant = await prisma.outingParticipant.findUnique({
    where: { outingId_userId: { outingId: activity.outingId!, userId: session.userId } },
  });
  if (!participant || participant.role !== "OWNER") return { error: "Only owner" };

  const updateData: { quantity?: number; productId?: string; totalCentimes?: number } = {};
  let product = await prisma.activityProduct.findUnique({ where: { id: record.productId } });

  if (data.productId && data.productId !== record.productId) {
    const newProduct = await prisma.activityProduct.findUnique({ where: { id: data.productId } });
    if (!newProduct || newProduct.activityId !== record.activityId) return { error: "Product not found" };
    updateData.productId = data.productId;
    product = newProduct;
  }

  if (data.quantity !== undefined) {
    if (data.quantity < 1) return { error: "Quantity must be at least 1" };
    updateData.quantity = data.quantity;
  }

  if (updateData.quantity !== undefined || updateData.productId !== undefined) {
    const qty = updateData.quantity ?? record.quantity;
    const price = product!.pricePerUnitCt;
    updateData.totalCentimes = price * qty;
  }

  await prisma.$transaction(async (tx) => {
    await tx.usageRecord.update({ where: { id: usageRecordId }, data: updateData });
    // Invalidate all confirmations
    await tx.usageConfirmation.updateMany({
      where: { usageRecordId },
      data: { status: "PENDING" },
    });
  });

  revalidatePath(`/groups/${outing.groupId}/outings/${activity.outingId}`);
  return { success: true };
}

/**
 * Delete a usage record. Owner only.
 */
export async function deleteUsageRecordAction(usageRecordId: string) {
  const session = await requireSession();
  const record = await prisma.usageRecord.findUnique({ where: { id: usageRecordId } });
  if (!record) return { error: "Not found" };

  const activity = await prisma.activity.findUnique({ where: { id: record.activityId } });
  if (!activity) return { error: "Activity not found" };

  const outing = await prisma.outing.findUnique({ where: { id: activity.outingId! } });
  if (!outing) return { error: "Outing not found" };
  if (outing.status === "SETTLED") return { error: "Outing is settled; activity data is locked." };

  const participant = await prisma.outingParticipant.findUnique({
    where: { outingId_userId: { outingId: activity.outingId!, userId: session.userId } },
  });
  if (!participant || participant.role !== "OWNER") return { error: "Only owner" };

  await prisma.usageRecord.delete({ where: { id: usageRecordId } });
  revalidatePath(`/groups/${outing.groupId}/outings/${activity.outingId}`);
  return { success: true };
}

/**
 * Confirm a usage record. Only participants of the record can confirm.
 */
export async function confirmUsageRecordAction(usageRecordId: string) {
  const session = await requireSession();
  const record = await prisma.usageRecord.findUnique({ where: { id: usageRecordId } });
  if (!record) return { error: "Not found" };

  const confirmation = await prisma.usageConfirmation.findUnique({
    where: { usageRecordId_userId: { usageRecordId, userId: session.userId } },
  });
  if (!confirmation) return { error: "You are not a participant of this usage record" };
  if (confirmation.status !== "PENDING") return { error: "Already confirmed/disputed" };

  await prisma.usageConfirmation.update({
    where: { id: confirmation.id },
    data: { status: "CONFIRMED" },
  });

  // Check if all confirmations are done
  const allConfirmations = await prisma.usageConfirmation.findMany({
    where: { usageRecordId },
  });
  const allConfirmed = allConfirmations.every(c => c.status === "CONFIRMED" || c.status === "ADMIN_CONFIRMED");
  if (allConfirmed) {
    await prisma.usageRecord.update({
      where: { id: usageRecordId },
      data: { status: "CONFIRMED" },
    });
  }

  const activity = await prisma.activity.findUnique({ where: { id: record.activityId } });
  if (activity?.outingId) {
    const outing = await prisma.outing.findUnique({ where: { id: activity.outingId } });
    if (outing) revalidatePath(`/groups/${outing.groupId}/outings/${activity.outingId}`);
  }
  return { success: true };
}

/**
 * Dispute a usage record. Only participants can dispute.
 * A disputed record is excluded from calculation until admin resolves.
 */
export async function disputeUsageRecordAction(usageRecordId: string, notes: string) {
  const session = await requireSession();
  const record = await prisma.usageRecord.findUnique({ where: { id: usageRecordId } });
  if (!record) return { error: "Not found" };

  const confirmation = await prisma.usageConfirmation.findUnique({
    where: { usageRecordId_userId: { usageRecordId, userId: session.userId } },
  });
  if (!confirmation) return { error: "You are not a participant of this usage record" };

  await prisma.$transaction(async (tx) => {
    await tx.usageConfirmation.update({
      where: { id: confirmation.id },
      data: { status: "DISPUTED", notes },
    });
    await tx.usageRecord.update({
      where: { id: usageRecordId },
      data: { status: "DISPUTED" },
    });
  });

  const activity = await prisma.activity.findUnique({ where: { id: record.activityId } });
  if (activity?.outingId) {
    const outing = await prisma.outing.findUnique({ where: { id: activity.outingId } });
    if (outing) revalidatePath(`/groups/${outing.groupId}/outings/${activity.outingId}`);
  }
  return { success: true };
}

/**
 * Admin confirms a usage record on behalf of a participant.
 * Only outing owner can do this.
 */
export async function adminConfirmUsageRecordAction(usageRecordId: string, targetUserId: string) {
  const session = await requireSession();
  const record = await prisma.usageRecord.findUnique({ where: { id: usageRecordId } });
  if (!record) return { error: "Not found" };

  const activity = await prisma.activity.findUnique({ where: { id: record.activityId } });
  if (!activity) return { error: "Activity not found" };

  const outing = await prisma.outing.findUnique({ where: { id: activity.outingId! } });
  if (!outing) return { error: "Outing not found" };

  const caller = await prisma.outingParticipant.findUnique({
    where: { outingId_userId: { outingId: activity.outingId!, userId: session.userId } },
  });
  if (!caller || caller.role !== "OWNER") return { error: "Only owner" };

  const confirmation = await prisma.usageConfirmation.findUnique({
    where: { usageRecordId_userId: { usageRecordId, userId: targetUserId } },
  });
  if (!confirmation) return { error: "Target user is not a participant" };
  if (confirmation.status !== "PENDING") return { error: "Already confirmed/disputed" };

  await prisma.usageConfirmation.update({
    where: { id: confirmation.id },
    data: { status: "ADMIN_CONFIRMED" },
  });

  // Check if all confirmations are done
  const allConfirmations = await prisma.usageConfirmation.findMany({
    where: { usageRecordId },
  });
  const allResolved = allConfirmations.every(c => c.status === "CONFIRMED" || c.status === "ADMIN_CONFIRMED");
  if (allResolved) {
    await prisma.usageRecord.update({
      where: { id: usageRecordId },
      data: { status: "CONFIRMED" },
    });
  }

  revalidatePath(`/groups/${outing.groupId}/outings/${activity.outingId}`);
  return { success: true };
}

/**
 * Admin resolves a dispute by correcting the quantity.
 * Invalidates confirmations, affected participants must re-confirm.
 */
export async function resolveDisputeAction(usageRecordId: string, newQuantity: number) {
  const session = await requireSession();
  const record = await prisma.usageRecord.findUnique({ where: { id: usageRecordId } });
  if (!record) return { error: "Not found" };
  if (record.status !== "DISPUTED") return { error: "Record is not disputed" };

  const activity = await prisma.activity.findUnique({ where: { id: record.activityId } });
  if (!activity) return { error: "Activity not found" };

  const outing = await prisma.outing.findUnique({ where: { id: activity.outingId! } });
  if (!outing) return { error: "Outing not found" };

  const caller = await prisma.outingParticipant.findUnique({
    where: { outingId_userId: { outingId: activity.outingId!, userId: session.userId } },
  });
  if (!caller || caller.role !== "OWNER") return { error: "Only owner" };

  if (newQuantity < 1) return { error: "Quantity must be at least 1" };

  const product = await prisma.activityProduct.findUnique({ where: { id: record.productId } });
  if (!product) return { error: "Product not found" };

  const newTotal = product.pricePerUnitCt * newQuantity;

  await prisma.$transaction(async (tx) => {
    await tx.usageRecord.update({
      where: { id: usageRecordId },
      data: { quantity: newQuantity, totalCentimes: newTotal, status: "PENDING" },
    });
    // Reset all confirmations
    await tx.usageConfirmation.updateMany({
      where: { usageRecordId },
      data: { status: "PENDING", notes: null },
    });
  });

  revalidatePath(`/groups/${outing.groupId}/outings/${activity.outingId}`);
  return { success: true };
}
