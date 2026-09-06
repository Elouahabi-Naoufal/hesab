import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/server/auth/session";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Please log in first" }, { status: 401 });
    }

    const { token } = await req.json();
    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    // Find outing by public token
    const outing = await prisma.outing.findUnique({
      where: { publicToken: token },
      include: { group: true },
    });

    if (!outing) {
      return NextResponse.json({ error: "Invalid invitation token" }, { status: 404 });
    }

    // User must be a group member to join the outing
    const isGroupMember = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: outing.groupId, userId: session.userId } },
    });

    if (!isGroupMember) {
      return NextResponse.json({
        error: "You must be a member of this group to join the outing. Join the group first.",
      }, { status: 403 });
    }

    // Check if already an outing participant
    const existingParticipant = await prisma.outingParticipant.findUnique({
      where: { outingId_userId: { outingId: outing.id, userId: session.userId } },
    });

    if (existingParticipant) {
      return NextResponse.json({
        success: true,
        message: "You are already a participant in this outing",
        groupId: outing.groupId,
        outingId: outing.id,
      });
    }

    // Check if there's a pending invitation
    const invitation = await prisma.outingInvitation.findUnique({
      where: { outingId_inviteeUserId: { outingId: outing.id, inviteeUserId: session.userId } },
    });

    // Add as participant
    await prisma.outingParticipant.create({
      data: {
        outingId: outing.id,
        userId: session.userId,
        role: "MEMBER",
      },
    });

    // If there was a pending invitation, mark it as accepted
    if (invitation && invitation.status === "PENDING") {
      await prisma.outingInvitation.update({
        where: { id: invitation.id },
        data: { status: "ACCEPTED" },
      });
    }

    return NextResponse.json({
      success: true,
      message: `Joined outing "${outing.name}"`,
      groupId: outing.groupId,
      outingId: outing.id,
    });
  } catch (error) {
    console.error("Join outing error:", error);
    return NextResponse.json({ error: "Failed to join outing" }, { status: 500 });
  }
}
