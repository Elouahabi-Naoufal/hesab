"use server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/server/auth/session";
import { logEvent } from "@/server/audit";
import { revalidatePath } from "next/cache";
import { parseDHToCentimes } from "@/lib/utils";
import { userError } from "@/lib/errors";
import { getTranslations } from "next-intl/server";

/**
 * Create a line item for a variable-price activity.
 * Participants can add their own items. Admin can add for anyone.
 */
export async function createLineItemAction(formData: FormData) {
  const session = await requireSession();
  const t = await getTranslations("errors");
  const activityId = formData.get("activityId") as string;
  const targetUserId = (formData.get("userId") as string) || session.userId;
  const description = ((formData.get("description") as string) || "").trim();
  const priceDH = formData.get("priceDH") as string;

  if (!activityId) return { error: t("activityRequired") };
  if (!description) return { error: t("descRequired") };
  if (!priceDH) return { error: t("priceRequired") };

  const activity = await prisma.activity.findUnique({ where: { id: activityId } });
  if (!activity) return { error: t("activityNotFound") };
  if (activity.pricingModel !== "VARIABLE") return { error: t("variableOnly") };

  const outing = await prisma.outing.findUnique({ where: { id: activity.outingId! } });
  if (!outing) return { error: t("outingNotFound") };
  if (outing.status === "SETTLED") return { error: t("outingSettledLocked") };

  // Permission check: can only add for self, unless admin
  const caller = await prisma.outingParticipant.findUnique({
    where: { outingId_userId: { outingId: activity.outingId!, userId: session.userId } },
  });
  if (!caller) return { error: t("notOutingParticipant") };

  if (targetUserId !== session.userId && caller.role !== "OWNER") {
    return { error: t("onlyOwner") };
  }

  // Validate target is an activity participant
  const targetParticipant = await prisma.outingParticipant.findUnique({
    where: { outingId_userId: { outingId: activity.outingId!, userId: targetUserId } },
  });
  if (!targetParticipant) return { error: t("targetNotParticipant") };

  let priceCentimes: number;
  try {
    priceCentimes = parseDHToCentimes(priceDH, { minCentimes: 0, field: "Price" });
  } catch (e: unknown) {
    return { error: userError(e, "Could not add this item. Please try again.") };
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
  const t = await getTranslations("errors");
  const item = await prisma.lineItem.findUnique({ where: { id: lineItemId } });
  if (!item) return { error: t("notFound") };

  const activity = await prisma.activity.findUnique({ where: { id: item.activityId } });
  if (!activity) return { error: t("activityNotFound") };

  const outing = await prisma.outing.findUnique({ where: { id: activity.outingId! } });
  if (!outing) return { error: t("outingNotFound") };
  if (outing.status === "SETTLED") return { error: t("outingSettledLocked") };

  const caller = await prisma.outingParticipant.findUnique({
    where: { outingId_userId: { outingId: activity.outingId!, userId: session.userId } },
  });
  if (!caller) return { error: t("notOutingParticipant") };

  // Can only edit own items unless admin
  if (item.userId !== session.userId && caller.role !== "OWNER") {
    return { error: t("editOwn") };
  }

  const updateData: { description?: string; priceCentimes?: number } = {};
  if (data.description !== undefined) updateData.description = data.description;
  if (data.priceDH !== undefined) {
    try {
      updateData.priceCentimes = parseDHToCentimes(data.priceDH, { minCentimes: 0, field: "Price" });
    } catch (e: unknown) {
      return { error: userError(e, "Could not update this item. Please try again.") };
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
  const t = await getTranslations("errors");
  const item = await prisma.lineItem.findUnique({ where: { id: lineItemId } });
  if (!item) return { error: t("notFound") };

  const activity = await prisma.activity.findUnique({ where: { id: item.activityId } });
  if (!activity) return { error: t("activityNotFound") };

  const outing = await prisma.outing.findUnique({ where: { id: activity.outingId! } });
  if (!outing) return { error: t("outingNotFound") };
  if (outing.status === "SETTLED") return { error: t("outingSettledLocked") };

  const caller = await prisma.outingParticipant.findUnique({
    where: { outingId_userId: { outingId: activity.outingId!, userId: session.userId } },
  });
  if (!caller) return { error: t("notOutingParticipant") };

  if (item.userId !== session.userId && caller.role !== "OWNER") {
    return { error: t("deleteOwn") };
  }

  await prisma.lineItem.delete({ where: { id: lineItemId } });
  revalidatePath(`/groups/${outing.groupId}/outings/${activity.outingId}`);
  return { success: true };
}
