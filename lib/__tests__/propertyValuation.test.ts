import { describe, it, expect } from "vitest";
import { hasMeaningfulPropertyValuation } from "../propertyValuation";
import type { PropertyValuation } from "../../types";

function makeStub(overrides: Partial<PropertyValuation> = {}): PropertyValuation {
  return {
    id: "pv1",
    dealId: "deal1",
    reportDate: null,
    sgCode: null,
    reportSource: "TPN Property Valuation Report", // always populated by default — never itself evidence
    valuationBasis: "unknown",
    propertyDescription: null,
    extentSqm: null,
    zoning: null,
    buildingSizeSqm: null,
    bedroomsReported: null,
    bathroomsReported: null,
    garagesReported: null,
    yearBuiltReported: null,
    estimatedValue: null,
    valueConfidenceLow: null,
    valueConfidenceHigh: null,
    valuationConfidence: null,
    pricePerSqm: null,
    currentOwnerSince: null,
    ownerAgeBand: null,
    transactions: [],
    bonds: [],
    comparables: [],
    ...overrides,
  };
}

describe("hasMeaningfulPropertyValuation", () => {
  it("is false for null/undefined", () => {
    expect(hasMeaningfulPropertyValuation(null)).toBe(false);
    expect(hasMeaningfulPropertyValuation(undefined)).toBe(false);
  });

  it("is false for a freshly-created empty stub (every field null, reportSource defaulted)", () => {
    expect(hasMeaningfulPropertyValuation(makeStub())).toBe(false);
  });

  it("is false when estimatedValue is 0 — never a real valuation, treated as absent not confirmed-zero", () => {
    expect(hasMeaningfulPropertyValuation(makeStub({ estimatedValue: 0 }))).toBe(false);
  });

  it("is true when estimatedValue is a real positive number", () => {
    expect(hasMeaningfulPropertyValuation(makeStub({ estimatedValue: 2_100_000 }))).toBe(true);
  });

  it("is true from a confidence range alone", () => {
    expect(hasMeaningfulPropertyValuation(makeStub({ valueConfidenceLow: 1_900_000 }))).toBe(true);
    expect(hasMeaningfulPropertyValuation(makeStub({ valueConfidenceHigh: 2_300_000 }))).toBe(true);
  });

  it("is true from a confidence label alone", () => {
    expect(hasMeaningfulPropertyValuation(makeStub({ valuationConfidence: "High" }))).toBe(true);
  });

  it("is true from populated comparables, transactions, or bonds alone", () => {
    expect(
      hasMeaningfulPropertyValuation(
        makeStub({ comparables: [{ id: "c1", propertyValuationId: "pv1", order: 0 }] })
      )
    ).toBe(true);
    expect(
      hasMeaningfulPropertyValuation(
        makeStub({ transactions: [{ id: "t1", propertyValuationId: "pv1", order: 0 }] })
      )
    ).toBe(true);
    expect(
      hasMeaningfulPropertyValuation(makeStub({ bonds: [{ id: "b1", propertyValuationId: "pv1", order: 0 }] }))
    ).toBe(true);
  });

  it("is true for a realistically fully-populated valuation", () => {
    expect(
      hasMeaningfulPropertyValuation(
        makeStub({
          estimatedValue: 2_150_000,
          valueConfidenceLow: 2_000_000,
          valueConfidenceHigh: 2_300_000,
          valuationConfidence: "High",
          pricePerSqm: 18_500,
          comparables: [{ id: "c1", propertyValuationId: "pv1", order: 0 }],
        })
      )
    ).toBe(true);
  });
});
