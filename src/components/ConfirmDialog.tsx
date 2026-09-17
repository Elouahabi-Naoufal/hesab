"use client";
import { useState } from "react";
import { IconX } from "@/components/icons";

export default function ConfirmDialog({
  trigger,
  title,
  message,
  confirmLabel,
  onConfirm,
  variant = "danger",
}: {
  trigger: React.ReactNode;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  variant?: "danger" | "warning";
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div onClick={() => setOpen(true)}>{trigger}</div>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="w-full max-w-sm surface-20 p-6 space-y-4 animate-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-[16px] font-bold">{title}</h3>
              <button onClick={() => setOpen(false)} className="icon-btn" aria-label="Close"><IconX size={16} /></button>
            </div>
            <p className="text-[14px] text-muted leading-relaxed">{message}</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setOpen(false)} className="btn-secondary btn-sm">{confirmLabel === "Delete" ? "Cancel" : "Cancel"}</button>
              <button onClick={() => { setOpen(false); onConfirm(); }} className={`btn-sm ${variant === "danger" ? "btn-primary" : "btn-navy"}`} style={variant === "danger" ? { background: "var(--danger)" } : {}}>
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}