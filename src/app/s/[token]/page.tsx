import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { formatDH } from "@/lib/utils";
import Link from "next/link";

export default async function PublicSettlement({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const settlement = await prisma.settlement.findUnique({ where: { publicToken: token }, include: { group: true, transfers: true } });
  if (!settlement) notFound();

  const userIds = [...new Set([...settlement.transfers.map(t => t.fromUserId), ...settlement.transfers.map(t => t.toUserId)])];
  const users = await prisma.user.findMany({ where: { id: { in: userIds } } });
  const userMap = new Map(users.map(u => [u.id, u.displayName]));

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 bg-white/80 dark:bg-zinc-900/80 backdrop-blur border-b p-4 text-center">
        <h1 className="font-semibold">🎱 {settlement.group.name}</h1>
        <p className="text-xs text-zinc-500">{new Date(settlement.createdAt).toLocaleDateString()} • Total {formatDH(settlement.totalExpenses)}</p>
      </header>
      <main className="max-w-md mx-auto px-4 py-6 space-y-6">
        <div className="bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-3xl p-6 space-y-3">
          <h3 className="text-center font-bold text-sm tracking-widest">PAYMENT INSTRUCTIONS</h3>
          {settlement.transfers.map((t, i) => (
            <div key={i} className="flex justify-between p-3 rounded-xl bg-white/10 dark:bg-zinc-900/10">
              <span>{userMap.get(t.fromUserId)} → {userMap.get(t.toUserId)}</span>
              <span className="font-bold">{formatDH(t.amountCentimes)}</span>
            </div>
          ))}
          {settlement.transfers.length === 0 && <p className="text-center text-sm opacity-70">All settled</p>}
        </div>
        <div className="text-center">
          <Link href="/" className="text-sm text-zinc-500 hover:underline">Create your own group on Hesab →</Link>
        </div>
      </main>
    </div>
  );
}
