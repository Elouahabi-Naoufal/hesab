"use client";
import { useActionState } from "react";

export default function AuthForm({
  action,
  children,
  className,
}: {
  action: (prevState: { error?: string }, formData: FormData) => Promise<{ error?: string }>;
  children: React.ReactNode;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className={className}>
      {children}
      {state?.error && (
        <div role="alert" className="p-2.5 rounded-[12px] bg-danger-subtle border border-danger/20 text-danger text-[13px]">
          {state.error}
        </div>
      )}
      <div className="sr-only" aria-live="polite">{pending ? "…" : ""}</div>
    </form>
  );
}
