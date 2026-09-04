/**
 * Money utilities - integer centimes handling
 * 100 DH = 10000 centimes (1 DH = 100 centimes)
 * Never use floating point for financial calculations
 */

export type Centimes = number; // integer

export function toCentimes(dh: number): Centimes {
  return Math.round(dh * 100);
}

export function fromCentimes(centimes: Centimes): number {
  return centimes / 100;
}

export function formatMoney(centimes: Centimes, currency = "DH"): string {
  const dh = centimes / 100;
  // Format with 2 decimal places, but trim trailing .00 for display?
  // Spec shows "40 DH" not "40.00 DH", but we should handle both
  if (centimes % 100 === 0) {
    return `${dh.toFixed(0)} ${currency}`;
  }
  return `${dh.toFixed(2)} ${currency}`;
}

export function formatMoneyPrecise(centimes: Centimes): string {
  return (centimes / 100).toFixed(2);
}

export function add(a: Centimes, b: Centimes): Centimes {
  return a + b;
}

export function subtract(a: Centimes, b: Centimes): Centimes {
  return a - b;
}

export function compare(a: Centimes, b: Centimes): number {
  return a - b;
}

export function multiply(centimes: Centimes, factor: number): Centimes {
  return Math.round(centimes * factor);
}

/**
 * Allocate total centimes equally among n participants
 * Handles rounding deterministically: remainder distributed 1 centime at a time
 * Ensures sum(allocations) === total
 */
export function allocateEqual(totalCentimes: Centimes, count: number): Centimes[] {
  if (count === 0) return [];
  if (count === 1) return [totalCentimes];
  
  const base = Math.floor(totalCentimes / count);
  const remainder = totalCentimes % count;
  
  const allocations: Centimes[] = Array(count).fill(base);
  // Distribute remainder deterministically to first `remainder` participants
  for (let i = 0; i < remainder; i++) {
    allocations[i] += 1;
  }
  return allocations;
}

/**
 * Allocate by percentages (basis points: 100% = 10000)
 * Validates sum === 10000
 * Uses largest remainder method to ensure sum === total
 */
export function allocatePercentage(
  totalCentimes: Centimes,
  percentagesBasisPoints: number[]
): Centimes[] {
  const sum = percentagesBasisPoints.reduce((a, b) => a + b, 0);
  if (sum !== 10000) {
    throw new Error(`Percentages must sum to 10000 basis points (100%), got ${sum}`);
  }

  // Calculate floor amounts and remainders
  const allocations: Centimes[] = [];
  let floorSum = 0;
  const remainders: { index: number; remainder: number }[] = [];

  for (let i = 0; i < percentagesBasisPoints.length; i++) {
    const exact = (totalCentimes * percentagesBasisPoints[i]) / 10000;
    const floor = Math.floor(exact);
    allocations.push(floor);
    floorSum += floor;
    remainders.push({ index: i, remainder: exact - floor });
  }

  let leftover = totalCentimes - floorSum;
  // Sort by remainder descending for deterministic distribution
  remainders.sort((a, b) => b.remainder - a.remainder);

  for (let i = 0; i < leftover; i++) {
    const idx = remainders[i % remainders.length].index;
    allocations[idx] += 1;
  }

  return allocations;
}

/**
 * Validate custom amounts sum to total exactly
 */
export function validateCustomAmounts(totalCentimes: Centimes, amounts: Centimes[]): void {
  const sum = amounts.reduce((a, b) => a + b, 0);
  if (sum !== totalCentimes) {
    throw new Error(`Custom amounts must sum to ${totalCentimes} centimes, got ${sum}`);
  }
}

/**
 * Allocate by portions: e.g., 2,3,1 portions of total
 */
export function allocatePortions(totalCentimes: Centimes, portions: number[]): Centimes[] {
  const totalPortions = portions.reduce((a, b) => a + b, 0);
  if (totalPortions === 0) throw new Error("Total portions cannot be zero");

  const allocations: Centimes[] = [];
  let floorSum = 0;
  const remainders: { index: number; remainder: number }[] = [];

  for (let i = 0; i < portions.length; i++) {
    const exact = (totalCentimes * portions[i]) / totalPortions;
    const floor = Math.floor(exact);
    allocations.push(floor);
    floorSum += floor;
    remainders.push({ index: i, remainder: exact - floor });
  }

  let leftover = totalCentimes - floorSum;
  remainders.sort((a, b) => b.remainder - a.remainder);
  for (let i = 0; i < leftover; i++) {
    const idx = remainders[i % remainders.length].index;
    allocations[idx] += 1;
  }

  return allocations;
}

/**
 * Ensure expense invariants:
 * sum(allocations) === total
 * sum(payments) === total IF payments are recorded, or 0 if unrecorded/unknown
 * Unknown (empty) is distinct from 0 paid — it means payer not specified.
 */
export function validateExpenseTotal(totalCentimes: Centimes, allocations: Centimes[], payments: Centimes[]): void {
  const allocSum = allocations.reduce((a, b) => a + b, 0);
  const paySum = payments.reduce((a, b) => a + b, 0);
  if (allocSum !== totalCentimes) {
    throw new Error(`Allocation sum ${allocSum} != total ${totalCentimes}`);
  }
  // Payments are OPTIONAL (see spec clarification):
  // - [] => unknown payer, valid but settlement incomplete
  // - [...] => when recorded, must sum to total (supports multiple payers)
  if (payments.length !== 0 && paySum !== totalCentimes) {
    throw new Error(`Payment sum ${paySum} != total ${totalCentimes} (or leave empty for unknown payer)`);
  }
}
