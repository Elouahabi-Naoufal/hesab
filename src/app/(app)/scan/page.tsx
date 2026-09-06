"use client";
import { useRouter } from "next/navigation";
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
  const router = useRouter();

  const handleScan = (decodedText: string) => {
    if (decodedText.includes("/join")) {
      router.push(decodedText);
    } else if (decodedText.includes("token=")) {
      router.push(`/join?${decodedText}`);
    } else {
      router.push(decodedText);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-[26px] font-bold tracking-tight">Scan QR code</h1>
          <p className="text-[14px] text-muted">
            Point your camera at a PoolSplit QR code to join a group or outing
          </p>
        </div>

        <div className="card-elevated p-6">
          <QrScanner onScan={handleScan} />
        </div>

        <div className="text-center">
          <Link href="/" className="text-[13px] text-muted hover:text-foreground">
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
