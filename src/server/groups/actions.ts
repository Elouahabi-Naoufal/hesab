"use server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/server/auth/session";
import { z } from "zod";
import { generateGroupPublicToken } from "@/lib/utils";
import { logEvent } from "@/server/audit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const createGroupSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
});

export async function createGroupAction(formData: FormData) {
  const session = await requireSession();
  const raw = {
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || undefined,
  };
  const parsed = createGroupSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const group = await prisma.group.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description,
      ownerId: session.userId,
      status: "PLANNING",
      publicToken: generateGroupPublicToken(),
    },
  });

  await prisma.groupMember.create({
    data: { groupId: group.id, userId: session.userId, role: "OWNER" },
  });

  await logEvent({ groupId: group.id, actorId: session.userId, eventType: "GROUP_CREATED", entityType: "Group", entityId: group.id, metadata: { name: group.name } });

  revalidatePath("/dashboard");
  redirect(`/groups/${group.id}`);
}

export async function inviteMemberAction(formData: FormData) {
  const session = await requireSession();
  const groupId = formData.get("groupId") as string;
  const publicId = formData.get("publicId") as string;

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) return { error: "Group not found" };
  if (group.ownerId !== session.userId) return { error: "Only owner can invite" };

  const invitedUser = await prisma.user.findUnique({ where: { publicId } });
  if (!invitedUser) return { error: "User not found with that ID" };

  const existingMember = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: invitedUser.id } },
  });
  if (existingMember) return { error: "User already a member" };

  const existingInvite = await prisma.groupInvitation.findFirst({
    where: { groupId, inviteeUserId: invitedUser.id, status: "PENDING" },
  });
  if (existingInvite) return { error: "Invitation already pending" };

  const inv = await prisma.groupInvitation.create({
    data: { groupId, inviterId: session.userId, inviteePublicId: publicId, inviteeUserId: invitedUser.id, status: "PENDING" },
  });

  await logEvent({ groupId, actorId: session.userId, eventType: "MEMBER_INVITED", entityType: "GroupInvitation", entityId: inv.id, metadata: { invitee: publicId } });
  revalidatePath(`/groups/${groupId}`);
  return { success: true };
}

export async function acceptInvitationAction(invitationId: string) {
  const session = await requireSession();
  const inv = await prisma.groupInvitation.findUnique({ where: { id: invitationId } });
  if (!inv) return { error: "Invitation not found" };
  if (inv.inviteeUserId !== session.userId) return { error: "Not your invitation" };
  if (inv.status !== "PENDING") return { error: "This invitation was already answered." };

  const group = await prisma.group.findUnique({ where: { id: inv.groupId } });
  if (!group) return { error: "Group not found" };

  try {
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.groupInvitation.findUnique({ where: { id: inv.id } });
      if (!fresh || fresh.status !== "PENDING") throw new Error("Already answered.");
      const alreadyMember = await tx.groupMember.findUnique({
        where: { groupId_userId: { groupId: inv.groupId, userId: session.userId } },
      });
      if (alreadyMember) throw new Error("Already a member of this group.");

      await tx.groupInvitation.update({ where: { id: inv.id }, data: { status: "ACCEPTED" } });
      await tx.groupMember.create({ data: { groupId: inv.groupId, userId: session.userId, role: "MEMBER" } });
      await tx.activityEvent.create({ data: { groupId: inv.groupId, actorId: session.userId, eventType: "MEMBER_JOINED", entityType: "User", entityId: session.userId } });
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("already answered") || msg.includes("already a member")) return { error: msg };
    throw e;
  }

  revalidatePath(`/groups/${inv.groupId}`);
  revalidatePath("/dashboard");
  return { success: true };
}

export async function declineInvitationAction(invitationId: string) {
  const session = await requireSession();
  const inv = await prisma.groupInvitation.findUnique({ where: { id: invitationId } });
  if (!inv) return { error: "Invitation not found" };
  if (inv.inviteeUserId !== session.userId) return { error: "Not your invitation" };
  await prisma.groupInvitation.update({ where: { id: inv.id }, data: { status: "DECLINED" } });
  revalidatePath("/dashboard");
  return { success: true };
}

export async function removeMemberAction(groupId: string, userId: string) {
  const session = await requireSession();
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) return { error: "Group not found" };
  if (group.ownerId !== session.userId) return { error: "Only owner" };
  if (userId === group.ownerId) return { error: "Cannot remove owner" };

  const member = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } } });
  if (!member) return { error: "Not a member" };

  await prisma.$transaction(async (tx) => {
    await tx.groupMember.delete({ where: { id: member.id } });
    await tx.activityEvent.create({ data: { groupId, actorId: session.userId, eventType: "MEMBER_REMOVED", entityType: "User", entityId: userId } });
  });
  revalidatePath(`/groups/${groupId}`);
  return { success: true };
}
