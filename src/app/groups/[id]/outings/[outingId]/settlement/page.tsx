import { prisma } from "@/lib/prisma";
import { getSession } from "@/server/auth/session";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { formatDH } from "@/lib/utils";
import { explainSettlement } from "@/domain/settlement";

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

  const explanation = explainSettlement(
    transfers.map(t => ({ fromUserId: t.fromUserId, toUserId: t.toUserId, amountCentimes: t.amountCentimes })),
    memberBalances
  );

  const allSettled = transfers.every(t => t.status === "PAID");

  return (
    <div className="min-h-screen">
      <header className="header">
        <div className="max-w-5xl mx-auto px-5 py-3 flex items-center gap-3">
          <Link href={`/groups/${groupId}/outings/${outingId}`} className="p-2 rounded-[10px] hover:bg-elevated transition text-muted">←</Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-[18px]">Settlement — {outing.name}</h1>
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
                <button className="btn-settle text-[13px] px-4 py-2 rounded-[10px]">Finalize</button>
              </form>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 py-8 space-y-6">
        {/* Settlement hero */}
        <div className="card-elevated p-6 border-l-3 border-l-settle">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-[14px] bg-settle-subtle text-settle flex items-center justify-center text-lg">💰</div>
            <div>
              <h2 className="text-[20px] font-bold tracking-tight">Settlement</h2>
              <p className="text-[13px] text-muted">{outing.name}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 rounded-[14px] bg-elevated">
              <div className="text-[12px] text-muted mb-1">Total Expenses</div>
              <div className="money text-[20px] font-bold">{formatDH(settlement.totalExpenses / 100)} DH</div>
            </div>
            <div className="text-center p-3 rounded-[14px] bg-elevated">
              <div className="text-[12px] text-muted mb-1">Total Paid</div>
              <div className="money text-[20px] font-bold">{formatDH(settlement.totalPaid / 100)} DH</div>
            </div>
            <div className="text-center p-3 rounded-[14px] bg-elevated">
              <div className="text-[12px] text-muted mb-1">Transfers</div>
              <div className="money text-[20px] font-bold">{transfers.length}</div>
            </div>
          </div>
        </div>

        {/* Member Balances */}
        <div className="card-elevated p-5 space-y-3">
          <h3 className="text-[15px] font-semibold">Member Balances</h3>
          <div className="space-y-2">
            {memberBalances.map(b => (
              <div key={b.userId} className="flex items-center justify-between py-2.5 px-3 rounded-[10px] bg-elevated">
                <div>
                  <div className="text-[14px] font-medium">{b.displayName}</div>
                  <div className="text-[12px] text-muted">Paid: {formatDH(b.totalPaid / 100)} · Responsible: {formatDH(b.totalResponsibility / 100)}</div>
                </div>
                <div className={`money text-[16px] font-bold ${b.netBalance > 0 ? "text-success" : b.netBalance < 0 ? "text-danger" : "text-muted"}`}>
                  {b.netBalance > 0 ? "+" : ""}{formatDH(b.netBalance / 100)} DH
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Transfers */}
        <div className="card-elevated p-5 space-y-3">
          <h3 className="text-[15px] font-semibold">Who Owes Whom</h3>
          {transfers.length === 0 ? (
            <div className="text-center py-6 text-[14px] text-muted">Everyone is settled up!</div>
          ) : (
            <div className="space-y-2">
              {transfers.map((t, i) => (
                <div key={t.id} className="flex items-center justify-between py-3 px-4 rounded-[14px] bg-settle-subtle border border-settle/10">
                  <div>
                    <div className="text-[14px] font-medium">
                      {userMap.get(t.fromUserId) || "?"} <span className="text-settle mx-1">→</span> {userMap.get(t.toUserId) || "?"}
                    </div>
                    <div className="text-[12px] text-muted">Transfer #{i + 1}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="money text-[16px] font-bold text-settle">{formatDH(t.amountCentimes / 100)} DH</span>
                    {t.status === "PAID" && <span className="tag bg-success-subtle text-success">Paid ✓</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Explanation */}
        <div className="card-elevated p-5 space-y-3">
          <h3 className="text-[15px] font-semibold">Explanation</h3>
          <pre className="text-[13px] bg-elevated p-4 rounded-[14px] overflow-x-auto whitespace-pre-wrap font-mono text-muted">
            {explanation}
          </pre>
        </div>

        {/* Mark Transfer Paid */}
        {isOwner && transfers.length > 0 && (
          <div className="card-elevated p-5 space-y-3">
            <h3 className="text-[15px] font-semibold">Mark Transfers</h3>
            <div className="space-y-2">
              {transfers.map(t => (
                <form key={t.id} action={async () => {
                  "use server";
                  const { markTransferPaidAction } = await import("@/server/settlement/actions");
                  await markTransferPaidAction(t.id);
                }} className="flex items-center justify-between py-2.5 px-3 rounded-[10px] bg-elevated">
                  <span className="text-[14px]">
                    {userMap.get(t.fromUserId)} → {userMap.get(t.toUserId)}: <span className="money font-medium">{formatDH(t.amountCentimes / 100)} DH</span>
                  </span>
                  <div className="flex items-center gap-2">
                    {t.status === "PAID" ? (
                      <span className="tag bg-success-subtle text-success">Paid ✓</span>
                    ) : (
                      <button type="submit" className="btn-primary text-[12px] px-3 py-1.5">Mark Paid</button>
                    )}
                  </div>
                </form>
              ))}
            </div>
          </div>
        )}

        {/* Final state */}
        {allSettled && (
          <div className="card-elevated p-8 text-center border-l-3 border-l-success">
            <div className="text-3xl mb-3">✓</div>
            <div className="text-[20px] font-bold text-success mb-1">Group settled</div>
            <div className="text-[14px] text-muted">All transfers have been completed</div>
          </div>
        )}
      </main>
    </div>
  );
}
