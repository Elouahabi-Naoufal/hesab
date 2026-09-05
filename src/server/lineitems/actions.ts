"use server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/server/auth/session";
import { logEvent } from "@/server/audit";
import { revalidatePath } from "next/cache";
import { parseDHToCentimes, errMsg } from "@/lib/utils";

/**
 * Create a line item for a variable-price activity.
 * Participants can add their own items. Admin can add for anyone.
 */
export async function createLineItemAction(formData: FormData) {
  const session = await requireSession();
  const activityId = formData.get("activityId") as string;
  const targetUserId = (formData.get("userId") as string) || session.userId;
  const description = ((formData.get("description") as string) || "").trim();
  const priceDH = formData.get("priceDH") as string;

  if (!activityId) return { error: "Activity is required." };
  if (!description) return { error: "Description is required." };
  if (!priceDH) return { error: "Price is required." };

  const activity = await prisma.activity.findUnique({ where: { id: activityId } });
  if (!activity) return { error: "Activity not found" };
  if (activity.pricingModel !== "VARIABLE") return { error: "Line items only for VARIABLE activities" };
  if (activity.status !== "OPEN") return { error: "Activity is not open" };

  const outing = await prisma.outing.findUnique({ where: { id: activity.outingId! } });
  if (!outing) return { error: "Outing not found" };

  // Permission check: can only add for self, unless admin
  const caller = await prisma.outingParticipant.findUnique({
    where: { outingId_userId: { outingId: activity.outingId!, userId: session.userId } },
  });
  if (!caller) return { error: "Not an outing participant" };

  if (targetUserId !== session.userId && caller.role !== "OWNER") {
    return { error: "Only owner can add items for other participants" };
  }

  // Validate target is an activity participant
  const targetParticipant = await prisma.outingParticipant.findUnique({
    where: { outingId_userId: { outingId: activity.outingId!, userId: targetUserId } },
  });
  if (!targetParticipant) return { error: "Target user is not an outing participant" };

  let priceCentimes: number;
  try {
    priceCentimes = parseDHToCentimes(priceDH, { minCentimes: 0, field: "Price" });
  } catch (e: unknown) {
    return { error: errMsg(e) };
  }

  const lineItem = await prisma.lineItem.create({
    data: {
      activityId,
      userId: targetUserId,
      description,
      priceCentimes,
    },
  });

  revalidatePath(`/groups/${outing.groupId}/outings/${activity.outingId}`);
  return { success: true, id: lineItem.id };
}

/**
 * Update a line item. Can only edit own items (or admin can edit any).
 */
export async function updateLineItemAction(lineItemId: string, data: { description?: string; priceDH?: string }) {
  const session = await requireSession();
  const item = await prisma.lineItem.findUnique({ where: { id: lineItemId } });
  if (!item) return { error: "Not found" };

  const activity = await prisma.activity.findUnique({ where: { id: item.activityId } });
  if (!activity || activity.status !== "OPEN") return { error: "Activity is not open" };

  const outing = await prisma.outing.findUnique({ where: { id: activity.outingId! } });
  if (!outing) return { error: "Outing not found" };

  const caller = await prisma.outingParticipant.findUnique({
    where: { outingId_userId: { outingId: activity.outingId!, userId: session.userId } },
  });
  if (!caller) return { error: "Not an outing participant" };

  // Can only edit own items unless admin
  if (item.userId !== session.userId && caller.role !== "OWNER") {
    return { error: "You can only edit your own items" };
  }

  const updateData: { description?: string; priceCentimes?: number } = {};
  if (data.description !== undefined) updateData.description = data.description;
  if (data.priceDH !== undefined) {
    try {
      updateData.priceCentimes = parseDHToCentimes(data.priceDH, { minCentimes: 0, field: "Price" });
    } catch (e: unknown) {
      return { error: errMsg(e) };
    }
  }

  await prisma.lineItem.update({ where: { id: lineItemId }, data: updateData });
  revalidatePath(`/groups/${outing.groupId}/outings/${activity.outingId}`);
  return { success: true };
}

/**
 * Delete a line item. Can only delete own items (or admin can delete any).
 */
export async function deleteLineItemAction(lineItemId: string) {
  const session = await requireSession();
  const item = await prisma.lineItem.findUnique({ where: { id: lineItemId } });
  if (!item) return { error: "Not found" };

  const activity = await prisma.activity.findUnique({ where: { id: item.activityId } });
  if (!activity || activity.status !== "OPEN") return { error: "Activity is not open" };

  const outing = await prisma.outing.findUnique({ where: { id: activity.outingId! } });
  if (!outing) return { error: "Outing not found" };

  const caller = await prisma.outingParticipant.findUnique({
    where: { outingId_userId: { outingId: activity.outingId!, userId: session.userId } },
  });
  if (!caller) return { error: "Not an outing participant" };

  if (item.userId !== session.userId && caller.role !== "OWNER") {
    return { error: "You can only delete your own items" };
  }

  await prisma.lineItem.delete({ where: { id: lineItemId } });
  revalidatePath(`/groups/${outing.groupId}/outings/${activity.outingId}`);
  return { success: true };
}
