"use client";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import Link from "next/link";

const QrScanner = dynamic(() => import("@/components/QrScanner"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center" style={{ minHeight: 250 }}>
      <div className="animate-spin w-8 h-8 border-4 border-border border-t-brand rounded-full" />
    </div>
  ),
});

export default function ScanPage() {
  const t = useTranslations("scan");
  const router = useRouter();

  const handleScan = (decodedText: string) => {
    // QR codes carry absolute invite URLs (no locale). Extract the token
    // and navigate locale-aware instead of pushing the raw URL.
    try {
      const url = new URL(decodedText, window.location.origin);
      const token = url.searchParams.get("token");
      if (token) {
        const type = url.searchParams.get("type") || "group";
        router.push(`/join?token=${encodeURIComponent(token)}&type=${encodeURIComponent(type)}`);
        return;
      }
    } catch {
      // Not a URL — fall through to raw navigation.
    }
    router.push(decodedText);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-[26px] font-bold tracking-tight">{t("title")}</h1>
          <p className="text-[14px] text-muted">
            {t("subtitle")}
          </p>
        </div>

        <div className="card-elevated p-6">
          <QrScanner onScan={handleScan} />
        </div>

        <div className="text-center">
          <Link href="/" className="text-[13px] text-muted hover:text-foreground">
            {t("backHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}
