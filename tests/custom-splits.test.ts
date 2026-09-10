import { describe, it, expect } from "vitest";
import {
  calculateEqualSplits,
  calculateExactSplits,
  calculatePercentageSplits,
  calculateShareSplits,
} from "../src/lib/balances";

describe("Custom Splits Calculation Engine", () => {
  it("correctly allocates residual penny for equal splits", () => {
    const equal3 = calculateEqualSplits(100, ["u1", "u2", "u3"]);
    const equalSum = Math.round(equal3.reduce((acc, s) => acc + s.owedAmount, 0) * 100) / 100;

    expect(equalSum).toBe(100);
    expect(equal3[0].owedAmount).toBe(33.34);
    expect(equal3[1].owedAmount).toBe(33.33);
    expect(equal3[2].owedAmount).toBe(33.33);
  });

  it("handles exact amounts splits correctly and validates sum", () => {
    const exactSplits = calculateExactSplits(1500, [
      { userId: "u1", amount: 800 },
      { userId: "u2", amount: 450 },
      { userId: "u3", amount: 250 },
    ]);
    const exactSum = Math.round(exactSplits.reduce((acc, s) => acc + s.owedAmount, 0) * 100) / 100;
    expect(exactSum).toBe(1500);

    // Mismatched sum should throw
    expect(() =>
      calculateExactSplits(1500, [
        { userId: "u1", amount: 800 },
        { userId: "u2", amount: 400 }, // sum 1200 !== 1500
      ])
    ).toThrow(/Exact split total/);
  });

  it("handles percentage splits with residual penny handling", () => {
    const percentSplits = calculatePercentageSplits(1000, [
      { userId: "u1", percentage: 60 },
      { userId: "u2", percentage: 25 },
      { userId: "u3", percentage: 15 },
    ]);
    const percentSum =
      Math.round(percentSplits.reduce((acc, s) => acc + s.owedAmount, 0) * 100) / 100;

    expect(percentSum).toBe(1000);
    expect(percentSplits[0].owedAmount).toBe(600);
    expect(percentSplits[1].owedAmount).toBe(250);
    expect(percentSplits[2].owedAmount).toBe(150);

    // Odd percentage split: ₹10 split 33.33%, 33.33%, 33.34%
    const oddPercentSplits = calculatePercentageSplits(10, [
      { userId: "u1", percentage: 33.33 },
      { userId: "u2", percentage: 33.33 },
      { userId: "u3", percentage: 33.34 },
    ]);
    const oddPercentSum =
      Math.round(oddPercentSplits.reduce((acc, s) => acc + s.owedAmount, 0) * 100) / 100;
    expect(oddPercentSum).toBe(10);

    // Invalid percentage total should throw
    expect(() =>
      calculatePercentageSplits(100, [
        { userId: "u1", percentage: 50 },
        { userId: "u2", percentage: 40 }, // sum 90% !== 100%
      ])
    ).toThrow(/Percentages must sum to 100%/);
  });

  it("handles shares / relative weights splits", () => {
    const shareSplits = calculateShareSplits(100, [
      { userId: "u1", shares: 2 },
      { userId: "u2", shares: 1 },
      { userId: "u3", shares: 1 },
    ]);
    const shareSum = Math.round(shareSplits.reduce((acc, s) => acc + s.owedAmount, 0) * 100) / 100;

    expect(shareSum).toBe(100);
    expect(shareSplits[0].owedAmount).toBe(50);
    expect(shareSplits[1].owedAmount).toBe(25);
    expect(shareSplits[2].owedAmount).toBe(25);

    const oddShares = calculateShareSplits(10, [
      { userId: "u1", shares: 1 },
      { userId: "u2", shares: 1 },
      { userId: "u3", shares: 1 },
    ]);
    const oddShareSum = Math.round(oddShares.reduce((acc, s) => acc + s.owedAmount, 0) * 100) / 100;
    expect(oddShareSum).toBe(10);
  });
});
