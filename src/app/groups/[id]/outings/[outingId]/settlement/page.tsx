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

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href={`/groups/${groupId}/outings/${outingId}`} className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800">←</Link>
          <div className="flex-1">
            <h1 className="font-semibold">💰 Settlement — {outing.name}</h1>
          </div>
          {isOwner && (
            <form action={async () => {
              "use server";
              const { finalizeSettlementAction } = await import("@/server/settlement/actions");
              await finalizeSettlementAction(outingId);
            }}>
              <button className="px-4 py-2 rounded-full bg-amber-600 text-white text-sm font-medium">Finalize</button>
            </form>
          )}
          {isOwner && (
            <form action={async () => {
              "use server";
              const { recalculateSettlementAction } = await import("@/server/settlement/actions");
              await recalculateSettlementAction(outingId);
            }}>
              <button className="px-4 py-2 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium">Recalculate</button>
            </form>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Summary */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-3">
          <h3 className="font-semibold">Summary</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-xs text-zinc-500">Total Expenses</div>
              <div className="font-bold">{formatDH(settlement.totalExpenses / 100)} DH</div>
            </div>
            <div>
              <div className="text-xs text-zinc-500">Total Paid</div>
              <div className="font-bold">{formatDH(settlement.totalPaid / 100)} DH</div>
            </div>
            <div>
              <div className="text-xs text-zinc-500">Transfers</div>
              <div className="font-bold">{transfers.length}</div>
            </div>
          </div>
        </div>

        {/* Member Balances */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-3">
          <h3 className="font-semibold">Member Balances</h3>
          <div className="space-y-2">
            {memberBalances.map(b => (
              <div key={b.userId} className={`flex justify-between p-3 rounded-xl ${b.netBalance > 0 ? "bg-emerald-50 dark:bg-emerald-950" : b.netBalance < 0 ? "bg-red-50 dark:bg-red-950" : "bg-zinc-50 dark:bg-zinc-800"}`}>
                <div>
                  <div className="font-medium">{b.displayName}</div>
                  <div className="text-xs text-zinc-500">
                    Paid: {formatDH(b.totalPaid / 100)} • Responsible: {formatDH(b.totalResponsibility / 100)}
                  </div>
                </div>
                <div className="font-bold">
                  {b.netBalance > 0 ? `+${formatDH(b.netBalance / 100)}` : b.netBalance < 0 ? formatDH(b.netBalance / 100) : "0.00"} DH
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Transfers */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-3">
          <h3 className="font-semibold">Who Owes Whom</h3>
          {transfers.length === 0 ? (
            <div className="text-center py-4 text-sm text-zinc-500">Everyone is settled up!</div>
          ) : (
            <div className="space-y-2">
              {transfers.map((t, i) => (
                <div key={t.id} className="flex justify-between items-center p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800">
                  <div>
                    <div className="font-medium">
                      {userMap.get(t.fromUserId) || "?"} → {userMap.get(t.toUserId) || "?"}
                    </div>
                    <div className="text-xs text-zinc-500">Transfer #{i + 1}</div>
                  </div>
                  <div className="font-bold text-emerald-700 dark:text-emerald-300">{formatDH(t.amountCentimes / 100)} DH</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Explanation */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-3">
          <h3 className="font-semibold">Explanation</h3>
          <pre className="text-xs bg-zinc-50 dark:bg-zinc-900 p-4 rounded-xl overflow-x-auto whitespace-pre-wrap font-mono">
            {explanation}
          </pre>
        </div>

        {/* Mark Transfer Paid */}
        {isOwner && (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-3">
            <h3 className="font-semibold">Mark Transfer Paid</h3>
            {transfers.map(t => (
              <form key={t.id} action={async () => {
                "use server";
                const { markTransferPaidAction } = await import("@/server/settlement/actions");
                await markTransferPaidAction(t.id);
              }} className="flex items-center gap-3">
                <span>{userMap.get(t.fromUserId)} → {userMap.get(t.toUserId)}: {formatDH(t.amountCentimes / 100)} DH</span>
                <span className={`text-xs px-2 py-1 rounded ${t.status === "PAID" ? "bg-green-100 text-green-700" : "bg-zinc-100 text-zinc-600"}`}>{t.status}</span>
                {t.status !== "PAID" && (
                  <button type="submit" className="px-3 py-1 rounded bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs">Mark Paid</button>
                )}
              </form>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
