import { prisma } from "@/lib/prisma";
import { getSession } from "@/server/auth/session";
import { redirect, notFound } from "next/navigation";
import { formatDH } from "@/lib/utils";
import Link from "next/link";
import { IconCheck } from "@/components/icons";

export default async function SettlementPage({ params }: { params: Promise<{ id: string; outingId: string }> }) {
  const { id: groupId, outingId } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const outing = await prisma.outing.findUnique({ where: { id: outingId } });
  if (!outing || outing.groupId !== groupId) notFound();

  const participant = await prisma.outingParticipant.findUnique({
    where: { outingId_userId: { outingId, userId: session.userId } },
  });
  if (!participant) return <div className="p-10 text-center">You are not a participant.</div>;
  const isOwner = participant.role === "OWNER";

  const settlement = await prisma.settlement.findFirst({ where: { outingId } });
  if (!settlement) {
    const openCount = await prisma.activity.count({ where: { outingId, status: "OPEN" } });
    const canGenerate = isOwner && openCount === 0;
    return (
      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8 space-y-8">
        <div>
          <nav aria-label="Breadcrumb" className="text-[13px] text-muted mb-1.5">
            <Link href="/dashboard" className="hover:text-foreground transition-colors">Groups</Link>
            <span className="mx-1.5">/</span>
            <Link href={`/groups/${groupId}`} className="hover:text-foreground transition-colors">Group</Link>
            <span className="mx-1.5">/</span>
            <Link href={`/groups/${groupId}/outings/${outingId}`} className="hover:text-foreground transition-colors">{outing.name}</Link>
            <span className="mx-1.5">/</span>
            <span className="text-foreground font-medium">Settlement</span>
          </nav>
          <h1 className="font-extrabold text-[26px] tracking-tight">Settlement</h1>
        </div>
        <div className="card border-dashed p-10 text-center space-y-3">
          <p className="font-semibold text-[15px]">No settlement yet</p>
          {!isOwner ? (
            <p className="text-[13px] text-muted">The outing owner hasn&apos;t generated the settlement yet.</p>
          ) : openCount > 0 ? (
            <p className="text-[13px] text-muted">Close all activities first, then generate the settlement.</p>
          ) : (
            <form action={async () => {
              "use server";
              const { finalizeSettlementAction } = await import("@/server/settlement/actions");
              await finalizeSettlementAction(outingId);
            }}>
              <button className="btn-navy">Generate settlement</button>
            </form>
          )}
          <div>
            <Link href={`/groups/${groupId}/outings/${outingId}`} className="text-[13px] text-brand hover:underline">Back to outing</Link>
          </div>
        </div>
      </main>
    );
  }

  const transfers = await prisma.settlementTransfer.findMany({ where: { settlementId: settlement.id } });
  const allParticipants = await prisma.outingParticipant.findMany({ where: { outingId }, include: { user: true } });
  const allUsers = allParticipants.map(p => p.user);
  const userMap = new Map(allUsers.map(u => [u.id, u.displayName]));

  const activities = await prisma.activity.findMany({
    where: { outingId },
    include: { products: true, usageRecords: { include: { participants: true } }, lineItems: true, payments: true },
  });

  const memberBalances = allParticipants.map(p => {
    const paid = activities.reduce((s, a) => s + a.payments.filter(pay => pay.userId === p.userId).reduce((s2, pay) => s2 + pay.amountCentimes, 0), 0);
    const resp = activities.reduce((s, a) => {
      if (a.pricingModel === "FIXED") {
        let myResp = 0;
        for (const r of a.usageRecords) {
          if (r.participants.find((pp: any) => pp.userId === p.userId) && r.participants.length > 0) {
            myResp += Math.floor(r.totalCentimes / r.participants.length);
          }
        }
        return s + myResp;
      } else {
        return s + a.lineItems.filter(l => l.userId === p.userId).reduce((s2, l) => s2 + l.priceCentimes, 0);
      }
    }, 0);
    return { userId: p.userId, displayName: p.user.displayName, totalPaid: paid, totalResponsibility: resp, netBalance: paid - resp };
  });

  const me = memberBalances.find(b => b.userId === session.userId);
  const myNet = me?.netBalance ?? 0;
  const myTransfersIn = transfers.filter(t => t.toUserId === session.userId);
  const myTransfersOut = transfers.filter(t => t.fromUserId === session.userId);
  const toReceive = myTransfersIn.reduce((s, t) => s + t.amountCentimes, 0);
  const toPay = myTransfersOut.reduce((s, t) => s + t.amountCentimes, 0);

  const doneCount = transfers.filter(t => t.status !== "PENDING").length;
  const allSettled = transfers.length > 0 && doneCount === transfers.length;

  return (
    <main className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8 space-y-8">
      <div>
        <nav aria-label="Breadcrumb" className="text-[13px] text-muted mb-1.5">
          <Link href="/dashboard" className="hover:text-foreground transition-colors">Groups</Link>
          <span className="mx-1.5">/</span>
          <Link href={`/groups/${groupId}`} className="hover:text-foreground transition-colors">Group</Link>
          <span className="mx-1.5">/</span>
          <Link href={`/groups/${groupId}/outings/${outingId}`} className="hover:text-foreground transition-colors">{outing.name}</Link>
          <span className="mx-1.5">/</span>
          <span className="text-foreground font-medium">Settlement</span>
        </nav>
        <div className="flex items-end justify-between gap-4">
          <h1 className="font-extrabold text-[26px] tracking-tight">Settlement</h1>
          {isOwner && (
            <div className="flex gap-2 flex-shrink-0">
              <form action={async () => {
                "use server";
                const { recalculateSettlementAction } = await import("@/server/settlement/actions");
                await recalculateSettlementAction(outingId);
              }}>
                <button className="btn-secondary btn-sm">Recalculate</button>
              </form>
              <form action={async () => {
                "use server";
                const { finalizeSettlementAction } = await import("@/server/settlement/actions");
                await finalizeSettlementAction(outingId);
              }}>
                <button className="btn-navy btn-sm">Finalize</button>
              </form>
            </div>
          )}
        </div>
      </div>
        <div>
          <h1 className="font-extrabold text-[26px] tracking-tight">Settlement</h1>
          <p className="text-[13px] text-muted">{outing.name}</p>
        </div>
        {/* Personal result — borderless band */}
        <section>
          <div className="text-[13px] text-muted mb-1">Your settlement · {outing.name}</div>
          <div className={`money-hero text-[40px] font-extrabold ${myNet > 0 ? "text-success" : myNet < 0 ? "text-danger" : "text-muted"}`}>
            {myNet > 0 ? "+" : ""}{formatDH(myNet)}
          </div>
          <div className="flex items-center gap-5 mt-3 text-[14px]">
            <span className="text-muted">To receive <span className="money font-bold text-success ml-1">{formatDH(toReceive)}</span></span>
            <span className="w-px h-4 bg-border" aria-hidden="true"></span>
            <span className="text-muted">To pay <span className="money font-bold text-danger ml-1">{formatDH(toPay)}</span></span>
          </div>
          {transfers.length > 0 && (
            <div className="mt-4 max-w-xs">
              <div className="progress-track">
                <div className="progress-fill navy" style={{ width: `${Math.round((doneCount / transfers.length) * 100)}%` }} />
              </div>
              <div className="text-[12px] text-muted mt-1.5">{doneCount} of {transfers.length} transfers confirmed</div>
            </div>
          )}
          <div className="divider mt-6"></div>
        </section>

        {/* Transfers + confirmation flow */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <div className="min-w-0 order-1 space-y-6">
        {/* Transfers */}
        <section className="space-y-3">
          <h3 className="section-label">Who owes whom</h3>
          {transfers.length === 0 ? (
            <div className="text-center py-6 text-[14px] text-muted">Everyone is settled up!</div>
          ) : (
            <div className="ledger">
              {transfers.map((t, i) => (
                <div key={t.id} className="flex items-center justify-between py-3">
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold">
                      {userMap.get(t.fromUserId) || "?"} <span className="text-navy mx-1">→</span> {userMap.get(t.toUserId) || "?"}
                    </div>
                    <div className="text-[12px] text-muted">Transfer #{i + 1}</div>
                  </div>
                  <div className="flex items-center gap-2.5 flex-shrink-0 ml-3">
                    <span className="money text-[16px] font-bold text-navy">{formatDH(t.amountCentimes)}</span>
                    {t.status === "CONFIRMED" ? (
                      <span className="tag bg-success-subtle text-success"><IconCheck size={12} />Confirmed</span>
                    ) : t.status === "PAID" ? (
                      <span className="tag bg-success-subtle text-success"><IconCheck size={12} />Paid</span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Why this is fair */}
        <section className="space-y-1">
          <h3 className="section-label">Why this is fair</h3>
          <div className="ledger">
            {memberBalances.map(b => {
              const isMe = b.userId === session.userId;
              const who = isMe ? "You" : b.displayName;
              return (
                <div key={b.userId} className="py-2.5 text-[14px] leading-relaxed">
                  {b.netBalance === 0 ? (
                    <span><strong className="font-semibold">{who}</strong> {isMe ? "are" : "is"} settled up — paid exactly {isMe ? "your" : "their"} share of <span className="money font-semibold">{formatDH(b.totalResponsibility)}</span>.</span>
                  ) : b.netBalance < 0 ? (
                    <span><strong className="font-semibold">{who}</strong> paid <span className="money font-semibold">{formatDH(b.totalPaid)}</span>, and {isMe ? "your" : "their"} share was <span className="money font-semibold">{formatDH(b.totalResponsibility)}</span>, so {isMe ? "you owe" : "they owe"} <span className="money font-semibold text-danger">{formatDH(-b.netBalance)}</span>.</span>
                  ) : (
                    <span><strong className="font-semibold">{who}</strong> paid <span className="money font-semibold">{formatDH(b.totalPaid)}</span>, and {isMe ? "your" : "their"} share was <span className="money font-semibold">{formatDH(b.totalResponsibility)}</span>, so {isMe ? "you get back" : "they get back"} <span className="money font-semibold text-success">{formatDH(b.netBalance)}</span>.</span>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Settle up — actions go to the people involved, not just the owner */}
        {transfers.length > 0 && (
          <section className="space-y-1">
            <h3 className="section-label">Settle up</h3>
            <div className="ledger">
              {transfers.map(t => {
                const iAmDebtor = t.fromUserId === session.userId;
                const iAmCreditor = t.toUserId === session.userId;
                return (
                  <div key={t.id} className="flex items-center justify-between py-2.5 gap-3">
                    <span className="text-[14px] min-w-0">
                      {userMap.get(t.fromUserId)} → {userMap.get(t.toUserId)}: <span className="money font-semibold">{formatDH(t.amountCentimes)}</span>
                    </span>
                    {t.status === "CONFIRMED" ? (
                      <span className="tag bg-success-subtle text-success flex-shrink-0"><IconCheck size={12} />Confirmed</span>
                    ) : t.status === "PAID" ? (
                      iAmCreditor ? (
                        <form action={async () => {
                          "use server";
                          const { confirmTransferReceivedAction } = await import("@/server/settlement/actions");
                          await confirmTransferReceivedAction(t.id);
                        }}>
                          <button type="submit" className="btn-primary text-[12px] px-3 py-1.5 flex-shrink-0">Confirm receipt</button>
                        </form>
                      ) : (
                        <span className="tag bg-success-subtle text-success flex-shrink-0"><IconCheck size={12} />Paid</span>
                      )
                    ) : iAmDebtor ? (
                      <form action={async () => {
                        "use server";
                        const { markTransferPaidAction } = await import("@/server/settlement/actions");
                        await markTransferPaidAction(t.id);
                      }}>
                        <button type="submit" className="btn-primary text-[12px] px-3 py-1.5 flex-shrink-0">Mark Paid</button>
                      </form>
                    ) : (
                      <span className="text-[12px] text-muted flex-shrink-0">Awaiting payment</span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}
          </div>
          <aside className="space-y-8 lg:sticky lg:top-6 min-w-0 order-2">
        {/* Group totals */}
        <section>
          <h3 className="section-label mb-2">Group totals</h3>
          <div className="flex items-center gap-5 text-[14px]">
            <span className="text-muted">Expenses <span className="money font-bold text-foreground ml-1">{formatDH(settlement.totalExpenses)}</span></span>
            <span className="w-px h-4 bg-border" aria-hidden="true"></span>
            <span className="text-muted">Paid <span className="money font-bold text-foreground ml-1">{formatDH(settlement.totalPaid)}</span></span>
            <span className="w-px h-4 bg-border" aria-hidden="true"></span>
            <span className="text-muted">Transfers <span className="money font-bold text-foreground ml-1">{transfers.length}</span></span>
          </div>
        </section>

        {/* Member Balances */}
        <section className="space-y-1">
          <h3 className="section-label">Member balances</h3>
          <div className="ledger">
            {memberBalances.map(b => (
              <div key={b.userId} className="flex items-center justify-between py-2.5">
                <div className="min-w-0">
                  <div className="text-[14px] font-medium">{b.displayName}{b.userId === session.userId ? <span className="text-[12px] text-muted"> (you)</span> : null}</div>
                  <div className="text-[12px] text-muted">Paid {formatDH(b.totalPaid)} · Owes {formatDH(b.totalResponsibility)}</div>
                </div>
                <div className={`money text-[15px] font-bold ml-3 ${b.netBalance > 0 ? "text-success" : b.netBalance < 0 ? "text-danger" : "text-muted"}`}>
                  {b.netBalance > 0 ? "+" : ""}{formatDH(b.netBalance)}
                </div>
              </div>
            ))}
          </div>
        </section>
          </aside>
        </div>

        {/* Completion */}
        {allSettled && (
          <section className="surface-20 p-8 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-success-subtle text-success flex items-center justify-center mb-3"><IconCheck size={22} /></div>
            <div className="text-[22px] font-bold text-success">Group settled</div>
            <div className="money text-[16px] font-semibold mt-1">{formatDH(settlement.totalExpenses)} reconciled</div>
            <div className="text-[13px] text-muted mt-1">All {transfers.length} transfer(s) confirmed</div>
          </section>
        )}
    </main>
  );
}
