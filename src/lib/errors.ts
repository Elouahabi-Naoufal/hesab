import { errCode, errMsg } from "@/lib/utils";

/**
 * Convert an unexpected failure into a user-facing declaration.
 *
 * Rules:
 * - Known Prisma error codes become plain-language declarations.
 * - Technical engine text (unknown-user/invariant throws, Prisma client
 *   validation noise) becomes the caller-supplied fallback.
 * - Everything else passes through untouched, so our own validation
 *   messages (e.g. "Amount must be…", "Select at least one participant")
 *   reach the user exactly as written.
 */
export function userError(e: unknown, fallback: string): string {
  const code = errCode(e);
  if (code) {
    switch (code) {
      case "P2002":
        return "This already exists — nothing was changed.";
      case "P2025":
        return "That item no longer exists. Refresh the page and try again.";
      case "P2003":
      case "P2014":
        return "Something it depends on is missing. Refresh the page and try again.";
      default:
        return fallback;
    }
  }
  if (
    e instanceof Error &&
    /unknown user in|invariant violated|Invalid `prisma\.|Expected .* for argument/i.test(e.message)
  ) {
    return fallback;
  }
  return errMsg(e) || fallback;
}
