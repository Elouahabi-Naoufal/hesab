import { prisma } from "@/lib/prisma";
import { getSession } from "@/server/auth/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { logoutAction } from "@/server/auth/actions";
import { acceptInvitationAction, declineInvitationAction } from "@/server/groups/actions";
import SubmitButton from "@/app/components/SubmitButton";

export default async function Dashboard() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) redirect("/login");

  const memberships = await prisma.groupMember.findMany({
    where: { userId: session.userId },
    include: { group: true },
    orderBy: { joinedAt: "desc" },
  });

  const invitations = await prisma.groupInvitation.findMany({
    where: { inviteeUserId: session.userId, status: "PENDING" },
    include: { group: true },
  });

  const groupsWithStats = await Promise.all(
    memberships.map(async (m) => {
      const memberCount = await prisma.groupMember.count({ where: { groupId: m.group.id } });
      const activityCount = await prisma.activity.count({ where: { groupId: m.group.id } });
      return { membership: m, memberCount, activityCount };
    })
  );

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 dark:bg-white flex items-center justify-center text-white dark:text-zinc-900 font-bold">H</div>
            <span className="font-semibold">Hesab</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-sm text-zinc-500">{user.displayName} • <span className="font-mono text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">{user.publicId}</span></span>
            <Link href="/scan" className="text-sm px-3 py-1 rounded-full border border-zinc-200 dark:border-zinc-700 flex items-center gap-1">📱 Scan</Link>
            <Link href="/profile" className="text-sm px-3 py-1 rounded-full border">Profile</Link>
            {user.isAdmin && <Link href="/admin" className="text-sm px-3 py-1 rounded-full bg-amber-100 text-amber-700 font-medium">Admin</Link>}
            <form action={logoutAction}><button className="text-sm px-3 py-1 rounded-full border border-zinc-200 dark:border-zinc-700">Logout</button></form>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Create group card */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold">Your ID: <span className="font-mono bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded text-sm">{user.publicId}</span></h2>
            <p className="text-sm text-zinc-500">Share this ID so friends can invite you to groups</p>
          </div>
          <form action={async (formData: FormData) => {
            "use server";
            const { createGroupAction } = await import("@/server/groups/actions");
            await createGroupAction(formData);
          }} className="flex gap-2">
            <input name="name" placeholder="New group name" required className="px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm" />
            <button className="px-4 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium whitespace-nowrap">Create Group</button>
          </form>
        </div>

        {/* Invitations */}
        {invitations.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold">Pending Invitations • {invitations.length}</h3>
            <div className="grid gap-3">
              {invitations.map(inv => (
                <div key={inv.id} className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{inv.group.name}</div>
                    <div className="text-sm text-zinc-600 dark:text-zinc-400">Group invitation pending</div>
                  </div>
                  <div className="flex gap-2 items-center">
                    <form action={async () => { "use server"; await acceptInvitationAction(inv.id); }} className="flex gap-2">
                      <SubmitButton className="px-4 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium">Accept</SubmitButton>
                    </form>
                    <form action={async () => { "use server"; await declineInvitationAction(inv.id); }}><button className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm">Decline</button></form>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Groups */}
        <div className="space-y-3">
          <h3 className="font-semibold">My Groups</h3>
          {groupsWithStats.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 p-10 text-center">
              <div className="text-4xl mb-3">🎱</div>
              <p className="font-medium">You aren&apos;t in any groups yet.</p>
              <p className="text-sm text-zinc-500 mb-4">Create a group for your next outing.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {groupsWithStats.map(({ membership, memberCount, activityCount }) => (
                <Link key={membership.group.id} href={`/groups/${membership.group.id}`} className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 flex items-center justify-between hover:shadow-md transition">
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      <span>🎱</span> {membership.group.name}
                      <span className={`text-xs px-2 py-0.5 rounded-full ${membership.group.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : membership.group.status === "SETTLED" ? "bg-zinc-100 text-zinc-600" : "bg-amber-100 text-amber-700"}`}>{membership.group.status}</span>
                    </div>
                    <div className="text-sm text-zinc-500">{memberCount} members • {activityCount} activities</div>
                  </div>
                  <div className="text-zinc-400">→</div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
