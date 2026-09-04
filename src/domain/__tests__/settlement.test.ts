import { describe, it, expect } from "vitest";
import { calculateSettlement } from "../settlement";
import { allocateEqual, allocatePercentage, allocatePortions } from "../money";

// Helper to convert DH to centimes
const dh = (amount: number) => Math.round(amount * 100);

describe("Required Financial Test 1 - Friday Pool Night", () => {
  it("should match spec example exactly", () => {
    const members = [
      { userId: "naoufal", displayName: "Naoufal" },
      { userId: "mohamed", displayName: "Mohamed" },
      { userId: "yassine", displayName: "Yassine" },
      { userId: "anour", displayName: "Anour" },
    ];

    const expenses = [
      {
        id: "exp1",
        totalCentimes: dh(120),
        allocations: [
          { userId: "naoufal", amountCentimes: dh(40) },
          { userId: "mohamed", amountCentimes: dh(40) },
          { userId: "yassine", amountCentimes: dh(40) },
        ],
        payments: [{ userId: "naoufal", amountCentimes: dh(120) }],
      },
      {
        id: "exp2",
        totalCentimes: dh(60),
        allocations: [
          { userId: "yassine", amountCentimes: dh(30) },
          { userId: "anour", amountCentimes: dh(30) },
        ],
        payments: [{ userId: "yassine", amountCentimes: dh(60) }],
      },
      {
        id: "exp3",
        totalCentimes: dh(40),
        allocations: [
          { userId: "naoufal", amountCentimes: dh(10) },
          { userId: "mohamed", amountCentimes: dh(10) },
          { userId: "yassine", amountCentimes: dh(10) },
          { userId: "anour", amountCentimes: dh(10) },
        ],
        payments: [{ userId: "mohamed", amountCentimes: dh(40) }],
      },
    ];

    const result = calculateSettlement({ members, expenses });

    // Expected responsibility
    const naoufal = result.memberBalances.find(b => b.userId === "naoufal")!;
    const mohamed = result.memberBalances.find(b => b.userId === "mohamed")!;
    const yassine = result.memberBalances.find(b => b.userId === "yassine")!;
    const anour = result.memberBalances.find(b => b.userId === "anour")!;

    expect(naoufal.totalResponsibility).toBe(dh(50));
    expect(mohamed.totalResponsibility).toBe(dh(50));
    expect(yassine.totalResponsibility).toBe(dh(80));
    expect(anour.totalResponsibility).toBe(dh(40));

    // Expected actual payments
    expect(naoufal.totalPaid).toBe(dh(120));
    expect(mohamed.totalPaid).toBe(dh(40));
    expect(yassine.totalPaid).toBe(dh(60));
    expect(anour.totalPaid).toBe(dh(0));

    // Expected balances
    expect(naoufal.netBalance).toBe(dh(70));
    expect(mohamed.netBalance).toBe(dh(-10));
    expect(yassine.netBalance).toBe(dh(-20));
    expect(anour.netBalance).toBe(dh(-40));

    // Expected settlement
    // Sorting transfers for deterministic comparison
    const transfers = result.transfers.sort((a, b) => b.amountCentimes - a.amountCentimes);
    expect(transfers).toHaveLength(3);
    // Anour -> Naoufal 40
    expect(transfers.find(t => t.fromUserId === "anour" && t.toUserId === "naoufal")?.amountCentimes).toBe(dh(40));
    // Yassine -> Naoufal 20
    expect(transfers.find(t => t.fromUserId === "yassine" && t.toUserId === "naoufal")?.amountCentimes).toBe(dh(20));
    // Mohamed -> Naoufal 10
    expect(transfers.find(t => t.fromUserId === "mohamed" && t.toUserId === "naoufal")?.amountCentimes).toBe(dh(10));

    // Total should be 70 DH
    const totalTransferred = transfers.reduce((s, t) => s + t.amountCentimes, 0);
    expect(totalTransferred).toBe(dh(70));

    // Invariant: sum positive == sum negative
    const positive = result.memberBalances.filter(b => b.netBalance > 0).reduce((s, b) => s + b.netBalance, 0);
    const negative = result.memberBalances.filter(b => b.netBalance < 0).reduce((s, b) => s + Math.abs(b.netBalance), 0);
    expect(positive).toBe(negative);
  });
});

