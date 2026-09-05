/**
 * Member contribution shares — what percentage of group costs each person
 * should bear. Pure domain logic, no framework dependencies.
 *
 * Model:
 * - Each member MAY have an explicit share in basis points (10000 = 100%).
 * - Members with NULL share split the REMAINDER equally. If nobody has an
 *   explicit share, everyone is equal (100/n each, largest-remainder exact).
 * - Explicit shares must each be 0..10000 and their sum must be <= 10000;
 *   the remainder goes to NULL members. If the sum is exactly 10000, NULL
 *   members get 0 (they still show as members, just with no share).
 * - The group editor (owner) always saves a FULL set that sums to exactly
 *   10000, so in practice shares are exact and complete.
 */

export interface ShareInput {
  userId: string;
  shareBasisPoints: number | null;
}

export interface EffectiveShare {
  userId: string;
  basisPoints: number;
  percentDisplay: string;
}

/** Parse a user-typed percent ("33.33", "33,33", "25") into basis points. */
export function parsePercentToBasisPoints(input: string | number, field = "Share"): number {
  let s = String(input ?? "").trim().replace(/\s*(%|percent|pourcent)\s*$/i, "").replace(/\s+/g, "").replace(",", ".");
  if (s === "") throw new Error(`${field} is required (in %, e.g. 25 or 33.33).`);
  if (s.startsWith("-")) throw new Error(`${field} must not be negative.`);
  if (s.startsWith("+")) s = s.slice(1);
  if (!/^\d+(\.\d{1,2})?$/.test(s)) {
    if (/^\d+\.\d{3,}$/.test(s)) throw new Error(`${field} supports at most 2 decimals.`);
    throw new Error(`${field} must be a valid percent like 25 or 33.33 (got "${input}").`);
  }
  const [intPart, fracPart = ""] = s.split(".");
  const bp = Number(intPart) * 100 + Number((fracPart + "00").slice(0, 2));
  if (!Number.isSafeInteger(bp) || bp > 10000) {
    throw new Error(`${field} must be between 0 and 100 (got "${input}").`);
  }
  return bp;
}

export function formatPercent(basisPoints: number): string {
  if (basisPoints % 100 === 0) return `${(basisPoints / 100).toFixed(0)}%`;
  return `${(basisPoints / 100).toFixed(2)}%`;
}

/**
 * Compute each member's effective share in basis points (always sums to
 * exactly 10000). NULL-share members split the remainder equally with
 * largest-remainder distribution (same determinism as allocateEqual).
 */
export function getEffectiveShares(members: ShareInput[]): EffectiveShare[] {
  if (members.length === 0) throw new Error("At least one member required.");
  for (const m of members) {
    if (m.shareBasisPoints !== null && (!Number.isInteger(m.shareBasisPoints) || m.shareBasisPoints < 0 || m.shareBasisPoints > 10000)) {
      throw new Error(`Invalid share for member ${m.userId}: must be 0..10000 basis points or null.`);
    }
  }
  const explicit = members.filter(m => m.shareBasisPoints !== null);
  const unset = members.filter(m => m.shareBasisPoints === null);
  const explicitSum = explicit.reduce((s, m) => s + (m.shareBasisPoints as number), 0);
  if (explicitSum > 10000) {
    throw new Error(`Explicit shares add up to more than 100% (${formatPercent(explicitSum)}).`);
  }
  const remainder = 10000 - explicitSum;
  // Largest-remainder split of the remainder among unset members
  let split: number[] = [];
  if (unset.length > 0) {
    const base = Math.floor(remainder / unset.length);
    const rem = remainder % unset.length;
    split = Array(unset.length).fill(base).map((x, i) => (i < rem ? x + 1 : x));
  } else if (remainder !== 0) {
    // No unset members but shares don't cover 100% — only valid when the
    // caller enforces exact sums (the group editor does). Fail loudly here.
    throw new Error(`Shares add up to ${formatPercent(explicitSum)}, not 100%.`);
  }
  const out: EffectiveShare[] = [];
  let j = 0;
  for (const m of members) {
    const bp = m.shareBasisPoints === null ? split[j++] : (m.shareBasisPoints as number);
    out.push({ userId: m.userId, basisPoints: bp, percentDisplay: formatPercent(bp) });
  }
  return out;
}

/** Validate a full owner-saved set: same members, each 0..10000, sum exactly 10000. */
export function validateShareSet(memberIds: string[], shares: Array<{ userId: string; basisPoints: number }>): void {
  const ids = new Set(memberIds);
  if (shares.length !== memberIds.length || !shares.every(s => ids.has(s.userId))) {
    throw new Error("Shares must cover exactly the current members.");
  }
  for (const s of shares) {
    if (!Number.isInteger(s.basisPoints) || s.basisPoints < 0 || s.basisPoints > 10000) {
      throw new Error(`Invalid share for member: must be 0..100%.`);
    }
  }
  const sum = shares.reduce((total, s) => total + s.basisPoints, 0);
  if (sum !== 10000) {
    throw new Error(`Shares must add up to exactly 100% (got ${formatPercent(sum)}).`);
  }
}
