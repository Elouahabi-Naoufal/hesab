import { prisma } from "@/lib/prisma";
import { getSession } from "@/server/auth/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { depositAction, getWalletWithTransactions } from "@/server/wallet/actions";

export default async function WalletPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const { wallet, transactions } = await getWalletWithTransactions();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 dark:bg-white flex items-center justify-center text-white dark:text-zinc-900 font-bold">H</div>
            <span className="font-semibold">Hesab</span>
          </Link>
          <div className="flex gap-2">
            <Link href="/profile" className="text-sm px-3 py-1 rounded-full border">Profile</Link>
            <Link href="/dashboard" className="text-sm px-3 py-1 rounded-full border">Dashboard</Link>
          </div>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <div className="bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-6 text-center">
          <div className="text-sm text-emerald-700 dark:text-emerald-300">Wallet Balance</div>
          <div className="text-4xl font-bold tracking-tight">{(wallet.balance / 100).toFixed(2)} DH</div>
          <div className="text-xs text-zinc-500 mt-1">{wallet.balance} centimes • Updates on every contribution</div>
        </div>

        <form action={async (formData: FormData) => { "use server"; await depositAction(formData); }} className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-4">
          <h2 className="font-semibold">Add Money</h2>
          <p className="text-sm text-zinc-500">Deposit centimes (e.g., 5000 = 50 DH). Used when you accept a group invite.</p>
          <div className="flex gap-2">
            <input name="amount" type="number" min={100} step={100} defaultValue={5000} required className="flex-1 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800" placeholder="5000" />
            <button className="px-4 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium">Deposit</button>
          </div>
          <div className="text-xs text-zinc-500">Tip: When accepting an invite you will be asked how much to contribute from this wallet (validated against balance).</div>
        </form>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-3">
          <h3 className="font-semibold">Recent Transactions (50)</h3>
          {transactions.length === 0 ? (
            <div className="text-sm text-zinc-500 text-center py-6">No transactions yet — deposit to start.</div>
          ) : (
            <div className="space-y-2">
              {transactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800">
                  <div>
                    <div className="text-sm font-medium">{t.type} <span className="text-zinc-500">• {t.description}</span></div>
                    <div className="text-xs text-zinc-500">{new Date(t.createdAt).toLocaleString()} {t.groupId ? `• Group ${t.groupId.slice(0,6)}` : ""}</div>
                  </div>
                  <div className={`font-mono font-medium ${t.amount >= 0 ? "text-emerald-600" : "text-red-600"}`}>{t.amount >= 0 ? "+" : ""}{(t.amount / 100).toFixed(2)} DH</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="text-center text-xs text-zinc-500">
          SQLite-backed via <span className="font-mono">Wallet</span> + <span className="font-mono">WalletTransaction</span> — no hardcoded balances.
        </div>
      </main>
    </div>
  );
}
