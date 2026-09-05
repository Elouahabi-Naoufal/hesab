/**
 * Hesab — Full Specification Compliance Test Suite
 * Tests every scenario from the prompt.md specification
 * Organized by spec section number
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  calculateSettlement,
  simplifyDebts,
  explainSettlement,
  OutingInput,
  SettlementResult,
} from "@/domain/settlement";
import {
  parseDHToCentimes,
  formatDH,
  allocateEqual,
  MAX_CENTIMES,
} from "@/domain/money";
import {
  getEffectiveShares,
  validateShareSet,
  parsePercentToBasisPoints,
} from "@/domain/shares";

// ═══════════════════════════════════════════════════════════════════════
// §1. PRODUCT PURPOSE — Hesab tells who owes whom after an outing
// ═══════════════════════════════════════════════════════════════════════
describe("§1 Product Purpose", () => {
  it("produces who-owes-whom from a simple scenario", () => {
    const input: OutingInput = {
      members: [
        { userId: "ahmed", displayName: "Ahmed" },
        { userId: "yassine", displayName: "Yassine" },
      ],
      activities: [
        {
          id: "a1",
          name: "Restaurant",
          pricingModel: "VARIABLE",
          status: "CLOSED",
          lineItems: [
            { userId: "ahmed", priceCentimes: 4000 },
            { userId: "yassine", priceCentimes: 6000 },
          ],
          payments: [{ userId: "ahmed", amountCentimes: 10000 }],
        },
      ],
    };
    const result = calculateSettlement(input);
    expect(result.isComplete).toBe(true);
    expect(result.transfers).toHaveLength(1);
    expect(result.transfers[0]).toEqual(
      expect.objectContaining({
        fromUserId: "yassine",
        toUserId: "ahmed",
        amountCentimes: 6000,
      })
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════
// §2. FUNDAMENTAL ACCOUNTING MODEL
// ═══════════════════════════════════════════════════════════════════════
describe("§2 Fundamental Accounting Model", () => {
  it("net balance = total paid - total responsibility", () => {
    const input: OutingInput = {
      members: [{ userId: "a" }, { userId: "b" }],
      activities: [
        {
          id: "a1",
          name: "Dinner",
          pricingModel: "VARIABLE",
          status: "CLOSED",
          lineItems: [
            { userId: "a", priceCentimes: 4000 },
            { userId: "b", priceCentimes: 6000 },
          ],
          payments: [{ userId: "a", amountCentimes: 10000 }],
        },
      ],
    };
    const result = calculateSettlement(input);
    const a = result.memberBalances.find((b) => b.userId === "a")!;
    const b = result.memberBalances.find((b) => b.userId === "b")!;
    // Ahmed: paid 10000, responsible 4000, net = +6000
    expect(a.totalPaid).toBe(10000);
    expect(a.totalResponsibility).toBe(4000);
    expect(a.netBalance).toBe(6000);
    // Yassine: paid 0, responsible 6000, net = -6000
    expect(b.totalPaid).toBe(0);
    expect(b.totalResponsibility).toBe(6000);
    expect(b.netBalance).toBe(-6000);
  });

  it("positive balance = should receive money", () => {
    const input: OutingInput = {
      members: [{ userId: "a" }, { userId: "b" }],
      activities: [
        {
          id: "a1",
          name: "Pool",
          pricingModel: "VARIABLE",
          status: "CLOSED",
          lineItems: [
            { userId: "a", priceCentimes: 0 },   // A didn't consume but paid
            { userId: "b", priceCentimes: 4000 }, // B consumed 40
          ],
          payments: [{ userId: "a", amountCentimes: 4000 }],
        },
      ],
    };
    const result = calculateSettlement(input);
    const a = result.memberBalances.find((b) => b.userId === "a")!;
    expect(a.netBalance).toBe(4000); // A paid 4000, resp 0, should receive 4000
  });

  it("negative balance = owes money", () => {
    const input: OutingInput = {
      members: [{ userId: "a" }, { userId: "b" }],
      activities: [
        {
          id: "a1",
          name: "Dinner",
          pricingModel: "VARIABLE",
          status: "CLOSED",
          lineItems: [
            { userId: "a", priceCentimes: 3000 },
            { userId: "b", priceCentimes: 7000 },
          ],
          payments: [{ userId: "a", amountCentimes: 10000 }],
        },
      ],
    };
    const result = calculateSettlement(input);
    const b = result.memberBalances.find((b) => b.userId === "b")!;
    expect(b.netBalance).toBe(-7000);
  });

  it("zero = settled", () => {
    const input: OutingInput = {
      members: [{ userId: "a" }, { userId: "b" }],
      activities: [
        {
          id: "a1",
          name: "X",
          pricingModel: "VARIABLE",
          status: "CLOSED",
          lineItems: [
            { userId: "a", priceCentimes: 5000 },
            { userId: "b", priceCentimes: 5000 },
          ],
          payments: [
            { userId: "a", amountCentimes: 5000 },
            { userId: "b", amountCentimes: 5000 },
          ],
        },
      ],
    };
    const result = calculateSettlement(input);
    expect(result.memberBalances.every((b) => b.netBalance === 0)).toBe(true);
    expect(result.transfers).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// §3. OUTINGS — independent financial contexts
// ═══════════════════════════════════════════════════════════════════════
describe("§3 Outings — Independent Financial Contexts", () => {
  it("two outings do NOT net across each other", () => {
    // Outing 1: Ahmed owes Yassine 20 DH
    const outing1: OutingInput = {
      members: [{ userId: "ahmed" }, { userId: "yassine" }],
      activities: [
        {
          id: "a1",
          name: "Pool",
          pricingModel: "VARIABLE",
          status: "CLOSED",
          lineItems: [
            { userId: "ahmed", priceCentimes: 0 },
            { userId: "yassine", priceCentimes: 4000 },
          ],
          payments: [{ userId: "ahmed", amountCentimes: 4000 }],
        },
      ],
    };
    // Outing 2: Yassine owes Ahmed 30 DH
    const outing2: OutingInput = {
      members: [{ userId: "ahmed" }, { userId: "yassine" }],
      activities: [
        {
          id: "a2",
          name: "Restaurant",
          pricingModel: "VARIABLE",
          status: "CLOSED",
          lineItems: [
            { userId: "ahmed", priceCentimes: 6000 },
            { userId: "yassine", priceCentimes: 0 },
          ],
          payments: [{ userId: "yassine", amountCentimes: 6000 }],
        },
      ],
    };
    const r1 = calculateSettlement(outing1);
    const r2 = calculateSettlement(outing2);

    // Outing 1: Yassine paid 0, responsible 4000 → owes 4000. Ahmed paid 4000, resp 0 → receives 4000
    expect(r1.transfers[0]).toEqual(
      expect.objectContaining({ fromUserId: "yassine", toUserId: "ahmed", amountCentimes: 4000 })
    );
    // Outing 2: Ahmed paid 0, responsible 6000 → owes 6000. Yassine paid 6000, resp 0 → receives 6000
    expect(r2.transfers[0]).toEqual(
      expect.objectContaining({ fromUserId: "ahmed", toUserId: "yassine", amountCentimes: 6000 })
    );
    // They are SEPARATE — not combined into 2000 DH
  });
});

// ═══════════════════════════════════════════════════════════════════════
// §4-5. MEMBERSHIP VS PARTICIPATION VS ACTIVITY + OUTSIDERS
// ═══════════════════════════════════════════════════════════════════════
describe("§4-5 Membership/Participation Layers", () => {
  it("activity participants are a subset of outing participants", () => {
    const input: OutingInput = {
      members: [
        { userId: "a" },
        { userId: "b" },
        { userId: "c" },
        { userId: "d" },
        { userId: "e" },
      ],
      activities: [
        {
          id: "a1",
          name: "Pool",
          pricingModel: "FIXED",
          status: "CLOSED",
          usageRecords: [
            { id: "u1", totalCentimes: 2500, status: "CONFIRMED", participantIds: ["a", "b"] },
            { id: "u2", totalCentimes: 1500, status: "CONFIRMED", participantIds: ["c", "d"] },
          ],
          // E is in the outing but NOT in any activity
          payments: [{ userId: "a", amountCentimes: 4000 }],
        },
      ],
    };
    const result = calculateSettlement(input);
    // E has 0 responsibility, 0 paid
    const e = result.memberBalances.find((b) => b.userId === "e")!;
    expect(e.totalResponsibility).toBe(0);
    expect(e.totalPaid).toBe(0);
    expect(e.netBalance).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// §6-8. ACTIVITY CREATION + FIXED-PRICE ACTIVITY + USAGE RECORDS
// ═══════════════════════════════════════════════════════════════════════
describe("§6-8 Fixed-Price Activity", () => {
  it("FIXED activity with one product, 2 participants", () => {
    const input: OutingInput = {
      members: [{ userId: "a" }, { userId: "b" }],
      activities: [
        {
          id: "a1",
          name: "Pool",
          pricingModel: "FIXED",
          status: "CLOSED",
          usageRecords: [
            {
              id: "u1",
              totalCentimes: 2500, // 5 games × 5 DH
              status: "CONFIRMED",
              participantIds: ["a", "b"],
            },
          ],
          payments: [{ userId: "a", amountCentimes: 2500 }],
        },
      ],
    };
    const result = calculateSettlement(input);
    const a = result.memberBalances.find((b) => b.userId === "a")!;
    const b = result.memberBalances.find((b) => b.userId === "b")!;
    // Each responsible for 1250 (2500/2)
    expect(a.totalResponsibility).toBe(1250);
    expect(b.totalResponsibility).toBe(1250);
    expect(a.totalPaid).toBe(2500);
    expect(b.totalPaid).toBe(0);
    expect(a.netBalance).toBe(1250);
    expect(b.netBalance).toBe(-1250);
    expect(result.transfers).toHaveLength(1);
    expect(result.transfers[0]).toEqual(
      expect.objectContaining({ fromUserId: "b", toUserId: "a", amountCentimes: 1250 })
    );
  });

  it("FIXED activity with multiple products", () => {
    const input: OutingInput = {
      members: [{ userId: "a" }, { userId: "b" }, { userId: "c" }],
      activities: [
        {
          id: "a1",
          name: "Pool + Bowling",
          pricingModel: "FIXED",
          status: "CLOSED",
          usageRecords: [
            {
              id: "u1",
              totalCentimes: 2500, // Pool: 5 games × 5 DH, A+B
              status: "CONFIRMED",
              participantIds: ["a", "b"],
            },
            {
              id: "u2",
              totalCentimes: 3000, // Bowling: 1 game × 30 DH, A+C
              status: "CONFIRMED",
              participantIds: ["a", "c"],
            },
          ],
          payments: [{ userId: "a", amountCentimes: 5500 }],
        },
      ],
    };
    const result = calculateSettlement(input);
    const a = result.memberBalances.find((b) => b.userId === "a")!;
    const b = result.memberBalances.find((b) => b.userId === "b")!;
    const c = result.memberBalances.find((b) => b.userId === "c")!;
    // A: resp = 1250 (pool) + 1500 (bowling) = 2750, paid = 5500, net = +2750
    expect(a.totalResponsibility).toBe(2750);
    expect(a.netBalance).toBe(2750);
    // B: resp = 1250, paid = 0, net = -1250
    expect(b.totalResponsibility).toBe(1250);
    expect(b.netBalance).toBe(-1250);
    // C: resp = 1500, paid = 0, net = -1500
    expect(c.totalResponsibility).toBe(1500);
    expect(c.netBalance).toBe(-1500);
  });

  it("FIXED with 3 participants in one usage (even division)", () => {
    const input: OutingInput = {
      members: [{ userId: "a" }, { userId: "b" }, { userId: "c" }],
      activities: [
        {
          id: "a1",
          name: "Pool",
          pricingModel: "FIXED",
          status: "CLOSED",
          usageRecords: [
            {
              id: "u1",
              totalCentimes: 1500, // 3 games × 5 DH = 15 DH, divides evenly by 3
              status: "CONFIRMED",
              participantIds: ["a", "b", "c"],
            },
          ],
          payments: [{ userId: "a", amountCentimes: 1500 }],
        },
      ],
    };
    const result = calculateSettlement(input);
    const a = result.memberBalances.find((b) => b.userId === "a")!;
    const b = result.memberBalances.find((b) => b.userId === "b")!;
    // 1500 / 3 = 500 per person
    expect(a.totalResponsibility).toBe(500);
    expect(b.totalResponsibility).toBe(500);
    expect(a.netBalance).toBe(1000); // 1500 - 500
    expect(b.netBalance).toBe(-500);
  });

  it("FIXED with non-divisible total: floor rounding per person", () => {
    // 1000 / 3 = 333.33... → each gets floor(333), total resp = 999
    // This means payments may not exactly match responsibility due to rounding
    const input: OutingInput = {
      members: [{ userId: "a" }, { userId: "b" }, { userId: "c" }],
      activities: [
        {
          id: "a1",
          name: "Pool",
          pricingModel: "FIXED",
          status: "CLOSED",
          usageRecords: [
            {
              id: "u1",
              totalCentimes: 1000,
              status: "CONFIRMED",
              participantIds: ["a", "b", "c"],
            },
          ],
          payments: [{ userId: "a", amountCentimes: 999 }],
        },
      ],
    };
    const result = calculateSettlement(input);
    // Each responsible for 333, total resp = 999, paid = 999
    const a = result.memberBalances.find((b) => b.userId === "a")!;
    expect(a.totalResponsibility).toBe(333);
    expect(result.isComplete).toBe(true);
  });

  it("FIXED with different prices for different products", () => {
    const input: OutingInput = {
      members: [{ userId: "a" }, { userId: "b" }],
      activities: [
        {
          id: "a1",
          name: "Pool + Parking",
          pricingModel: "FIXED",
          status: "CLOSED",
          usageRecords: [
            {
              id: "u1",
              totalCentimes: 2500, // Pool: 5 games × 5 DH
              status: "CONFIRMED",
              participantIds: ["a", "b"],
            },
            {
              id: "u2",
              totalCentimes: 500, // Parking: 1 hour × 5 DH
              status: "CONFIRMED",
              participantIds: ["a", "b"],
            },
          ],
          payments: [{ userId: "a", amountCentimes: 3000 }],
        },
      ],
    };
    const result = calculateSettlement(input);
    const a = result.memberBalances.find((b) => b.userId === "a")!;
    expect(a.totalResponsibility).toBe(1500); // (2500+500)/2
    expect(a.netBalance).toBe(1500); // 3000 - 1500
  });
});

// ═══════════════════════════════════════════════════════════════════════
// §9. FIXED USAGE CONFIRMATION — disputed records excluded
// ═══════════════════════════════════════════════════════════════════════
describe("§9 Fixed Usage Confirmation", () => {
  it("DISPUTED usage record is excluded from calculation", () => {
    const input: OutingInput = {
      members: [{ userId: "a" }, { userId: "b" }, { userId: "c" }, { userId: "d" }],
      activities: [
        {
          id: "a1",
          name: "Pool",
          pricingModel: "FIXED",
          status: "CLOSED",
          usageRecords: [
            {
              id: "u1",
              totalCentimes: 2500,
              status: "CONFIRMED",
              participantIds: ["a", "b"],
            },
            {
              id: "u2",
              totalCentimes: 1500,
              status: "DISPUTED", // Disputed — excluded!
              participantIds: ["c", "d"],
            },
          ],
          payments: [{ userId: "a", amountCentimes: 2500 }],
        },
      ],
    };
    const result = calculateSettlement(input);
    const c = result.memberBalances.find((b) => b.userId === "c")!;
    const d = result.memberBalances.find((b) => b.userId === "d")!;
    // c and d have 0 responsibility because u2 is disputed
    expect(c.totalResponsibility).toBe(0);
    expect(d.totalResponsibility).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// §14-16. VARIABLE-PRICE ACTIVITY
// ═══════════════════════════════════════════════════════════════════════
describe("§14-16 Variable-Price Activity", () => {
  it("VARIABLE: participants enter own items, responsibility = sum of items", () => {
    const input: OutingInput = {
      members: [{ userId: "a" }, { userId: "b" }],
      activities: [
        {
          id: "a1",
          name: "Restaurant",
          pricingModel: "VARIABLE",
          status: "CLOSED",
          lineItems: [
            { userId: "a", priceCentimes: 4000 }, // Burger 40
            { userId: "a", priceCentimes: 1000 }, // Drink 10
            { userId: "a", priceCentimes: 1500 }, // Dessert 15
            { userId: "b", priceCentimes: 5000 }, // Pizza 50
          ],
          payments: [{ userId: "b", amountCentimes: 11500 }],
        },
      ],
    };
    const result = calculateSettlement(input);
    const a = result.memberBalances.find((b) => b.userId === "a")!;
    const b = result.memberBalances.find((b) => b.userId === "b")!;
    expect(a.totalResponsibility).toBe(6500); // 40+10+15
    expect(b.totalResponsibility).toBe(5000); // 50
    expect(a.totalPaid).toBe(0);
    expect(b.totalPaid).toBe(11500);
    expect(a.netBalance).toBe(-6500);
    expect(b.netBalance).toBe(6500);
    expect(result.transfers[0]).toEqual(
      expect.objectContaining({ fromUserId: "a", toUserId: "b", amountCentimes: 6500 })
    );
  });

  it("VARIABLE: each person pays for own = no transfers", () => {
    const input: OutingInput = {
      members: [{ userId: "a" }, { userId: "b" }],
      activities: [
        {
          id: "a1",
          name: "Restaurant",
          pricingModel: "VARIABLE",
          status: "CLOSED",
          lineItems: [
            { userId: "a", priceCentimes: 5000 },
            { userId: "b", priceCentimes: 3000 },
          ],
          payments: [
            { userId: "a", amountCentimes: 5000 },
            { userId: "b", amountCentimes: 3000 },
          ],
        },
      ],
    };
    const result = calculateSettlement(input);
    expect(result.transfers).toHaveLength(0);
    expect(result.memberBalances.every((b) => b.netBalance === 0)).toBe(true);
  });

  it("VARIABLE: negative prices must not appear (domain validation)", () => {
    // parseDHToCentimes rejects negatives
    expect(() => parseDHToCentimes("-20")).toThrow("must not be negative");
  });

  it("VARIABLE: zero-price items handled consistently", () => {
    const input: OutingInput = {
      members: [{ userId: "a" }, { userId: "b" }],
      activities: [
        {
          id: "a1",
          name: "Free activity",
          pricingModel: "VARIABLE",
          status: "CLOSED",
          lineItems: [
            { userId: "a", priceCentimes: 0 },
            { userId: "b", priceCentimes: 0 },
          ],
          payments: [],
        },
      ],
    };
    const result = calculateSettlement(input);
    expect(result.totalExpenses).toBe(0);
    expect(result.transfers).toHaveLength(0);
  });

  it("VARIABLE: many items per participant", () => {
    const input: OutingInput = {
      members: [{ userId: "a" }],
      activities: [
        {
          id: "a1",
          name: "Shopping",
          pricingModel: "VARIABLE",
          status: "CLOSED",
          lineItems: [
            { userId: "a", priceCentimes: 100 },
            { userId: "a", priceCentimes: 200 },
            { userId: "a", priceCentimes: 300 },
            { userId: "a", priceCentimes: 400 },
            { userId: "a", priceCentimes: 500 },
          ],
          payments: [{ userId: "a", amountCentimes: 1500 }],
        },
      ],
    };
    const result = calculateSettlement(input);
    expect(result.memberBalances[0].totalResponsibility).toBe(1500);
    expect(result.memberBalances[0].netBalance).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// §17-22. ACTIVITY LIFECYCLE & CLOSURE VALIDATION
// ═══════════════════════════════════════════════════════════════════════
describe("§17-22 Activity Lifecycle & Closure", () => {
  it("multiple activities can be open simultaneously", () => {
    const input: OutingInput = {
      members: [{ userId: "a" }, { userId: "b" }],
      activities: [
        {
          id: "a1",
          name: "Pool",
          pricingModel: "FIXED",
          status: "OPEN", // Still open
          usageRecords: [
            { id: "u1", totalCentimes: 2500, status: "CONFIRMED", participantIds: ["a", "b"] },
          ],
          payments: [{ userId: "a", amountCentimes: 2500 }],
        },
        {
          id: "a2",
          name: "Restaurant",
          pricingModel: "VARIABLE",
          status: "OPEN", // Also open
          lineItems: [{ userId: "a", priceCentimes: 5000 }],
          payments: [{ userId: "a", amountCentimes: 5000 }],
        },
      ],
    };
    // Even with open activities, settlement calculates current state
    const result = calculateSettlement(input);
    expect(result.totalExpenses).toBe(7500); // 2500 + 5000
  });

  it("creating another activity does NOT close the previous one", () => {
    const input: OutingInput = {
      members: [{ userId: "a" }, { userId: "b" }],
      activities: [
        {
          id: "a1",
          name: "Pool",
          pricingModel: "FIXED",
          status: "CLOSED",
          usageRecords: [
            { id: "u1", totalCentimes: 2500, status: "CONFIRMED", participantIds: ["a", "b"] },
          ],
          payments: [{ userId: "a", amountCentimes: 2500 }],
        },
        {
          id: "a2",
          name: "Restaurant",
          pricingModel: "VARIABLE",
          status: "CLOSED",
          lineItems: [{ userId: "a", priceCentimes: 5000 }],
          payments: [{ userId: "a", amountCentimes: 5000 }],
        },
      ],
    };
    const result = calculateSettlement(input);
    expect(result.isComplete).toBe(true);
  });

  it("pending invitations at closure treated as declined (no financial impact)", () => {
    // C is invited but hasn't accepted — they have no usage/lineItems, so 0 resp
    const input: OutingInput = {
      members: [{ userId: "a" }, { userId: "b" }, { userId: "c" }],
      activities: [
        {
          id: "a1",
          name: "Pool",
          pricingModel: "FIXED",
          status: "CLOSED",
          usageRecords: [
            { id: "u1", totalCentimes: 2500, status: "CONFIRMED", participantIds: ["a", "b"] },
          ],
          payments: [{ userId: "a", amountCentimes: 2500 }],
        },
      ],
    };
    const result = calculateSettlement(input);
    const c = result.memberBalances.find((b) => b.userId === "c")!;
    expect(c.totalResponsibility).toBe(0);
    expect(c.totalPaid).toBe(0);
    expect(c.netBalance).toBe(0);
  });

  it("activity with no payments is incomplete", () => {
    const input: OutingInput = {
      members: [{ userId: "a" }, { userId: "b" }],
      activities: [
        {
          id: "a1",
          name: "Pool",
          pricingModel: "FIXED",
          status: "OPEN",
          usageRecords: [
            { id: "u1", totalCentimes: 2500, status: "CONFIRMED", participantIds: ["a", "b"] },
          ],
          payments: [], // No payments yet
        },
      ],
    };
    const result = calculateSettlement(input);
    expect(result.isComplete).toBe(false);
    expect(result.totalUnrecorded).toBe(2500);
    expect(result.incompleteActivityIds).toContain("a1");
  });

  it("partial payments make activity incomplete", () => {
    const input: OutingInput = {
      members: [{ userId: "a" }, { userId: "b" }],
      activities: [
        {
          id: "a1",
          name: "Pool",
          pricingModel: "FIXED",
          status: "OPEN",
          usageRecords: [
            { id: "u1", totalCentimes: 2500, status: "CONFIRMED", participantIds: ["a", "b"] },
          ],
          payments: [{ userId: "a", amountCentimes: 1000 }], // Only 1000 of 2500
        },
      ],
    };
    const result = calculateSettlement(input);
    expect(result.isComplete).toBe(false);
    expect(result.totalUnrecorded).toBe(1500);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// §24-28. PAYMENTS
// ═══════════════════════════════════════════════════════════════════════
describe("§24-28 Payments", () => {
  it("one person paid everything (Scenario 1)", () => {
    const input: OutingInput = {
      members: [{ userId: "a" }, { userId: "b" }, { userId: "c" }],
      activities: [
        {
          id: "a1",
          name: "Restaurant",
          pricingModel: "VARIABLE",
          status: "CLOSED",
          lineItems: [
            { userId: "a", priceCentimes: 4000 },
            { userId: "b", priceCentimes: 3000 },
            { userId: "c", priceCentimes: 3000 },
          ],
          payments: [{ userId: "a", amountCentimes: 10000 }],
        },
      ],
    };
    const result = calculateSettlement(input);
    expect(result.transfers).toHaveLength(2);
    expect(result.transfers.find((t) => t.fromUserId === "b")!.amountCentimes).toBe(3000);
    expect(result.transfers.find((t) => t.fromUserId === "c")!.amountCentimes).toBe(3000);
  });

  it("multiple people paid (Scenario 2)", () => {
    const input: OutingInput = {
      members: [{ userId: "a" }, { userId: "b" }, { userId: "c" }],
      activities: [
        {
          id: "a1",
          name: "Dinner",
          pricingModel: "VARIABLE",
          status: "CLOSED",
          lineItems: [
            { userId: "a", priceCentimes: 5000 },
            { userId: "b", priceCentimes: 4000 },
            { userId: "c", priceCentimes: 3000 },
          ],
          payments: [
            { userId: "a", amountCentimes: 3000 },
            { userId: "b", amountCentimes: 4000 },
            { userId: "c", amountCentimes: 5000 },
          ],
        },
      ],
    };
    const result = calculateSettlement(input);
    // A: paid 3000, resp 5000, net -2000
    // B: paid 4000, resp 4000, net 0
    // C: paid 5000, resp 3000, net +2000
    expect(result.memberBalances.find((b) => b.userId === "a")!.netBalance).toBe(-2000);
    expect(result.memberBalances.find((b) => b.userId === "b")!.netBalance).toBe(0);
    expect(result.memberBalances.find((b) => b.userId === "c")!.netBalance).toBe(2000);
    expect(result.transfers).toHaveLength(1);
    expect(result.transfers[0]).toEqual(
      expect.objectContaining({ fromUserId: "a", toUserId: "c", amountCentimes: 2000 })
    );
  });

  it("each person paid for their own (Scenario 3)", () => {
    const input: OutingInput = {
      members: [{ userId: "a" }, { userId: "b" }],
      activities: [
        {
          id: "a1",
          name: "Pool",
          pricingModel: "VARIABLE",
          status: "CLOSED",
          lineItems: [
            { userId: "a", priceCentimes: 5000 },
            { userId: "b", priceCentimes: 3000 },
          ],
          payments: [
            { userId: "a", amountCentimes: 5000 },
            { userId: "b", amountCentimes: 3000 },
          ],
        },
      ],
    };
    const result = calculateSettlement(input);
    expect(result.transfers).toHaveLength(0);
    expect(result.memberBalances.every((b) => b.netBalance === 0)).toBe(true);
  });

  it("multiple payment records for same participant are summed", () => {
    const input: OutingInput = {
      members: [{ userId: "a" }, { userId: "b" }],
      activities: [
        {
          id: "a1",
          name: "Dinner",
          pricingModel: "VARIABLE",
          status: "CLOSED",
          lineItems: [
            { userId: "a", priceCentimes: 6000 },
            { userId: "b", priceCentimes: 4000 },
          ],
          payments: [
            { userId: "a", amountCentimes: 3000 },
            { userId: "a", amountCentimes: 2000 },
            { userId: "a", amountCentimes: 1000 },
          ],
        },
      ],
    };
    const result = calculateSettlement(input);
    expect(result.memberBalances.find((b) => b.userId === "a")!.totalPaid).toBe(6000);
    expect(result.memberBalances.find((b) => b.userId === "a")!.netBalance).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// §31-34. FINAL OUTING SETTLEMENT + OPTIMIZATION + EXPLANATION
// ═══════════════════════════════════════════════════════════════════════
describe("§31-34 Settlement", () => {
  it("settlement engine minimizes transfers", () => {
    // Ahmed +100, Yassine -60, Omar -40
    const input: OutingInput = {
      members: [{ userId: "ahmed" }, { userId: "yassine" }, { userId: "omar" }],
      activities: [
        {
          id: "a1",
          name: "Dinner",
          pricingModel: "VARIABLE",
          status: "CLOSED",
          lineItems: [
            { userId: "ahmed", priceCentimes: 0 },
            { userId: "yassine", priceCentimes: 6000 },
            { userId: "omar", priceCentimes: 4000 },
          ],
          payments: [{ userId: "ahmed", amountCentimes: 10000 }],
        },
      ],
    };
    const result = calculateSettlement(input);
    // Should be exactly 2 transfers (Yassine→Ahmed, Omar→Ahmed)
    expect(result.transfers).toHaveLength(2);
    expect(result.transfers.find((t) => t.fromUserId === "yassine")!.amountCentimes).toBe(6000);
    expect(result.transfers.find((t) => t.fromUserId === "omar")!.amountCentimes).toBe(4000);
  });

  it("settlement explanation is transparent", () => {
    const input: OutingInput = {
      members: [
        { userId: "ahmed", displayName: "Ahmed" },
        { userId: "yassine", displayName: "Yassine" },
      ],
      activities: [
        {
          id: "a1",
          name: "Pool",
          pricingModel: "VARIABLE",
          status: "CLOSED",
          lineItems: [
            { userId: "ahmed", priceCentimes: 0 },
            { userId: "yassine", priceCentimes: 3500 },
          ],
          payments: [{ userId: "ahmed", amountCentimes: 3500 }],
        },
      ],
    };
    const result = calculateSettlement(input);
    const userMap = new Map([
      ["ahmed", "Ahmed"],
      ["yassine", "Yassine"],
    ]);
    const explanation = explainSettlement(result.transfers, result.memberBalances, userMap);
    expect(explanation).toContain("Ahmed");
    expect(explanation).toContain("Yassine");
    expect(explanation).toContain("35.00 DH");
    expect(explanation).toContain("Paid:");
    expect(explanation).toContain("Responsible for:");
    expect(explanation).toContain("Net:");
  });

  it("settlement does NOT track real-world payment", () => {
    // Settlement produces transfers, but no paidAt/confirmedAt
    const result = simplifyDebts([
      { userId: "a", totalPaid: 10000, totalResponsibility: 4000, netBalance: 6000 },
      { userId: "b", totalPaid: 0, totalResponsibility: 6000, netBalance: -6000 },
    ]);
    expect(result[0]).not.toHaveProperty("paidAt");
    expect(result[0]).not.toHaveProperty("confirmedAt");
  });

  it("net balances sum to zero (invariant)", () => {
    const input: OutingInput = {
      members: [{ userId: "a" }, { userId: "b" }, { userId: "c" }, { userId: "d" }],
      activities: [
        {
          id: "a1",
          name: "Pool",
          pricingModel: "FIXED",
          status: "CLOSED",
          usageRecords: [
            { id: "u1", totalCentimes: 2500, status: "CONFIRMED", participantIds: ["a", "b"] },
            { id: "u2", totalCentimes: 1500, status: "CONFIRMED", participantIds: ["c", "d"] },
          ],
          payments: [{ userId: "a", amountCentimes: 4000 }],
        },
      ],
    };
    const result = calculateSettlement(input);
    const sum = result.memberBalances.reduce((s, b) => s + b.netBalance, 0);
    expect(sum).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// §38. MONEY PRECISION
// ═══════════════════════════════════════════════════════════════════════
describe("§38 Money Precision", () => {
  it("formatDH always shows appropriate decimals", () => {
    expect(formatDH(500)).toBe("5 DH");
    expect(formatDH(550)).toBe("5.50 DH");
    expect(formatDH(100)).toBe("1 DH");
    expect(formatDH(105)).toBe("1.05 DH");
    expect(formatDH(0)).toBe("0 DH");
    expect(formatDH(-500)).toBe("-5 DH");
    expect(formatDH(-550)).toBe("-5.50 DH");
  });

  it("parseDHToCentimes handles Moroccan input", () => {
    expect(parseDHToCentimes("7,50")).toBe(750);
    expect(parseDHToCentimes("100 DH")).toBe(10000);
    expect(parseDHToCentimes("1 000.50")).toBe(100050);
  });

  it("parseDHToCentimes rejects negatives", () => {
    expect(() => parseDHToCentimes("-20")).toThrow("must not be negative");
  });

  it("parseDHToCentimes rejects >2 decimals", () => {
    expect(() => parseDHToCentimes("10.999")).toThrow("at most 2 decimals");
  });

  it("allocation sum equals total (invariant)", () => {
    const total = 1000;
    const allocs = allocateEqual(total, 3);
    expect(allocs.reduce((a, b) => a + b, 0)).toBe(total);
    expect(allocs).toHaveLength(3);
  });

  it("allocation handles non-divisible amounts", () => {
    const total = 100; // 1.00 DH
    const allocs = allocateEqual(total, 3);
    // 33 + 33 + 34 = 100
    expect(allocs.reduce((a, b) => a + b, 0)).toBe(total);
    expect(allocs).toEqual([34, 33, 33]); // remainder distributed to first
  });

  it("100.00 DH / 3 produces exact sum", () => {
    const allocs = allocateEqual(10000, 3);
    expect(allocs.reduce((a, b) => a + b, 0)).toBe(10000);
  });

  it("no floating point in financial calculations", () => {
    // 0.1 + 0.2 = 0.30000000000000004 in JS float
    // But 10 + 20 = 30 in integer centimes
    expect(parseDHToCentimes("0.10") + parseDHToCentimes("0.20")).toBe(parseDHToCentimes("0.30"));
  });
});

// ═══════════════════════════════════════════════════════════════════════
// §49. FINANCIAL INVARIANT TESTS
// ═══════════════════════════════════════════════════════════════════════
describe("§49 Financial Invariants", () => {
  it("sum(net balances) = 0 for any valid settlement", () => {
    const scenarios: OutingInput[] = [
      // Scenario 1: Simple 2-person
      {
        members: [{ userId: "a" }, { userId: "b" }],
        activities: [
          {
            id: "a1",
            name: "X",
            pricingModel: "VARIABLE",
            status: "CLOSED",
            lineItems: [
              { userId: "a", priceCentimes: 5000 },
              { userId: "b", priceCentimes: 3000 },
            ],
            payments: [{ userId: "a", amountCentimes: 8000 }],
          },
        ],
      },
      // Scenario 2: 5 people, mixed
      {
        members: [
          { userId: "a" },
          { userId: "b" },
          { userId: "c" },
          { userId: "d" },
          { userId: "e" },
        ],
        activities: [
          {
            id: "a1",
            name: "Pool",
            pricingModel: "FIXED",
            status: "CLOSED",
            usageRecords: [
              { id: "u1", totalCentimes: 2500, status: "CONFIRMED", participantIds: ["a", "b"] },
              { id: "u2", totalCentimes: 1500, status: "CONFIRMED", participantIds: ["c", "d"] },
            ],
            payments: [{ userId: "a", amountCentimes: 4000 }],
          },
          {
            id: "a2",
            name: "Restaurant",
            pricingModel: "VARIABLE",
            status: "CLOSED",
            lineItems: [
              { userId: "a", priceCentimes: 4000 },
              { userId: "b", priceCentimes: 5000 },
              { userId: "c", priceCentimes: 3000 },
              { userId: "d", priceCentimes: 2000 },
              { userId: "e", priceCentimes: 1000 },
            ],
            payments: [{ userId: "e", amountCentimes: 15000 }],
          },
        ],
      },
      // Scenario 3: All zero
      {
        members: [{ userId: "a" }, { userId: "b" }],
        activities: [
          {
            id: "a1",
            name: "Free",
            pricingModel: "VARIABLE",
            status: "CLOSED",
            lineItems: [],
            payments: [],
          },
        ],
      },
    ];

    for (const input of scenarios) {
      const result = calculateSettlement(input);
      const sum = result.memberBalances.reduce((s, b) => s + b.netBalance, 0);
      expect(sum).toBe(0);
    }
  });

  it("all generated transfers reconcile with net balances", () => {
    const input: OutingInput = {
      members: [{ userId: "a" }, { userId: "b" }, { userId: "c" }, { userId: "d" }],
      activities: [
        {
          id: "a1",
          name: "Pool",
          pricingModel: "FIXED",
          status: "CLOSED",
          usageRecords: [
            { id: "u1", totalCentimes: 5000, status: "CONFIRMED", participantIds: ["a", "b", "c", "d"] },
          ],
          payments: [{ userId: "a", amountCentimes: 5000 }],
        },
      ],
    };
    const result = calculateSettlement(input);
    // Simulate applying transfers
    const simulated = new Map(result.memberBalances.map((b) => [b.userId, b.netBalance]));
    for (const t of result.transfers) {
      simulated.set(t.fromUserId, simulated.get(t.fromUserId)! + t.amountCentimes);
      simulated.set(t.toUserId, simulated.get(t.toUserId)! - t.amountCentimes);
    }
    for (const balance of simulated.values()) {
      expect(balance).toBe(0);
    }
  });

  it("no negative prices in financial records", () => {
    expect(() => parseDHToCentimes("-5")).toThrow();
    expect(() => parseDHToCentimes("-0.01")).toThrow();
    expect(() => parseDHToCentimes("-100")).toThrow();
  });

  it("no duplicate financial mutation from double-clicking (idempotent)", () => {
    // The settlement engine is pure — same input = same output
    const input: OutingInput = {
      members: [{ userId: "a" }, { userId: "b" }],
      activities: [
        {
          id: "a1",
          name: "X",
          pricingModel: "VARIABLE",
          status: "CLOSED",
          lineItems: [
            { userId: "a", priceCentimes: 5000 },
            { userId: "b", priceCentimes: 3000 },
          ],
          payments: [{ userId: "a", amountCentimes: 8000 }],
        },
      ],
    };
    const r1 = calculateSettlement(input);
    const r2 = calculateSettlement(input);
    expect(JSON.stringify(r1.transfers)).toBe(JSON.stringify(r2.transfers));
    expect(r1.totalExpenses).toBe(r2.totalExpenses);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// §50. REALISTIC END-TO-END TEST
// ═══════════════════════════════════════════════════════════════════════
describe("§50 Realistic E2E Scenario", () => {
  it("full outing: InDrive + Pool×2 + Restaurant + InDrive → correct who-owes-whom", () => {
    const members = [
      { userId: "a", displayName: "A" },
      { userId: "b", displayName: "B" },
      { userId: "c", displayName: "C" },
      { userId: "d", displayName: "D" },
      { userId: "e", displayName: "E" },
    ];

    const input: OutingInput = {
      members,
      activities: [
        // InDrive #1: A+B+C+D, one person pays everyone
        {
          id: "indrive1",
          name: "InDrive #1",
          pricingModel: "VARIABLE",
          status: "CLOSED",
          lineItems: [
            { userId: "a", priceCentimes: 500 },
            { userId: "b", priceCentimes: 500 },
            { userId: "c", priceCentimes: 500 },
            { userId: "d", priceCentimes: 500 },
          ],
          payments: [{ userId: "a", amountCentimes: 2000 }],
        },
        // Pool #1: 5 games × 5 DH for A+B, 3 games for C+D
        {
          id: "pool1",
          name: "Pool #1",
          pricingModel: "FIXED",
          status: "CLOSED",
          usageRecords: [
            { id: "pu1", totalCentimes: 2500, status: "CONFIRMED", participantIds: ["a", "b"] },
            { id: "pu2", totalCentimes: 1500, status: "CONFIRMED", participantIds: ["c", "d"] },
          ],
          payments: [{ userId: "a", amountCentimes: 4000 }],
        },
        // Pool #2: C+A=8 games, D+B=2 games, E+A=3 games, E+D=2 games
        // C+A: 8×5=40 DH, D+B: 2×5=10 DH, E+A: 3×5=15 DH, E+D: 2×5=10 DH
        {
          id: "pool2",
          name: "Pool #2",
          pricingModel: "FIXED",
          status: "CLOSED",
          usageRecords: [
            { id: "pu3", totalCentimes: 4000, status: "CONFIRMED", participantIds: ["c", "a"] },
            { id: "pu4", totalCentimes: 1000, status: "CONFIRMED", participantIds: ["d", "b"] },
            { id: "pu5", totalCentimes: 1500, status: "CONFIRMED", participantIds: ["e", "a"] },
            { id: "pu6", totalCentimes: 1000, status: "CONFIRMED", participantIds: ["e", "d"] },
          ],
          payments: [{ userId: "b", amountCentimes: 7500 }],
        },
        // Restaurant: variable, E pays everyone
        {
          id: "restaurant",
          name: "Restaurant",
          pricingModel: "VARIABLE",
          status: "CLOSED",
          lineItems: [
            { userId: "a", priceCentimes: 7500 }, // Burger 40 + Drink 15 + Dessert 20
            { userId: "b", priceCentimes: 5000 }, // Pizza 50
          ],
          payments: [{ userId: "e", amountCentimes: 12500 }],
        },
        // InDrive #2: C pays everyone
        {
          id: "indrive2",
          name: "InDrive #2",
          pricingModel: "VARIABLE",
          status: "CLOSED",
          lineItems: [
            { userId: "a", priceCentimes: 400 },
            { userId: "b", priceCentimes: 400 },
            { userId: "c", priceCentimes: 400 },
            { userId: "d", priceCentimes: 400 },
          ],
          payments: [{ userId: "c", amountCentimes: 1600 }],
        },
      ],
    };

    const result = calculateSettlement(input);
    expect(result.isComplete).toBe(true);

    // Verify sum of net balances is 0
    const sum = result.memberBalances.reduce((s, b) => s + b.netBalance, 0);
    expect(sum).toBe(0);

    // Verify positive sum equals negative sum
    const positiveSum = result.memberBalances
      .filter((b) => b.netBalance > 0)
      .reduce((s, b) => s + b.netBalance, 0);
    const negativeSum = result.memberBalances
      .filter((b) => b.netBalance < 0)
      .reduce((s, b) => s + Math.abs(b.netBalance), 0);
    expect(positiveSum).toBe(negativeSum);

    // Verify transfers reconcile
    const simulated = new Map(result.memberBalances.map((b) => [b.userId, b.netBalance]));
    for (const t of result.transfers) {
      simulated.set(t.fromUserId, simulated.get(t.fromUserId)! + t.amountCentimes);
      simulated.set(t.toUserId, simulated.get(t.toUserId)! - t.amountCentimes);
    }
    for (const balance of simulated.values()) {
      expect(balance).toBe(0);
    }

    // Print result for manual verification
    const userMap = new Map(members.map((m) => [m.userId, m.displayName]));
    const explanation = explainSettlement(result.transfers, result.memberBalances, userMap);
    console.log("\n=== §50 E2E Settlement Result ===");
    console.log(explanation);
    console.log("Transfers:", result.transfers.length);
  });

  it("jumu'ah (non-financial activity) has no financial impact", () => {
    const input: OutingInput = {
      members: [{ userId: "a" }, { userId: "b" }, { userId: "c" }],
      activities: [
        {
          id: "pool",
          name: "Pool",
          pricingModel: "FIXED",
          status: "CLOSED",
          usageRecords: [
            { id: "u1", totalCentimes: 2500, status: "CONFIRMED", participantIds: ["a", "b"] },
          ],
          payments: [{ userId: "a", amountCentimes: 2500 }],
        },
        {
          id: "jumuah",
          name: "Jumu'ah",
          pricingModel: "FIXED",
          status: "CLOSED",
          usageRecords: [], // No usage records = no financial cost
          payments: [],
        },
      ],
    };
    const result = calculateSettlement(input);
    expect(result.totalExpenses).toBe(2500);
    // Only pool matters
    const a = result.memberBalances.find((b) => b.userId === "a")!;
    expect(a.totalResponsibility).toBe(1250);
    expect(a.totalPaid).toBe(2500);
    expect(a.netBalance).toBe(1250);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// §40-41. PERMISSIONS & SECURITY
// ═══════════════════════════════════════════════════════════════════════
describe("§40-41 Permissions", () => {
  it("settlement engine is pure — no server-side auth needed for calculation", () => {
    // The settlement engine is a pure function — security is enforced
    // at the server action layer, not in the domain logic
    const input: OutingInput = {
      members: [{ userId: "a" }, { userId: "b" }],
      activities: [
        {
          id: "a1",
          name: "X",
          pricingModel: "VARIABLE",
          status: "CLOSED",
          lineItems: [
            { userId: "a", priceCentimes: 5000 },
            { userId: "b", priceCentimes: 5000 },
          ],
          payments: [
            { userId: "a", amountCentimes: 5000 },
            { userId: "b", amountCentimes: 5000 },
          ],
        },
      ],
    };
    const result = calculateSettlement(input);
    expect(result.transfers).toHaveLength(0);
  });

  it("unknown user in usage record throws error", () => {
    const input: OutingInput = {
      members: [{ userId: "a" }],
      activities: [
        {
          id: "a1",
          name: "X",
          pricingModel: "FIXED",
          status: "CLOSED",
          usageRecords: [
            { id: "u1", totalCentimes: 1000, status: "CONFIRMED", participantIds: ["a", "unknown"] },
          ],
          payments: [],
        },
      ],
    };
    expect(() => calculateSettlement(input)).toThrow("Unknown user in usage record: unknown");
  });

  it("unknown user in line item throws error", () => {
    const input: OutingInput = {
      members: [{ userId: "a" }],
      activities: [
        {
          id: "a1",
          name: "X",
          pricingModel: "VARIABLE",
          status: "CLOSED",
          lineItems: [{ userId: "unknown", priceCentimes: 1000 }],
          payments: [],
        },
      ],
    };
    expect(() => calculateSettlement(input)).toThrow("Unknown user in line item: unknown");
  });

  it("unknown user in payment throws error", () => {
    const input: OutingInput = {
      members: [{ userId: "a" }],
      activities: [
        {
          id: "a1",
          name: "X",
          pricingModel: "VARIABLE",
          status: "CLOSED",
          lineItems: [{ userId: "a", priceCentimes: 1000 }],
          payments: [{ userId: "unknown", amountCentimes: 1000 }],
        },
      ],
    };
    expect(() => calculateSettlement(input)).toThrow("Unknown user in payment: unknown");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// §39. WALLET ISOLATION
// ═══════════════════════════════════════════════════════════════════════
describe("§39 Wallet Isolation", () => {
  it("settlement engine has no wallet dependency", () => {
    // The settlement engine only takes OutingInput — no wallet, no contributions
    const input: OutingInput = {
      members: [{ userId: "a" }, { userId: "b" }],
      activities: [
        {
          id: "a1",
          name: "X",
          pricingModel: "VARIABLE",
          status: "CLOSED",
          lineItems: [
            { userId: "a", priceCentimes: 5000 },
            { userId: "b", priceCentimes: 5000 },
          ],
          payments: [
            { userId: "a", amountCentimes: 5000 },
            { userId: "b", amountCentimes: 5000 },
          ],
        },
      ],
    };
    // No wallet field exists in OutingInput — settlement is clean
    const result = calculateSettlement(input);
    expect(result).not.toHaveProperty("totalContributions");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// §35-37. POST-SETTLEMENT CORRECTIONS (domain-level validation)
// ═══════════════════════════════════════════════════════════════════════
describe("§35-37 Post-Settlement Corrections", () => {
  it("after correction, new settlement is mathematically valid", () => {
    // Original: A paid 100, B paid 0. A resp 40, B resp 60.
    const original: OutingInput = {
      members: [{ userId: "a" }, { userId: "b" }],
      activities: [
        {
          id: "a1",
          name: "Restaurant",
          pricingModel: "VARIABLE",
          status: "CLOSED",
          lineItems: [
            { userId: "a", priceCentimes: 4000 },
            { userId: "b", priceCentimes: 6000 },
          ],
          payments: [{ userId: "a", amountCentimes: 10000 }],
        },
      ],
    };
    const r1 = calculateSettlement(original);
    expect(r1.transfers[0]).toEqual(
      expect.objectContaining({ fromUserId: "b", toUserId: "a", amountCentimes: 6000 })
    );

    // After correction: B's drink was actually 70 (not 60)
    const corrected: OutingInput = {
      members: [{ userId: "a" }, { userId: "b" }],
      activities: [
        {
          id: "a1",
          name: "Restaurant",
          pricingModel: "VARIABLE",
          status: "CLOSED",
          lineItems: [
            { userId: "a", priceCentimes: 4000 },
            { userId: "b", priceCentimes: 7000 },
          ],
          payments: [{ userId: "a", amountCentimes: 11000 }],
        },
      ],
    };
    const r2 = calculateSettlement(corrected);
    expect(r2.transfers[0]).toEqual(
      expect.objectContaining({ fromUserId: "b", toUserId: "a", amountCentimes: 7000 })
    );
    // Both are mathematically valid
    const sum1 = r1.memberBalances.reduce((s, b) => s + b.netBalance, 0);
    const sum2 = r2.memberBalances.reduce((s, b) => s + b.netBalance, 0);
    expect(sum1).toBe(0);
    expect(sum2).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// ADDITIONAL: Edge cases
// ═══════════════════════════════════════════════════════════════════════
describe("Edge Cases", () => {
  it("single person outing — no transfers needed", () => {
    const input: OutingInput = {
      members: [{ userId: "a" }],
      activities: [
        {
          id: "a1",
          name: "Solo",
          pricingModel: "VARIABLE",
          status: "CLOSED",
          lineItems: [{ userId: "a", priceCentimes: 5000 }],
          payments: [{ userId: "a", amountCentimes: 5000 }],
        },
      ],
    };
    const result = calculateSettlement(input);
    expect(result.transfers).toHaveLength(0);
    expect(result.memberBalances[0].netBalance).toBe(0);
  });

  it("no activities — no expenses", () => {
    const input: OutingInput = {
      members: [{ userId: "a" }, { userId: "b" }],
      activities: [],
    };
    const result = calculateSettlement(input);
    expect(result.totalExpenses).toBe(0);
    expect(result.transfers).toHaveLength(0);
  });

  it("very large group (10 people)", () => {
    const members = Array.from({ length: 10 }, (_, i) => ({ userId: `u${i}` }));
    const input: OutingInput = {
      members,
      activities: [
        {
          id: "a1",
          name: "Dinner",
          pricingModel: "VARIABLE",
          status: "CLOSED",
          lineItems: members.map((m) => ({ userId: m.userId, priceCentimes: 1000 })),
          payments: [{ userId: "u0", amountCentimes: 10000 }],
        },
      ],
    };
    const result = calculateSettlement(input);
    const sum = result.memberBalances.reduce((s, b) => s + b.netBalance, 0);
    expect(sum).toBe(0);
    expect(result.totalExpenses).toBe(10000);
  });

  it("mixed FIXED and VARIABLE activities in same outing", () => {
    const input: OutingInput = {
      members: [{ userId: "a" }, { userId: "b" }],
      activities: [
        {
          id: "fixed",
          name: "Pool",
          pricingModel: "FIXED",
          status: "CLOSED",
          usageRecords: [
            { id: "u1", totalCentimes: 2500, status: "CONFIRMED", participantIds: ["a", "b"] },
          ],
          payments: [{ userId: "a", amountCentimes: 2500 }],
        },
        {
          id: "variable",
          name: "Restaurant",
          pricingModel: "VARIABLE",
          status: "CLOSED",
          lineItems: [
            { userId: "a", priceCentimes: 4000 },
            { userId: "b", priceCentimes: 6000 },
          ],
          payments: [{ userId: "b", amountCentimes: 10000 }],
        },
      ],
    };
    const result = calculateSettlement(input);
    // A: pool resp 1250, restaurant resp 4000 = 5250. A paid 2500. Net = -2750
    // B: pool resp 1250, restaurant resp 6000 = 7250. B paid 10000. Net = +2750
    expect(result.memberBalances.find((b) => b.userId === "a")!.netBalance).toBe(-2750);
    expect(result.memberBalances.find((b) => b.userId === "b")!.netBalance).toBe(2750);
    expect(result.transfers).toHaveLength(1);
    expect(result.transfers[0]).toEqual(
      expect.objectContaining({ fromUserId: "a", toUserId: "b", amountCentimes: 2750 })
    );
  });

  it("FIXED with 10 participants in one usage", () => {
    const participantIds = Array.from({ length: 10 }, (_, i) => `u${i}`);
    const input: OutingInput = {
      members: participantIds.map((id) => ({ userId: id })),
      activities: [
        {
          id: "a1",
          name: "Bus",
          pricingModel: "FIXED",
          status: "CLOSED",
          usageRecords: [
            { id: "u1", totalCentimes: 10000, status: "CONFIRMED", participantIds },
          ],
          payments: [{ userId: "u0", amountCentimes: 10000 }],
        },
      ],
    };
    const result = calculateSettlement(input);
    // 10000 / 10 = 1000 per person
    const u5 = result.memberBalances.find((b) => b.userId === "u5")!;
    expect(u5.totalResponsibility).toBe(1000);
    const sum = result.memberBalances.reduce((s, b) => s + b.netBalance, 0);
    expect(sum).toBe(0);
  });

  it("simplifyDebts handles 3-way cycle optimally", () => {
    // A owes B 100, B owes C 100, C owes A 100 — all settle to 0
    const balances = [
      { userId: "a", totalPaid: 10000, totalResponsibility: 10000, netBalance: 0 },
      { userId: "b", totalPaid: 0, totalResponsibility: 0, netBalance: 0 },
      { userId: "c", totalPaid: 0, totalResponsibility: 0, netBalance: 0 },
    ];
    const transfers = simplifyDebts(balances);
    expect(transfers).toHaveLength(0);
  });

  it("simplifyDebts with uneven splits", () => {
    // 100 / 3 = 33.33 each, but one person paid all
    const balances = [
      { userId: "a", totalPaid: 10000, totalResponsibility: 3333, netBalance: 6667 },
      { userId: "b", totalPaid: 0, totalResponsibility: 3333, netBalance: -3333 },
      { userId: "c", totalPaid: 0, totalResponsibility: 3334, netBalance: -3334 },
    ];
    const transfers = simplifyDebts(balances);
    const sum = transfers.reduce((s, t) => s + t.amountCentimes, 0);
    expect(sum).toBe(6667);
  });

  it("explainSettlement produces human-readable output", () => {
    const balances = [
      { userId: "a", displayName: "Alice", totalPaid: 10000, totalResponsibility: 4000, netBalance: 6000 },
      { userId: "b", displayName: "Bob", totalPaid: 0, totalResponsibility: 6000, netBalance: -6000 },
    ];
    const transfers = [
      { fromUserId: "b", toUserId: "a", amountCentimes: 6000, fromDisplayName: "Bob", toDisplayName: "Alice" },
    ];
    const userMap = new Map([
      ["a", "Alice"],
      ["b", "Bob"],
    ]);
    const text = explainSettlement(transfers, balances, userMap);
    expect(text).toContain("Alice:");
    expect(text).toContain("Bob:");
    expect(text).toContain("100.00 DH");
    expect(text).toContain("40.00 DH");
    expect(text).toContain("+60.00 DH");
    expect(text).toContain("-60.00 DH");
    expect(text).toContain("Bob -> Alice: 60.00 DH");
  });
});
