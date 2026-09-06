"use client";
import { useRouter } from "next/navigation";
import QrScanner from "@/components/QrScanner";
import Link from "next/link";

export default function ScanPage() {
  const router = useRouter();

  const handleScan = (decodedText: string) => {
    // The QR code should contain a URL like:
    // https://hesab.naoufalelouahabi.com/join?token=xxx&type=group|outing
    if (decodedText.includes("/join")) {
      router.push(decodedText);
    } else if (decodedText.includes("token=")) {
      // If it's just a token, build the join URL
      router.push(`/join?${decodedText}`);
    } else {
      // Try to navigate to it directly
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
