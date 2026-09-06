import Link from "next/link";
import { getSession } from "@/server/auth/session";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <div className="flex flex-1 flex-col">
      <header className="header">
        <div className="header-inner justify-between">
          <div className="flex items-center gap-2.5">
            <div className="brand-mark">P</div>
            <span className="font-semibold tracking-tight text-[15px]">PoolSplit</span>
          </div>
          <div className="flex gap-2">
            <Link href="/login" className="btn-secondary text-[13px] py-2">Login</Link>
            <Link href="/register" className="btn-primary text-[13px] py-2">Get Started</Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-5 py-10 md:py-16">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div className="space-y-6">
            <div className="tag bg-success-subtle text-success">
              <span className="status-dot bg-success"></span>Live · Next.js · Prisma
            </div>
            <h1 className="text-[36px] md:text-[44px] font-bold tracking-tight leading-[1.1]">
              Who pays whom, <br />
              <span className="text-muted">how much?</span>
            </h1>
            <p className="text-[15px] text-muted leading-relaxed">
              For pool nights, dinners, trips, and any group outing where different people join different activities. Record once, settle automatically.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/register" className="btn-primary px-6 py-3">Create Group →</Link>
              <Link href="/login" className="btn-secondary px-6 py-3">See Demo</Link>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-6 border-t border-border">
              <div>
                <div className="money text-[22px] font-bold">350 DH</div>
                <div className="text-[12px] text-muted">Total pool</div>
              </div>
              <div>
                <div className="money text-[22px] font-bold">3</div>
                <div className="text-[12px] text-muted">Activities</div>
              </div>
              <div>
                <div className="money text-[22px] font-bold">3</div>
                <div className="text-[12px] text-muted">Transfers</div>
              </div>
            </div>
          </div>

          {/* Demo card — STATIC EXAMPLE, not real user data */}
          <div className="surface-20 p-6 space-y-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-[15px]">Friday Pool Night</h3>
              <div className="flex gap-2">
                <span className="tag bg-elevated text-muted">Demo preview</span>
                <span className="tag bg-warn-subtle text-warn"><span className="status-dot bg-warn"></span>Active</span>
              </div>
            </div>

            <div className="space-y-2 text-[14px]">
              <div className="flex justify-between py-2.5 px-3 rounded-[10px] bg-elevated">
                <span>Table 1 · Naoufal, Mohamed, Yassine</span>
                <span className="money font-semibold">120 DH</span>
              </div>
              <div className="flex justify-between py-2.5 px-3 rounded-[10px] bg-elevated">
                <span>Table 2 · Yassine, Anour</span>
                <span className="money font-semibold">60 DH</span>
              </div>
              <div className="flex justify-between py-2.5 px-3 rounded-[10px] bg-elevated">
                <span>Drinks · Everyone</span>
                <span className="money font-semibold">40 DH</span>
              </div>
            </div>

            <div className="rounded-[14px] bg-settle-subtle p-5 space-y-3">
              <div className="text-[12px] text-settle uppercase tracking-widest font-semibold">Final Settlement</div>
              <div className="space-y-2 font-mono text-[13px]">
                <div className="flex justify-between"><span>Anour → Naoufal</span><span className="money">40 DH</span></div>
                <div className="flex justify-between"><span>Yassine → Naoufal</span><span className="money">20 DH</span></div>
                <div className="flex justify-between"><span>Mohamed → Naoufal</span><span className="money">10 DH</span></div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-16 grid md:grid-cols-3 gap-4">
          {[
            { title: "Different tables, different people", desc: "Not everyone joins every activity. Track participants per activity." },
            { title: "Contribution ≠ Payment", desc: "Who consumed vs who actually paid at the venue are tracked separately." },
            { title: "Integer centimes, no float", desc: "All money in centimes, deterministic rounding, fully audited." },
          ].map(c => (
            <div key={c.title} className="card p-6">
              <h4 className="font-semibold text-[15px] mb-2">{c.title}</h4>
              <p className="text-[13px] text-muted leading-relaxed">{c.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-border py-6 text-center text-[12px] text-muted">
        PoolSplit · Built for groups · Docker ready
      </footer>
    </div>
  );
}
