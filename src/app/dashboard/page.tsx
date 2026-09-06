import { prisma } from "@/lib/prisma";
import { getSession } from "@/server/auth/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { logoutAction } from "@/server/auth/actions";
import { acceptInvitationAction, declineInvitationAction } from "@/server/groups/actions";
import SubmitButton from "@/app/components/SubmitButton";
import { formatDH } from "@/lib/utils";

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
      const outings = await prisma.outing.findMany({ where: { groupId: m.group.id }, include: { activities: true } });
      const outingCount = outings.length;
      const settledCount = outings.filter(o => o.status === "SETTLED").length;
      return { membership: m, memberCount, outingCount, settledCount };
    })
  );

  return (
    <div className="min-h-screen">
      <header className="header">
        <div className="max-w-5xl mx-auto px-5 py-3 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[10px] bg-brand flex items-center justify-center text-white font-bold text-sm">H</div>
            <span className="font-semibold text-[15px]">PoolSplit</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-[13px] text-muted">{user.displayName}</span>
            <Link href="/scan" className="btn-ghost text-[13px]">Scan</Link>
            <Link href="/profile" className="btn-ghost text-[13px]">Profile</Link>
            {user.isAdmin && <Link href="/admin" className="tag bg-warn-subtle text-warn">Admin</Link>}
            <form action={logoutAction}><button className="btn-ghost text-[13px]">Logout</button></form>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 py-8 space-y-8">
        {/* Hero: Financial identity */}
        <div className="space-y-1">
          <h1 className="text-[32px] leading-tight font-bold tracking-tight">Welcome, {user.displayName}</h1>
          <p className="text-muted text-[15px]">Your public ID: <span className="font-mono text-brand font-medium">{user.publicId}</span> — share it to get invited</p>
        </div>

        {/* Create group */}
        <div className="card-elevated p-5">
          <form action={async (formData: FormData) => {
            "use server";
            const { createGroupAction } = await import("@/server/groups/actions");
            await createGroupAction(formData);
          }} className="flex flex-col sm:flex-row gap-3">
            <input name="name" placeholder="New group name" required className="input flex-1" />
            <input type="hidden" name="dummy" value="" className="hidden" />
            <button className="btn-primary whitespace-nowrap">Create Group</button>
          </form>
        </div>

        {/* Invitations */}
        {invitations.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-[15px] font-semibold flex items-center gap-2">
              <span className="status-dot bg-warn"></span>Pending Invitations
              <span className="tag bg-warn-subtle text-warn">{invitations.length}</span>
            </h2>
            <div className="space-y-2">
              {invitations.map(inv => (
                <div key={inv.id} className="card-elevated p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-l-3 border-l-warn">
                  <div>
                    <div className="font-medium text-[15px]">{inv.group.name}</div>
                    <div className="text-[13px] text-muted">Group invitation pending</div>
                  </div>
                  <div className="flex gap-2">
                    <form action={async () => { "use server"; await acceptInvitationAction(inv.id); }}>
                      <SubmitButton className="btn-primary text-[13px] px-4 py-2">Accept</SubmitButton>
                    </form>
                    <form action={async () => { "use server"; await declineInvitationAction(inv.id); }}>
                      <button className="btn-secondary text-[13px] px-4 py-2">Decline</button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Groups */}
        <div className="space-y-3">
          <h2 className="text-[15px] font-semibold">My Groups</h2>
          {groupsWithStats.length === 0 ? (
            <div className="card border-dashed p-12 text-center">
              <div className="text-3xl mb-3 opacity-40">🎱</div>
              <p className="font-medium text-[15px]">No groups yet</p>
              <p className="text-[13px] text-muted mt-1">Create a group for your next outing</p>
            </div>
          ) : (
            <div className="space-y-2">
              {groupsWithStats.map(({ membership, memberCount, outingCount, settledCount }) => (
                <Link key={membership.group.id} href={`/groups/${membership.group.id}`} className="card card-hover p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-[14px] bg-brand-subtle text-brand flex items-center justify-center font-bold text-[15px] flex-shrink-0">🎱</div>
                    <div className="min-w-0">
                      <div className="font-medium text-[15px] truncate">{membership.group.name}</div>
                      <div className="text-[13px] text-muted">{memberCount} members · {outingCount} outings{settledCount > 0 ? ` · ${settledCount} settled` : ""}</div>
                    </div>
                  </div>
                  <span className="text-muted text-sm">→</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
