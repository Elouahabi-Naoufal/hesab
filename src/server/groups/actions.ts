"use server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/server/auth/session";
import { z } from "zod";
import { generateGroupPublicToken } from "@/lib/utils";
import { userError } from "@/lib/errors";
import { getTranslations } from "next-intl/server";
import { logEvent } from "@/server/audit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const createGroupSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
});

export async function createGroupAction(formData: FormData) {
  const session = await requireSession();
  const t = await getTranslations("errors");
  const raw = {
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || undefined,
  };
  const parsed = createGroupSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = String(issue?.path?.[0] ?? "");
    if (field === "name") return { error: t("groupNameLen") };
    if (field === "description") return { error: t("groupDescLen") };
    return { error: t("invalidInput") };
  }

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
  const t = await getTranslations("errors");
  const groupId = formData.get("groupId") as string;
  const publicId = formData.get("publicId") as string;

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) return { error: t("groupMissing") };
  if (group.ownerId !== session.userId) return { error: t("onlyOwner") };

  const invitedUser = await prisma.user.findUnique({ where: { publicId } });
  if (!invitedUser) return { error: t("userMissing") };

  const existingMember = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: invitedUser.id } },
  });
  if (existingMember) return { error: t("alreadyMember") };

  const existingInvite = await prisma.groupInvitation.findFirst({
    where: { groupId, inviteeUserId: invitedUser.id, status: "PENDING" },
  });
  if (existingInvite) return { error: t("alreadyInvited") };

  const inv = await prisma.groupInvitation.create({
    data: { groupId, inviterId: session.userId, inviteePublicId: publicId, inviteeUserId: invitedUser.id, status: "PENDING" },
  });

  await logEvent({ groupId, actorId: session.userId, eventType: "MEMBER_INVITED", entityType: "GroupInvitation", entityId: inv.id, metadata: { invitee: publicId } });
  revalidatePath(`/groups/${groupId}`);
  return { success: true };
}

export async function acceptInvitationAction(invitationId: string) {
  const session = await requireSession();
  const t = await getTranslations("errors");
  const inv = await prisma.groupInvitation.findUnique({ where: { id: invitationId } });
  if (!inv) return { error: t("inviteNotFound") };
  if (inv.inviteeUserId !== session.userId) return { error: t("notYourInvite") };
  if (inv.status !== "PENDING") return { error: t("alreadyResponded") };

  const group = await prisma.group.findUnique({ where: { id: inv.groupId } });
  if (!group) return { error: t("groupMissing") };

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
    return { error: userError(e, "Could not accept this invitation. Please try again.") };
  }

  revalidatePath(`/groups/${inv.groupId}`);
  revalidatePath("/dashboard");
  return { success: true };
}

export async function declineInvitationAction(invitationId: string) {
  const session = await requireSession();
  const t = await getTranslations("errors");
  const inv = await prisma.groupInvitation.findUnique({ where: { id: invitationId } });
  if (!inv) return { error: t("inviteNotFound") };
  if (inv.inviteeUserId !== session.userId) return { error: t("notYourInvite") };
  await prisma.groupInvitation.update({ where: { id: inv.id }, data: { status: "DECLINED" } });
  revalidatePath("/dashboard");
  return { success: true };
}

export async function removeMemberAction(groupId: string, userId: string) {
  const session = await requireSession();
  const t = await getTranslations("errors");
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) return { error: t("groupMissing") };
  if (group.ownerId !== session.userId) return { error: t("onlyOwner") };
  if (userId === group.ownerId) return { error: t("cantRemoveOwner") };

  const member = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } } });
  if (!member) return { error: t("notGroupMember") };

  await prisma.$transaction(async (tx) => {
    await tx.groupMember.delete({ where: { id: member.id } });
    await tx.activityEvent.create({ data: { groupId, actorId: session.userId, eventType: "MEMBER_REMOVED", entityType: "User", entityId: userId } });
  });
  revalidatePath(`/groups/${groupId}`);
  return { success: true };
}
