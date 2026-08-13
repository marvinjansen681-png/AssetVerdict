import { describe, it, expect } from "vitest";
import { METRIC_DEFINITIONS } from "../metricDefinitions";
import {
  RENTAL_RELATIONSHIP_CHAINS,
  FLIP_RELATIONSHIP_CHAINS,
  getRelationshipChainsForStrategy,
  getKeyLabel,
} from "../relationshipChains";

const KNOWN_METRIC_KEYS = new Set(Object.keys(METRIC_DEFINITIONS));
// Raw fields the chains are allowed to reference as starting points even
// though they aren't in the registry (see relationshipChains.ts's FIELD_LABELS).
const KNOWN_FIELD_KEYS = new Set(["purchasePrice", "marketValue", "monthlyRent", "occupancyRate", "annualDebtService"]);

function flattenSteps(steps: (string | string[])[]): string[] {
  return steps.flatMap((s) => (Array.isArray(s) ? s : [s]));
}

describe("relationship chains — every step resolves to a known key", () => {
  it("rental chains only reference known metric or field keys", () => {
    for (const chain of RENTAL_RELATIONSHIP_CHAINS) {
      for (const key of flattenSteps(chain.steps)) {
        expect(
          KNOWN_METRIC_KEYS.has(key) || KNOWN_FIELD_KEYS.has(key),
          `chain "${chain.title}" references unknown key "${key}"`
        ).toBe(true);
      }
    }
  });

  it("flip chains only reference known metric or field keys", () => {
    for (const chain of FLIP_RELATIONSHIP_CHAINS) {
      for (const key of flattenSteps(chain.steps)) {
        expect(
          KNOWN_METRIC_KEYS.has(key) || KNOWN_FIELD_KEYS.has(key),
          `chain "${chain.title}" references unknown key "${key}"`
        ).toBe(true);
      }
    }
  });

  it("no chain contains a Fix & Flip metric key mixed into a rental chain, or vice versa", () => {
    const flipOnlyKeys = new Set(
      Object.values(METRIC_DEFINITIONS)
        .filter((m) => m.perspective === "flip")
        .map((m) => m.key)
    );
    for (const chain of RENTAL_RELATIONSHIP_CHAINS) {
      for (const key of flattenSteps(chain.steps)) {
        expect(flipOnlyKeys.has(key), `rental chain "${chain.title}" references flip key "${key}"`).toBe(false);
      }
    }
  });

  it("getRelationshipChainsForStrategy routes fix_and_flip to flip chains and everything else to rental chains", () => {
    expect(getRelationshipChainsForStrategy("fix_and_flip")).toBe(FLIP_RELATIONSHIP_CHAINS);
    for (const strategy of ["commercial", "buy_to_let", "multi_let", "student", "str", "instalment_sale"]) {
      expect(getRelationshipChainsForStrategy(strategy)).toBe(RENTAL_RELATIONSHIP_CHAINS);
    }
  });
});

describe("getKeyLabel", () => {
  it("resolves a registry metric key to its short name", () => {
    expect(getKeyLabel("dscr")).toBe("DSCR");
  });

  it("resolves a known raw field key to its friendly label", () => {
    expect(getKeyLabel("purchasePrice")).toBe("Purchase Price");
    expect(getKeyLabel("annualDebtService")).toBe("Debt Payments");
  });

  it("falls back to a humanized version of an unrecognised camelCase key", () => {
    expect(getKeyLabel("someRandomField")).toBe("Some Random Field");
  });
});
