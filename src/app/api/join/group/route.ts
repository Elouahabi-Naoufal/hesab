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

    // Find group by public token
    const group = await prisma.group.findUnique({
      where: { publicToken: token },
    });

    if (!group) {
      return NextResponse.json({ error: "Invalid invitation token" }, { status: 404 });
    }

    // Check if already a member
    const existingMember = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: group.id, userId: session.userId } },
    });

    if (existingMember) {
      return NextResponse.json({
        success: true,
        message: "You are already a member of this group",
        groupId: group.id,
      });
    }

    // Check if there's a pending invitation
    const invitation = await prisma.groupInvitation.findFirst({
      where: {
        groupId: group.id,
        inviteeUserId: session.userId,
        status: "PENDING",
      },
    });

    // Add as member (direct join via QR code bypasses invitation)
    await prisma.groupMember.create({
      data: {
        groupId: group.id,
        userId: session.userId,
        role: "MEMBER",
      },
    });

    // If there was a pending invitation, mark it as accepted
    if (invitation) {
      await prisma.groupInvitation.update({
        where: { id: invitation.id },
        data: { status: "ACCEPTED" },
      });
    }

    return NextResponse.json({
      success: true,
      message: `Joined group "${group.name}"`,
      groupId: group.id,
    });
  } catch (error) {
    console.error("Join group error:", error);
    return NextResponse.json({ error: "Failed to join group" }, { status: 500 });
  }
}
