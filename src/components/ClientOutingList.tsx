"use client";
import { useState } from "react";
import { IconSearch } from "@/components/icons";

export default function ClientOutingList({
  children,
  placeholder = "Search outings...",
}: {
  children: React.ReactNode;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");

  return (
    <div className="space-y-3">
      <div className="relative">
        <IconSearch size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={placeholder}
          className="input ps-9 text-[13px]"
        />
      </div>
      <div data-search-query={query.toLowerCase()}>
        {children}
      </div>
    </div>
  );
}