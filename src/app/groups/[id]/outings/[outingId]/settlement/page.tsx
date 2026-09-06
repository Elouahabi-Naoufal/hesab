import { prisma } from "@/lib/prisma";
import { getSession } from "@/server/auth/session";
import { redirect, notFound } from "next/navigation";
import { formatDH } from "@/lib/utils";
import { explainSettlement } from "@/domain/settlement";
import BackButton from "@/components/BackButton";
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
  if (!settlement) notFound();

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

  const explanation = explainSettlement(
    transfers.map(t => ({ fromUserId: t.fromUserId, toUserId: t.toUserId, amountCentimes: t.amountCentimes })),
    memberBalances
  );

  const paidCount = transfers.filter(t => t.status === "PAID").length;
  const allSettled = transfers.length > 0 && paidCount === transfers.length;

  return (
    <div className="min-h-screen">
      <header className="header">
        <div className="header-inner">
          <BackButton href={`/groups/${groupId}/outings/${outingId}`} label="Back to outing" />
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-[18px] tracking-tight">Settlement</h1>
            <p className="text-[13px] text-muted">{outing.name}</p>
          </div>
          {isOwner && (
            <div className="flex gap-2">
              <form action={async () => {
                "use server";
                const { recalculateSettlementAction } = await import("@/server/settlement/actions");
                await recalculateSettlementAction(outingId);
              }}>
                <button className="btn-secondary text-[13px]">Recalculate</button>
              </form>
              <form action={async () => {
                "use server";
                const { finalizeSettlementAction } = await import("@/server/settlement/actions");
                await finalizeSettlementAction(outingId);
              }}>
                <button className="btn-settle text-[13px] px-4">Finalize</button>
              </form>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 py-8 space-y-6">
        {/* Personal result hero */}
        <section className="surface-20 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-[14px] bg-settle-subtle text-settle flex items-center justify-center text-lg font-bold">⇄</div>
            <div>
              <h2 className="text-[20px] font-bold tracking-tight">Your settlement</h2>
              <p className="text-[13px] text-muted">
                {myNet > 0 ? "You receive the difference" : myNet < 0 ? "You pay the difference" : "You are settled up"}
              </p>
            </div>
          </div>
          <div className={`money-hero text-[34px] font-bold ${myNet > 0 ? "text-success" : myNet < 0 ? "text-danger" : "text-muted"}`}>
            {myNet > 0 ? "+" : ""}{formatDH(myNet)}
          </div>
          <div className="grid grid-cols-2 gap-3 mt-5">
            <div className="well p-4">
              <div className="text-[12px] text-muted mb-1">To receive</div>
              <div className="money text-[18px] font-bold text-success">{formatDH(toReceive)}</div>
              <div className="text-[12px] text-muted mt-1">{myTransfersIn.length} transfer(s)</div>
            </div>
            <div className="well p-4">
              <div className="text-[12px] text-muted mb-1">To pay</div>
              <div className="money text-[18px] font-bold text-danger">{formatDH(toPay)}</div>
              <div className="text-[12px] text-muted mt-1">{myTransfersOut.length} transfer(s)</div>
            </div>
          </div>
          {transfers.length > 0 && (
            <div className="mt-5">
              <div className="progress-track">
                <div className="progress-fill settle" style={{ width: `${Math.round((paidCount / transfers.length) * 100)}%` }} />
              </div>
              <div className="text-[12px] text-muted mt-1.5">{paidCount} of {transfers.length} transfers confirmed</div>
            </div>
          )}
        </section>

        {/* Group totals */}
        <section className="card-elevated p-5">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-[12px] text-muted mb-1">Expenses</div>
              <div className="money text-[18px] font-bold">{formatDH(settlement.totalExpenses)}</div>
            </div>
            <div>
              <div className="text-[12px] text-muted mb-1">Paid</div>
              <div className="money text-[18px] font-bold">{formatDH(settlement.totalPaid)}</div>
            </div>
            <div>
              <div className="text-[12px] text-muted mb-1">Transfers</div>
              <div className="money text-[18px] font-bold">{transfers.length}</div>
            </div>
          </div>
        </section>

        {/* Member Balances */}
        <section className="card-elevated p-5 space-y-3">
          <h3 className="text-[15px] font-semibold">Member balances</h3>
          <div className="space-y-1">
            {memberBalances.map(b => (
              <div key={b.userId} className="flex items-center justify-between py-2.5 px-3 rounded-[10px] bg-elevated">
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

        {/* Transfers */}
        <section className="card-elevated p-5 space-y-3">
          <h3 className="text-[15px] font-semibold">Who owes whom</h3>
          {transfers.length === 0 ? (
            <div className="text-center py-6 text-[14px] text-muted">Everyone is settled up!</div>
          ) : (
            <div className="space-y-2">
              {transfers.map((t, i) => (
                <div key={t.id} className="flex items-center justify-between py-3 px-4 rounded-[14px] bg-settle-subtle">
                  <div className="min-w-0">
                    <div className="text-[14px] font-medium">
                      {userMap.get(t.fromUserId) || "?"} <span className="text-settle mx-1">→</span> {userMap.get(t.toUserId) || "?"}
                    </div>
                    <div className="text-[12px] text-muted">Transfer #{i + 1}</div>
                  </div>
                  <div className="flex items-center gap-2.5 flex-shrink-0 ml-3">
                    <span className="money text-[16px] font-bold text-settle">{formatDH(t.amountCentimes)}</span>
                    {t.status === "PAID" && <span className="tag bg-success-subtle text-success"><IconCheck size={12} />Paid</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Explanation */}
        <section className="card-elevated p-5 space-y-3">
          <h3 className="text-[15px] font-semibold">Explanation</h3>
          <pre className="text-[13px] bg-elevated p-4 rounded-[14px] overflow-x-auto whitespace-pre-wrap font-mono text-muted">
            {explanation}
          </pre>
        </section>

        {/* Mark Transfer Paid */}
        {isOwner && transfers.length > 0 && (
          <section className="card-elevated p-5 space-y-3">
            <h3 className="text-[15px] font-semibold">Confirm transfers</h3>
            <div className="space-y-2">
              {transfers.map(t => (
                <form key={t.id} action={async () => {
                  "use server";
                  const { markTransferPaidAction } = await import("@/server/settlement/actions");
                  await markTransferPaidAction(t.id);
                }} className="flex items-center justify-between py-2.5 px-3 rounded-[10px] bg-elevated gap-3">
                  <span className="text-[14px] min-w-0">
                    {userMap.get(t.fromUserId)} → {userMap.get(t.toUserId)}: <span className="money font-semibold">{formatDH(t.amountCentimes)}</span>
                  </span>
                  {t.status === "PAID" ? (
                    <span className="tag bg-success-subtle text-success flex-shrink-0"><IconCheck size={12} />Paid</span>
                  ) : (
                    <button type="submit" className="btn-primary text-[12px] px-3 py-1.5 flex-shrink-0">Mark Paid</button>
                  )}
                </form>
              ))}
            </div>
          </section>
        )}

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
    </div>
  );
}
