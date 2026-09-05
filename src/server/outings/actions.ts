"use server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/server/auth/session";
import { logEvent } from "@/server/audit";
import { revalidatePath } from "next/cache";
import { errMsg } from "@/lib/utils";

/**
 * Create an outing within a group. Only group members can create outings.
 * The creator becomes an OutingParticipant automatically.
 */
export async function createOutingAction(formData: FormData) {
  const session = await requireSession();
  const groupId = formData.get("groupId") as string;
  const name = ((formData.get("name") as string) || "").trim();
  const description = ((formData.get("description") as string) || "").trim() || undefined;

  if (!groupId) return { error: "Group is required." };
  if (!name) return { error: "Outing name is required." };

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) return { error: "Group not found" };

  const member = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: session.userId } },
  });
  if (!member) return { error: "Not a member of this group" };

  const outing = await prisma.outing.create({
    data: {
      groupId,
      name,
      description,
      status: "PLANNING",
      createdBy: session.userId,
    },
  });

  // Creator becomes an outing participant
  await prisma.outingParticipant.create({
    data: {
      outingId: outing.id,
      userId: session.userId,
      role: "OWNER",
    },
  });

  await logEvent({
    groupId,
    outingId: outing.id,
    actorId: session.userId,
    eventType: "OUTING_CREATED",
    entityType: "Outing",
    entityId: outing.id,
    metadata: { name },
  });

  revalidatePath(`/groups/${groupId}`);
  return { success: true, id: outing.id };
}

/**
 * Invite a group member to an outing. Only outing OWNER can invite.
 * Invited user must be a group member.
 */
export async function inviteToOutingAction(outingId: string, userId: string) {
  const session = await requireSession();
  const outing = await prisma.outing.findUnique({ where: { id: outingId } });
  if (!outing) return { error: "Outing not found" };

  const inviter = await prisma.outingParticipant.findUnique({
    where: { outingId_userId: { outingId, userId: session.userId } },
  });
  if (!inviter || inviter.role !== "OWNER") return { error: "Only outing owner can invite" };

  // Must be a group member
  const groupMember = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: outing.groupId, userId } },
  });
  if (!groupMember) return { error: "User is not a group member" };

  // Check if already a participant
  const existing = await prisma.outingParticipant.findUnique({
    where: { outingId_userId: { outingId, userId } },
  });
  if (existing) return { error: "Already a participant" };

  await prisma.outingParticipant.create({
    data: { outingId, userId, role: "MEMBER" },
  });

  await logEvent({
    groupId: outing.groupId,
    outingId,
    actorId: session.userId,
    eventType: "OUTING_MEMBER_INVITED",
    entityType: "OutingParticipant",
    entityId: userId,
  });

  revalidatePath(`/groups/${outing.groupId}/outings/${outingId}`);
  return { success: true };
}

/**
 * Invite an outsider (non-group-member) to an outing.
 * The outsider must already have a Hesab account.
 * Admin invites them, they accept, they become an outing participant
 * but NOT a group member.
 */
export async function inviteOutsiderToOutingAction(outingId: string, userPublicId: string) {
  const session = await requireSession();
  const outing = await prisma.outing.findUnique({ where: { id: outingId } });
  if (!outing) return { error: "Outing not found" };

  const inviter = await prisma.outingParticipant.findUnique({
    where: { outingId_userId: { outingId, userId: session.userId } },
  });
  if (!inviter || inviter.role !== "OWNER") return { error: "Only outing owner can invite" };

  const invitee = await prisma.user.findUnique({ where: { publicId: userPublicId } });
  if (!invitee) return { error: "User not found" };

  // Check not already invited
  const existingInvite = await prisma.outingInvitation.findUnique({
    where: { outingId_inviteeUserId: { outingId, inviteeUserId: invitee.id } },
  });
  if (existingInvite) return { error: "Already invited" };

  // Check not already a participant
  const existingParticipant = await prisma.outingParticipant.findUnique({
    where: { outingId_userId: { outingId, userId: invitee.id } },
  });
  if (existingParticipant) return { error: "Already a participant" };

  const invite = await prisma.outingInvitation.create({
    data: {
      outingId,
      inviterId: session.userId,
      inviteeUserId: invitee.id,
      status: "PENDING",
    },
  });

  await logEvent({
    groupId: outing.groupId,
    outingId,
    actorId: session.userId,
    eventType: "OUTING_OUTSIDER_INVITED",
    entityType: "OutingInvitation",
    entityId: invite.id,
    metadata: { invitee: userPublicId },
  });

  revalidatePath(`/groups/${outing.groupId}/outings/${outingId}`);
  return { success: true };
}

/**
 * Accept an outing invitation. Adds user as an outing participant.
 */
export async function acceptOutingInvitationAction(invitationId: string) {
  const session = await requireSession();
  const invite = await prisma.outingInvitation.findUnique({ where: { id: invitationId } });
  if (!invite) return { error: "Invitation not found" };
  if (invite.inviteeUserId !== session.userId) return { error: "Not your invitation" };
  if (invite.status !== "PENDING") return { error: "Already responded" };

  await prisma.$transaction(async (tx) => {
    const fresh = await tx.outingInvitation.findUnique({ where: { id: invitationId } });
    if (!fresh || fresh.status !== "PENDING") throw new Error("Already responded");

    await tx.outingInvitation.update({
      where: { id: invitationId },
      data: { status: "ACCEPTED" },
    });

    await tx.outingParticipant.create({
      data: {
        outingId: invite.outingId,
        userId: session.userId,
        role: "MEMBER",
      },
    });
  });

  const outing = await prisma.outing.findUnique({ where: { id: invite.outingId } });
  if (outing) {
    revalidatePath(`/groups/${outing.groupId}/outings/${invite.outingId}`);
  }
  return { success: true };
}

