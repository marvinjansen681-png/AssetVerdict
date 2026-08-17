import { describe, it, expect } from "vitest";
import { hasFallbackAnalysisContent, hasExitAnalysisContent } from "../areaIntelligence";
import type { ExitSummary } from "../calculations";
import type { PropertyValuation, SuburbProfile } from "../../types";

function makeValuationStub(overrides: Partial<PropertyValuation> = {}): PropertyValuation {
  return {
    id: "pv1",
    dealId: "deal1",
    reportDate: null,
    sgCode: null,
    reportSource: "TPN Property Valuation Report",
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

function makeSuburbProfile(overrides: Partial<SuburbProfile> = {}): SuburbProfile {
  return {
    id: "sp1",
    suburb: "Observatory",
    city: "Cape Town",
    province: "Western Cape",
    ...overrides,
  } as SuburbProfile;
}

function makeExitSummary(overrides: Partial<ExitSummary> = {}): ExitSummary {
  return {
    holdPeriodYears: 20,
    isPlannedSale: false,
    projectedPropertyValueAtExit: 2_500_000,
    remainingDebtAtExit: 1_000_000,
    cgtBaseCost: 1_500_000,
    capitalGainsTaxAtExit: 100_000,
    terminalEquityValue: 1_400_000,
    ...overrides,
  };
}

describe("hasFallbackAnalysisContent", () => {
  it("is true for the three strategies with fallback risk", () => {
    expect(hasFallbackAnalysisContent("str")).toBe(true);
    expect(hasFallbackAnalysisContent("multi_let")).toBe(true);
    expect(hasFallbackAnalysisContent("student")).toBe(true);
  });

  it("is false for strategies without fallback risk", () => {
    expect(hasFallbackAnalysisContent("buy_to_let")).toBe(false);
    expect(hasFallbackAnalysisContent("commercial")).toBe(false);
    expect(hasFallbackAnalysisContent("instalment_sale")).toBe(false);
    expect(hasFallbackAnalysisContent("fix_and_flip")).toBe(false);
  });
});

describe("hasExitAnalysisContent", () => {
  it("is false when there is no valuation evidence, no suburb profile, and no exitSummary", () => {
    expect(
      hasExitAnalysisContent({
        propertyValuation: null,
        suburbProfile: null,
        exitSummary: undefined,
      })
    ).toBe(false);
  });

  it("is false when the only propertyValuation is an empty stub", () => {
    expect(
      hasExitAnalysisContent({
        propertyValuation: makeValuationStub(),
        suburbProfile: null,
        exitSummary: undefined,
      })
    ).toBe(false);
  });

  it("is true when exitSummary alone is present (Fix & Flip has none, every other strategy always does)", () => {
    expect(
      hasExitAnalysisContent({
        propertyValuation: null,
        suburbProfile: null,
        exitSummary: makeExitSummary(),
      })
    ).toBe(true);
  });

  it("is true when a suburb profile is linked, even with no valuation and no exitSummary", () => {
    expect(
      hasExitAnalysisContent({
        propertyValuation: null,
        suburbProfile: makeSuburbProfile(),
        exitSummary: undefined,
      })
    ).toBe(true);
  });

  it("is true when the property valuation has real evidence", () => {
    expect(
      hasExitAnalysisContent({
        propertyValuation: makeValuationStub({ estimatedValue: 2_100_000 }),
        suburbProfile: null,
        exitSummary: undefined,
      })
    ).toBe(true);
  });
});
