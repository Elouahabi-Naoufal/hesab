/**
 * Settlement Engine Tests — Outing-centric model
 * Tests the core settlement logic with FIXED and VARIABLE activities
 */
import { describe, it, expect } from "vitest";
import { calculateSettlement, simplifyDebts, type OutingInput, type SettlementResult } from "../settlement";

describe("calculateSettlement", () => {
  it("simple 2-person split: one pays for both", () => {
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
    expect(result.totalExpenses).toBe(10000);
    expect(result.totalPaid).toBe(10000);

    const a = result.memberBalances.find(b => b.userId === "a")!;
    const b = result.memberBalances.find(b => b.userId === "b")!;

    expect(a.totalPaid).toBe(10000);
    expect(a.totalResponsibility).toBe(5000);
    expect(a.netBalance).toBe(5000); // should receive

    expect(b.totalPaid).toBe(0);
    expect(b.totalResponsibility).toBe(5000);
    expect(b.netBalance).toBe(-5000); // owes

    expect(result.transfers).toHaveLength(1);
    expect(result.transfers[0]).toEqual({
      fromUserId: "b",
      toUserId: "a",
      amountCentimes: 5000,
      fromDisplayName: "Bob",
      toDisplayName: "Alice",
    });
  });

  it("3-person: one pays for all, equal split", () => {
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
            { id: "u1", totalCentimes: 1500, status: "CONFIRMED", participantIds: ["a", "b", "c"] },
          ],
          payments: [{ userId: "a", amountCentimes: 1500 }],
        },
      ],
    };

    const result = calculateSettlement(input);
    expect(result.isComplete).toBe(true);

    const a = result.memberBalances.find(b => b.userId === "a")!;
    expect(a.totalPaid).toBe(1500);
    expect(a.totalResponsibility).toBe(500);
    expect(a.netBalance).toBe(1000);

    expect(result.transfers).toHaveLength(2);
  });

  it("multi-activity outing: mixed FIXED and VARIABLE", () => {
    const input: OutingInput = {
      members: [
        { userId: "a", displayName: "Alice" },
        { userId: "b", displayName: "Bob" },
        { userId: "c", displayName: "Charlie" },
      ],
      activities: [
        {
          id: "act1",
          name: "InDrive",
          pricingModel: "VARIABLE",
          status: "CLOSED",
          lineItems: [
            { userId: "a", priceCentimes: 333 },
            { userId: "b", priceCentimes: 333 },
            { userId: "c", priceCentimes: 334 },
          ],
          payments: [{ userId: "a", amountCentimes: 1000 }],
        },
        {
          id: "act2",
          name: "Pool",
          pricingModel: "FIXED",
          status: "CLOSED",
          usageRecords: [
            { id: "u1", totalCentimes: 500, status: "CONFIRMED", participantIds: ["a", "b"] },
          ],
          payments: [{ userId: "b", amountCentimes: 500 }],
        },
        {
          id: "act3",
          name: "Restaurant",
          pricingModel: "VARIABLE",
          status: "CLOSED",
          lineItems: [
            { userId: "a", priceCentimes: 4000 },
            { userId: "b", priceCentimes: 5000 },
            { userId: "c", priceCentimes: 3000 },
          ],
          payments: [{ userId: "c", amountCentimes: 12000 }],
        },
      ],
    };

    const result = calculateSettlement(input);
    expect(result.isComplete).toBe(true);

    // A: paid 1000, resp 333+250+4000 = 4583 → net = -3583
    // B: paid 500, resp 333+250+5000 = 5583 → net = -5083
    // C: paid 12000, resp 334+0+3000 = 3334 → net = +8666

    const a = result.memberBalances.find(b => b.userId === "a")!;
    const b = result.memberBalances.find(b => b.userId === "b")!;
    const c = result.memberBalances.find(b => b.userId === "c")!;

    expect(a.netBalance).toBe(1000 - 4583);
    expect(b.netBalance).toBe(500 - 5583);
    expect(c.netBalance).toBe(12000 - 3334);

    // Sum of all net = 0
    const sum = a.netBalance + b.netBalance + c.netBalance;
    expect(sum).toBe(0);
  });

  it("disputed usage records excluded from calculation", () => {
    const input: OutingInput = {
      members: [
        { userId: "a", displayName: "Alice" },
        { userId: "b", displayName: "Bob" },
      ],
      activities: [
        {
          id: "act1",
          name: "Pool",
          pricingModel: "FIXED",
          status: "OPEN",
          usageRecords: [
            { id: "u1", totalCentimes: 500, status: "CONFIRMED", participantIds: ["a", "b"] },
            { id: "u2", totalCentimes: 1000, status: "DISPUTED", participantIds: ["a", "b"] },
          ],
          payments: [{ userId: "a", amountCentimes: 500 }],
        },
      ],
    };

    const result = calculateSettlement(input);
    expect(result.isComplete).toBe(true);
    expect(result.totalExpenses).toBe(500); // only the confirmed record

    const a = result.memberBalances.find(b => b.userId === "a")!;
    expect(a.totalResponsibility).toBe(250);
  });

  it("no payments → incomplete", () => {
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
          ],
          payments: [],
        },
      ],
    };

    const result = calculateSettlement(input);
    expect(result.isComplete).toBe(false);
    expect(result.incompleteActivityIds).toContain("act1");
  });

  it("partial payments → incomplete", () => {
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
          payments: [{ userId: "a", amountCentimes: 3000 }],
        },
      ],
    };

    const result = calculateSettlement(input);
    expect(result.isComplete).toBe(false);
  });
});

describe("simplifyDebts", () => {
  it("eliminates intermediaries", () => {
    const balances = [
      { userId: "a", totalPaid: 10000, totalResponsibility: 3333, netBalance: 6667 },
      { userId: "b", totalPaid: 0, totalResponsibility: 3333, netBalance: -3333 },
      { userId: "c", totalPaid: 0, totalResponsibility: 3334, netBalance: -3334 },
    ];

    const transfers = simplifyDebts(balances);
    expect(transfers).toHaveLength(2);
    // B → A: 3333, C → A: 3334
    expect(transfers[0].fromUserId).toBe("c");
    expect(transfers[0].amountCentimes).toBe(3334);
    expect(transfers[1].fromUserId).toBe("b");
    expect(transfers[1].amountCentimes).toBe(3333);
  });

  it("no transfers when all settled", () => {
    const balances = [
      { userId: "a", totalPaid: 5000, totalResponsibility: 5000, netBalance: 0 },
      { userId: "b", totalPaid: 5000, totalResponsibility: 5000, netBalance: 0 },
    ];

    const transfers = simplifyDebts(balances);
    expect(transfers).toHaveLength(0);
  });
});