describe("Required Financial Test 2 - Simple 2 tables", () => {
  it("should simplify without involving Mohamed", () => {
    const members = [
      { userId: "naoufal", displayName: "Naoufal" },
      { userId: "mohamed", displayName: "Mohamed" },
      { userId: "yassine", displayName: "Yassine" },
    ];

    const expenses = [
      {
        id: "t1",
        totalCentimes: dh(100),
        allocations: [
          { userId: "naoufal", amountCentimes: dh(50) },
          { userId: "mohamed", amountCentimes: dh(50) },
        ],
        payments: [{ userId: "naoufal", amountCentimes: dh(100) }],
      },
      {
        id: "t2",
        totalCentimes: dh(100),
        allocations: [
          { userId: "mohamed", amountCentimes: dh(50) },
          { userId: "yassine", amountCentimes: dh(50) },
        ],
        payments: [{ userId: "mohamed", amountCentimes: dh(100) }],
      },
    ];

    const result = calculateSettlement({ members, expenses });

    const naoufal = result.memberBalances.find(b => b.userId === "naoufal")!;
    const mohamed = result.memberBalances.find(b => b.userId === "mohamed")!;
    const yassine = result.memberBalances.find(b => b.userId === "yassine")!;

    expect(naoufal.totalResponsibility).toBe(dh(50));
    expect(mohamed.totalResponsibility).toBe(dh(100));
    expect(yassine.totalResponsibility).toBe(dh(50));

    expect(naoufal.totalPaid).toBe(dh(100));
    expect(mohamed.totalPaid).toBe(dh(100));
    expect(yassine.totalPaid).toBe(dh(0));

    expect(naoufal.netBalance).toBe(dh(50));
    expect(mohamed.netBalance).toBe(dh(0));
    expect(yassine.netBalance).toBe(dh(-50));

    expect(result.transfers).toHaveLength(1);
    expect(result.transfers[0].fromUserId).toBe("yassine");
    expect(result.transfers[0].toUserId).toBe("naoufal");
    expect(result.transfers[0].amountCentimes).toBe(dh(50));

    // Ensure Mohamed not involved
    expect(result.transfers.some(t => t.fromUserId === "mohamed" || t.toUserId === "mohamed")).toBe(false);
  });
});

describe("Money allocation", () => {
  it("equal split rounding: 100 DH among 3", () => {
    const allocations = allocateEqual(dh(100), 3);
    expect(allocations).toEqual([dh(33.34), dh(33.33), dh(33.33)]);
    expect(allocations.reduce((a, b) => a + b, 0)).toBe(dh(100));
  });

  it("equal split exact: 120 among 3", () => {
    expect(allocateEqual(dh(120), 3)).toEqual([dh(40), dh(40), dh(40)]);
  });

  it("percentage split 50/25/25", () => {
    const allocations = allocatePercentage(dh(160), [5000, 2500, 2500]);
    expect(allocations).toEqual([dh(80), dh(40), dh(40)]);
    expect(allocations.reduce((a, b) => a + b, 0)).toBe(dh(160));
  });

  it("percentage must sum to 10000", () => {
    expect(() => allocatePercentage(dh(100), [5000, 4000])).toThrow();
  });

  it("portions split", () => {
    const allocations = allocatePortions(dh(120), [2, 3, 1]);
    expect(allocations).toEqual([dh(40), dh(60), dh(20)]);
  });

  it("many participants equal split sums correctly", () => {
    for (let n = 1; n <= 10; n++) {
      const total = dh(100);
      const allocs = allocateEqual(total, n);
      expect(allocs.reduce((a, b) => a + b, 0)).toBe(total);
    }
  });
});

