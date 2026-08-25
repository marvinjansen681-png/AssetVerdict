import { describe, it, expect } from "vitest";
import {
  buildValuationSummary,
  calcValuationVariance,
  calcValuationEvidenceQuality,
  classifyValuationSource,
  type ValuationSourceCategory,
} from "../valuationEvidence";
import type { FlipExitValuationInput } from "../fixFlipExitValue";

function valuation(overrides: Partial<FlipExitValuationInput> = {}): FlipExitValuationInput {
  return {
    estimatedValue: null,
    valueConfidenceLow: null,
    valueConfidenceHigh: null,
    valuationConfidence: null,
    valuationBasis: "unknown",
    reportSource: null,
    reportDate: null,
    comparableCount: 0,
    ...overrides,
  };
}

describe("classifyValuationSource (Phase 4.24 §4)", () => {
  it.each<[string, ValuationSourceCategory]>([
    ["ABSA Bank Valuation", "bank_valuation"],
    ["Independent Professional Valuation", "independent_valuation"],
    ["Registered Valuer Report", "independent_valuation"],
    ["TPN Property Valuation Report", "avm"],
    ["Automated Valuation Model", "avm"],
    ["Comparable Sales Analysis", "comparable_sales_analysis"],
    ["CMA", "comparable_sales_analysis"],
    ["Estate Agent Opinion", "agent_cma"],
    ["User Estimate", "user_estimate"],
    ["Some Random Unrecognised String", "other_unknown"],
  ])("classifies '%s' as %s", (source, expected) => {
    expect(classifyValuationSource(source)).toBe(expected);
  });

  it("fails closed to other_unknown for null/blank source, never guesses upward", () => {
    expect(classifyValuationSource(null)).toBe("other_unknown");
    expect(classifyValuationSource(undefined)).toBe("other_unknown");
    expect(classifyValuationSource("")).toBe("other_unknown");
    expect(classifyValuationSource("   ")).toBe("other_unknown");
  });
});

describe("calcValuationEvidenceQuality (Phase 4.24 §5)", () => {
  it("no estimate at all -> unverified", () => {
    expect(
      calcValuationEvidenceQuality({
        estimatedValue: null,
        valueConfidenceLow: null,
        valueConfidenceHigh: null,
        sourceCategory: "bank_valuation",
        comparableCount: 5,
        valuationBasis: "current_condition",
      })
    ).toBe("unverified");
  });

  it("a bare user estimate with no corroborating detail -> unverified, not indicative", () => {
    expect(
      calcValuationEvidenceQuality({
        estimatedValue: 1_400_000,
        valueConfidenceLow: null,
        valueConfidenceHigh: null,
        sourceCategory: "user_estimate",
        comparableCount: 0,
        valuationBasis: "unknown",
      })
    ).toBe("unverified");
  });

  it("a source label alone never implies Strong Evidence — bank valuation with no basis and no corroboration is NOT strong_evidence", () => {
    const result = calcValuationEvidenceQuality({
      estimatedValue: 1_400_000,
      valueConfidenceLow: null,
      valueConfidenceHigh: null,
      sourceCategory: "bank_valuation",
      comparableCount: 0,
      valuationBasis: "unknown", // basis not known
    });
    expect(result).not.toBe("strong_evidence");
  });

  it("bank valuation + known basis + at least one comparable -> strong_evidence", () => {
    expect(
      calcValuationEvidenceQuality({
        estimatedValue: 1_400_000,
        valueConfidenceLow: null,
        valueConfidenceHigh: null,
        sourceCategory: "bank_valuation",
        comparableCount: 1,
        valuationBasis: "current_condition",
      })
    ).toBe("strong_evidence");
  });

  it("independent valuation + known basis + confidence range -> strong_evidence", () => {
    expect(
      calcValuationEvidenceQuality({
        estimatedValue: 1_400_000,
        valueConfidenceLow: 1_350_000,
        valueConfidenceHigh: 1_450_000,
        sourceCategory: "independent_valuation",
        comparableCount: 0,
        valuationBasis: "current_condition",
      })
    ).toBe("strong_evidence");
  });

  it("3 comparables from an AVM source with a known basis -> supported, not automatically strong", () => {
    const result = calcValuationEvidenceQuality({
      estimatedValue: 1_400_000,
      valueConfidenceLow: null,
      valueConfidenceHigh: null,
      sourceCategory: "avm",
      comparableCount: 3,
      valuationBasis: "current_condition",
    });
    expect(result).toBe("supported");
    expect(result).not.toBe("strong_evidence");
  });

  it("AVM source alone (no comparables, no range) -> indicative", () => {
    expect(
      calcValuationEvidenceQuality({
        estimatedValue: 1_400_000,
        valueConfidenceLow: null,
        valueConfidenceHigh: null,
        sourceCategory: "avm",
        comparableCount: 0,
        valuationBasis: "unknown",
      })
    ).toBe("indicative");
  });

  it("comparables existing does not automatically imply quality if the source/basis don't corroborate (1 comparable, unknown source) -> indicative at best", () => {
    const result = calcValuationEvidenceQuality({
      estimatedValue: 1_400_000,
      valueConfidenceLow: null,
      valueConfidenceHigh: null,
      sourceCategory: "other_unknown",
      comparableCount: 1,
      valuationBasis: "unknown",
    });
    expect(result).toBe("indicative");
    expect(result).not.toBe("supported");
  });
});

