"use client";
import { useState, useEffect } from "react";

const MODES = [
  { id: "default", label: "Mixed", icon: "🤝" },
  { id: "guys", label: "Guys", icon: "⚡" },
  { id: "girls", label: "Girls", icon: "🌸" },
] as const;

export default function FriendshipModeToggle() {
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<"default" | "guys" | "girls">("default");

useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("friendship-mode");
    if (stored === "guys" || stored === "girls") {
      setMode(stored);
      document.documentElement.classList.add(stored);
    }
  }, []);

  const toggle = () => {
    const ids = MODES.map(m => m.id);
    const idx = ids.indexOf(mode);
    const next = ids[(idx + 1) % ids.length];
    setMode(next);
    localStorage.setItem("friendship-mode", next);
    document.documentElement.classList.remove("guys", "girls");
    if (next !== "default") document.documentElement.classList.add(next);
  };

  if (!mounted) return <div className="w-9 h-9 rounded-[12px] bg-border" />;

  const current = MODES.find(m => m.id === mode)!;

  return (
    <button
      onClick={toggle}
      className="icon-btn text-[13px] font-semibold gap-1 px-2 w-auto"
      title={`Mode: ${current.label}`}
      aria-label="Toggle friendship mode"
    >
      <span>{current.icon}</span>
      <span className="hidden sm:inline">{current.label}</span>
    </button>
  );
}