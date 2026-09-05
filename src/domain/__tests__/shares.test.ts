import { describe, it, expect } from "vitest";
import {
  parsePercentToBasisPoints,
  formatPercent,
  getEffectiveShares,
  validateShareSet,
} from "../shares";

describe("parsePercentToBasisPoints — % input, no float", () => {
  const cases: Array<[unknown, number]> = [
    ["0", 0],
    ["25", 2500],
    ["33.33", 3333],
    ["33,33", 3333],
    ["100", 10000],
    ["7.50", 750],
    ["25%", 2500],
    ["  50  ", 5000],
    [25, 2500],
  ];
  for (const [input, expected] of cases) {
    it(`parses ${JSON.stringify(input)} -> ${expected}bp`, () => {
      expect(parsePercentToBasisPoints(input as string)).toBe(expected);
    });
  }
  const invalid: Array<[unknown, string]> = [
    ["", "required"],
    ["-5", "negative"],
    ["101", "0 and 100"],
    ["12.345", "2 decimals"],
    ["abc", "valid percent"],
  ];
  for (const [input, contains] of invalid) {
    it(`rejects ${JSON.stringify(input)}`, () => {
      expect(() => parsePercentToBasisPoints(input as string)).toThrowError(new RegExp(contains, "i"));
    });
  }
});

describe("formatPercent", () => {
  it("renders whole and fractional", () => {
    expect(formatPercent(2500)).toBe("25%");
    expect(formatPercent(3333)).toBe("33.33%");
    expect(formatPercent(0)).toBe("0%");
  });
});

describe("getEffectiveShares", () => {
  it("all NULL -> equal split summing to exactly 10000", () => {
    const out = getEffectiveShares([
      { userId: "a", shareBasisPoints: null },
      { userId: "b", shareBasisPoints: null },
      { userId: "c", shareBasisPoints: null },
    ]);
    expect(out.map(o => o.basisPoints).reduce((s, x) => s + x, 0)).toBe(10000);
    expect(out.map(o => o.basisPoints)).toEqual([3334, 3333, 3333]);
  });

  it("explicit + NULL remainder: 50% set, two others split 50%", () => {
    const out = getEffectiveShares([
      { userId: "a", shareBasisPoints: 5000 },
      { userId: "b", shareBasisPoints: null },
      { userId: "c", shareBasisPoints: null },
    ]);
    expect(out).toEqual([
      expect.objectContaining({ userId: "a", basisPoints: 5000 }),
      expect.objectContaining({ userId: "b", basisPoints: 2500 }),
      expect.objectContaining({ userId: "c", basisPoints: 2500 }),
    ]);
  });

  it("rejects explicit sum over 100%", () => {
    expect(() =>
      getEffectiveShares([
        { userId: "a", shareBasisPoints: 6000 },
        { userId: "b", shareBasisPoints: 5000 },
      ])
    ).toThrowError(/more than 100%/);
  });

  it("rejects full set that does not cover 100%", () => {
    expect(() =>
      getEffectiveShares([
        { userId: "a", shareBasisPoints: 6000 },
        { userId: "b", shareBasisPoints: 3000 },
      ])
    ).toThrowError(/not 100%/);
  });
});

describe("validateShareSet — owner-saved full set", () => {
  const ids = ["a", "b", "c"];
  it("accepts exact 100% cover", () => {
    expect(() =>
      validateShareSet(ids, [
        { userId: "a", basisPoints: 5000 },
        { userId: "b", basisPoints: 3000 },
        { userId: "c", basisPoints: 2000 },
      ])
    ).not.toThrow();
  });
  it("rejects 99.99%", () => {
    expect(() =>
      validateShareSet(ids, [
        { userId: "a", basisPoints: 5000 },
        { userId: "b", basisPoints: 3000 },
        { userId: "c", basisPoints: 1999 },
      ])
    ).toThrowError(/exactly 100%/);
  });
  it("rejects missing member", () => {
    expect(() =>
      validateShareSet(ids, [
        { userId: "a", basisPoints: 5000 },
        { userId: "b", basisPoints: 5000 },
      ])
    ).toThrowError(/exactly the current members/);
  });
  it("rejects unknown member", () => {
    expect(() =>
      validateShareSet(ids, [
        { userId: "a", basisPoints: 5000 },
        { userId: "b", basisPoints: 3000 },
        { userId: "zzz", basisPoints: 2000 },
      ])
    ).toThrowError(/exactly the current members/);
  });
});
