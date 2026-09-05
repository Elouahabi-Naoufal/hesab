import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function PublicSettlementPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const settlement = await prisma.settlement.findUnique({
    where: { publicToken: token },
  });
  if (!settlement) notFound();

  const transfers = await prisma.settlementTransfer.findMany({
    where: { settlementId: settlement.id },
  });

  const userIds = [...new Set([...transfers.map(t => t.fromUserId), ...transfers.map(t => t.toUserId)])];
  const users = await prisma.user.findMany({ where: { id: { in: userIds } } });
  const userMap = new Map(users.map(u => [u.id, u.displayName]));

  const outing = settlement.outingId ? await prisma.outing.findUnique({ where: { id: settlement.outingId } }) : null;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-6">
        <div className="text-center">
          <h1 className="text-xl font-bold">🎱 Settlement</h1>
          {outing && <p className="text-sm text-zinc-500 mt-1">{outing.name}</p>}
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800">
            <span>Total expenses</span>
            <span className="font-medium">{(settlement.totalExpenses / 100).toFixed(2)} DH</span>
          </div>
          <div className="flex justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800">
            <span>Total paid</span>
            <span className="font-medium">{(settlement.totalPaid / 100).toFixed(2)} DH</span>
          </div>
        </div>

        {transfers.length > 0 ? (
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Transfers</h3>
            {transfers.map((t, i) => (
              <div key={t.id} className="flex justify-between items-center p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800">
                <span className="text-sm">{userMap.get(t.fromUserId) || "?"} → {userMap.get(t.toUserId) || "?"}</span>
                <span className="font-medium text-emerald-700 dark:text-emerald-300">{(t.amountCentimes / 100).toFixed(2)} DH</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-sm text-zinc-500 py-4">Everyone is settled up!</div>
        )}

        <div className="text-center text-xs text-zinc-400 pt-4 border-t border-zinc-200 dark:border-zinc-700">
          Created with <Link href="/" className="underline">Hesab</Link>
        </div>
      </div>
    </div>
  );
}
