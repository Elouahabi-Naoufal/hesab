"use client";
import { useState, useCallback, useRef } from "react";
import { useZxing, type DetectedBarcode } from "react-zxing";

interface QrScannerProps {
  onScan: (decodedText: string) => void;
  onError?: (error: string) => void;
}

export default function QrScanner({ onScan, onError }: QrScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const scannedRef = useRef(false);

  const onDecode = useCallback(
    (result: DetectedBarcode) => {
      if (scannedRef.current) return;
      scannedRef.current = true;
      setPaused(true);
      onScan(result.rawValue);
    },
    [onScan]
  );

  const { ref } = useZxing({
    paused,
    onDecodeResult: onDecode,
    onError(err) {
      if (!scannedRef.current) {
        const msg = err instanceof Error ? err.message : "Camera error";
        setError(msg);
        onError?.(msg);
      }
    },
  });

  const togglePause = () => {
    if (!paused) {
      scannedRef.current = false;
    }
    setPaused(!paused);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="w-full max-w-sm rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-700 bg-black">
        <video
          ref={ref}
          muted
          playsInline
          className="w-full h-auto"
          style={{ minHeight: 250 }}
        />
      </div>

      {error && (
        <p className="text-sm text-red-500 text-center">{error}</p>
      )}

      <div className="flex gap-3">
        <button
          onClick={togglePause}
          className="px-6 py-3 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-medium hover:opacity-90"
        >
          {paused ? "Resume" : "Pause"}
        </button>
      </div>
    </div>
  );
}
