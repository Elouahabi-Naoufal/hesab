"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";

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
      // Use setTimeout to avoid synchronous setState in effect
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
  }, [token]);

  const handleLoginRedirect = () => {
    const returnUrl = encodeURIComponent(`/join?token=${token}&type=${type}`);
    router.push(`/login?returnUrl=${returnUrl}`);
  };

  if (status === "loading") {
    return (
      <div className="text-center space-y-4">
        <div className="animate-spin w-8 h-8 border-4 border-zinc-300 border-t-zinc-900 rounded-full mx-auto" />
        <p className="text-zinc-500">Processing invitation...</p>
      </div>
    );
  }

  if (status === "login") {
    return (
      <div className="text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-2xl">
          {type === "outing" ? "🎉" : "👥"}
        </div>
        <div>
          <h2 className="text-xl font-bold">You&apos;re invited!</h2>
          <p className="text-sm text-zinc-500 mt-1">
            Log in or create an account to join this {type}
          </p>
        </div>
        <button
          onClick={handleLoginRedirect}
          className="w-full py-3 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-medium hover:opacity-90"
        >
          Login to Join
        </button>
        <Link
          href="/register"
          className="block text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
        >
          Create an account instead
        </Link>
      </div>
    );
  }

  if (status === "joining") {
    return (
      <div className="text-center space-y-4">
        <div className="animate-spin w-8 h-8 border-4 border-zinc-300 border-t-zinc-900 rounded-full mx-auto" />
        <p className="text-zinc-500">Joining {type}...</p>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-2xl text-green-600">
          ✓
        </div>
        <div>
          <h2 className="text-xl font-bold text-green-600 dark:text-green-400">Joined!</h2>
          <p className="text-sm text-zinc-500 mt-1">{message}</p>
        </div>
        <p className="text-xs text-zinc-400">Redirecting...</p>
      </div>
    );
  }

  return (
    <div className="text-center space-y-4">
      <div className="w-16 h-16 mx-auto rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-2xl text-red-600">
        ✗
      </div>
      <div>
        <h2 className="text-xl font-bold text-red-600 dark:text-red-400">Error</h2>
        <p className="text-sm text-zinc-500 mt-1">{message}</p>
      </div>
      <Link
        href="/"
        className="inline-block px-6 py-3 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-medium hover:opacity-90"
      >
        Go Home
      </Link>
    </div>
  );
}

export default function JoinPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center gap-2 text-zinc-900 dark:text-white">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 dark:bg-white flex items-center justify-center text-white dark:text-zinc-900 font-bold text-sm">
              H
            </div>
            <span className="font-bold">Hesab</span>
          </Link>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <Suspense
            fallback={
              <div className="text-center">
                <div className="animate-spin w-8 h-8 border-4 border-zinc-300 border-t-zinc-900 rounded-full mx-auto" />
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
