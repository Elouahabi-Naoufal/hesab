"use client";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";

const QrScanner = dynamic(() => import("@/components/QrScanner"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center" style={{ minHeight: 250 }}>
      <div className="animate-spin w-8 h-8 border-4 border-zinc-300 border-t-zinc-900 rounded-full" />
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
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Scan QR Code</h1>
          <p className="text-sm text-zinc-500">
            Point your camera at a Hesab QR code to join a group or outing
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <QrScanner onScan={handleScan} />
        </div>

        <div className="text-center">
          <Link
            href="/"
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