describe("Settlement invariants", () => {
  it("zero balance case: everyone paid exactly responsibility", () => {
    const members = [
      { userId: "a" }, { userId: "b" }
    ];
    const expenses = [
      {
        id: "e1",
        totalCentimes: dh(100),
        allocations: [{ userId: "a", amountCentimes: dh(50) }, { userId: "b", amountCentimes: dh(50) }],
        payments: [{ userId: "a", amountCentimes: dh(50) }, { userId: "b", amountCentimes: dh(50) }],
      }
    ];
    const result = calculateSettlement({ members, expenses });
    expect(result.transfers).toHaveLength(0);
    expect(result.memberBalances.every(b => b.netBalance === 0)).toBe(true);
  });

  it("multiple payers for single expense", () => {
    const members = [{ userId: "a" }, { userId: "b" }, { userId: "c" }];
    const expenses = [
      {
        id: "e1",
        totalCentimes: dh(120),
        allocations: [{ userId: "a", amountCentimes: dh(40) }, { userId: "b", amountCentimes: dh(40) }, { userId: "c", amountCentimes: dh(40) }],
        payments: [{ userId: "a", amountCentimes: dh(60) }, { userId: "b", amountCentimes: dh(60) }],
      }
    ];
    const result = calculateSettlement({ members, expenses });
    const a = result.memberBalances.find(b => b.userId === "a")!;
    const b = result.memberBalances.find(b => b.userId === "b")!;
    const c = result.memberBalances.find(b => b.userId === "c")!;
    expect(a.netBalance).toBe(dh(20));
    expect(b.netBalance).toBe(dh(20));
    expect(c.netBalance).toBe(dh(-40));
    expect(result.transfers).toHaveLength(2);
  });

  it("after applying transfers all balances zero", () => {
    const members = [
      { userId: "naoufal" }, { userId: "mohamed" }, { userId: "yassine" }, { userId: "anour" }
    ];
    const expenses = [
      {
        id: "exp1",
        totalCentimes: dh(120),
        allocations: [{ userId: "naoufal", amountCentimes: dh(40) }, { userId: "mohamed", amountCentimes: dh(40) }, { userId: "yassine", amountCentimes: dh(40) }],
        payments: [{ userId: "naoufal", amountCentimes: dh(120) }],
      },
      {
        id: "exp2",
        totalCentimes: dh(60),
        allocations: [{ userId: "yassine", amountCentimes: dh(30) }, { userId: "anour", amountCentimes: dh(30) }],
        payments: [{ userId: "yassine", amountCentimes: dh(60) }],
      },
      {
        id: "exp3",
        totalCentimes: dh(40),
        allocations: [{ userId: "naoufal", amountCentimes: dh(10) }, { userId: "mohamed", amountCentimes: dh(10) }, { userId: "yassine", amountCentimes: dh(10) }, { userId: "anour", amountCentimes: dh(10) }],
        payments: [{ userId: "mohamed", amountCentimes: dh(40) }],
      },
    ];
    const result = calculateSettlement({ members, expenses });
    // Simulate applying transfers
    const balances = new Map(result.memberBalances.map(b => [b.userId, b.netBalance]));
    for (const t of result.transfers) {
      balances.set(t.fromUserId, balances.get(t.fromUserId)! + t.amountCentimes);
      balances.set(t.toUserId, balances.get(t.toUserId)! - t.amountCentimes);
    }
    for (const [_, bal] of balances) {
      expect(bal).toBe(0);
    }
  });
});

