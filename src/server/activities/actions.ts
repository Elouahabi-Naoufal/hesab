"use server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/server/auth/session";
import { logEvent } from "@/server/audit";
import { revalidatePath } from "next/cache";
import { parseDHToCentimes } from "@/domain/money";
import { errMsg } from "@/lib/utils";
import { z } from "zod";

const createActivitySchema = z.object({
  groupId: z.string(),
  name: z.string().min(1).max(100),
  type: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  rate: z.coerce.number().optional(),
  notes: z.string().optional(),
  participantIds: z.array(z.string()).min(1),
});

export async function createActivityAction(formData: FormData) {
  const session = await requireSession();
  const groupId = formData.get("groupId") as string;
  const name = formData.get("name") as string;
  const participantIdsRaw = formData.get("participantIds") as string; // JSON array

  let participantIds: string[] = [];
  try {
    participantIds = JSON.parse(participantIdsRaw);
  } catch {
    return { error: "Invalid participants" };
  }

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) return { error: "Group not found" };
  if (group.status === "SETTLED" || group.status === "ARCHIVED" || group.status === "CHECKOUT") {
    return { error: "Cannot add activity after checkout" };
  }
  // Verify membership
  const member = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId: session.userId } } });
  if (!member) return { error: "Not a member" };
  if (group.ownerId !== session.userId) {
    // For MVP, only owner can create activities, but allow members? spec says owner can, members can view
    // We'll allow members for now but spec says owner only. Enforce owner.
    return { error: "Only owner can create activities" };
  }

  const startTime = formData.get("startTime") ? new Date(formData.get("startTime") as string) : null;
  const endTime = formData.get("endTime") ? new Date(formData.get("endTime") as string) : null;
  // Rate is DH-denominated (e.g. "60" or "59.99" per hour)
  const rateRaw = ((formData.get("rateDH") as string) || "").trim();
  let rate: number | null = null;
  if (rateRaw !== "") {
    try {
      rate = parseDHToCentimes(rateRaw, { minCentimes: 0, field: "Rate" });
    } catch (e: unknown) {
      return { error: errMsg(e) };
    }
  }

  const activity = await prisma.activity.create({
    data: {
      groupId,
      name,
      type: (formData.get("type") as string) || null,
      startTime,
      endTime,
      rate,
      notes: (formData.get("notes") as string) || null,
      createdBy: session.userId,
    },
  });

  // Create members
  for (const uid of participantIds) {
    await prisma.activityMember.create({ data: { activityId: activity.id, userId: uid } });
  }

  await logEvent({
    groupId,
    actorId: session.userId,
    eventType: "ACTIVITY_CREATED",
    entityType: "Activity",
    entityId: activity.id,
    metadata: { name },
  });

  revalidatePath(`/groups/${groupId}`);
  return { success: true, id: activity.id };
}

export async function deleteActivityAction(activityId: string) {
  const session = await requireSession();
  const activity = await prisma.activity.findUnique({ where: { id: activityId } });
  if (!activity) return { error: "Not found" };
  const group = await prisma.group.findUnique({ where: { id: activity.groupId } });
  if (!group) return { error: "Group not found" };
  if (group.ownerId !== session.userId) return { error: "Only owner" };
  if (group.status === "SETTLED" || group.status === "ARCHIVED") return { error: "Group settled" };
  if (group.status === "CHECKOUT") return { error: "Group in checkout, cannot delete activities" };

  await prisma.activity.delete({ where: { id: activityId } });
  revalidatePath(`/groups/${group.id}`);
  return { success: true };
}
