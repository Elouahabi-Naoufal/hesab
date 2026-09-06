"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import { useZxing, type DetectedBarcode } from "react-zxing";

interface QrScannerProps {
  onScan: (decodedText: string) => void;
  onError?: (error: string) => void;
}

type Phase =
  | { kind: "checking" }
  | { kind: "ready" }
  | { kind: "active" }
  | { kind: "denied" }
  | { kind: "no-camera" }
  | { kind: "insecure" }
  | { kind: "error"; message: string };

function describeError(err: unknown): Phase {
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError") return { kind: "denied" };
  if (name === "NotFoundError" || name === "OverconstrainedError") return { kind: "no-camera" };
  return { kind: "error", message: err instanceof Error ? err.message : "Camera error" };
}

async function probePermission(): Promise<"granted" | "denied" | "unknown"> {
  try {
    const status = await navigator.permissions?.query({ name: "camera" as PermissionName });
    if (status?.state === "granted") return "granted";
    if (status?.state === "denied") return "denied";
  } catch {
    // Permissions API unavailable (older Safari) — fall through to direct request.
  }
  return "unknown";
}

function ScannerView({ onScan, onStreamError }: { onScan: (v: string) => void; onStreamError: (e: unknown) => void }) {
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
      if (!scannedRef.current) onStreamError(err);
    },
  });

  const togglePause = () => {
    if (!paused) scannedRef.current = false;
    setPaused(!paused);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="w-full max-w-sm rounded-[20px] overflow-hidden border border-border bg-black">
        <video ref={ref} muted playsInline className="w-full h-auto" style={{ minHeight: 250 }} />
      </div>
      <button onClick={togglePause} className="btn-secondary px-6">
        {paused ? "Resume" : "Pause"}
      </button>
    </div>
  );
}

export default function QrScanner({ onScan, onError }: QrScannerProps) {
  const [phase, setPhase] = useState<Phase>({ kind: "checking" });
  const [busy, setBusy] = useState(false);
  const [runId, setRunId] = useState(0);

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setPhase({ kind: "insecure" });
      return;
    }
    probePermission().then(state => {
      if (state === "denied") setPhase({ kind: "denied" });
      else setPhase({ kind: "ready" });
    });
  }, []);

  const request = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setPhase({ kind: "insecure" });
      return;
    }
    setBusy(true);
    try {
      // User-tap request: this is what makes the browser show the prompt
      // reliably (including iOS Safari). Release the probe stream at once;
      // the decoder opens its own stream without re-prompting.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      stream.getTracks().forEach(t => t.stop());
      setRunId(id => id + 1);
      setPhase({ kind: "active" });
    } catch (err) {
      const next = describeError(err);
      setPhase(next);
      if (next.kind === "denied" || next.kind === "error") {
        onError?.(next.kind === "denied" ? "Camera permission denied" : next.message);
      }
    } finally {
      setBusy(false);
    }
  }, [onError]);

  const retry = useCallback(() => {
    setPhase({ kind: "checking" });
    probePermission().then(state => {
      if (state === "denied") setPhase({ kind: "denied" });
      else void request();
    });
  }, [request]);

  if (phase.kind === "checking") {
    return (
      <div className="flex flex-col items-center gap-3 py-10">
        <div className="animate-spin w-8 h-8 border-4 border-border border-t-action rounded-full" />
        <p className="text-muted text-[14px]">Checking camera…</p>
      </div>
    );
  }

  if (phase.kind === "ready") {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <p className="text-[14px] font-semibold">Allow camera access to scan</p>
        <p className="text-[13px] text-muted max-w-xs">Your browser will ask for permission. The camera is only used to read the QR code.</p>
        <button onClick={() => void request()} disabled={busy} className="btn-primary px-6">
          {busy ? "Requesting…" : "Enable camera"}
        </button>
      </div>
    );
  }

  if (phase.kind === "denied") {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <p className="text-[14px] font-semibold text-danger">Camera is blocked</p>
        <p className="text-[13px] text-muted max-w-xs">
          The browser is not showing the permission prompt because camera access was blocked for this site.
          Tap the lock (or <span className="font-mono">⋯</span>) icon in the address bar → Site settings → Camera → Allow,
          then try again.
        </p>
        <button onClick={retry} className="btn-primary px-6">
          Try again
        </button>
      </div>
    );
  }

  if (phase.kind === "no-camera") {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <p className="text-[14px] font-semibold">No camera found</p>
        <p className="text-[13px] text-muted max-w-xs">This device has no available camera, or it is already in use by another app.</p>
        <button onClick={retry} className="btn-secondary px-6">
          Try again
        </button>
      </div>
    );
  }

  if (phase.kind === "insecure") {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <p className="text-[14px] font-semibold">Camera unavailable</p>
        <p className="text-[13px] text-muted max-w-xs">Browsers only allow camera access on secure (HTTPS) pages. Open this page over HTTPS and try again.</p>
      </div>
    );
  }

  if (phase.kind === "error") {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <p className="text-[14px] font-semibold text-danger">Camera error</p>
        <p className="text-[13px] text-muted max-w-xs">{phase.message}</p>
        <button onClick={retry} className="btn-secondary px-6">
          Try again
        </button>
      </div>
    );
  }

  return (
    <ScannerView
      key={runId}
      onScan={onScan}
      onStreamError={err => {
        const next = describeError(err);
        setPhase(next.kind === "active" ? { kind: "error", message: "Camera error" } : next);
      }}
    />
  );
}
