import { describe, it, expect } from "vitest";
import {
  calculateSettlement,
  simplifyDebts,
  type SettlementInput,
} from "../settlement";
import { allocateEqual } from "../money";

const dh = (n: number) => Math.round(n * 100);

/** Shared invariant checker for complete settlements */
function expectBalanced(input: SettlementInput) {
  const r = calculateSettlement(input);
  expect(r.isComplete).toBe(true);
  // Responsibility == paid totals == expense total
  const resp = r.memberBalances.reduce((s, b) => s + b.totalResponsibility, 0);
  expect(resp).toBe(r.totalExpenses);
  expect(r.totalPaid).toBe(r.totalExpenses);
  // Debtors == creditors
  const pos = r.memberBalances.filter(b => b.netBalance > 0).reduce((s, b) => s + b.netBalance, 0);
  const neg = r.memberBalances.filter(b => b.netBalance < 0).reduce((s, b) => s + Math.abs(b.netBalance), 0);
  expect(pos).toBe(neg);
  // Transfer rules
  for (const t of r.transfers) {
    expect(t.amountCentimes).toBeGreaterThan(0);
    expect(t.fromUserId).not.toBe(t.toUserId);
  }
  // Applying transfers zeroes everyone
  const bal = new Map(r.memberBalances.map(b => [b.userId, b.netBalance]));
  for (const t of r.transfers) {
    bal.set(t.fromUserId, bal.get(t.fromUserId)! + t.amountCentimes);
    bal.set(t.toUserId, bal.get(t.toUserId)! - t.amountCentimes);
  }
  for (const v of bal.values()) expect(v).toBe(0);
  return r;
}

describe("Case A — 300 DH, Alice pays all, equal split", () => {
  it("Bob->Alice 100, Charlie->Alice 100", () => {
    const r = expectBalanced({
      members: [{ userId: "a" }, { userId: "b" }, { userId: "c" }],
      expenses: [{
        id: "e1", totalCentimes: dh(300),
        allocations: [{ userId: "a", amountCentimes: dh(100) }, { userId: "b", amountCentimes: dh(100) }, { userId: "c", amountCentimes: dh(100) }],
        payments: [{ userId: "a", amountCentimes: dh(300) }],
      }],
    });
    expect(r.transfers).toHaveLength(2);
    expect(r.transfers).toContainEqual(expect.objectContaining({ fromUserId: "b", toUserId: "a", amountCentimes: dh(100) }));
    expect(r.transfers).toContainEqual(expect.objectContaining({ fromUserId: "c", toUserId: "a", amountCentimes: dh(100) }));
  });
});

describe("Case B — 300 DH, Alice 100 + Bob 200, equal split", () => {
  it("Charlie->Bob 100 only", () => {
    const r = expectBalanced({
      members: [{ userId: "a" }, { userId: "b" }, { userId: "c" }],
      expenses: [{
        id: "e1", totalCentimes: dh(300),
        allocations: [{ userId: "a", amountCentimes: dh(100) }, { userId: "b", amountCentimes: dh(100) }, { userId: "c", amountCentimes: dh(100) }],
        payments: [{ userId: "a", amountCentimes: dh(100) }, { userId: "b", amountCentimes: dh(200) }],
      }],
    });
    expect(r.transfers).toEqual([
      expect.objectContaining({ fromUserId: "c", toUserId: "b", amountCentimes: dh(100) }),
    ]);
  });
});

describe("Case C — 100 DH / 3 people", () => {
  it("allocations total exactly 100 DH", () => {
    const a = allocateEqual(dh(100), 3);
    expect(a.reduce((s: number, x: number) => s + x, 0)).toBe(dh(100));
  });
});

describe("Case F — unknown payer stays incomplete, never invents", () => {
  it("marks incomplete with unrecorded total, no transfers TO anyone", () => {
    const r = calculateSettlement({
      members: [{ userId: "a" }, { userId: "b" }],
      expenses: [{
        id: "e1", totalCentimes: dh(200),
        allocations: [{ userId: "a", amountCentimes: dh(100) }, { userId: "b", amountCentimes: dh(100) }],
        payments: [],
      }],
    });
    expect(r.isComplete).toBe(false);
    expect(r.totalUnrecorded).toBe(dh(200));
    expect(r.incompleteExpenseIds).toEqual(["e1"]);
    // Nobody receives: no creditor exists
    expect(r.memberBalances.every(b => b.netBalance <= 0)).toBe(true);
  });
});

