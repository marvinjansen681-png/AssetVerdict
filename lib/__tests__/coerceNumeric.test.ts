import { describe, it, expect } from "vitest";
import { coerceNumericFields } from "../coerceNumeric";

// Phase 4.7: leaseTermMonths round-trips through the same whitelist-driven
// coercion every other numeric cashflow field (e.g. billsIncludedAmount)
// already relies on — a blank form field must persist as null ("not
// recorded"), never as 0 ("0 months remaining").
describe("coerceNumericFields — leaseTermMonths (Phase 4.7)", () => {
  it("coerces a numeric string to a number", () => {
    const result = coerceNumericFields({ leaseTermMonths: "60" }, ["leaseTermMonths"]);
    expect(result.leaseTermMonths).toBe(60);
  });

  it("coerces an empty string to null, not 0", () => {
    const result = coerceNumericFields({ leaseTermMonths: "" }, ["leaseTermMonths"]);
    expect(result.leaseTermMonths).toBeNull();
  });

  it("leaves an already-null value as null", () => {
    const result = coerceNumericFields({ leaseTermMonths: null }, ["leaseTermMonths"]);
    expect(result.leaseTermMonths).toBeNull();
  });

  it("leaves fields not in the whitelist untouched", () => {
    const result = coerceNumericFields({ leaseTermMonths: "60", notes: "hello" }, ["leaseTermMonths"]);
    expect(result.notes).toBe("hello");
  });
});
