"use client";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";
import { IconGlobe, IconCheck } from "@/components/icons";

const NATIVE_NAMES: Record<AppLocale, string> = {
  en: "English",
  fr: "Français",
  ar: "العربية",
};

export default function LanguageSwitcher() {
  const t = useTranslations("profile");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const pathname = usePathname();

  const switchTo = (next: AppLocale) => {
    if (next === locale) return;
    router.replace(pathname, { locale: next });
  };

  return (
    <div className="card-elevated p-6 space-y-4">
      <div className="flex items-center gap-2.5">
        <span className="text-muted"><IconGlobe size={18} /></span>
        <div>
          <h2 className="text-[15px] font-semibold">{t("language")}</h2>
          <p className="text-[13px] text-muted">{t("languageHint")}</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2" role="group" aria-label={t("language")}>
        {(routing.locales as readonly AppLocale[]).map(l => {
          const active = l === locale;
          return (
            <button
              key={l}
              type="button"
              onClick={() => switchTo(l)}
              aria-pressed={active}
              className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-[12px] border text-[14px] font-semibold transition-colors ${
                active
                  ? "border-action bg-action-subtle text-action"
                  : "border-border bg-surface text-muted hover:text-foreground hover:border-muted"
              }`}
            >
              {active && <IconCheck size={13} />}
              {NATIVE_NAMES[l]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
