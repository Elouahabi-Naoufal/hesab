import { nanoid } from "nanoid";

export function generatePublicUserId(): string {
  // usr_ + 6 chars alphanumeric
  return `usr_${nanoid(6).toUpperCase()}`;
}

export function generatePublicToken(): string {
  return nanoid(16);
}

export function generateGroupPublicToken(): string {
  return nanoid(12);
}

export function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

// Canonical money helpers live in @/domain/money (single source of truth).
export { formatDH, parseDHToCentimes, MAX_CENTIMES } from "@/domain/money";
export type { Centimes } from "@/domain/money";

/** Safe message extraction for `catch (e: unknown)` — never leaks internals by itself. */
export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Prisma-style error code probe (`P2002`, `P2025`, …) without using `any`. */
export function errCode(e: unknown): string | undefined {
  if (typeof e === "object" && e !== null && "code" in e) {
    const code: unknown = (e as { code: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}
