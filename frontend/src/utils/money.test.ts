import { describe, expect, it } from "vitest";
import { bpToPercent, formatMoney, fromMinor, isValidAmount, percentToBp, toMinor } from "./money";

describe("decimal text and minor units", () => {
  it("converts typed amounts without float error", () => {
    expect(toMinor("19.99")).toBe(1999);
    expect(toMinor("1,234.5")).toBe(123450);
    expect(toMinor("0.07")).toBe(7);
    expect(toMinor("")).toBe(0);
    // parseFloat("4.35") * 100 is 434.99999999999994.
    expect(toMinor("4.35")).toBe(435);
  });
  it("rejects anything that is not a plain amount", () => {
    expect(() => toMinor("1.234")).toThrow();
    expect(() => toMinor("-5")).toThrow();
    expect(() => toMinor("abc")).toThrow();
    expect(isValidAmount("1.234")).toBe(false);
    expect(isValidAmount("12.34")).toBe(true);
  });
  it("round-trips and formats", () => {
    expect(fromMinor(123456)).toBe("1234.56");
    expect(formatMoney(123456789, "INR")).toBe("INR 1,234,567.89");
    expect(formatMoney(undefined, "USD")).toBe("USD 0.00");
  });
  it("converts percentages to basis points", () => {
    expect(percentToBp("12.5")).toBe(1250);
    expect(bpToPercent(1800)).toBe("18");
    expect(bpToPercent(1250)).toBe("12.50");
  });
});
