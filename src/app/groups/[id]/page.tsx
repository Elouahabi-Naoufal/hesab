import { prisma } from "@/lib/prisma";
import { getSession } from "@/server/auth/session";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import QrInvite from "@/components/QrInvite";
import { formatDH } from "@/lib/utils";

function activityTotal(a: any): number {
  if (a.pricingModel === "FIXED") {
    return (a.usageRecords ?? [])
      .filter((r: any) => r.status !== "DISPUTED")
      .reduce((s: number, r: any) => s + (r.totalCentimes ?? 0), 0);
  }
  return (a.lineItems ?? []).reduce((s: number, l: any) => s + (l.priceCentimes ?? 0), 0);
}

function myResponsibility(a: any, userId: string): number {
  if (a.pricingModel === "FIXED") {
    let mine = 0;
    for (const r of (a.usageRecords ?? []).filter((r: any) => r.status !== "DISPUTED")) {
      const parts = r.participants ?? [];
      if (parts.some((pp: any) => pp.userId === userId) && parts.length > 0) {
        mine += Math.floor((r.totalCentimes ?? 0) / parts.length);
      }
    }
    return mine;
  }
  return (a.lineItems ?? []).filter((l: any) => l.userId === userId).reduce((s: number, l: any) => s + (l.priceCentimes ?? 0), 0);
}

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
  const outings = await prisma.outing.findMany({
    where: { groupId: id },
    orderBy: { createdAt: "desc" },
    include: {
      activities: {
        include: {
          payments: true,
          usageRecords: { include: { participants: true } },
          lineItems: true,
        },
      },
      _count: { select: { participants: true } },
    },
  });
  const invitations = await prisma.groupInvitation.findMany({ where: { groupId: id, status: "PENDING" } });

  const outingsWithStats = outings.map(o => {
    const activityCount = o.activities.length;
    const participantCount = o._count.participants;
    const expenseTotal = o.activities.reduce((s, a) => s + activityTotal(a), 0);
    const myPaid = o.activities.reduce(
      (s, a) => s + (a.payments ?? []).filter((p: any) => p.userId === session.userId).reduce((s2: number, p: any) => s2 + p.amountCentimes, 0),
      0
    );
    const myResp = o.activities.reduce((s, a) => s + myResponsibility(a, session.userId), 0);
    return { ...o, activityCount, participantCount, expenseTotal, myNet: myPaid - myResp };
  });

  const groupSpent = outingsWithStats.reduce((s, o) => s + o.expenseTotal, 0);
  const settledOutings = outingsWithStats.filter(o => o.status === "SETTLED").length;
  const myGroupNet = outingsWithStats.reduce((s, o) => s + o.myNet, 0);

  return (
    <div className="min-h-screen">
      <header className="header">
        <div className="header-inner">
          <Link href="/dashboard" className="p-2 rounded-[10px] hover:bg-elevated transition text-muted">←</Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-[18px] truncate tracking-tight">{group.name}</h1>
            <p className="text-[13px] text-muted">{members.length} members · {outings.length} outings</p>
          </div>
          <div className="text-right flex-shrink-0">
            <div className={`money text-[16px] font-bold ${myGroupNet > 0 ? "text-success" : myGroupNet < 0 ? "text-danger" : "text-muted"}`}>
              {myGroupNet > 0 ? "+" : ""}{formatDH(myGroupNet)}
            </div>
            <div className="text-[12px] text-muted">your position</div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 py-8 space-y-6">
        {/* Group financial strip */}
        <section className="surface-20 p-5">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-[12px] text-muted mb-1">Spent</div>
              <div className="money text-[18px] font-bold">{formatDH(groupSpent)}</div>
            </div>
            <div>
              <div className="text-[12px] text-muted mb-1">Outings</div>
              <div className="money text-[18px] font-bold">{outings.length}</div>
            </div>
            <div>
              <div className="text-[12px] text-muted mb-1">Settled</div>
              <div className="money text-[18px] font-bold">{settledOutings}</div>
            </div>
          </div>
          {outings.length > 0 && (
            <div className="mt-4">
              <div className="progress-track">
                <div className="progress-fill settle" style={{ width: `${Math.round((settledOutings / outings.length) * 100)}%` }} />
              </div>
            </div>
          )}
        </section>

        {/* Members */}
        <section className="card-elevated p-5 space-y-4">
          <h2 className="text-[15px] font-semibold">Members</h2>
          <div className="space-y-1">
            {members.map(m => (
              <div key={m.id} className="flex items-center justify-between py-2.5 px-3 rounded-[10px] hover:bg-elevated transition">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-brand-subtle text-brand flex items-center justify-center text-[13px] font-bold">{m.user.displayName[0]}</div>
                  <span className="font-medium text-[14px]">{m.user.displayName}</span>
                  {m.role === "OWNER" && <span className="tag bg-brand-subtle text-brand">owner</span>}
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
              <h3 className="text-[13px] font-medium text-muted mb-2">Invite member</h3>
              <form action={async (formData: FormData) => {
                "use server";
                const { inviteMemberAction } = await import("@/server/groups/actions");
                await inviteMemberAction(formData);
              }} className="flex gap-2">
                <input type="hidden" name="groupId" value={id} />
                <input name="publicId" placeholder="usr_XXXXXX" required className="input flex-1" />
                <button className="btn-primary text-[13px] px-4">Invite</button>
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
        </section>

        {/* Outings */}
        <section className="card-elevated p-5 space-y-4">
          <h2 className="text-[15px] font-semibold">Outings</h2>
          <div className="space-y-2.5">
            {outingsWithStats.length === 0 ? (
              <div className="text-center py-8 text-[13px] text-muted">No outings yet</div>
            ) : (
              outingsWithStats.map(o => (
                <Link key={o.id} href={`/groups/${id}/outings/${o.id}`} className="card card-hover p-4 block">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-[15px] truncate">{o.name}</span>
                        {o.status === "SETTLED" ? (
                          <span className="tag bg-success-subtle text-success"><span className="status-dot bg-success"></span>Settled</span>
                        ) : o.status === "ACTIVE" ? (
                          <span className="tag bg-brand-subtle text-brand"><span className="status-dot bg-brand"></span>Active</span>
                        ) : (
                          <span className="tag bg-elevated text-muted"><span className="status-dot bg-muted"></span>{o.status}</span>
                        )}
                      </div>
                      <div className="text-[13px] text-muted mt-1">
                        {o.participantCount} participants · {o.activityCount} activities · {formatDH(o.expenseTotal)}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className={`money text-[15px] font-bold ${o.myNet > 0 ? "text-success" : o.myNet < 0 ? "text-danger" : "text-muted"}`}>
                        {o.myNet > 0 ? "+" : ""}{formatDH(o.myNet)}
                      </div>
                      <div className="text-muted text-sm">→</div>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>

          {isOwner && (
            <details className="rounded-[14px] border border-border p-4">
              <summary className="text-[14px] font-medium cursor-pointer text-muted"><span className="chev">›</span> Create outing</summary>
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
        </section>
      </main>
    </div>
  );
}
