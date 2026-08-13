import { describe, it, expect } from "vitest";
import {
  classifyMetricForStrategy,
  getGaugeColorForStrategy,
  hasCalibratedThreshold,
  getStrategyThresholds,
} from "../thresholds";

/**
 * Phase 3.1 — Classification Integrity Fix.
 *
 * A missing threshold rule must never masquerade as a real judgement. These
 * tests pin down the three-state classification contract at its source:
 * lib/calculations/thresholds.ts. See also applicability.test.ts (the
 * not_applicable state, which depends on deal context, not just the
 * strategy's threshold table) and lib/education/__tests__/metricDefinitions.test.ts
 * (the same guarantee one layer up, via explainDealMetric).
 */
describe("classifyMetricForStrategy — three-state classification", () => {
  it("returns status 'classified' with a real colour/label for a metric with a calibrated rule", () => {
    const result = classifyMetricForStrategy("dscr", 1.4, "commercial");
    expect(result.status).toBe("classified");
    expect(result.applicable).toBe(true);
    expect(result.color).toBe("green");
    expect(result.label).toBe("Strong");
  });

  it("returns status 'unclassified' — never 'orange'/'Caution' — for a metric with no calibrated rule", () => {
    // Gross Revenue is a real, applicable number with no inherent good/bad
    // direction — AssetVerdict has never calibrated a threshold for it.
    const result = classifyMetricForStrategy("grossRevenueAnnual", 2_400_000, "commercial");
    expect(result.status).toBe("unclassified");
    expect(result.applicable).toBe(true);
    expect(result.color).toBeNull();
    expect(result.label).toBeNull();
    expect(result.reason).toBe("no_threshold");
  });

  it("returns status 'not_applicable' for a non-finite value, not a colour", () => {
    const result = classifyMetricForStrategy("dscr", Infinity, "commercial");
    expect(result.status).toBe("not_applicable");
    expect(result.applicable).toBe(false);
    expect(result.color).toBeNull();
    expect(result.label).toBeNull();
  });

  it("never returns 'orange' for any metric with no rule, across every strategy", () => {
    const unratedKeys = [
      "grossRevenueAnnual",
      "noiAnnual",
      "cashflowMonthly",
      "npv",
      "totalInvestment",
      "totalLoanAmount",
      "depositRequired",
      "initialEquityInvestment",
    ];
    for (const strategyId of ["commercial", "buy_to_let", "multi_let", "student", "str", "instalment_sale"]) {
      for (const key of unratedKeys) {
        const result = classifyMetricForStrategy(key, 123_456, strategyId);
        expect(result.status, `${key}/${strategyId}`).toBe("unclassified");
        expect(result.color, `${key}/${strategyId}`).toBeNull();
      }
    }
  });

  it("never returns 'orange' for unrated Fix & Flip metrics", () => {
    for (const key of ["totalCost", "holdingCosts", "grossProfit", "profitMargin"]) {
      const result = classifyMetricForStrategy(key, 50_000, "fix_and_flip");
      expect(result.status, key).toBe("unclassified");
      expect(result.color, key).toBeNull();
    }
  });

  it("bug fix: Annualised ROI is classified, not unclassified — the threshold key previously read 'annualisedRoi' and never matched the real 'annualisedROI' field name used everywhere else", () => {
    expect(hasCalibratedThreshold("annualisedROI", "fix_and_flip")).toBe(true);
    const result = classifyMetricForStrategy("annualisedROI", 35, "fix_and_flip");
    expect(result.status).toBe("classified");
    expect(result.color).toBe("orange"); // 25-40 band per FIX_AND_FLIP_THRESHOLDS
  });

  it("Net Profit (flip) is genuinely calibrated — a green/red split, not a fallback", () => {
    expect(hasCalibratedThreshold("netProfit", "fix_and_flip")).toBe(true);
    expect(classifyMetricForStrategy("netProfit", 10_000, "fix_and_flip").status).toBe("classified");
  });
});

describe("hasCalibratedThreshold", () => {
  it("is true for real, calibrated metrics", () => {
    for (const key of ["dscr", "irr", "ltv", "breakEvenRatio", "operatingExpenseRatio"]) {
      expect(hasCalibratedThreshold(key, "commercial"), key).toBe(true);
    }
  });

  it("is false for metrics with no calibrated rule", () => {
    for (const key of ["grossRevenueAnnual", "noiAnnual", "npv", "totalInvestment"]) {
      expect(hasCalibratedThreshold(key, "commercial"), key).toBe(false);
    }
  });

  it("agrees with getStrategyThresholds — a key present there is calibrated, absent is not", () => {
    const table = getStrategyThresholds("buy_to_let");
    expect(hasCalibratedThreshold("dscr", "buy_to_let")).toBe("dscr" in table);
    expect(hasCalibratedThreshold("grossRevenueAnnual", "buy_to_let")).toBe("grossRevenueAnnual" in table);
  });
});

describe("getGaugeColorForStrategy — visual colour derived from classification", () => {
  it("returns a real colour for a calibrated metric (regression: dashboard gauges must not change)", () => {
    expect(getGaugeColorForStrategy("dscr", 1.4, "commercial")).toBe("green");
    expect(getGaugeColorForStrategy("dscr", 0.8, "commercial")).toBe("red");
    expect(getGaugeColorForStrategy("irr", 20, "commercial")).toBe("green");
  });

  it("returns 'neutral' — never 'orange' — for a metric with no calibrated rule", () => {
    expect(getGaugeColorForStrategy("grossRevenueAnnual", 2_000_000, "commercial")).toBe("neutral");
    expect(getGaugeColorForStrategy("npv", 500_000, "commercial")).toBe("neutral");
    expect(getGaugeColorForStrategy("totalCost", 1_000_000, "fix_and_flip")).toBe("neutral");
  });

  it("returns the corrected colour for Annualised ROI now that the key bug is fixed", () => {
    expect(getGaugeColorForStrategy("annualisedROI", 45, "fix_and_flip")).toBe("green");
  });
});
