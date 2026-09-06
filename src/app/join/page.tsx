"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { IconCheck, IconUsers, IconX } from "@/components/icons";

function JoinContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "login" | "joining" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  const token = searchParams.get("token");
  const type = searchParams.get("type") || "group";

  const joinWithToken = async () => {
    if (!token) return;

    try {
      const endpoint = type === "outing" ? "/api/join/outing" : "/api/join/group";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus("success");
        setMessage(data.message || "Successfully joined!");
        setTimeout(() => {
          if (type === "outing" && data.outingId) {
            router.push(`/groups/${data.groupId}/outings/${data.outingId}`);
          } else if (data.groupId) {
            router.push(`/groups/${data.groupId}`);
          } else {
            router.push("/dashboard");
          }
        }, 2000);
      } else {
        setStatus("error");
        setMessage(data.error || "Failed to join.");
      }
    } catch {
      setStatus("error");
      setMessage("An error occurred. Please try again.");
    }
  };

  useEffect(() => {
    if (!token) {
      setTimeout(() => {
        setStatus("error");
        setMessage("No invitation token found.");
      }, 0);
      return;
    }

    fetch("/api/auth/me")
      .then((res) => {
        if (res.ok) {
          setStatus("joining");
          joinWithToken();
        } else {
          setStatus("login");
        }
      })
      .catch(() => {
        setStatus("login");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleLoginRedirect = () => {
    const returnUrl = encodeURIComponent(`/join?token=${token}&type=${type}`);
    router.push(`/login?returnUrl=${returnUrl}`);
  };

  if (status === "loading") {
    return (
      <div className="text-center space-y-4">
        <div className="animate-spin w-8 h-8 border-4 border-border border-t-brand rounded-full mx-auto" />
        <p className="text-muted text-[14px]">Processing invitation...</p>
      </div>
    );
  }

  if (status === "login") {
    return (
      <div className="text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-[20px] bg-brand-subtle text-brand flex items-center justify-center">
          <IconUsers size={28} />
        </div>
        <div>
          <h2 className="text-[20px] font-bold tracking-tight">You&apos;re invited!</h2>
          <p className="text-[14px] text-muted mt-1">
            Log in or create an account to join this {type}
          </p>
        </div>
        <button onClick={handleLoginRedirect} className="btn-primary w-full py-3">
          Login to Join
        </button>
        <Link href="/register" className="block text-[13px] text-muted hover:text-foreground">
          Create an account instead
        </Link>
      </div>
    );
  }

  if (status === "joining") {
    return (
      <div className="text-center space-y-4">
        <div className="animate-spin w-8 h-8 border-4 border-border border-t-brand rounded-full mx-auto" />
        <p className="text-muted text-[14px]">Joining {type}...</p>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-[20px] bg-success-subtle flex items-center justify-center text-success">
          <IconCheck size={28} />
        </div>
        <div>
          <h2 className="text-[20px] font-bold text-success tracking-tight">Joined!</h2>
          <p className="text-[14px] text-muted mt-1">{message}</p>
        </div>
        <p className="text-[12px] text-muted">Redirecting...</p>
      </div>
    );
  }

  return (
    <div className="text-center space-y-4">
      <div className="w-16 h-16 mx-auto rounded-[20px] bg-danger-subtle flex items-center justify-center text-danger">
        <IconX size={28} />
      </div>
      <div>
        <h2 className="text-[20px] font-bold text-danger tracking-tight">Something went wrong</h2>
        <p className="text-[14px] text-muted mt-1">{message}</p>
      </div>
      <Link href="/" className="btn-primary inline-block px-6 py-3">
        Go Home
      </Link>
    </div>
  );
}

export default function JoinPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="brand-mark">P</div>
            <span className="font-bold text-[15px]">PoolSplit</span>
          </Link>
        </div>

        <div className="card-elevated p-6">
          <Suspense
            fallback={
              <div className="text-center">
                <div className="animate-spin w-8 h-8 border-4 border-border border-t-brand rounded-full mx-auto" />
              </div>
            }
          >
            <JoinContent />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
