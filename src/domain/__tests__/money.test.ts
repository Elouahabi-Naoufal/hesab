import { describe, it, expect } from "vitest";
import {
  parseDHToCentimes,
  formatDH,
  allocateEqual,
  allocatePercentage,
  allocatePortions,
  validateCustomAmounts,
  MAX_CENTIMES,
} from "../money";

describe("parseDHToCentimes — the only money entry point", () => {
  const cases: Array<[unknown, number]> = [
    ["0", 0],
    ["0.01", 1],
    ["0.10", 10],
    ["1", 100],
    ["7.50", 750],
    ["99.99", 9999],
    ["100", 10000],
    ["1000.50", 100050],
    [100, 10000],
    [7.5, 750],
    // Moroccan input styles
    ["7,50", 750],
    ["1 000.50", 100050],
    ["100 DH", 10000],
    ["100dh", 10000],
    ["100 MAD", 10000],
    ["  25  ", 2500],
  ];
  for (const [input, expected] of cases) {
    it(`parses ${JSON.stringify(input)} -> ${expected}`, () => {
      expect(parseDHToCentimes(input as string)).toBe(expected);
    });
  }

  const invalid: Array<[unknown, string?]> = [
    ["", "required"],
    ["   ", "required"],
    [null, "required"],
    [undefined, "required"],
    ["-5", "negative"],
    ["-0.01", "negative"],
    ["abc", "valid DH"],
    ["12.345", "2 decimals"],
    ["10.999", "2 decimals"],
    ["1.2.3", "valid DH"],
    ["--5", "negative"],
    ["NaN", "valid DH"],
    ["Infinity", "valid DH"],
  ];
  for (const [input, contains] of invalid) {
    it(`rejects ${JSON.stringify(input)}`, () => {
      expect(() => parseDHToCentimes(input as string)).toThrowError(
        new RegExp(contains as string, "i")
      );
    });
  }

  it("enforces minCentimes (deposit must be >= 0.01 DH)", () => {
    expect(() => parseDHToCentimes("0", { minCentimes: 1, field: "Deposit amount" })).toThrowError(
      /at least 0.01 DH/
    );
    expect(parseDHToCentimes("0.01", { minCentimes: 1 })).toBe(1);
  });

  it("rejects amounts above the cap", () => {
    expect(() => parseDHToCentimes("2000000000")).toThrowError(/too large/);
    expect(MAX_CENTIMES).toBe(1_000_000_000_00);
  });

  it("never uses float: 0.1 + 0.2 style inputs stay exact", () => {
    expect(parseDHToCentimes("0.10") + parseDHToCentimes("0.20")).toBe(30);
  });
});

describe("formatDH — DH-only display", () => {
  it("renders whole amounts without decimals", () => {
    expect(formatDH(10000)).toBe("100 DH");
    expect(formatDH(0)).toBe("0 DH");
  });
  it("renders fractional amounts with 2 decimals", () => {
    expect(formatDH(750)).toBe("7.50 DH");
    expect(formatDH(1)).toBe("0.01 DH");
  });
  it("renders negatives with sign prefix", () => {
    expect(formatDH(-500)).toBe("-5 DH");
    expect(formatDH(-750)).toBe("-7.50 DH");
  });
  it("round-trips the parser", () => {
    for (const c of [0, 1, 99, 100, 750, 9999, 10000, 123456]) {
      expect(parseDHToCentimes(formatDH(c))).toBe(c);
    }
  });
});

describe("allocateEqual — exact totals", () => {
  it("100 DH / 3 -> 33.34 + 33.33 + 33.33", () => {
    const a = allocateEqual(10000, 3);
    expect(a.reduce((s, x) => s + x, 0)).toBe(10000);
    expect(a).toEqual([3334, 3333, 3333]);
  });
  const totals = [100, 1000, 10000, 99999];
  const counts = [2, 3, 5, 6, 7, 11];
  for (const t of totals) {
    for (const n of counts) {
      it(`total ${t} / ${n} sums exactly`, () => {
        const a = allocateEqual(t, n);
        expect(a).toHaveLength(n);
        expect(a.reduce((s, x) => s + x, 0)).toBe(t);
        expect(Math.max(...a) - Math.min(...a)).toBeLessThanOrEqual(1);
      });
    }
  }
  it("randomized totals always sum exactly", () => {
    let seed = 42;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    for (let i = 0; i < 200; i++) {
      const total = Math.floor(rnd() * 100000);
      const n = 1 + Math.floor(rnd() * 12);
      const a = allocateEqual(total, n);
      expect(a.reduce((s, x) => s + x, 0)).toBe(total);
    }
  });
});

describe("allocatePercentage — basis points", () => {
  it("33.33/33.33/33.34 splits 100 DH exactly", () => {
    const a = allocatePercentage(10000, [3333, 3333, 3334]);
    expect(a.reduce((s, x) => s + x, 0)).toBe(10000);
  });
  it("rejects sums != 10000", () => {
    expect(() => allocatePercentage(10000, [3333, 3333, 3333])).toThrowError(/10000/);
    expect(() => allocatePercentage(10000, [5000, 5001])).toThrowError(/10000/);
    expect(() => allocatePercentage(10000, [5000, 4000])).toThrowError(/10000/);
  });
});

describe("allocatePortions", () => {
  it("1:2:3 of 600 DH -> 100/200/300", () => {
    expect(allocatePortions(60000, [1, 2, 3])).toEqual([10000, 20000, 30000]);
  });
  it("uneven totals still sum exactly", () => {
    const a = allocatePortions(10000, [1, 1, 1]);
    expect(a.reduce((s, x) => s + x, 0)).toBe(10000);
  });
  it("rejects zero total portions", () => {
    expect(() => allocatePortions(10000, [0, 0])).toThrowError(/zero/);
  });
});

describe("validateCustomAmounts", () => {
  it("accepts exact sums", () => {
    expect(() => validateCustomAmounts(50000, [10000, 15000, 25000])).not.toThrow();
  });
  it("rejects 450 vs 500", () => {
    expect(() => validateCustomAmounts(50000, [10000, 15000, 20000])).toThrowError(/45000/);
  });
});
