"use client";
import { useFormStatus } from "react-dom";

/**
 * Financial-form submit button. Disables itself while the server action runs,
 * preventing accidental double-submission (double-click / Enter-spam) that
 * could otherwise create duplicate deposits or contributions.
 */
export default function SubmitButton({
  children,
  className,
  pendingText = "Working…",
}: {
  children: React.ReactNode;
  className?: string;
  pendingText?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-disabled={pending} className={`${className || ""} ${pending ? "opacity-60 cursor-wait" : ""}`}>
      {pending ? pendingText : children}
    </button>
  );
}
