"use client";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState, useEffect, Suspense } from "react";
import { Link } from "@/i18n/navigation";
import { IconCheck, IconUsers, IconX } from "@/components/icons";

function JoinContent() {
  const t = useTranslations("join");
  const locale = useLocale();
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
        setMessage(data.message || t("joined"));
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
        setMessage(data.error || t("wentWrong"));
      }
    } catch {
      setStatus("error");
      setMessage(t("wentWrong"));
    }
  };

  useEffect(() => {
    if (!token) {
      setTimeout(() => {
        setStatus("error");
        setMessage(t("noToken"));
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
    const returnUrl = encodeURIComponent(`/${locale}/join?token=${token}&type=${type}`);
    router.push(`/login?returnUrl=${returnUrl}`);
  };

  if (status === "loading") {
    return (
      <div className="text-center space-y-4">
        <div className="animate-spin w-8 h-8 border-4 border-border border-t-brand rounded-full mx-auto" />
        <p className="text-muted text-[14px]">{t("processing")}</p>
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
          <h2 className="text-[20px] font-bold tracking-tight">{t("invited")}</h2>
          <p className="text-[14px] text-muted mt-1">
            {t("invitedSub", { type })}
          </p>
        </div>
        <button onClick={handleLoginRedirect} className="btn-primary w-full py-3">
          {t("loginToJoin")}
        </button>
        <Link href="/register" className="block text-[13px] text-muted hover:text-foreground">
          {t("createInstead")}
        </Link>
      </div>
    );
  }

  if (status === "joining") {
    return (
      <div className="text-center space-y-4">
        <div className="animate-spin w-8 h-8 border-4 border-border border-t-brand rounded-full mx-auto" />
        <p className="text-muted text-[14px]">{t("joining", { type })}</p>
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
          <h2 className="text-[20px] font-bold text-success tracking-tight">{t("joined")}</h2>
          <p className="text-[14px] text-muted mt-1">{message}</p>
        </div>
        <p className="text-[12px] text-muted">{t("redirecting")}</p>
      </div>
    );
  }

  return (
    <div className="text-center space-y-4">
      <div className="w-16 h-16 mx-auto rounded-[20px] bg-danger-subtle flex items-center justify-center text-danger">
        <IconX size={28} />
      </div>
      <div>
          <h2 className="text-[20px] font-bold text-danger tracking-tight">{t("wentWrong")}</h2>
          <p className="text-[14px] text-muted mt-1">{message}</p>
        </div>
        <Link href="/" className="btn-primary inline-block px-6 py-3">
          {t("goHome")}
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
            <div className="brand-mark"><img src="/logo.png?v=1" alt="PoolSplit" /></div>
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
