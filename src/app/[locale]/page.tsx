import { Link } from "@/i18n/navigation";
import { redirect } from "next/navigation";
import { IconArrowRight } from "@/components/icons";
import { getSession } from "@/server/auth/session";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await getSession();
  if (session) redirect("/dashboard");

  const t = await getTranslations({ locale: locale as AppLocale, namespace: "home" });
  const ta = await getTranslations({ locale: locale as AppLocale, namespace: "auth" });

  const feats = [
    { title: t("feat1t"), desc: t("feat1d") },
    { title: t("feat2t"), desc: t("feat2d") },
    { title: t("feat3t"), desc: t("feat3d") },
  ];

  return (
    <div className="flex flex-1 flex-col">
      <header className="header">
        <div className="header-inner justify-between">
          <div className="flex items-center gap-2.5">
            <div className="brand-mark"><img src="/logo.png?v=1" alt="PoolSplit" /></div>
            <span className="font-semibold tracking-tight text-[15px]">PoolSplit</span>
          </div>
          <div className="flex gap-2">
            <Link href="/login" className="btn-secondary text-[13px] py-2">{ta("login")}</Link>
            <Link href="/register" className="btn-primary text-[13px] py-2">{t("createOuting")}</Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-5 py-10 md:py-16">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div className="space-y-6">
            <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-action">{t("eyebrow")}</p>
            <h1 className="text-[36px] md:text-[44px] font-extrabold leading-[1.08]">
              {t("title")}
            </h1>
            <p className="text-[15px] text-muted leading-relaxed">
              {t("subtitle")}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/register" className="btn-primary px-6 py-3">{t("createOuting")}<IconArrowRight size={15} /></Link>
              <Link href="/login" className="btn-secondary px-6 py-3">{t("loginBtn")}</Link>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="tag bg-elevated text-foreground"><span className="status-dot bg-action"></span>{t("chipBeach")}</span>
              <span className="tag bg-elevated text-foreground"><span className="status-dot bg-happy"></span>{t("chipDinner")}</span>
              <span className="tag bg-elevated text-foreground"><span className="status-dot bg-mint"></span>{t("chipGames")}</span>
            </div>
          </div>

          {/* Demo card — STATIC EXAMPLE, not real user data */}
          <div className="surface-20 p-6 space-y-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-[15px]">{t("demoTitle")}</h3>
              <div className="flex gap-2">
                <span className="tag bg-elevated text-muted">{t("demoPreview")}</span>
                <span className="tag bg-warn-subtle text-warn"><span className="status-dot bg-warn"></span>{t("demoActive")}</span>
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
              <div className="text-[12px] text-navy uppercase tracking-[0.12em] font-semibold">{t("demoSettle")}</div>
              <div className="space-y-2 font-mono text-[13px]">
                <div className="flex justify-between"><span>Anour → Naoufal</span><span className="money">40 DH</span></div>
                <div className="flex justify-between"><span>Yassine → Naoufal</span><span className="money">20 DH</span></div>
                <div className="flex justify-between"><span>Mohamed → Naoufal</span><span className="money">10 DH</span></div>
              </div>
            </div>
          </div>
        </div>

        <dl className="mt-16 card divide-y divide-[var(--border-color)] overflow-hidden">
          {feats.map(c => (
            <div key={c.title} className="p-6 sm:grid sm:grid-cols-[220px_1fr] sm:gap-6">
              <dt className="font-semibold text-[15px]">{c.title}</dt>
              <dd className="text-[13px] text-muted leading-relaxed mt-1 sm:mt-0">{c.desc}</dd>
            </div>
          ))}
        </dl>

        <section className="mt-16 rounded-[24px] cta-band p-8 sm:p-12 text-center space-y-4">
          <h2 className="text-[26px] sm:text-[32px] font-extrabold">{t("ctaTitle")}</h2>
          <p className="text-[15px] max-w-md mx-auto">{t("ctaSub")}</p>
          <Link href="/register" className="btn-primary inline-flex px-8 py-3.5 text-[15px]">{t("ctaBtn")}<IconArrowRight size={16} /></Link>
        </section>
      </main>

      <footer className="border-t border-border py-6 text-center text-[12px] text-muted">
        {t("footer")}
      </footer>
    </div>
  );
}
