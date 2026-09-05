"use server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/server/auth/session";
import { logEvent } from "@/server/audit";
import { revalidatePath } from "next/cache";
import { errMsg } from "@/lib/utils";

/**
 * Create an activity within an outing. Only outing OWNER can create.
 * pricingModel: "FIXED" or "VARIABLE"
 */
export async function createActivityAction(formData: FormData) {
  const session = await requireSession();
  const outingId = formData.get("outingId") as string;
  const name = ((formData.get("name") as string) || "").trim();
  const pricingModel = (formData.get("pricingModel") as string) || "FIXED";
  const notes = ((formData.get("notes") as string) || "").trim() || undefined;

  if (!outingId) return { error: "Outing is required." };
  if (!name) return { error: "Activity name is required." };
  if (pricingModel !== "FIXED" && pricingModel !== "VARIABLE") {
    return { error: "Pricing model must be FIXED or VARIABLE." };
  }

  const outing = await prisma.outing.findUnique({ where: { id: outingId } });
  if (!outing) return { error: "Outing not found" };
  if (outing.status === "SETTLED") return { error: "Outing is settled" };

  const participant = await prisma.outingParticipant.findUnique({
    where: { outingId_userId: { outingId, userId: session.userId } },
  });
  if (!participant || participant.role !== "OWNER") {
    return { error: "Only outing owner can create activities" };
  }

  const activity = await prisma.activity.create({
    data: {
      outingId,
      name,
      pricingModel,
      notes,
      createdBy: session.userId,
    },
  });

  await logEvent({
    groupId: outing.groupId,
    outingId,
    actorId: session.userId,
    eventType: "ACTIVITY_CREATED",
    entityType: "Activity",
    entityId: activity.id,
    metadata: { name, pricingModel },
  });

  revalidatePath(`/groups/${outing.groupId}/outings/${outingId}`);
  return { success: true, id: activity.id };
}

/**
 * Update activity status (OPEN → CLOSED). Only owner.
 * Closure validates: no disputed usage, all confirmations resolved, payments = responsibility.
 */
export async function closeActivityAction(activityId: string) {
  const session = await requireSession();
  const activity = await prisma.activity.findUnique({ where: { id: activityId } });
  if (!activity) return { error: "Activity not found" };
  if (activity.status !== "OPEN") return { error: "Activity is not open" };

  const outing = await prisma.outing.findUnique({ where: { id: activity.outingId! } });
  if (!outing) return { error: "Outing not found" };

  const participant = await prisma.outingParticipant.findUnique({
    where: { outingId_userId: { outingId: activity.outingId!, userId: session.userId } },
  });
  if (!participant || participant.role !== "OWNER") {
    return { error: "Only outing owner can close activities" };
  }

  // Validate closure
  const errors: string[] = [];

  if (activity.pricingModel === "FIXED") {
    // Check all usage records are confirmed or admin-confirmed
    const usageRecords = await prisma.usageRecord.findMany({
      where: { activityId },
      include: { confirmations: true },
    });

    for (const record of usageRecords) {
      if (record.status === "DISPUTED") {
        errors.push(`Usage record "${record.id}" is disputed.`);
      }
      const pendingConfirmations = record.confirmations.filter(c => c.status === "PENDING");
      if (pendingConfirmations.length > 0) {
        errors.push(`Usage record "${record.id}" has ${pendingConfirmations.length} pending confirmation(s).`);
      }
    }
  } else {
    // VARIABLE: check all participants have at least one line item (optional per spec)
    // Actually spec says participants can add items but it's not required
  }

  // Check payments cover responsibility
  const payments = await prisma.activityPayment.findMany({ where: { activityId } });
  const totalPaid = payments.reduce((sum, p) => sum + p.amountCentimes, 0);

  let totalResponsibility = 0;
  if (activity.pricingModel === "FIXED") {
    const usageRecords = await prisma.usageRecord.findMany({
      where: { activityId, status: { not: "DISPUTED" } },
    });
    for (const record of usageRecords) {
      const participants = await prisma.usageParticipant.findMany({
        where: { usageRecordId: record.id },
      });
      if (participants.length > 0) {
        const share = Math.floor(record.totalCentimes / participants.length);
        totalResponsibility += share * participants.length;
      }
    }
  } else {
    const lineItems = await prisma.lineItem.findMany({ where: { activityId } });
    totalResponsibility = lineItems.reduce((sum, item) => sum + item.priceCentimes, 0);
  }

  if (totalPaid !== totalResponsibility) {
    errors.push(`${totalPaid !== totalResponsibility ? Math.abs(totalResponsibility - totalPaid) : 0} DH of payments are missing (${totalPaid} paid vs ${totalResponsibility} responsibility).`);
  }

  if (errors.length > 0) {
    return { error: `Cannot close activity:\n${errors.join("\n")}` };
  }

  await prisma.activity.update({
    where: { id: activityId },
    data: { status: "CLOSED", endTime: new Date() },
  });

  await logEvent({
    groupId: outing.groupId,
    outingId: activity.outingId!,
    actorId: session.userId,
    eventType: "ACTIVITY_CLOSED",
    entityType: "Activity",
    entityId: activityId,
  });

  revalidatePath(`/groups/${outing.groupId}/outings/${activity.outingId}`);
  return { success: true };
}

/**
 * Delete an activity. Owner only, before outing is settled.
 */
export async function deleteActivityAction(activityId: string) {
  const session = await requireSession();
  const activity = await prisma.activity.findUnique({ where: { id: activityId } });
  if (!activity) return { error: "Not found" };

  const outing = await prisma.outing.findUnique({ where: { id: activity.outingId! } });
  if (!outing) return { error: "Outing not found" };
  if (outing.status === "SETTLED") return { error: "Outing is settled" };

  const participant = await prisma.outingParticipant.findUnique({
    where: { outingId_userId: { outingId: activity.outingId!, userId: session.userId } },
  });
  if (!participant || participant.role !== "OWNER") return { error: "Only owner" };

  await prisma.activity.delete({ where: { id: activityId } });

  revalidatePath(`/groups/${outing.groupId}/outings/${activity.outingId}`);
  return { success: true };
}
