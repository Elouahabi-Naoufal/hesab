import { getSession } from "@/server/auth/session";
import { redirect } from "next/navigation";
import { depositAction, getWalletAction } from "@/server/wallet/actions";
import { formatDH } from "@/lib/utils";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";

export default async function WalletPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const t = await getTranslations({ locale: locale as AppLocale, namespace: "wallet" });
  const { balanceCt, transactions } = await getWalletAction();

  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-6 py-6 sm:py-8 space-y-8">
      <h1 className="font-extrabold text-[26px] tracking-tight">{t("title")}</h1>

      <div className="surface-20 p-6 sm:p-8 space-y-6">
        <div>
          <div className="text-[13px] text-muted mb-1">{t("yourBalance")}</div>
          <div className={`money-hero text-[44px] font-extrabold ${balanceCt > 0 ? "text-success" : balanceCt < 0 ? "text-danger" : ""}`}>
            {formatDH(balanceCt)}
          </div>
        </div>

        <form action={depositAction} className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1 w-full space-y-1.5">
            <label className="text-[13px] font-medium text-muted">{t("addFunds")}</label>
            <input name="amount" placeholder="100" required className="input" />
          </div>
          <button type="submit" className="btn-primary whitespace-nowrap">{t("depositBtn")}</button>
        </form>
      </div>

      <section className="space-y-3">
        <h2 className="section-label">{t("history")}</h2>
        {transactions.length === 0 ? (
          <div className="card border-dashed p-10 text-center">
            <p className="text-[14px] text-muted">{t("noTransactions")}</p>
          </div>
        ) : (
          <div className="ledger">
            {transactions.map((tx: { id: string; type: string; amountCt: number; balanceAfterCt: number; description: string | null; createdAt: string }) => (
              <div key={tx.id} className="flex items-center justify-between py-2.5 gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      tx.type === "DEPOSIT" ? "bg-success" :
                      tx.type === "CONTRIBUTION" ? "bg-action" :
                      "bg-brand"
                    }`} />
                    <span className="text-[14px] font-medium">{tx.description || tx.type}</span>
                    <span className="text-[11px] text-muted">
                      {new Date(tx.createdAt).toLocaleDateString(locale === "ar" ? "ar-MA" : locale, {
                        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
                      })}
                    </span>
                  </div>
                </div>
                <div className="text-end flex-shrink-0">
                  <div className={`money text-[15px] font-bold ${
                    tx.type === "DEPOSIT" ? "text-success" : "text-danger"
                  }`}>
                    {tx.type === "DEPOSIT" ? "+" : "-"}{formatDH(tx.amountCt)}
                  </div>
                  <div className="text-[11px] text-muted">{formatDH(tx.balanceAfterCt)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}