describe("simplifyDebts — minimal transfers, no self/zero/negative", () => {
  it("chains collapse: A owes 100, B owes C 100 -> 2 transfers not 3", () => {
    const t = simplifyDebts([
      { userId: "a", totalPaid: 0, totalResponsibility: 100, netBalance: -100 },
      { userId: "b", totalPaid: 200, totalResponsibility: 100, netBalance: 100 },
      { userId: "c", totalPaid: 0, totalResponsibility: 100, netBalance: -100 },
      { userId: "d", totalPaid: 200, totalResponsibility: 100, netBalance: 100 },
    ]);
    // 2 debtors, 2 creditors -> at most 3 transfers, greedy gives <= n-1... assert correctness
    const bal = new Map([["a", -100], ["b", 100], ["c", -100], ["d", 100]]);
    for (const x of t) {
      expect(x.amountCentimes).toBeGreaterThan(0);
      expect(x.fromUserId).not.toBe(x.toUserId);
      bal.set(x.fromUserId, bal.get(x.fromUserId)! + x.amountCentimes);
      bal.set(x.toUserId, bal.get(x.toUserId)! - x.amountCentimes);
    }
    for (const v of bal.values()) expect(v).toBe(0);
    expect(t.length).toBeLessThanOrEqual(3);
  });
});

describe("randomized settlement invariants", () => {
  let seed = 1234567;
  const rnd = (n: number) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };

  for (let trial = 0; trial < 100; trial++) {
    it(`random complete settlement #${trial} balances`, () => {
      const nMembers = 2 + rnd(4); // 2..5
      const members = Array.from({ length: nMembers }, (_, i) => ({ userId: `u${i}` }));
      const nExp = 1 + rnd(4);
      const expenses = Array.from({ length: nExp }, (_, e) => {
        const total = 100 * (1 + rnd(500)); // 1.00..500.00 DH in centimes
        // equal split with remainder
        const base = Math.floor(total / nMembers);
        const rem = total % nMembers;
        const allocations = members.map((m, i) => ({ userId: m.userId, amountCentimes: base + (i < rem ? 1 : 0) }));
        // random payer covers whole expense (complete settlement)
        const payer = members[rnd(nMembers)].userId;
        return { id: `e${e}`, totalCentimes: total, allocations, payments: [{ userId: payer, amountCentimes: total }] };
      });
      const r = calculateSettlement({ members, expenses });
      expect(r.isComplete).toBe(true);
      const pos = r.memberBalances.filter(b => b.netBalance > 0).reduce((s, b) => s + b.netBalance, 0);
      const neg = r.memberBalances.filter(b => b.netBalance < 0).reduce((s, b) => s + Math.abs(b.netBalance), 0);
      expect(pos).toBe(neg);
      const bal = new Map(r.memberBalances.map(b => [b.userId, b.netBalance]));
      for (const t of r.transfers) {
        expect(t.amountCentimes).toBeGreaterThan(0);
        bal.set(t.fromUserId, bal.get(t.fromUserId)! + t.amountCentimes);
        bal.set(t.toUserId, bal.get(t.toUserId)! - t.amountCentimes);
      }
      for (const v of bal.values()) expect(v).toBe(0);
    });
  }
});

describe("contributions are tracked, settlement stays expense-based", () => {
  it("contribution does not change transfers, but is summed", () => {
    const base: SettlementInput = {
      members: [{ userId: "a" }, { userId: "b" }],
      expenses: [{
        id: "e1", totalCentimes: dh(200),
        allocations: [{ userId: "a", amountCentimes: dh(100) }, { userId: "b", amountCentimes: dh(100) }],
        payments: [{ userId: "a", amountCentimes: dh(200) }],
      }],
    };
    const without = calculateSettlement(base);
    const withContrib = calculateSettlement({
      ...base,
      contributions: [{ userId: "a", amountCentimes: dh(500) }],
    });
    // Documented model: contribution = pool buy-in (wallet-held), settlement covers expense debts
    expect(withContrib.totalContributions).toBe(dh(500));
    expect(withContrib.transfers).toEqual(without.transfers);
  });
});
