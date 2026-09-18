import { registerAction } from "@/server/auth/actions";
import { Link } from "@/i18n/navigation";
import AuthForm from "@/components/AuthForm";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";

export default async function RegisterPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "auth" });

  return (
    <div className="min-h-screen flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-[20px] bg-brand overflow-hidden flex items-center justify-center"><img src="/logo.png" alt="PoolSplit" className="w-full h-full object-cover" /></div>
          <h1 className="text-[26px] font-bold tracking-tight">{t("createAccount")}</h1>
          <p className="text-[14px] text-muted">{t("createSubtitle")}</p>
        </div>

        <AuthForm
          action={async (_prev: { error?: string }, formData: FormData) => {
            "use server";
            return await registerAction(formData);
          }}
          className="card-elevated p-6 space-y-4"
        >
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-muted">{t("displayName")}</label>
            <input name="displayName" required placeholder="Naoufal" className="input" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-muted">{t("username")}</label>
            <input name="username" required placeholder="naoufal" className="input" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-muted">{t("password")}</label>
            <input name="password" type="password" required className="input" />
          </div>
          <button type="submit" className="btn-primary w-full py-2.5">{t("createBtn")}</button>
          <p className="text-center text-[13px] text-muted">{t("haveAccount")} <Link href="/login" className="font-medium text-brand hover:underline">{t("loginLink")}</Link></p>
        </AuthForm>
      </div>
    </div>
  );
}
