/**
 * Settlement Invariant Tests — Outing-centric model
 * Verifies core accounting invariants hold for all settlements
 */
import { describe, it, expect } from "vitest";
import { calculateSettlement, type OutingInput, type SettlementResult } from "../settlement";

function expectBalanced(result: SettlementResult) {
  if (!result.isComplete) return; // incomplete settlements are allowed to be unbalanced

  const positiveSum = result.memberBalances
    .filter(b => b.netBalance > 0)
    .reduce((s, b) => s + b.netBalance, 0);
  const negativeSum = result.memberBalances
    .filter(b => b.netBalance < 0)
    .reduce((s, b) => s + Math.abs(b.netBalance), 0);

  expect(positiveSum).toBe(negativeSum);
  expect(result.totalPaid).toBe(result.totalExpenses);

  // All transfers must be positive
  for (const t of result.transfers) {
    expect(t.amountCentimes).toBeGreaterThan(0);
    expect(t.fromUserId).not.toBe(t.toUserId);
  }

  // Applying transfers must zero all balances
  const simulated = new Map(result.memberBalances.map(b => [b.userId, b.netBalance]));
  for (const t of result.transfers) {
    // Debtor pays: their balance increases (toward 0)
    simulated.set(t.fromUserId, simulated.get(t.fromUserId)! + t.amountCentimes);
    // Creditor receives: their balance decreases (toward 0)
    simulated.set(t.toUserId, simulated.get(t.toUserId)! - t.amountCentimes);
  }
  for (const balance of simulated.values()) {
    expect(balance).toBe(0);
  }
}

describe("Settlement invariants", () => {
  it("Case A: 2 people, one pays", () => {
    const input: OutingInput = {
      members: [
        { userId: "a", displayName: "Alice" },
        { userId: "b", displayName: "Bob" },
      ],
      activities: [
        {
          id: "act1",
          name: "Dinner",
          pricingModel: "VARIABLE",
          status: "CLOSED",
          lineItems: [
            { userId: "a", priceCentimes: 5000 },
            { userId: "b", priceCentimes: 5000 },
          ],
          payments: [{ userId: "a", amountCentimes: 10000 }],
        },
      ],
    };

    const result = calculateSettlement(input);
    expect(result.isComplete).toBe(true);
    expectBalanced(result);
  });

  it("Case B: 3 people, each pays different", () => {
    const input: OutingInput = {
      members: [
        { userId: "a", displayName: "Alice" },
        { userId: "b", displayName: "Bob" },
        { userId: "c", displayName: "Charlie" },
      ],
      activities: [
        {
          id: "act1",
          name: "Restaurant",
          pricingModel: "VARIABLE",
          status: "CLOSED",
          lineItems: [
            { userId: "a", priceCentimes: 3000 },
            { userId: "b", priceCentimes: 4000 },
            { userId: "c", priceCentimes: 5000 },
          ],
          payments: [
            { userId: "a", amountCentimes: 1000 },
            { userId: "b", amountCentimes: 2000 },
            { userId: "c", amountCentimes: 9000 },
          ],
        },
      ],
    };

    const result = calculateSettlement(input);
    expect(result.isComplete).toBe(true);
    expectBalanced(result);
  });

  it("Case C: multiple activities", () => {
    const input: OutingInput = {
      members: [
        { userId: "a", displayName: "Alice" },
        { userId: "b", displayName: "Bob" },
        { userId: "c", displayName: "Charlie" },
      ],
      activities: [
        {
          id: "act1",
          name: "Pool",
          pricingModel: "FIXED",
          status: "CLOSED",
          usageRecords: [
            { id: "u1", totalCentimes: 500, status: "CONFIRMED", participantIds: ["a", "b"] },
          ],
          payments: [{ userId: "a", amountCentimes: 500 }],
        },
        {
          id: "act2",
          name: "Food",
          pricingModel: "VARIABLE",
          status: "CLOSED",
          lineItems: [
            { userId: "a", priceCentimes: 2000 },
            { userId: "b", priceCentimes: 3000 },
            { userId: "c", priceCentimes: 4000 },
          ],
          payments: [{ userId: "c", amountCentimes: 9000 }],
        },
      ],
    };

    const result = calculateSettlement(input);
    expect(result.isComplete).toBe(true);
    expectBalanced(result);
  });

  it("Case D: partial payment → incomplete", () => {
    const input: OutingInput = {
      members: [
        { userId: "a", displayName: "Alice" },
        { userId: "b", displayName: "Bob" },
      ],
      activities: [
        {
          id: "act1",
          name: "Dinner",
          pricingModel: "VARIABLE",
          status: "OPEN",
          lineItems: [
            { userId: "a", priceCentimes: 5000 },
            { userId: "b", priceCentimes: 5000 },
          ],
          payments: [],
        },
      ],
    };

    const result = calculateSettlement(input);
    expect(result.isComplete).toBe(false);
    expect(result.incompleteActivityIds).toContain("act1");
  });

  it("Case E: FIXED usage with 2 participants per match", () => {
    const input: OutingInput = {
      members: [
        { userId: "a", displayName: "Alice" },
        { userId: "b", displayName: "Bob" },
        { userId: "c", displayName: "Charlie" },
        { userId: "d", displayName: "Dave" },
      ],
      activities: [
        {
          id: "act1",
          name: "Pool S1",
          pricingModel: "FIXED",
          status: "CLOSED",
          usageRecords: [
            { id: "u1", totalCentimes: 2500, status: "CONFIRMED", participantIds: ["a", "b"] }, // 5 games × 5 DH
            { id: "u2", totalCentimes: 1500, status: "CONFIRMED", participantIds: ["c", "d"] }, // 3 games × 5 DH
          ],
          payments: [{ userId: "a", amountCentimes: 4000 }],
        },
      ],
    };

    const result = calculateSettlement(input);
    expect(result.isComplete).toBe(true);
    expectBalanced(result);

    // A: paid 4000, resp 1250, net +2750
    // B: paid 0, resp 1250, net -1250
    // C: paid 0, resp 750, net -750
    // D: paid 0, resp 750, net -750
    const a = result.memberBalances.find(b => b.userId === "a")!;
    expect(a.totalPaid).toBe(4000);
    expect(a.totalResponsibility).toBe(1250);
    expect(a.netBalance).toBe(2750);
  });
});
