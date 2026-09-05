"use server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/server/auth/session";
import { z } from "zod";
import { generatePublicToken, generateGroupPublicToken } from "@/lib/utils";
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

  // Creator becomes owner member
  await prisma.groupMember.create({
    data: {
      groupId: group.id,
      userId: session.userId,
      role: "OWNER",
      contribution: 0,
    },
  });

  await logEvent({
    groupId: group.id,
    actorId: session.userId,
    eventType: "GROUP_CREATED",
    entityType: "Group",
    entityId: group.id,
    metadata: { name: group.name },
  });

  revalidatePath("/dashboard");
  redirect(`/groups/${group.id}`);
}

export async function updateContributionAction(groupId: string, amountCentimes: number) {
  const session = await requireSession();
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) throw new Error("Group not found");
  if (group.status !== "PLANNING" && group.status !== "ACTIVE") {
    return { error: "Cannot change contribution after checkout begins" };
  }
  const member = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: session.userId } },
  });
  if (!member) throw new Error("Not a member");

  await prisma.groupMember.update({
    where: { id: member.id },
    data: { contribution: amountCentimes },
  });
  revalidatePath(`/groups/${groupId}`);
  return { success: true };
}

export async function inviteMemberAction(formData: FormData) {
  const session = await requireSession();
  const groupId = formData.get("groupId") as string;
  const publicId = formData.get("publicId") as string;
  const suggested = parseInt((formData.get("suggestedContribution") as string) || "0", 10);

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) return { error: "Group not found" };
  if (group.ownerId !== session.userId) return { error: "Only owner can invite" };
  if (group.status !== "PLANNING" && group.status !== "ACTIVE") return { error: "Cannot invite after checkout" };

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
    data: {
      groupId,
      inviterId: session.userId,
      inviteePublicId: publicId,
      inviteeUserId: invitedUser.id,
      status: "PENDING",
      suggestedContribution: suggested,
    },
  });

  await logEvent({
    groupId,
    actorId: session.userId,
    eventType: "MEMBER_INVITED",
    entityType: "GroupInvitation",
    entityId: inv.id,
    metadata: { invitee: publicId },
  });

  revalidatePath(`/groups/${groupId}`);
  return { success: true };
}

export async function acceptInvitationAction(invitationId: string, contribution?: number) {
  const session = await requireSession();
  const inv = await prisma.groupInvitation.findUnique({ where: { id: invitationId } });
  if (!inv) return { error: "Invitation not found" };
  if (inv.inviteeUserId !== session.userId) return { error: "Not your invitation" };
  if (inv.status !== "PENDING") return { error: "Invitation not pending" };

  const group = await prisma.group.findUnique({ where: { id: inv.groupId } });
  if (!group) return { error: "Group not found" };
  if (group.status !== "PLANNING" && group.status !== "ACTIVE") return { error: "Group not accepting members" };

  const amount = contribution ?? inv.suggestedContribution;

  try {
    await prisma.$transaction(async (tx) => {
      // Wallet deduction - must have enough balance
      if (amount > 0) {
        let wallet = await tx.wallet.findUnique({ where: { userId: session.userId } });
        if (!wallet) {
          wallet = await tx.wallet.create({ data: { userId: session.userId, balance: 0 } });
        }
        if (wallet.balance < amount) {
          throw new Error(`Insufficient wallet: need ${(amount / 100).toFixed(2)} DH, have ${(wallet.balance / 100).toFixed(2)} DH. Deposit at /wallet.`);
        }
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: { decrement: amount } },
        });
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            amount: -amount,
            type: "CONTRIBUTION",
            description: `Contribution to ${group.name}`,
            groupId: group.id,
          },
        });
      }

      await tx.groupInvitation.update({ where: { id: inv.id }, data: { status: "ACCEPTED" } });
      await tx.groupMember.create({
        data: {
          groupId: inv.groupId,
          userId: session.userId,
          role: "MEMBER",
          contribution: amount,
        },
      });
      await tx.activityEvent.create({
        data: {
          groupId: inv.groupId,
          actorId: session.userId,
          eventType: "MEMBER_JOINED",
          entityType: "User",
          entityId: session.userId,
        },
      });
    });
  } catch (e: any) {
    if (e.message?.includes("Insufficient wallet")) return { error: e.message };
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
  if (group.status !== "PLANNING" && group.status !== "ACTIVE") return { error: "Cannot remove after checkout" };
  if (userId === group.ownerId) return { error: "Cannot remove owner" };

  await prisma.groupMember.delete({ where: { groupId_userId: { groupId, userId } } });
  await logEvent({ groupId, actorId: session.userId, eventType: "MEMBER_REMOVED", entityId: userId });
  revalidatePath(`/groups/${groupId}`);
  return { success: true };
}

export async function startCheckoutAction(groupId: string) {
  const session = await requireSession();
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) return { error: "Group not found" };
  if (group.ownerId !== session.userId) return { error: "Only owner can start checkout" };
  if (group.status !== "PLANNING" && group.status !== "ACTIVE") return { error: "Already in checkout" };

  await prisma.group.update({ where: { id: groupId }, data: { status: "CHECKOUT" } });
  await logEvent({ groupId, actorId: session.userId, eventType: "CHECKOUT_STARTED" });

  // Generate settlement immediately
  const { generateSettlement } = await import("@/server/settlement/actions");
  await generateSettlement(groupId);

  revalidatePath(`/groups/${groupId}`);
  return { success: true };
}
