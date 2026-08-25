import { describe, it, expect } from "vitest";
import {
  DEAL_PATCH_ALLOWED_FIELDS,
  DEAL_PATCH_NUMERIC_FIELDS,
  DEAL_PATCH_PROTECTED_FIELDS,
  DERIVED_FINANCIAL_FIELD_NAMES,
  pickAllowedDealFields,
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
});
