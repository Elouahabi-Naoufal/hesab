import { prisma } from "@/lib/prisma";
import { getSession } from "@/server/auth/session";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import QrInvite from "@/components/QrInvite";

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const group = await prisma.group.findUnique({ where: { id } });
  if (!group) notFound();

  const member = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId: id, userId: session.userId } } });
  if (!member) return <div className="p-10 text-center">You are not a member of this group.</div>;

  const isOwner = group.ownerId === session.userId;
  const members = await prisma.groupMember.findMany({ where: { groupId: id }, include: { user: true } });
  const outings = await prisma.outing.findMany({ where: { groupId: id }, orderBy: { createdAt: "desc" } });
  const invitations = await prisma.groupInvitation.findMany({ where: { groupId: id, status: "PENDING" } });

  const outingsWithStats = await Promise.all(
    outings.map(async (o) => {
      const activityCount = await prisma.activity.count({ where: { outingId: o.id } });
      const participantCount = await prisma.outingParticipant.count({ where: { outingId: o.id } });
      return { ...o, activityCount, participantCount };
    })
  );

  return (
    <div className="min-h-screen">
      <header className="header">
        <div className="max-w-5xl mx-auto px-5 py-3 flex items-center gap-3">
          <Link href="/dashboard" className="p-2 rounded-[10px] hover:bg-elevated transition text-muted">←</Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-[18px] truncate">{group.name}</h1>
            <p className="text-[13px] text-muted">{members.length} members · {outings.length} outings</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 py-8 space-y-8">
        {/* Members */}
        <div className="card-elevated p-5 space-y-4">
          <h2 className="text-[15px] font-semibold">Members</h2>
          <div className="space-y-1">
            {members.map(m => (
              <div key={m.id} className="flex items-center justify-between py-2.5 px-3 rounded-[10px] hover:bg-elevated transition">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-brand-subtle text-brand flex items-center justify-center text-[13px] font-bold">{m.user.displayName[0]}</div>
                  <div>
                    <span className="font-medium text-[14px]">{m.user.displayName}</span>
                    {m.role === "OWNER" && <span className="tag bg-brand-subtle text-brand ml-2">owner</span>}
                  </div>
                </div>
                {isOwner && m.userId !== group.ownerId && (
                  <form action={async () => {
                    "use server";
                    const { removeMemberAction } = await import("@/server/groups/actions");
                    await removeMemberAction(id, m.userId);
                  }}>
                    <button className="text-[12px] text-danger hover:underline">Remove</button>
                  </form>
                )}
              </div>
            ))}
          </div>

          {isOwner && (
            <div className="pt-3 border-t border-border">
              <h3 className="text-[13px] font-medium text-muted mb-2">Invite Member</h3>
              <form action={async (formData: FormData) => {
                "use server";
                const { inviteMemberAction } = await import("@/server/groups/actions");
                await inviteMemberAction(formData);
              }} className="flex gap-2">
                <input type="hidden" name="groupId" value={id} />
                <input name="publicId" placeholder="usr_XXXXXX" required className="input flex-1" />
                <button className="btn-primary text-[13px] px-4 py-2">Invite</button>
              </form>
              {invitations.length > 0 && (
                <div className="text-[12px] text-muted mt-2">{invitations.length} pending invite(s)</div>
              )}
            </div>
          )}

          {isOwner && group.publicToken && (
            <div className="pt-3 border-t border-border">
              <QrInvite token={group.publicToken} type="group" name={group.name} />
            </div>
          )}
        </div>

        {/* Outings */}
        <div className="card-elevated p-5 space-y-4">
          <h2 className="text-[15px] font-semibold">Outings</h2>
          <div className="space-y-2">
            {outingsWithStats.length === 0 ? (
              <div className="text-center py-8 text-[13px] text-muted">No outings yet</div>
            ) : (
              outingsWithStats.map(o => (
                <Link key={o.id} href={`/groups/${id}/outings/${o.id}`} className="card card-hover p-4 flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="font-medium text-[15px] truncate">{o.name}</div>
                    <div className="text-[13px] text-muted">{o.status} · {o.participantCount} participants · {o.activityCount} activities</div>
                  </div>
                  <span className="text-muted text-sm">→</span>
                </Link>
              ))
            )}
          </div>

          {isOwner && (
            <details className="rounded-[14px] border border-border p-4">
              <summary className="text-[14px] font-medium cursor-pointer text-muted">+ Create Outing</summary>
              <form action={async (formData: FormData) => {
                "use server";
                const { createOutingAction } = await import("@/server/outings/actions");
                await createOutingAction(formData);
              }} className="space-y-3 mt-3">
                <input type="hidden" name="groupId" value={id} />
                <input name="name" placeholder="Friday Pool Night" required className="input" />
                <input name="description" placeholder="Description (optional)" className="input" />
                <div>
                  <div className="text-[12px] font-medium text-muted mb-2">Who will participate?</div>
                  <div className="space-y-1">
                    {members.map(m => (
                      <label key={m.userId} className="flex items-center gap-2.5 text-[14px] py-1.5 px-2 rounded-[10px] hover:bg-elevated transition cursor-pointer">
                        <input type="checkbox" name="participantIds" value={m.userId} defaultChecked disabled={m.userId === group.ownerId} className="accent-brand" />
                        <span>{m.user.displayName}</span>
                        {m.userId === group.ownerId && <span className="text-[12px] text-muted">(you)</span>}
                      </label>
                    ))}
                  </div>
                </div>
                <button className="btn-primary w-full py-2.5">Create Outing</button>
              </form>
            </details>
          )}
        </div>
      </main>
    </div>
  );
}
