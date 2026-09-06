"use client";
import { useState } from "react";
import dynamic from "next/dynamic";

const QrCode = dynamic(() => import("@/components/QrCode"), { ssr: false });

interface QrInviteProps {
  token: string;
  type: "group" | "outing";
  name: string;
}

export default function QrInvite({ token, type, name }: QrInviteProps) {
  const [showQr, setShowQr] = useState(false);
  const joinUrl = `${typeof window !== "undefined" ? window.location.origin : "https://hesab.naoufalelouahabi.com"}/join?token=${token}&type=${type}`;

  return (
    <div className="space-y-2">
      <button
        onClick={() => setShowQr(!showQr)}
        className="w-full px-4 py-2 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-600 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition flex items-center justify-center gap-2"
      >
        <span className="text-lg">📱</span>
        {showQr ? "Hide QR Code" : "Show QR Code"}
      </button>

      {showQr && (
        <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800 space-y-3">
          <p className="text-xs text-zinc-500 text-center">
            Scan to join {type}: <strong>{name}</strong>
          </p>
          <div className="flex justify-center">
            <QrCode value={joinUrl} size={180} />
          </div>
          <div className="text-center">
            <a
              href={joinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-500 hover:underline"
            >
              Open invite link
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