describe("calcValuationVariance (Phase 4.24 §12/24)", () => {
  it("R150,000 difference / 12% — worked example from the brief", () => {
    const variance = calcValuationVariance(1_400_000, 1_250_000);
    expect(variance).not.toBeNull();
    expect(variance!.differenceRand).toBe(150_000);
    expect(variance!.differencePercent).toBeCloseTo(12, 4);
  });

  it("missing user estimate -> null, never fabricated", () => {
    expect(calcValuationVariance(null, 1_250_000)).toBeNull();
  });

  it("missing evidence value -> null", () => {
    expect(calcValuationVariance(1_400_000, null)).toBeNull();
  });

  it("both missing -> null", () => {
    expect(calcValuationVariance(null, null)).toBeNull();
  });

  it("zero or negative values are treated as invalid, not real comparisons", () => {
    expect(calcValuationVariance(0, 1_250_000)).toBeNull();
    expect(calcValuationVariance(1_400_000, -1)).toBeNull();
  });
});

describe("buildValuationSummary — user estimate and evidence remain separately available (Phase 4.24 §11/24)", () => {
  it("both values present and differing are BOTH returned, never one silently overriding the other", () => {
    const summary = buildValuationSummary({
      userEstimatedCurrentMarketValue: 1_400_000,
      valuation: valuation({ estimatedValue: 1_250_000, valuationBasis: "current_condition", reportSource: "TPN Property Valuation Report" }),
    });
    expect(summary.userEstimatedCurrentMarketValue).toBe(1_400_000);
    expect(summary.evidenceBasedCurrentValue).toBe(1_250_000);
    expect(summary.variance).toEqual({
      userEstimate: 1_400_000,
      evidenceValue: 1_250_000,
      differenceRand: 150_000,
      differencePercent: 12,
    });
  });

  it("missing user estimate: evidence value is not fabricated into a user estimate", () => {
    const summary = buildValuationSummary({
      userEstimatedCurrentMarketValue: null,
      valuation: valuation({ estimatedValue: 1_250_000, valuationBasis: "current_condition" }),
    });
    expect(summary.userEstimatedCurrentMarketValue).toBeNull();
    expect(summary.evidenceBasedCurrentValue).toBe(1_250_000);
    expect(summary.variance).toBeNull();
  });

  it("missing evidence: evidenceBasedCurrentValue is N/A (null), never substituted with the user estimate or purchase price", () => {
    const summary = buildValuationSummary({
      userEstimatedCurrentMarketValue: 1_400_000,
      valuation: null,
    });
    expect(summary.evidenceBasedCurrentValue).toBeNull();
    expect(summary.valuationEvidenceQuality).toBe("unverified");
    expect(summary.variance).toBeNull();
  });
});