/**
 * Decline an outing invitation.
 */
export async function declineOutingInvitationAction(invitationId: string) {
  const session = await requireSession();
  const invite = await prisma.outingInvitation.findUnique({ where: { id: invitationId } });
  if (!invite) return { error: "Invitation not found" };
  if (invite.inviteeUserId !== session.userId) return { error: "Not your invitation" };

  await prisma.outingInvitation.update({
    where: { id: invitationId },
    data: { status: "DECLINED" },
  });

  const outing = await prisma.outing.findUnique({ where: { id: invite.outingId } });
  if (outing) {
    revalidatePath(`/groups/${outing.groupId}/outings/${invite.outingId}`);
  }
  return { success: true };
}

/**
 * Request to leave an outing. Only participants with no financial data
 * can be directly removed by admin. Others must request to leave.
 * Admin approves or rejects.
 */
export async function requestLeaveOutingAction(outingId: string) {
  const session = await requireSession();
  const participant = await prisma.outingParticipant.findUnique({
    where: { outingId_userId: { outingId, userId: session.userId } },
  });
  if (!participant) return { error: "Not a participant" };
  if (participant.role === "OWNER") return { error: "Owner cannot leave" };

  // Check if user has financial data in the outing
  const hasActivityPayments = await prisma.activityPayment.findFirst({
    where: { activity: { outingId }, userId: session.userId },
  });
  const hasLineItems = await prisma.lineItem.findFirst({
    where: { activity: { outingId }, userId: session.userId },
  });
  const hasUsageRecords = await prisma.usageRecord.findFirst({
    where: { activity: { outingId }, createdById: session.userId },
  });

  const hasFinancialData = hasActivityPayments || hasLineItems || hasUsageRecords;

  // Remove directly if no financial data
  if (!hasFinancialData) {
    await prisma.outingParticipant.delete({
      where: { outingId_userId: { outingId, userId: session.userId } },
    });
    const outing = await prisma.outing.findUnique({ where: { id: outingId } });
    if (outing) revalidatePath(`/groups/${outing.groupId}/outings/${outingId}`);
    return { success: true, removed: true };
  }

  // Has financial data — needs admin approval (for now, auto-remove but preserve history)
  await prisma.outingParticipant.delete({
    where: { outingId_userId: { outingId, userId: session.userId } },
  });

  const outing = await prisma.outing.findUnique({ where: { id: outingId } });
  if (outing) {
    await logEvent({
      groupId: outing.groupId,
      outingId,
      actorId: session.userId,
      eventType: "OUTING_MEMBER_LEFT",
      entityType: "User",
      entityId: session.userId,
    });
    revalidatePath(`/groups/${outing.groupId}/outings/${outingId}`);
  }
  return { success: true, removed: true, hadFinancialData: true };
}

/**
 * Admin removes a participant from an outing.
 * If they have financial data, their data is preserved but they can't participate further.
 */
export async function removeOutingParticipantAction(outingId: string, userId: string) {
  const session = await requireSession();
  const outing = await prisma.outing.findUnique({ where: { id: outingId } });
  if (!outing) return { error: "Outing not found" };

  const caller = await prisma.outingParticipant.findUnique({
    where: { outingId_userId: { outingId, userId: session.userId } },
  });
  if (!caller || caller.role !== "OWNER") return { error: "Only owner can remove" };
  if (userId === session.userId) return { error: "Cannot remove yourself" };

  const target = await prisma.outingParticipant.findUnique({
    where: { outingId_userId: { outingId, userId } },
  });
  if (!target) return { error: "Not a participant" };

  await prisma.outingParticipant.delete({
    where: { outingId_userId: { outingId, userId } },
  });

  await logEvent({
    groupId: outing.groupId,
    outingId,
    actorId: session.userId,
    eventType: "OUTING_MEMBER_REMOVED",
    entityType: "User",
    entityId: userId,
  });

  revalidatePath(`/groups/${outing.groupId}/outings/${outingId}`);
  return { success: true };
}

/**
 * Activate an outing (PLANNING → ACTIVE). Owner only.
 */
export async function activateOutingAction(outingId: string) {
  const session = await requireSession();
  const outing = await prisma.outing.findUnique({ where: { id: outingId } });
  if (!outing) return { error: "Outing not found" };

  const participant = await prisma.outingParticipant.findUnique({
    where: { outingId_userId: { outingId, userId: session.userId } },
  });
  if (!participant || participant.role !== "OWNER") return { error: "Only owner" };
  if (outing.status !== "PLANNING") return { error: "Outing is not in PLANNING status" };

  await prisma.outing.update({
    where: { id: outingId },
    data: { status: "ACTIVE" },
  });

  await logEvent({
    groupId: outing.groupId,
    outingId,
    actorId: session.userId,
    eventType: "OUTING_ACTIVATED",
    entityType: "Outing",
    entityId: outingId,
  });

  revalidatePath(`/groups/${outing.groupId}/outings/${outingId}`);
  return { success: true };
}
