"use client";
import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

interface QrScannerProps {
  onScan: (decodedText: string) => void;
  onError?: (error: string) => void;
}

export default function QrScanner({ onScan, onError }: QrScannerProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (scannerRef.current && isRunning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [isRunning]);

  const startScanner = async () => {
    if (!containerRef.current) return;

    try {
      const scanner = new Html5Qrcode("qr-scanner-container");
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          onScan(decodedText);
          scanner.stop().catch(() => {});
          setIsRunning(false);
        },
        () => {} // Ignore scan errors (no QR found yet)
      );

      setIsRunning(true);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start camera";
      setError(message);
      onError?.(message);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {}
      scannerRef.current = null;
    }
    setIsRunning(false);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        id="qr-scanner-container"
        ref={containerRef}
        className="w-full max-w-sm rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-700"
        style={{ minHeight: isRunning ? 300 : 0 }}
      />

      {error && (
        <p className="text-sm text-red-500 text-center">{error}</p>
      )}

      <div className="flex gap-3">
        {!isRunning ? (
          <button
            onClick={startScanner}
            className="px-6 py-3 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-medium hover:opacity-90"
          >
            Start Scanner
          </button>
        ) : (
          <button
            onClick={stopScanner}
            className="px-6 py-3 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600"
          >
            Stop Scanner
          </button>
        )}
      </div>
    </div>
  );
}
