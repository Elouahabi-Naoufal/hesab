"use client";
import { useState } from "react";
import { IconSun, IconMoon } from "@/components/icons";

function getInitialDark(): boolean {
  if (typeof window === "undefined") return false;
  const stored = localStorage.getItem("theme");
  if (stored === "dark") return true;
  if (stored === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(getInitialDark);
  const [mounted, setMounted] = useState(false);

  if (!mounted && typeof window !== "undefined") {
    setMounted(true);
    document.documentElement.classList.toggle("dark", isDark);
  }

  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    localStorage.setItem("theme", next ? "dark" : "light");
    document.documentElement.classList.toggle("dark", next);
  };

  if (!mounted) return <div className="w-9 h-9" />;

  return (
    <button onClick={toggle} className="icon-btn" title={isDark ? "Light mode" : "Dark mode"} aria-label="Toggle theme">
      {isDark ? <IconSun size={16} /> : <IconMoon size={16} />}
    </button>
  );
}