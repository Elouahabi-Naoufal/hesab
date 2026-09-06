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
      <div className="w-full max-w-sm rounded-[14px] overflow-hidden border border-border bg-black">
        <video
          ref={ref}
          muted
          playsInline
          className="w-full h-auto"
          style={{ minHeight: 250 }}
        />
      </div>

      {error && (
        <p className="text-[13px] text-danger text-center">{error}</p>
      )}

      <div className="flex gap-3">
        <button
          onClick={togglePause}
          className="btn-primary px-6 py-3"
        >
          {paused ? "Resume" : "Pause"}
        </button>
      </div>
    </div>
  );
}
