"use server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/server/auth/session";
import { z } from "zod";
import { generateGroupPublicToken } from "@/lib/utils";
import { parseDHToCentimes, formatDH } from "@/domain/money";
import { deductWalletTx, creditWalletTx } from "@/server/wallet/ledger";
import { parsePercentToBasisPoints, validateShareSet } from "@/domain/shares";
import { errMsg, errCode } from "@/lib/utils";
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

export async function updateContributionAction(groupId: string, amountDH: string | number) {
  const session = await requireSession();
  let amount: number;
  try {
    amount = parseDHToCentimes(amountDH, { minCentimes: 0, field: "Contribution" });
  } catch (e: unknown) {
    return { error: errMsg(e) };
  }
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) return { error: "Group not found" };
  const member = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: session.userId } },
  });
  if (!member) return { error: "Not a member" };

  const delta = amount - member.contribution;
  try {
    await prisma.$transaction(async (tx) => {
      if (delta > 0) {
        try {
          await deductWalletTx(tx, session.userId, delta, {
            type: "CONTRIBUTION",
            description: `Top-up contribution to ${group.name}`,
            groupId: group.id,
          });
        } catch (e: unknown) {
          if (errMsg(e).includes("Insufficient wallet")) {
            throw new Error(
              `Insufficient wallet: need ${formatDH(delta)} more but you have ${formatDH((await tx.wallet.findUnique({ where: { userId: session.userId } }))?.balance ?? 0)}. Deposit at /wallet.`
            );
          }
          throw e;
        }
      } else if (delta < 0) {
        await creditWalletTx(tx, session.userId, -delta, {
          type: "REFUND",
          description: `Contribution refund from ${group.name}`,
          groupId: group.id,
        });
      }
      await tx.groupMember.update({ where: { id: member.id }, data: { contribution: amount } });
    });
  } catch (e: unknown) {
    if (errMsg(e).includes("Insufficient wallet")) return { error: errMsg(e) };
    throw e;
  }
  revalidatePath(`/groups/${groupId}`);
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateMemberSharesAction(groupId: string, sharesRaw: string) {
  const session = await requireSession();
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) return { error: "Group not found" };
  if (group.ownerId !== session.userId) return { error: "Only owner can edit shares" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(sharesRaw);
  } catch {
    return { error: "Invalid shares format." };
  }
  if (!Array.isArray(parsed)) return { error: "Invalid shares format." };
  const members = await prisma.groupMember.findMany({ where: { groupId } });
  const memberIds = members.map(m => m.userId);
  let shares: Array<{ userId: string; basisPoints: number }>;
  try {
    shares = (parsed as Array<{ userId: string; percent: string | number }>).map(s => {
      if (!s || typeof s.userId !== "string") throw new Error("Invalid shares format.");
      return { userId: s.userId, basisPoints: parsePercentToBasisPoints(s.percent, "Share") };
    });
    validateShareSet(memberIds, shares);
  } catch (e: unknown) {
    return { error: errMsg(e) };
  }
  await prisma.$transaction(async (tx) => {
    for (const s of shares) {
      await tx.groupMember.update({
        where: { groupId_userId: { groupId, userId: s.userId } },
        data: { shareBasisPoints: s.basisPoints },
      });
    }
    await tx.activityEvent.create({
      data: {
        groupId,
        actorId: session.userId,
        eventType: "SHARES_UPDATED",
        entityType: "Group",
        entityId: groupId,
      },
    });
  });
  revalidatePath(`/groups/${groupId}`);
  return { success: true };
}

export async function inviteMemberAction(formData: FormData) {
  const session = await requireSession();
  const groupId = formData.get("groupId") as string;
  const publicId = formData.get("publicId") as string;
  const suggestedRaw = ((formData.get("suggestedContribution") as string) || "").trim();
  let suggested = 0;
  if (suggestedRaw !== "") {
    try {
      suggested = parseDHToCentimes(suggestedRaw, { minCentimes: 0, field: "Suggested contribution" });
    } catch (e: unknown) {
      return { error: errMsg(e) };
    }
  }

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

export async function acceptInvitationAction(invitationId: string, contributionDH?: string | number) {
  const session = await requireSession();
  const inv = await prisma.groupInvitation.findUnique({ where: { id: invitationId } });
  if (!inv) return { error: "Invitation not found" };
  if (inv.inviteeUserId !== session.userId) return { error: "Not your invitation" };
  if (inv.status !== "PENDING") return { error: "This invitation was already answered." };

  const group = await prisma.group.findUnique({ where: { id: inv.groupId } });
  if (!group) return { error: "Group not found" };

  let amount: number;
  const raw = contributionDH === undefined || contributionDH === null || String(contributionDH).trim() === ""
    ? null
    : contributionDH;
  try {
    amount = raw === null ? inv.suggestedContribution : parseDHToCentimes(raw, { minCentimes: 0, field: "Contribution" });
  } catch (e: unknown) {
    return { error: errMsg(e) };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.groupInvitation.findUnique({ where: { id: inv.id } });
      if (!fresh || fresh.status !== "PENDING") throw new Error("This invitation was already answered.");
      const alreadyMember = await tx.groupMember.findUnique({
        where: { groupId_userId: { groupId: inv.groupId, userId: session.userId } },
      });
      if (alreadyMember) throw new Error("You are already a member of this group.");

      if (amount > 0) {
        await deductWalletTx(tx, session.userId, amount, {
          type: "CONTRIBUTION",
          description: `Contribution to ${group.name}`,
          groupId: group.id,
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
  } catch (e: unknown) {
    if (errMsg(e).includes("Insufficient wallet")) return { error: errMsg(e) };
    if (errMsg(e).includes("already answered") || errMsg(e).includes("already a member")) return { error: errMsg(e) };
    if (errCode(e) === "P2002") return { error: "You are already a member of this group." };
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
    if (member.contribution > 0) {
      await creditWalletTx(tx, userId, member.contribution, {
        type: "REFUND",
        description: `Contribution refund from ${group.name} (removed by owner)`,
        groupId: group.id,
      });
    }
    await tx.groupMember.delete({ where: { id: member.id } });
    await tx.activityEvent.create({
      data: {
        groupId,
        actorId: session.userId,
        eventType: "MEMBER_REMOVED",
        entityType: "User",
        entityId: userId,
      },
    });
  });
  revalidatePath(`/groups/${groupId}`);
  return { success: true };
}
