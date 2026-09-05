import { prisma } from "@/lib/prisma";
import { getSession } from "@/server/auth/session";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";

export default async function CheckoutRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id: groupId } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  // Find the most recent outing for this group
  const outing = await prisma.outing.findFirst({
    where: { groupId },
    orderBy: { createdAt: "desc" },
  });

  if (outing) {
    redirect(`/groups/${groupId}/outings/${outing.id}/settlement`);
  }

  // Fallback: group page
  redirect(`/groups/${groupId}`);
}
