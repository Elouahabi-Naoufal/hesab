"use client";
import { useEffect, useRef } from "react";
import QRCode from "qrcode";

interface QrCodeProps {
  value: string;
  size?: number;
  className?: string;
}

export default function QrCode({ value, size = 200, className = "" }: QrCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, value, {
        width: size,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      });
    }
  }, [value, size]);

  return (
    <div className={`inline-flex flex-col items-center gap-2 ${className}`}>
      <canvas ref={canvasRef} />
      <p className="text-xs text-zinc-500 break-all max-w-[200px] text-center">{value}</p>
    </div>
  );
}
