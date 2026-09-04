import { prisma } from "@/lib/prisma";
import { getSession } from "@/server/auth/session";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { formatDH } from "@/lib/utils";
import { calculateSettlement } from "@/domain/settlement";

export default async function CheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const group = await prisma.group.findUnique({ where: { id } });
  if (!group) notFound();

  const members = await prisma.groupMember.findMany({ where: { groupId: id }, include: { user: true } });
  const expenses = await prisma.expense.findMany({ where: { groupId: id }, include: { allocations: true, payments: true } });
  const settlement = await prisma.settlement.findUnique({ where: { groupId: id }, include: { transfers: true } });

  // Compute live settlement if not yet settled
  const users = await prisma.user.findMany({ where: { id: { in: members.map(m => m.userId) } } });
  const userMap = new Map(users.map(u => [u.id, u.displayName]));

  const expenseInputs = expenses.map(e => ({
    id: e.id,
    totalCentimes: e.totalCentimes,
    allocations: e.allocations.map(a => ({ userId: a.userId, amountCentimes: a.amountCentimes })),
    payments: e.payments.map(p => ({ userId: p.userId, amountCentimes: p.amountCentimes })),
  }));

  const membersInput = members.map(m => ({ userId: m.userId, displayName: userMap.get(m.userId) }));
  const contributions = members.map(m => ({ userId: m.userId, amountCentimes: m.contribution }));

  let liveResult;
  try {
    liveResult = calculateSettlement({ members: membersInput, expenses: expenseInputs, contributions });
  } catch (e: any) {
    liveResult = null;
  }

  const displayTransfers = settlement ? settlement.transfers : liveResult?.transfers || [];
  const displayBalances = liveResult?.memberBalances || [];
  const totalUnrecorded = liveResult?.totalUnrecorded || 0;
  const isComplete = liveResult?.isComplete ?? true;
  const incompleteExpenses = liveResult?.incompleteExpenseIds?.length ? expenses.filter(e => liveResult!.incompleteExpenseIds.includes(e.id)) : [];

  // Enrich transfers with names
  const enrichedTransfers = displayTransfers.map((t: any) => ({
    ...t,
    fromName: userMap.get(t.fromUserId) || t.fromUserId,
    toName: userMap.get(t.toUserId) || t.toUserId,
  }));

  const myBalance = displayBalances.find(b => b.userId === session.userId);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href={`/groups/${id}`} className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800">←</Link>
          <div>
            <h1 className="font-semibold">CHECKOUT — {group.name}</h1>
            <p className="text-xs text-zinc-500">Total expenses {liveResult ? formatDH(liveResult.totalExpenses) : "—"} • Settlement {enrichedTransfers.length} transfers</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Incomplete warning */}
        {liveResult && !isComplete && (
          <div className="rounded-2xl bg-amber-50 dark:bg-amber-950 border border-amber-300 dark:border-amber-800 p-4 space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-200">⚠️ Settlement incomplete — payer unknown</div>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              {formatDH(totalUnrecorded)} of expenses have no payer recorded (responsibility known, but who actually paid is unknown). Hesab can show who OWES, but cannot determine who should RECEIVE until payer is specified. This is distinct from 0 DH — 0 means they paid nothing, unknown means we don't know who advanced the money.
            </p>
            <div className="text-xs text-zinc-600 dark:text-zinc-400">Incomplete expenses: {incompleteExpenses.map(e => `${e.description} (${formatDH(e.totalCentimes)})`).join(", ")}</div>
            <p className="text-xs text-zinc-500">Go back to Group → edit each expense → add “Who actually paid?” (supports one or multiple payers).</p>
          </div>
        )}

        {/* My position */}
        {myBalance && (
          <div className={`rounded-2xl p-5 text-center ${myBalance.netBalance > 0 ? "bg-emerald-600 text-white" : myBalance.netBalance < 0 ? "bg-amber-500 text-white" : "bg-white dark:bg-zinc-900 border"}`}>
            <div className="text-xs uppercase tracking-widest opacity-80 font-semibold">{myBalance.netBalance > 0 ? "You receive" : myBalance.netBalance < 0 ? "You need to pay" : "Settled"}</div>
            <div className="text-3xl font-bold mt-1">{myBalance.netBalance === 0 ? "0 DH" : formatDH(Math.abs(myBalance.netBalance))}</div>
            <div className="text-xs opacity-80 mt-1">Paid {formatDH(myBalance.totalPaid)} • Responsible {formatDH(myBalance.totalResponsibility)} • Contrib {formatDH(myBalance.contribution || 0)}</div>
          </div>
        )}

        {/* All balances */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-3">
          <h3 className="font-semibold">Member Summary</h3>
          <div className="space-y-2">
            {displayBalances.map(b => (
              <div key={b.userId} className="flex justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 text-sm">
                <div>
                  <div className="font-medium">{userMap.get(b.userId)}</div>
                  <div className="text-xs text-zinc-500">Paid {formatDH(b.totalPaid)} • Resp {formatDH(b.totalResponsibility)}</div>
                </div>
                <div className={`font-bold ${b.netBalance > 0 ? "text-emerald-600" : b.netBalance < 0 ? "text-red-600" : "text-zinc-500"}`}>
                  {b.netBalance > 0 ? `+${formatDH(b.netBalance)} receives` : b.netBalance < 0 ? `${formatDH(b.netBalance)} pays` : "0"}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Final payment plan - hero */}
        <div className="bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-3xl p-6 space-y-4">
          <h3 className="font-bold text-center tracking-widest text-sm">FINAL PAYMENT PLAN</h3>
          {enrichedTransfers.length === 0 ? (
            <p className="text-center text-sm opacity-70">No transfers needed — everyone settled</p>
          ) : (
            <div className="space-y-3">
              {enrichedTransfers.map((t: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-white/10 dark:bg-zinc-900/10 backdrop-blur">
                  <div className="text-center flex-1">
                    <div className="font-bold">{t.fromName}</div>
                    <div className="text-xs opacity-70">pays</div>
                  </div>
                  <div className="flex flex-col items-center px-4">
                    <div className="text-lg font-bold">{formatDH(t.amountCentimes)}</div>
                    <div className="w-12 h-0.5 bg-white/30 dark:bg-zinc-900/30 my-1" />
                    <div className="text-xs">→</div>
                  </div>
                  <div className="text-center flex-1">
                    <div className="font-bold">{t.toName}</div>
                    <div className="text-xs opacity-70">receives</div>
                  </div>
                </div>
              ))}

              {/* Actions per transfer */}
              <div className="space-y-2 pt-2">
                {enrichedTransfers.map((t: any) => (
                  <div key={t.id || `${t.fromUserId}-${t.toUserId}`} className="flex gap-2">
                    {t.status && <span className="text-xs px-2 py-1 rounded-full bg-white/20">{t.status}</span>}
                    {t.fromUserId === session.userId && t.status === "PENDING" && (
                      <form action={async () => {
                        "use server";
                        const { markTransferPaidAction } = await import("@/server/settlement/actions");
                        await markTransferPaidAction(t.id);
                      }}>
                        <button className="text-xs px-3 py-1 rounded-full bg-emerald-500 text-white">Mark as Paid</button>
                      </form>
                    )}
                    {t.toUserId === session.userId && t.status === "PAID" && (
                      <form action={async () => {
                        "use server";
                        const { confirmTransferReceivedAction } = await import("@/server/settlement/actions");
                        await confirmTransferReceivedAction(t.id);
                      }}>
                        <button className="text-xs px-3 py-1 rounded-full bg-white text-zinc-900">Confirm Received</button>
                      </form>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  onClick={() => { /* client copy handled via UI fallback */ }}
                  className="flex-1 py-3 rounded-full bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white font-medium text-sm"
                  id="copy-btn"
                >
                  Copy
                </button>
                <button className="flex-1 py-3 rounded-full bg-emerald-500 text-white font-medium text-sm" id="share-btn">Share WhatsApp</button>
              </div>

              <script dangerouslySetInnerHTML={{
                __html: `
                const text = ${JSON.stringify(
                  `🎱 ${group.name}\n\nFinal settlement:\n\n${enrichedTransfers.map((t: any) => `${t.fromName} → ${t.toName}: ${t.amountCentimes / 100} DH`).join("\n")}\n\nTotal: ${liveResult ? liveResult.totalExpenses / 100 : 0} DH`
                )};
                document.getElementById('copy-btn')?.addEventListener('click', ()=>{navigator.clipboard.writeText(text); alert('Copied!')});
                document.getElementById('share-btn')?.addEventListener('click', ()=>{ window.open('https://wa.me/?text='+encodeURIComponent(text), '_blank')});
                `
              }} />
            </div>
          )}

          {settlement && (
            <div className="text-center">
              <Link href={`/s/${settlement.publicToken}`} className="text-xs underline opacity-70">Public share link: /s/{settlement.publicToken}</Link>
            </div>
          )}
        </div>

        {!settlement && liveResult && (
          <form action={async () => {
            "use server";
            const { generateSettlement } = await import("@/server/settlement/actions");
            await generateSettlement(id);
          }}>
            <button className="w-full py-3 rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-medium">Finalize Settlement</button>
          </form>
        )}
      </main>
    </div>
  );
}
