import { describe, it, expect } from "vitest";
import { formatMoney } from "../src/lib/format";

describe("formatMoney", () => {
  it("formats an integer with INR symbol and group separators", () => {
    expect(formatMoney(4850)).toBe("₹4,850.00");
  });

  it("normalizes string input from numeric() columns", () => {
    expect(formatMoney("600")).toBe("₹600.00");
    expect(formatMoney("1234.5")).toBe("₹1,234.50");
  });

  it("forces two decimal places by default", () => {
    expect(formatMoney(600)).toBe("₹600.00");
    expect(formatMoney(3.1)).toBe("₹3.10");
  });

  it("supports explicit plus/minus sign prefixes", () => {
    expect(formatMoney(600, { sign: "+" })).toBe("+₹600.00");
    expect(formatMoney(600, { sign: "-" })).toBe("-₹600.00");
  });

  it("preserves natural negatives when no sign option is passed", () => {
    expect(formatMoney(-600)).toBe("-₹600.00");
  });

  it("honors forceDecimals=false", () => {
    expect(formatMoney(4850, { forceDecimals: false })).toBe("₹4,850");
  });

  it("supports currency and locale overrides", () => {
    expect(formatMoney(10, { currency: "USD", locale: "en-US" })).toBe("$10.00");
  });

  it("returns a zero currency string for invalid input", () => {
    expect(formatMoney(Number.NaN)).toBe("₹0.00");
    expect(formatMoney("not-a-number")).toBe("₹0.00");
  });
});