describe("buildValuationSummary — current vs post-renovation vs future isolation (Phase 4.24 §7/8/24, central acceptance rule)", () => {
  it("a post_renovation valuation NEVER populates evidenceBasedCurrentValue", () => {
    const summary = buildValuationSummary({
      userEstimatedCurrentMarketValue: 1_000_000,
      valuation: valuation({ estimatedValue: 1_500_000, valuationBasis: "post_renovation" }),
    });
    expect(summary.evidenceBasedCurrentValue).toBeNull();
    expect(summary.evidenceBasedPostRenovationValue).toBe(1_500_000);
    // The R1,500,000 post-renovation figure must never leak into a current-value comparison.
    expect(summary.variance).toBeNull();
  });

  it("an 'unknown' basis populates NEITHER current nor post-renovation — fails closed, never guessed", () => {
    const summary = buildValuationSummary({
      userEstimatedCurrentMarketValue: 1_000_000,
      valuation: valuation({ estimatedValue: 1_200_000, valuationBasis: "unknown" }),
    });
    expect(summary.evidenceBasedCurrentValue).toBeNull();
    expect(summary.evidenceBasedPostRenovationValue).toBeNull();
  });

  it("worked example from the brief: Purchase R1,000,000 / Current Evidence R1,050,000 / Post-Renovation Assumption R1,500,000 — post-renovation never becomes the current-value denominator", () => {
    const summary = buildValuationSummary({
      userEstimatedCurrentMarketValue: 1_050_000,
      valuation: valuation({ estimatedValue: 1_050_000, valuationBasis: "current_condition" }),
      assumedFutureSalePrice: 1_500_000,
    });
    expect(summary.evidenceBasedCurrentValue).toBe(1_050_000);
    expect(summary.assumedFutureSalePrice).toBe(1_500_000);
    expect(summary.evidenceBasedCurrentValue).not.toBe(summary.assumedFutureSalePrice);
  });

  it("future projected values (Year-5/10/20) are an entirely separate concept never accepted by this function at all — no parameter exists for them", () => {
    // Structural proof: buildValuationSummary's params type has no
    // "projectedValue"/"futureValue" field — a caller literally cannot pass
    // calc20YearProjection output into it. This test documents that
    // isolation explicitly rather than leaving it implicit.
    const summary = buildValuationSummary({
      userEstimatedCurrentMarketValue: 1_000_000,
      valuation: valuation({ estimatedValue: 1_050_000, valuationBasis: "current_condition" }),
    });
    expect(Object.keys(summary)).not.toContain("projectedYear5Value");
    expect(Object.keys(summary)).not.toContain("futureProjectedValue");
  });
});

describe("buildValuationSummary — source/date/comparables survive through (Phase 4.24 §24)", () => {
  it("valuation source metadata is carried straight through", () => {
    const summary = buildValuationSummary({
      userEstimatedCurrentMarketValue: null,
      valuation: valuation({ estimatedValue: 1_200_000, valuationBasis: "current_condition", reportSource: "ABSA Bank Valuation" }),
    });
    expect(summary.valuationSource).toBe("ABSA Bank Valuation");
    expect(summary.valuationSourceCategory).toBe("bank_valuation");
  });

  it("valuation date remains attached and age is computed relative to `now`", () => {
    const reportDate = new Date("2026-08-01T00:00:00Z");
    const now = new Date("2026-08-11T00:00:00Z");
    const summary = buildValuationSummary({
      userEstimatedCurrentMarketValue: null,
      valuation: valuation({ estimatedValue: 1_200_000, valuationBasis: "current_condition", reportDate }),
      now,
    });
    expect(summary.valuationDate).toBe(reportDate);
    expect(summary.valuationAgeDays).toBe(10);
  });

  it("comparableCount survives through unchanged", () => {
    const summary = buildValuationSummary({
      userEstimatedCurrentMarketValue: null,
      valuation: valuation({ estimatedValue: 1_200_000, valuationBasis: "current_condition", comparableCount: 4 }),
    });
    expect(summary.comparableCount).toBe(4);
  });

  it("no valuation record at all -> null source, null date, zero comparables, unverified quality — never fabricated", () => {
    const summary = buildValuationSummary({ userEstimatedCurrentMarketValue: 1_000_000, valuation: null });
    expect(summary.valuationSource).toBeNull();
    expect(summary.valuationDate).toBeNull();
    expect(summary.valuationAgeDays).toBeNull();
    expect(summary.comparableCount).toBe(0);
    expect(summary.valuationEvidenceQuality).toBe("unverified");
  });
});

describe("buildValuationSummary — invalid values rejected (Phase 4.24 §24)", () => {
  it("Estimated Current Market Value <= 0 is treated as absent, not a real value", () => {
    expect(buildValuationSummary({ userEstimatedCurrentMarketValue: 0, valuation: null }).userEstimatedCurrentMarketValue).toBeNull();
    expect(buildValuationSummary({ userEstimatedCurrentMarketValue: -500_000, valuation: null }).userEstimatedCurrentMarketValue).toBeNull();
  });

  it("a zero/negative evidence estimatedValue is treated as absent", () => {
    const summary = buildValuationSummary({
      userEstimatedCurrentMarketValue: null,
      valuation: valuation({ estimatedValue: 0, valuationBasis: "current_condition" }),
    });
    expect(summary.evidenceBasedCurrentValue).toBeNull();
  });
});
