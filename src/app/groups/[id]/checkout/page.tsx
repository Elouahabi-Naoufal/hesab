import { prisma } from "@/lib/prisma";
import { getSession } from "@/server/auth/session";
import { redirect, notFound } from "next/navigation";

export default async function CheckoutRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id: groupId } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const outing = await prisma.outing.findFirst({
    where: { groupId },
    orderBy: { createdAt: "desc" },
  });

  if (outing) {
    redirect(`/groups/${groupId}/outings/${outing.id}/settlement`);
  }

  redirect(`/groups/${groupId}`);
}
