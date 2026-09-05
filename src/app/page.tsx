import Link from "next/link";
import { getSession } from "@/server/auth/session";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <div className="flex flex-1 flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 dark:bg-white flex items-center justify-center text-white dark:text-zinc-900 font-bold">H</div>
            <span className="font-semibold tracking-tight">Hesab</span>
          </div>
          <div className="flex gap-2">
            <Link href="/login" className="px-4 py-2 text-sm font-medium rounded-full border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800">Login</Link>
            <Link href="/register" className="px-4 py-2 text-sm font-medium rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:opacity-90">Get Started</Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-10 md:py-16">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-xs font-medium">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              SQLite • Prisma • Next.js
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight">
              Who pays whom, <br />
              <span className="text-zinc-400">how much?</span>
            </h1>
            <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
              For pool nights, dinners, trips, and any group outing where different people join different activities. Record once, settle automatically.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/register" className="px-6 py-3 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-medium hover:opacity-90">Create Group →</Link>
              <Link href="/login" className="px-6 py-3 rounded-full border border-zinc-200 dark:border-zinc-700 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800">See Demo</Link>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-6 border-t border-zinc-200 dark:border-zinc-800">
              <div>
                <div className="text-2xl font-bold">350 DH</div>
                <div className="text-xs text-zinc-500">Total pool</div>
              </div>
              <div>
                <div className="text-2xl font-bold">3</div>
                <div className="text-xs text-zinc-500">Activities</div>
              </div>
              <div>
                <div className="text-2xl font-bold">3</div>
                <div className="text-xs text-zinc-500">Transfers</div>
              </div>
            </div>
          </div>

          {/* Demo card — STATIC EXAMPLE, not real user data */}
          <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">🎱 Friday Pool Night</h3>
              <div className="flex gap-2">
                <span className="px-2 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 text-xs font-medium">Demo preview</span>
                <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">ACTIVE</span>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800">
                <span>Table 1 • Naoufal, Mohamed, Yassine</span>
                <span className="font-medium">120 DH</span>
              </div>
              <div className="flex justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800">
                <span>Table 2 • Yassine, Anour</span>
                <span className="font-medium">60 DH</span>
              </div>
              <div className="flex justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800">
                <span>🥤 Drinks • Everyone</span>
                <span className="font-medium">40 DH</span>
              </div>
            </div>

            <div className="rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 p-5 space-y-3">
              <div className="text-xs opacity-70 uppercase tracking-widest font-semibold">Final Settlement</div>
              <div className="space-y-2 font-mono text-sm">
                <div className="flex justify-between"><span>Anour → Naoufal</span><span>40 DH</span></div>
                <div className="flex justify-between"><span>Yassine → Naoufal</span><span>20 DH</span></div>
                <div className="flex justify-between"><span>Mohamed → Naoufal</span><span>10 DH</span></div>
              </div>
              <div className="pt-2 border-t border-white/20 dark:border-zinc-900/10 flex gap-2">
                <button className="flex-1 py-2 rounded-full bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white text-sm font-medium">Copy</button>
                <button className="flex-1 py-2 rounded-full bg-emerald-500 text-white text-sm font-medium">Share WhatsApp</button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-16 grid md:grid-cols-3 gap-6">
          {[
            { title: "Different tables, different people", desc: "Not everyone joins every activity. Track participants per activity." },
            { title: "Contribution ≠ Payment", desc: "Who contributed vs who actually paid at the venue are separate." },
            { title: "Integer centimes, no float", desc: "All money in centimes, deterministic rounding, audited." },
          ].map(c => (
            <div key={c.title} className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <h4 className="font-semibold mb-2">{c.title}</h4>
              <p className="text-sm text-zinc-500">{c.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-zinc-200 dark:border-zinc-800 py-6 text-center text-xs text-zinc-500">
        Built for VPS • SQLite on persistent volume • Docker ready • WAL mode
      </footer>
    </div>
  );
}