describe("Optional payment - Responsibility vs Payment distinction (Hesab core model)", () => {
  it("Case 1: Everyone pays for themselves - no settlement", () => {
    const members = [
      { userId: "naoufal" }, { userId: "mohamed" }, { userId: "yassine" },
    ];
    const expenses = [
      {
        id: "pizza",
        totalCentimes: dh(120),
        allocations: [
          { userId: "naoufal", amountCentimes: dh(40) },
          { userId: "mohamed", amountCentimes: dh(40) },
          { userId: "yassine", amountCentimes: dh(40) },
        ],
        payments: [
          { userId: "naoufal", amountCentimes: dh(40) },
          { userId: "mohamed", amountCentimes: dh(40) },
          { userId: "yassine", amountCentimes: dh(40) },
        ],
      },
    ];
    const result = calculateSettlement({ members, expenses });
    expect(result.isComplete).toBe(true);
    expect(result.memberBalances.every(b => b.netBalance === 0)).toBe(true);
    expect(result.transfers).toHaveLength(0);
  });

  it("Case 2: One person pays for everyone", () => {
    const members = [
      { userId: "naoufal" }, { userId: "mohamed" }, { userId: "yassine" },
    ];
    const expenses = [
      {
        id: "pizza",
        totalCentimes: dh(120),
        allocations: [
          { userId: "naoufal", amountCentimes: dh(40) },
          { userId: "mohamed", amountCentimes: dh(40) },
          { userId: "yassine", amountCentimes: dh(40) },
        ],
        payments: [{ userId: "naoufal", amountCentimes: dh(120) }],
      },
    ];
    const result = calculateSettlement({ members, expenses });
    const naoufal = result.memberBalances.find(b => b.userId === "naoufal")!;
    const mohamed = result.memberBalances.find(b => b.userId === "mohamed")!;
    const yassine = result.memberBalances.find(b => b.userId === "yassine")!;
    expect(naoufal.netBalance).toBe(dh(80)); // 120 - 40
    expect(mohamed.netBalance).toBe(dh(-40));
    expect(yassine.netBalance).toBe(dh(-40));
    expect(result.transfers).toHaveLength(2);
    expect(result.transfers.some(t => t.fromUserId === "mohamed" && t.toUserId === "naoufal" && t.amountCentimes === dh(40))).toBe(true);
    expect(result.transfers.some(t => t.fromUserId === "yassine" && t.toUserId === "naoufal" && t.amountCentimes === dh(40))).toBe(true);
  });

  it("Case 3: Multiple people pay (80+40) - partial reimbursement", () => {
    const members = [
      { userId: "naoufal" }, { userId: "mohamed" }, { userId: "yassine" },
    ];
    const expenses = [
      {
        id: "pizza",
        totalCentimes: dh(120),
        allocations: [
          { userId: "naoufal", amountCentimes: dh(40) },
          { userId: "mohamed", amountCentimes: dh(40) },
          { userId: "yassine", amountCentimes: dh(40) },
        ],
        payments: [
          { userId: "naoufal", amountCentimes: dh(80) },
          { userId: "mohamed", amountCentimes: dh(40) },
        ],
      },
    ];
    const result = calculateSettlement({ members, expenses });
    // Naoufal +40, Mohamed 0, Yassine -40 => Yassine -> Naoufal 40
    expect(result.memberBalances.find(b => b.userId === "naoufal")!.netBalance).toBe(dh(40));
    expect(result.memberBalances.find(b => b.userId === "mohamed")!.netBalance).toBe(0);
    expect(result.memberBalances.find(b => b.userId === "yassine")!.netBalance).toBe(dh(-40));
    expect(result.transfers).toHaveLength(1);
    expect(result.transfers[0]).toEqual(expect.objectContaining({ fromUserId: "yassine", toUserId: "naoufal", amountCentimes: dh(40) }));
  });

  it("Case 4: Payment not recorded - unknown payer distinct from 0", () => {
    const members = [
      { userId: "naoufal" }, { userId: "mohamed" }, { userId: "yassine" },
    ];
    const expenses = [
      {
        id: "pool",
        totalCentimes: dh(90),
        allocations: [
          { userId: "naoufal", amountCentimes: dh(30) },
          { userId: "mohamed", amountCentimes: dh(30) },
          { userId: "yassine", amountCentimes: dh(30) },
        ],
        payments: [], // unknown payer
      },
    ];
    const result = calculateSettlement({ members, expenses });
    expect(result.isComplete).toBe(false);
    expect(result.totalUnrecorded).toBe(dh(90));
    expect(result.incompleteExpenseIds).toContain("pool");
    // Each owes 30, but no one paid, so no transfers possible (no creditor)
    expect(result.memberBalances.every(b => b.netBalance === dh(-30))).toBe(true);
    expect(result.transfers).toHaveLength(0);
    // This is distinct from "everyone paid 0" vs "unknown": if we explicitly set 0, same balances but isComplete false signals unknown
  });

  it("Percentage responsibility independent from payment: Pizza 200 DH with unequal shares, Mohamed paid all", () => {
    const members = [
      { userId: "naoufal" }, { userId: "yassine" }, { userId: "mohamed" },
    ];
    // Responsibility: Naoufal 20% =40, Yassine 30%=60, Mohamed 50%=100, Payment: Mohamed 200
    const expenses = [
      {
        id: "pizza",
        totalCentimes: dh(200),
        allocations: [
          { userId: "naoufal", amountCentimes: dh(40) },
          { userId: "yassine", amountCentimes: dh(60) },
          { userId: "mohamed", amountCentimes: dh(100) },
        ],
        payments: [{ userId: "mohamed", amountCentimes: dh(200) }],
      },
    ];
    const result = calculateSettlement({ members, expenses });
    expect(result.memberBalances.find(b => b.userId === "naoufal")!.netBalance).toBe(dh(-40));
    expect(result.memberBalances.find(b => b.userId === "yassine")!.netBalance).toBe(dh(-60));
    expect(result.memberBalances.find(b => b.userId === "mohamed")!.netBalance).toBe(dh(100));
    // Mohamed receives 40+60, his own 100 already covered
    expect(result.transfers).toHaveLength(2);
    expect(result.transfers.some(t => t.fromUserId === "naoufal" && t.toUserId === "mohamed")).toBe(true);
    expect(result.transfers.some(t => t.fromUserId === "yassine" && t.toUserId === "mohamed")).toBe(true);
  });

  it("Multiple payers for restaurant 300 DH with 25% each: Naoufal 200, Yassine 100", () => {
    const members = [
      { userId: "naoufal" }, { userId: "yassine" }, { userId: "mohamed" }, { userId: "anour" },
    ];
    const expenses = [
      {
        id: "resto",
        totalCentimes: dh(300),
        allocations: [
          { userId: "naoufal", amountCentimes: dh(75) },
          { userId: "yassine", amountCentimes: dh(75) },
          { userId: "mohamed", amountCentimes: dh(75) },
          { userId: "anour", amountCentimes: dh(75) },
        ],
        payments: [
          { userId: "naoufal", amountCentimes: dh(200) },
          { userId: "yassine", amountCentimes: dh(100) },
        ],
      },
    ];
    const result = calculateSettlement({ members, expenses });
    // Naoufal +125, Yassine +25, Mohamed -75, Anour -75
    expect(result.memberBalances.find(b => b.userId === "naoufal")!.netBalance).toBe(dh(125));
    expect(result.memberBalances.find(b => b.userId === "yassine")!.netBalance).toBe(dh(25));
    expect(result.memberBalances.find(b => b.userId === "mohamed")!.netBalance).toBe(dh(-75));
    expect(result.memberBalances.find(b => b.userId === "anour")!.netBalance).toBe(dh(-75));
    // Settlement minimizes transfers, should be 3 transfers covering 150
    const totalTransferred = result.transfers.reduce((s, t) => s + t.amountCentimes, 0);
    expect(totalTransferred).toBe(dh(150));
    // Verify all balances zero after applying
    const balances = new Map(result.memberBalances.map(b => [b.userId, b.netBalance]));
    for (const t of result.transfers) {
      balances.set(t.fromUserId, balances.get(t.fromUserId)! + t.amountCentimes);
      balances.set(t.toUserId, balances.get(t.toUserId)! - t.amountCentimes);
    }
    for (const bal of balances.values()) expect(bal).toBe(0);
  });
});
