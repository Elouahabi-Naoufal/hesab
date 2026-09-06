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
        className="w-full px-4 py-2.5 rounded-[10px] border border-dashed border-border text-[13px] font-medium hover:bg-elevated transition flex items-center justify-center gap-2 text-muted"
      >
        📱 {showQr ? "Hide QR Code" : "Show QR Code"}
      </button>

      {showQr && (
        <div className="p-4 rounded-[14px] bg-elevated space-y-3">
          <p className="text-[12px] text-muted text-center">
            Scan to join: <strong className="text-foreground">{name}</strong>
          </p>
          <div className="flex justify-center">
            <QrCode value={joinUrl} size={180} />
          </div>
          <div className="text-center">
            <a href={joinUrl} target="_blank" rel="noopener noreferrer" className="text-[12px] text-brand hover:underline">
              Open invite link
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
