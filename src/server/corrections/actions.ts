"use server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/server/auth/session";
import { logEvent } from "@/server/audit";
import { revalidatePath } from "next/cache";

/**
 * Request a post-settlement correction. Only for own data.
 */
export async function requestCorrectionAction(
  outingId: string,
  entityType: string,
  entityId: string,
  field: string,
  oldValue: string,
  newValue: string
) {
  const session = await requireSession();
  const outing = await prisma.outing.findUnique({ where: { id: outingId } });
  if (!outing) return { error: "Outing not found" };
  if (outing.status !== "SETTLED") return { error: "Outing must be settled to request corrections" };

  // Verify requester is a participant
  const participant = await prisma.outingParticipant.findUnique({
    where: { outingId_userId: { outingId, userId: session.userId } },
  });
  if (!participant) return { error: "Not an outing participant" };

  // Verify the entity belongs to the requester (IDOR guard)
  if (entityType === "LineItem") {
    const item = await prisma.lineItem.findUnique({ where: { id: entityId } });
    if (!item || item.userId !== session.userId) return { error: "Can only correct your own data" };
  } else if (entityType === "ActivityPayment") {
    const payment = await prisma.activityPayment.findUnique({ where: { id: entityId } });
    if (!payment || payment.userId !== session.userId) return { error: "Can only correct your own data" };
  }

  const request = await prisma.correctionRequest.create({
    data: {
      outingId,
      requesterId: session.userId,
      entityType,
      entityId,
      field,
      oldValue,
      newValue,
      status: "PENDING",
    },
  });

  await logEvent({
    groupId: outing.groupId,
    outingId,
    actorId: session.userId,
    eventType: "CORRECTION_REQUESTED",
    entityType: "CorrectionRequest",
    entityId: request.id,
    metadata: { entityType, entityId, field, oldValue, newValue },
  });

  revalidatePath(`/groups/${outing.groupId}/outings/${outingId}`);
  return { success: true, id: request.id };
}

/**
 * Approve a correction request. Only outing owner can approve.
 * Applies the change and recalculates settlement.
 */
export async function approveCorrectionAction(requestId: string, decisionNote?: string) {
  const session = await requireSession();
  const request = await prisma.correctionRequest.findUnique({ where: { id: requestId } });
  if (!request) return { error: "Not found" };
  if (request.status !== "PENDING") return { error: "Already decided" };

  const outing = await prisma.outing.findUnique({ where: { id: request.outingId } });
  if (!outing) return { error: "Outing not found" };

  const caller = await prisma.outingParticipant.findUnique({
    where: { outingId_userId: { outingId: request.outingId, userId: session.userId } },
  });
  if (!caller || caller.role !== "OWNER") return { error: "Only owner can approve" };

  await prisma.$transaction(async (tx) => {
    // Apply the correction
    if (request.entityType === "LineItem") {
      const field = request.field as "description" | "priceCentimes";
      const value = field === "priceCentimes" ? parseInt(request.newValue, 10) : request.newValue;
      await tx.lineItem.update({
        where: { id: request.entityId },
        data: { [field]: value },
      });
    } else if (request.entityType === "ActivityPayment") {
      await tx.activityPayment.update({
        where: { id: request.entityId },
        data: { amountCentimes: parseInt(request.newValue, 10) },
      });
    }

    // Mark as approved
    await tx.correctionRequest.update({
      where: { id: requestId },
      data: {
        status: "APPROVED",
        deciderId: session.userId,
        decisionNote,
        decidedAt: new Date(),
      },
    });
  });

  await logEvent({
    groupId: outing.groupId,
    outingId: request.outingId,
    actorId: session.userId,
    eventType: "CORRECTION_APPROVED",
    entityType: "CorrectionRequest",
    entityId: requestId,
  });

  revalidatePath(`/groups/${outing.groupId}/outings/${request.outingId}`);
  return { success: true };
}

/**
 * Reject a correction request. Only outing owner can reject.
 */
export async function rejectCorrectionAction(requestId: string, decisionNote?: string) {
  const session = await requireSession();
  const request = await prisma.correctionRequest.findUnique({ where: { id: requestId } });
  if (!request) return { error: "Not found" };
  if (request.status !== "PENDING") return { error: "Already decided" };

  const outing = await prisma.outing.findUnique({ where: { id: request.outingId } });
  if (!outing) return { error: "Outing not found" };

  const caller = await prisma.outingParticipant.findUnique({
    where: { outingId_userId: { outingId: request.outingId, userId: session.userId } },
  });
  if (!caller || caller.role !== "OWNER") return { error: "Only owner can reject" };

  await prisma.correctionRequest.update({
    where: { id: requestId },
    data: {
      status: "REJECTED",
      deciderId: session.userId,
      decisionNote,
      decidedAt: new Date(),
    },
  });

  await logEvent({
    groupId: outing.groupId,
    outingId: request.outingId,
    actorId: session.userId,
    eventType: "CORRECTION_REJECTED",
    entityType: "CorrectionRequest",
    entityId: requestId,
  });

  revalidatePath(`/groups/${outing.groupId}/outings/${request.outingId}`);
  return { success: true };
}
