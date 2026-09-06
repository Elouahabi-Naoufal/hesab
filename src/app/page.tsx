import Link from "next/link";
import { IconArrowRight } from "@/components/icons";
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
            <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-action">PoolSplit for friends</p>
            <h1 className="text-[36px] md:text-[44px] font-extrabold leading-[1.08]">
              What are we doing<br />this weekend?
            </h1>
            <p className="text-[15px] text-muted leading-relaxed">
              Find something fun. Invite your people. Make it happen — and settle up without the awkward math.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/register" className="btn-primary px-6 py-3">Create an outing<IconArrowRight size={15} /></Link>
              <Link href="/login" className="btn-secondary px-6 py-3">Log in</Link>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="tag bg-elevated text-foreground"><span className="status-dot bg-action"></span>Beach day</span>
              <span className="tag bg-elevated text-foreground"><span className="status-dot bg-happy"></span>Dinner out</span>
              <span className="tag bg-elevated text-foreground"><span className="status-dot bg-mint"></span>Game night</span>
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
              <div className="flex justify-between py-2.5 px-3 rounded-[12px] bg-elevated">
                <span>Table 1 · Naoufal, Mohamed, Yassine</span>
                <span className="money font-semibold">120 DH</span>
              </div>
              <div className="flex justify-between py-2.5 px-3 rounded-[12px] bg-elevated">
                <span>Table 2 · Yassine, Anour</span>
                <span className="money font-semibold">60 DH</span>
              </div>
              <div className="flex justify-between py-2.5 px-3 rounded-[12px] bg-elevated">
                <span>Drinks · Everyone</span>
                <span className="money font-semibold">40 DH</span>
              </div>
            </div>

            <div className="rounded-[20px] bg-brand-subtle p-5 space-y-3">
              <div className="text-[12px] text-navy uppercase tracking-[0.12em] font-semibold">Final settlement</div>
              <div className="space-y-2 font-mono text-[13px]">
                <div className="flex justify-between"><span>Anour → Naoufal</span><span className="money">40 DH</span></div>
                <div className="flex justify-between"><span>Yassine → Naoufal</span><span className="money">20 DH</span></div>
                <div className="flex justify-between"><span>Mohamed → Naoufal</span><span className="money">10 DH</span></div>
              </div>
            </div>
          </div>
        </div>

        <dl className="mt-16 card divide-y divide-[var(--border-color)] overflow-hidden">
          {[
            { title: "Different tables, different people", desc: "Not everyone joins every activity. Track participants per activity." },
            { title: "Contribution ≠ Payment", desc: "Who consumed vs who actually paid at the venue are tracked separately." },
            { title: "Integer centimes, no float", desc: "All money in centimes, deterministic rounding, fully audited." },
          ].map(c => (
            <div key={c.title} className="p-6 sm:grid sm:grid-cols-[220px_1fr] sm:gap-6">
              <dt className="font-semibold text-[15px]">{c.title}</dt>
              <dd className="text-[13px] text-muted leading-relaxed mt-1 sm:mt-0">{c.desc}</dd>
            </div>
          ))}
        </dl>

        <section className="mt-16 rounded-[24px] cta-band p-8 sm:p-12 text-center space-y-4">
          <h2 className="text-[26px] sm:text-[32px] font-extrabold">Get your friends together tonight</h2>
          <p className="text-[15px] max-w-md mx-auto">Create your first outing in under a minute. The math takes care of itself.</p>
          <Link href="/register" className="btn-primary inline-flex px-8 py-3.5 text-[15px]">Create an outing<IconArrowRight size={16} /></Link>
        </section>
      </main>

      <footer className="border-t border-border py-6 text-center text-[12px] text-muted">
        PoolSplit · Built for groups · Docker ready
      </footer>
    </div>
  );
}
