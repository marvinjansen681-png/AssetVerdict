import { describe, it, expect } from "vitest";
import {
  DEAL_PATCH_ALLOWED_FIELDS,
  DEAL_PATCH_NUMERIC_FIELDS,
  DEAL_PATCH_PROTECTED_FIELDS,
  DERIVED_FINANCIAL_FIELD_NAMES,
  pickAllowedDealFields,
  validateDealFieldValues,
} from "../dealFieldPolicy";

describe("dealFieldPolicy — allowlist/denylist design (Phase 4.22.1)", () => {
  it("no derived financial field name is ever present in the allowlist", () => {
    const allowed = new Set<string>(DEAL_PATCH_ALLOWED_FIELDS);
    for (const derived of DERIVED_FINANCIAL_FIELD_NAMES) {
      expect(allowed.has(derived)).toBe(false);
    }
  });

  it("no protected (system-owned) field name is ever present in the allowlist", () => {
    const allowed = new Set<string>(DEAL_PATCH_ALLOWED_FIELDS);
    for (const protectedField of DEAL_PATCH_PROTECTED_FIELDS) {
      expect(allowed.has(protectedField)).toBe(false);
    }
  });

  it("DEAL_PATCH_NUMERIC_FIELDS is a subset of DEAL_PATCH_ALLOWED_FIELDS", () => {
    const allowed = new Set<string>(DEAL_PATCH_ALLOWED_FIELDS);
    for (const numeric of DEAL_PATCH_NUMERIC_FIELDS) {
      expect(allowed.has(numeric)).toBe(true);
    }
  });

  it("derived and protected field lists never overlap the allowlist even after future edits (guards against silent regressions)", () => {
    const allowed = new Set<string>(DEAL_PATCH_ALLOWED_FIELDS);
    const blocked = new Set<string>([...DERIVED_FINANCIAL_FIELD_NAMES, ...DEAL_PATCH_PROTECTED_FIELDS]);
    const intersection = [...allowed].filter((f) => blocked.has(f));
    expect(intersection).toEqual([]);
  });

  describe("pickAllowedDealFields", () => {
    it("keeps only allowlisted keys present in the input", () => {
      const result = pickAllowedDealFields({
        purchasePrice: 2_000_000,
        renovationCost: 1,
        totalInvestment: 1,
        irr: 999,
        verdict: "strong",
      });
      expect(result).toEqual({ purchasePrice: 2_000_000 });
    });

    it("returns an empty object when nothing in the input is allowlisted", () => {
      expect(pickAllowedDealFields({ dscr: 1, npv: 2, negotiation: {} })).toEqual({});
    });

    it("passes through every legitimate field untouched, including falsy values", () => {
      const result = pickAllowedDealFields({ purchasePrice: 0, wantToSell: false, name: "" });
      expect(result).toEqual({ purchasePrice: 0, wantToSell: false, name: "" });
    });

    it("never mutates the input object", () => {
      const input = { purchasePrice: 1, irr: 2 };
      const snapshot = { ...input };
      pickAllowedDealFields(input);
      expect(input).toEqual(snapshot);
    });
  });

  describe("validateDealFieldValues (Phase 4.24, Tasks 21/22)", () => {
    it("rejects purchasePrice of exactly 0", () => {
      expect(validateDealFieldValues({ purchasePrice: 0 })).toBe(
        "Purchase Price must be greater than R0"
      );
    });

    it("rejects a negative purchasePrice", () => {
      expect(validateDealFieldValues({ purchasePrice: -500_000 })).toBe(
        "Purchase Price must be greater than R0"
      );
    });

    it("rejects a non-numeric purchasePrice (e.g. failed coercion left it as a string)", () => {
      expect(validateDealFieldValues({ purchasePrice: "abc" })).toBe(
        "Purchase Price must be greater than R0"
      );
    });

    it("accepts a positive purchasePrice", () => {
      expect(validateDealFieldValues({ purchasePrice: 1_000_000 })).toBeNull();
    });

    it("is a no-op when purchasePrice isn't in the payload at all", () => {
      expect(validateDealFieldValues({ name: "Deal" })).toBeNull();
    });

    it("rejects a negative marketValue", () => {
      expect(validateDealFieldValues({ marketValue: -1 })).toBe(
        "Estimated Current Market Value cannot be negative"
      );
    });

    it("allows marketValue of null (cleared/blank)", () => {
      expect(validateDealFieldValues({ marketValue: null })).toBeNull();
    });

    it("allows marketValue of 0", () => {
      expect(validateDealFieldValues({ marketValue: 0 })).toBeNull();
    });

    it("allows a positive marketValue", () => {
      expect(validateDealFieldValues({ marketValue: 3_200_000 })).toBeNull();
    });

    it("checks purchasePrice before marketValue when both are invalid, returning the first violation", () => {
      expect(
        validateDealFieldValues({ purchasePrice: 0, marketValue: -1 })
      ).toBe("Purchase Price must be greater than R0");
    });

    it("an empty payload is valid", () => {
      expect(validateDealFieldValues({})).toBeNull();
    });
  });
});
