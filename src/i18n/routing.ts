import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "fr", "ar"],
  defaultLocale: "en",
  localePrefix: "always",
});

export type AppLocale = (typeof routing.locales)[number];

export const RTL_LOCALES: AppLocale[] = ["ar"];

export function isRtl(locale: string): boolean {
  return (RTL_LOCALES as string[]).includes(locale);
}
