import { describe, it, expect } from "vitest";
import {
  classifyMetricForStrategy,
  getGaugeColorForStrategy,
  getMetricBenchmark,
  getIrrReferenceClassification,
  hasCalibratedThreshold,
  getStrategyDefinitions,
  getThresholdDefinition,
} from "../thresholds";

/**
 * Phase 3.1 established the three-state classification contract (classified
 * / unclassified / not_applicable) so a missing rule can never masquerade as
 * a real judgement. Phase 4.1 rebuilds the rule table itself as declarative
 * data and adds two new classification models — target_relative (Equity
 * IRR, Cash-on-Cash Return, judged against the investor's own required
 * return) and zero_relative (Equity NPV, judged against zero, normalized by
 * equity invested) — plus deliberately demotes Payback Period, NOI Margin,
 * and Fix & Flip Net Profit from classified to unclassified (owner
 * Decisions 4/6/9). These tests pin down all of it at the source.
 */
describe("classifyMetricForStrategy — fixed_bands (unchanged model)", () => {
  it("returns status 'classified' with a real colour/label for a metric with a calibrated rule", () => {
    const result = classifyMetricForStrategy("dscr", 1.4, "commercial");
    expect(result.status).toBe("classified");
    expect(result.applicable).toBe(true);
    expect(result.color).toBe("green");
    expect(result.label).toBe("Strong");
    if (result.status === "classified") {
      expect(result.category).toBe("financial_safety");
      expect(result.model).toBe("fixed_bands");
    }
  });

  it("returns status 'unclassified' — never 'orange'/'Caution' — for a metric that never had a rule", () => {
    // Gross Revenue is a real, applicable number with no inherent good/bad
    // direction — AssetVerdict has never calibrated a threshold for it.
    const result = classifyMetricForStrategy("grossRevenueAnnual", 2_400_000, "commercial");
    expect(result.status).toBe("unclassified");
    expect(result.applicable).toBe(true);
    expect(result.color).toBeNull();
    expect(result.label).toBeNull();
  });

  it("returns status 'not_applicable' for a non-finite value, not a colour", () => {
    const result = classifyMetricForStrategy("dscr", Infinity, "commercial");
    expect(result.status).toBe("not_applicable");
    expect(result.applicable).toBe(false);
    expect(result.color).toBeNull();
    expect(result.label).toBeNull();
  });

  it("never returns 'orange' for any metric with no rule, across every strategy", () => {
    const unratedKeys = ["grossRevenueAnnual", "noiAnnual", "cashflowMonthly", "totalInvestment", "totalLoanAmount", "depositRequired", "initialEquityInvestment"];
    for (const strategyId of ["commercial", "buy_to_let", "multi_let", "student", "str", "instalment_sale"]) {
      for (const key of unratedKeys) {
        const result = classifyMetricForStrategy(key, 123_456, strategyId);
        expect(result.status, `${key}/${strategyId}`).toBe("unclassified");
        expect(result.color, `${key}/${strategyId}`).toBeNull();
      }
    }
  });

  it("boundary values: exact cutoff sits on the inclusive (green) side", () => {
    // DSCR commercial: green >= 1.25.
    expect(classifyMetricForStrategy("dscr", 1.25, "commercial").color).toBe("green");
    expect(classifyMetricForStrategy("dscr", 1.249999, "commercial").color).toBe("orange");
    // Operating Expense Ratio (lower-is-better) commercial: green <= 40.
    expect(classifyMetricForStrategy("operatingExpenseRatio", 40, "commercial").color).toBe("green");
    expect(classifyMetricForStrategy("operatingExpenseRatio", 40.0001, "commercial").color).toBe("orange");
  });

  it("Cap Rate PP sweet-spot: green inside [8,12], orange in the two flanking bands, red outside", () => {
    expect(classifyMetricForStrategy("capRatePP", 10, "commercial").color).toBe("green");
    expect(classifyMetricForStrategy("capRatePP", 8, "commercial").color).toBe("green");
    expect(classifyMetricForStrategy("capRatePP", 12, "commercial").color).toBe("green");
    expect(classifyMetricForStrategy("capRatePP", 6, "commercial").color).toBe("orange");
    expect(classifyMetricForStrategy("capRatePP", 13, "commercial").color).toBe("orange");
    expect(classifyMetricForStrategy("capRatePP", 4, "commercial").color).toBe("red");
    expect(classifyMetricForStrategy("capRatePP", 14, "commercial").color).toBe("red");
  });
});

describe("classifyMetricForStrategy — target_relative (Decisions 1, 3)", () => {
  it("Equity IRR: exceeds required return -> Exceeds Target / green", () => {
    const result = classifyMetricForStrategy("irr", 22, "commercial", { discountRate: 18 });
    expect(result.status).toBe("classified");
    expect(result.color).toBe("green");
    expect(result.label).toBe("Exceeds Target");
    if (result.status === "classified") expect(result.category).toBe("investor_target");
  });

  it("Equity IRR: within the caution margin below required return -> Near Target / orange", () => {
    // cautionMarginPoints is 2 — 17% is 1pp below an 18% target.
    const result = classifyMetricForStrategy("irr", 17, "commercial", { discountRate: 18 });
    expect(result.color).toBe("orange");
    expect(result.label).toBe("Near Target");
  });

  it("Equity IRR: meaningfully below required return -> Below Target / red", () => {
    const result = classifyMetricForStrategy("irr", 10, "commercial", { discountRate: 18 });
    expect(result.color).toBe("red");
    expect(result.label).toBe("Below Target");
  });

  it("Equity IRR: exactly at the required return -> Exceeds Target (boundary is inclusive)", () => {
    expect(classifyMetricForStrategy("irr", 18, "commercial", { discountRate: 18 }).label).toBe("Exceeds Target");
  });

  it("classification is based on the target relationship, NOT the old fixed 15% band — a 12% IRR against a 10% target exceeds target even though 12% would have failed the old 15% Commercial band", () => {
    const result = classifyMetricForStrategy("irr", 12, "commercial", { discountRate: 10 });
    expect(result.label).toBe("Exceeds Target");
    expect(result.color).toBe("green");
  });

  it("a leveraged, high-IRR example still classifies purely on the target comparison, not a hardcoded 15%", () => {
    // A deal with an aggressive 30% IRR but a demanding 28% required return
    // is barely exceeding target — the model must not read 30% as an
    // automatic "Strong" the way the old fixed >15% Commercial band would.
    const result = classifyMetricForStrategy("irr", 30, "commercial", { discountRate: 28 });
    expect(result.label).toBe("Exceeds Target");
    // And the reverse: a modest 14% IRR against a low 8% required return
    // clearly exceeds target even though 14% would have been "Caution"
    // under the old fixed 8-15% Commercial band.
    const modest = classifyMetricForStrategy("irr", 14, "commercial", { discountRate: 8 });
    expect(modest.label).toBe("Exceeds Target");
  });

  it("Cash-on-Cash Return (Pre-Tax and Post-Tax) both classify against discountRate", () => {
    for (const key of ["netYieldPreTax", "netYieldPostTax"]) {
      const above = classifyMetricForStrategy(key, 20, "commercial", { discountRate: 12 });
      expect(above.label, key).toBe("Exceeds Target");
      const below = classifyMetricForStrategy(key, 5, "commercial", { discountRate: 12 });
      expect(below.label, key).toBe("Below Target");
    }
  });

  it("falls back to 'unclassified' — never a colour — when no discountRate is supplied", () => {
    const result = classifyMetricForStrategy("irr", 22, "commercial");
    expect(result.status).toBe("unclassified");
    expect(result.color).toBeNull();
  });

  it("is provisional, and carries a rationale explaining why", () => {
    const result = classifyMetricForStrategy("irr", 22, "commercial", { discountRate: 18 });
    expect(result.status).toBe("classified");
    if (result.status === "classified") {
      expect(result.provisional).toBe(true);
      expect(result.reason).toBeTruthy();
    }
  });
});

describe("classifyMetricForStrategy — zero_relative (Decision 2, Equity NPV)", () => {
  it("positive NPV, well above the near-zero tolerance -> Exceeds Target / green", () => {
    const result = classifyMetricForStrategy("npv", 500_000, "commercial", { initialEquityInvestment: 1_000_000 });
    expect(result.status).toBe("classified");
    expect(result.color).toBe("green");
    expect(result.label).toBe("Exceeds Target");
  });

  it("NPV within the near-zero tolerance of equity invested -> Near Target / orange", () => {
    // nearZeroTolerance is 0.05 (5% of equity) — R30k on R1m equity is 3%, inside the band.
    const result = classifyMetricForStrategy("npv", 30_000, "commercial", { initialEquityInvestment: 1_000_000 });
    expect(result.color).toBe("orange");
    expect(result.label).toBe("Near Target");
  });

  it("negative NPV, materially below the tolerance -> Below Target / red, never 'High Risk' language", () => {
    const result = classifyMetricForStrategy("npv", -500_000, "commercial", { initialEquityInvestment: 1_000_000 });
    expect(result.color).toBe("red");
    expect(result.label).toBe("Below Target");
  });

  it("normalizes by equity invested so deal size doesn't bias the judgement — same ratio, different absolute rand amounts, same classification", () => {
    const small = classifyMetricForStrategy("npv", 5_000, "commercial", { initialEquityInvestment: 100_000 }); // 5%
    const large = classifyMetricForStrategy("npv", 500_000, "commercial", { initialEquityInvestment: 10_000_000 }); // 5%
    expect(small.label).toBe(large.label);
    expect(small.color).toBe(large.color);
  });

  it("falls back to 'unclassified' when there's no positive equity to normalize against", () => {
    expect(classifyMetricForStrategy("npv", 100_000, "commercial", { initialEquityInvestment: 0 }).status).toBe("unclassified");
    expect(classifyMetricForStrategy("npv", 100_000, "commercial").status).toBe("unclassified");
  });
});

describe("classifyMetricForStrategy — deliberately unclassified metrics (Decisions 4, 6, 9)", () => {
  it("Payback Period is unclassified with a specific, informative rationale — not a generic message", () => {
    const result = classifyMetricForStrategy("paybackPeriod", 6, "commercial");
    expect(result.status).toBe("unclassified");
    expect(result.reason).toMatch(/ignores/i);
  });

  it("NOI Margin is unclassified — its rationale explains it's the mathematical complement of Operating Expense Ratio", () => {
    const result = classifyMetricForStrategy("noiMargin", 65, "commercial");
    expect(result.status).toBe("unclassified");
    expect(result.reason).toMatch(/complement/i);
    expect(result.reason).toMatch(/Operating Expense Ratio/);
  });

  it("Fix & Flip Net Profit is unclassified — its rationale explains deal-size dependence", () => {
    const result = classifyMetricForStrategy("netProfit", 148_200, "fix_and_flip");
    expect(result.status).toBe("unclassified");
    expect(result.reason).toMatch(/deal size/i);
  });

  it("Cap Rate on Market Value is unclassified — its rationale explains market-value provenance", () => {
    const result = classifyMetricForStrategy("capRateMV", 9, "commercial");
    expect(result.status).toBe("unclassified");
    expect(result.reason).toMatch(/market-value|market value/i);
  });

  it("never returns 'orange' for unrated/demoted Fix & Flip metrics", () => {
    for (const key of ["totalCost", "holdingCosts", "grossProfit", "profitMargin", "netProfit"]) {
      const result = classifyMetricForStrategy(key, 50_000, "fix_and_flip");
      expect(result.status, key).toBe("unclassified");
      expect(result.color, key).toBeNull();
    }
  });

  it("bug fix carried forward: Annualised ROI is classified, not unclassified — the threshold key previously read 'annualisedRoi' and never matched the real field name", () => {
    expect(hasCalibratedThreshold("annualisedROI", "fix_and_flip")).toBe(true);
    const result = classifyMetricForStrategy("annualisedROI", 35, "fix_and_flip");
    expect(result.status).toBe("classified");
    expect(result.color).toBe("orange"); // 25-40 band
  });

  it("ROI (flip) remains genuinely calibrated with Strong/Caution/Weak, unaffected by Net Profit's demotion", () => {
    expect(hasCalibratedThreshold("roi", "fix_and_flip")).toBe(true);
    expect(classifyMetricForStrategy("roi", 30, "fix_and_flip").status).toBe("classified");
  });
});

describe("hasCalibratedThreshold", () => {
  it("is true for fixed-bands metrics", () => {
    for (const key of ["dscr", "ltv", "breakEvenRatio", "operatingExpenseRatio", "capRatePP"]) {
      expect(hasCalibratedThreshold(key, "commercial"), key).toBe(true);
    }
  });

  it("is true for target_relative and zero_relative metrics — they have an active model, just need context to produce a colour", () => {
    for (const key of ["irr", "netYieldPreTax", "netYieldPostTax", "npv"]) {
      expect(hasCalibratedThreshold(key, "commercial"), key).toBe(true);
    }
  });

  it("is false for metrics that never had a rule", () => {
    for (const key of ["grossRevenueAnnual", "noiAnnual", "totalInvestment"]) {
      expect(hasCalibratedThreshold(key, "commercial"), key).toBe(false);
    }
  });

  it("is false for metrics deliberately demoted to unclassified", () => {
    expect(hasCalibratedThreshold("paybackPeriod", "commercial")).toBe(false);
    expect(hasCalibratedThreshold("noiMargin", "commercial")).toBe(false);
    expect(hasCalibratedThreshold("capRateMV", "commercial")).toBe(false);
    expect(hasCalibratedThreshold("netProfit", "fix_and_flip")).toBe(false);
  });
});

describe("getMetricBenchmark — the single marker source (Decision 7)", () => {
  it("returns the green boundary for a cutoff fixed_bands metric", () => {
    expect(getMetricBenchmark({ metricKey: "dscr", strategyId: "commercial" })).toBe(1.25);
    expect(getMetricBenchmark({ metricKey: "ltv", strategyId: "commercial" })).toBe(60);
  });

  it("varies by strategy — the exact bug the Phase 4 audit found is now structurally impossible", () => {
    expect(getMetricBenchmark({ metricKey: "dscr", strategyId: "commercial" })).toBe(1.25);
    expect(getMetricBenchmark({ metricKey: "dscr", strategyId: "buy_to_let" })).toBe(1.2);
    expect(getMetricBenchmark({ metricKey: "dscr", strategyId: "multi_let" })).toBe(1.3);
    expect(getMetricBenchmark({ metricKey: "grossYield", strategyId: "commercial" })).toBe(10);
    expect(getMetricBenchmark({ metricKey: "grossYield", strategyId: "str" })).toBe(15);
  });

  it("returns undefined for a two-sided sweet_spot metric — no single meaningful marker, and none is invented", () => {
    expect(getMetricBenchmark({ metricKey: "capRatePP", strategyId: "commercial" })).toBeUndefined();
  });

  it("returns the supplied discountRate for a target_relative metric", () => {
    expect(getMetricBenchmark({ metricKey: "irr", strategyId: "commercial", discountRate: 14 })).toBe(14);
    expect(getMetricBenchmark({ metricKey: "netYieldPreTax", strategyId: "commercial", discountRate: 9 })).toBe(9);
  });

  it("returns undefined for a target_relative metric with no discountRate supplied — never a stale/invented number", () => {
    expect(getMetricBenchmark({ metricKey: "irr", strategyId: "commercial" })).toBeUndefined();
  });

  it("returns 0 for a zero_relative metric — its own natural benchmark", () => {
    expect(getMetricBenchmark({ metricKey: "npv", strategyId: "commercial" })).toBe(0);
  });

  it("returns undefined for an unclassified metric", () => {
    expect(getMetricBenchmark({ metricKey: "paybackPeriod", strategyId: "commercial" })).toBeUndefined();
    expect(getMetricBenchmark({ metricKey: "grossRevenueAnnual", strategyId: "commercial" })).toBeUndefined();
  });
});

describe("getIrrReferenceClassification — secondary-only reference band (Decision 1/6)", () => {
  it("reports within/outside AssetVerdict's previous strategy-specific range, marked provisional", () => {
    const within = getIrrReferenceClassification(20, "commercial");
    expect(within?.withinRange).toBe(true);
    expect(within?.label).toBe("Strong");
    expect(within?.provisional).toBe(true);
    expect(within?.evidenceLevel).toBe("provisional");

    const outside = getIrrReferenceClassification(5, "commercial");
    expect(outside?.withinRange).toBe(false);
    expect(outside?.label).toBe("Weak");
  });

  it("varies the reference range by strategy, independent of the primary target-relative classification", () => {
    // 16% is within Commercial's old >15 band but outside Buy to Let's old >=12/>=8 orange floor at 16... actually 16 is >=12 so still green on buy_to_let too; use a value that differs.
    const commercial = getIrrReferenceClassification(13, "commercial"); // 8-15 orange band
    const buyToLet = getIrrReferenceClassification(13, "buy_to_let"); // >=12 green band
    expect(commercial?.label).toBe("Caution");
    expect(buyToLet?.label).toBe("Strong");
  });

  it("is independent of the primary target-relative classification — a deal can exceed target while sitting outside the old reference range, or vice versa", () => {
    const primary = classifyMetricForStrategy("irr", 9, "commercial", { discountRate: 5 });
    const reference = getIrrReferenceClassification(9, "commercial");
    expect(primary.label).toBe("Exceeds Target"); // beats a modest 5% required return
    expect(reference?.withinRange).toBe(false); // but sits in Commercial's old 8-15 orange band, not >15 green
  });

  it("returns undefined for a non-finite value", () => {
    expect(getIrrReferenceClassification(Infinity, "commercial")).toBeUndefined();
  });
});

describe("getGaugeColorForStrategy — visual colour derived from classification", () => {
  it("returns a real colour for a fixed_bands metric (regression: dashboard gauges must not change)", () => {
    expect(getGaugeColorForStrategy("dscr", 1.4, "commercial")).toBe("green");
    expect(getGaugeColorForStrategy("dscr", 0.8, "commercial")).toBe("red");
  });

  it("returns 'neutral' — never 'orange' — for a metric with no active judgement", () => {
    expect(getGaugeColorForStrategy("grossRevenueAnnual", 2_000_000, "commercial")).toBe("neutral");
    expect(getGaugeColorForStrategy("paybackPeriod", 6, "commercial")).toBe("neutral");
    expect(getGaugeColorForStrategy("noiMargin", 65, "commercial")).toBe("neutral");
    expect(getGaugeColorForStrategy("netProfit", 100_000, "fix_and_flip")).toBe("neutral");
    expect(getGaugeColorForStrategy("capRateMV", 9, "commercial")).toBe("neutral");
  });

  it("target_relative and zero_relative metrics produce a real colour once context is supplied", () => {
    expect(getGaugeColorForStrategy("irr", 22, "commercial", { discountRate: 18 })).toBe("green");
    expect(getGaugeColorForStrategy("npv", 500_000, "commercial", { initialEquityInvestment: 1_000_000 })).toBe("green");
  });

  it("returns the corrected colour for Annualised ROI now that the key-casing bug is fixed", () => {
    expect(getGaugeColorForStrategy("annualisedROI", 45, "fix_and_flip")).toBe("green");
  });
});

describe("structural integrity — declarative definition table (section 26)", () => {
  const STRATEGIES = ["commercial", "buy_to_let", "multi_let", "student", "str", "fix_and_flip", "instalment_sale"];

  it("every classified metric's definition carries a category and a model", () => {
    for (const strategyId of STRATEGIES) {
      const defs = getStrategyDefinitions(strategyId);
      for (const [key, def] of Object.entries(defs)) {
        expect(def.metricKey, `${strategyId}/${key}`).toBe(key);
        expect(def.category, `${strategyId}/${key}`).toBeTruthy();
        expect(def.model, `${strategyId}/${key}`).toBeTruthy();
      }
    }
  });

  it("every unclassified definition carries a rationale — nothing is silently removed", () => {
    for (const strategyId of STRATEGIES) {
      const defs = getStrategyDefinitions(strategyId);
      for (const [key, def] of Object.entries(defs)) {
        if (def.model === "unclassified") {
          expect(def.rationale, `${strategyId}/${key}`).toBeTruthy();
        }
      }
    }
  });

  it("fixed_bands definitions always carry bands; target_relative/zero_relative never do", () => {
    for (const strategyId of STRATEGIES) {
      const defs = getStrategyDefinitions(strategyId);
      for (const [key, def] of Object.entries(defs)) {
        if (def.model === "fixed_bands") {
          expect(def.bands, `${strategyId}/${key}`).toBeDefined();
        } else {
          expect(def.bands, `${strategyId}/${key}`).toBeUndefined();
        }
      }
    }
  });

  it("cutoff bands never have green === orange (a real band, not an accidental single point)", () => {
    for (const strategyId of STRATEGIES) {
      const defs = getStrategyDefinitions(strategyId);
      for (const [key, def] of Object.entries(defs)) {
        if (def.bands?.shape === "cutoff") {
          expect(def.bands.green, `${strategyId}/${key}`).not.toBe(def.bands.orange);
        }
      }
    }
  });

  it("sweet_spot bands are internally ordered (greenMin <= greenMax, orangeMin <= orangeMax, orange range contains green range)", () => {
    for (const strategyId of STRATEGIES) {
      const defs = getStrategyDefinitions(strategyId);
      for (const [key, def] of Object.entries(defs)) {
        if (def.bands?.shape === "sweet_spot") {
          const { greenMin, greenMax, orangeMin, orangeMax } = def.bands;
          expect(greenMin, `${strategyId}/${key}`).toBeLessThanOrEqual(greenMax);
          expect(orangeMin, `${strategyId}/${key}`).toBeLessThanOrEqual(orangeMax);
          expect(orangeMin, `${strategyId}/${key}`).toBeLessThanOrEqual(greenMin);
          expect(orangeMax, `${strategyId}/${key}`).toBeGreaterThanOrEqual(greenMax);
        }
      }
    }
  });

  it("no strategy override silently drops a metric present in Commercial (every rental strategy has the same key set)", () => {
    const commercialKeys = new Set(Object.keys(getStrategyDefinitions("commercial")));
    for (const strategyId of ["buy_to_let", "multi_let", "student", "str", "instalment_sale"]) {
      const keys = new Set(Object.keys(getStrategyDefinitions(strategyId)));
      expect(keys, strategyId).toEqual(commercialKeys);
    }
  });

  it("strategy overrides actually differ from Commercial for at least one metric (overrides aren't accidentally no-ops)", () => {
    for (const strategyId of ["buy_to_let", "multi_let", "student", "str", "instalment_sale"]) {
      const commercial = getStrategyDefinitions("commercial");
      const overridden = getStrategyDefinitions(strategyId);
      const differs = Object.keys(commercial).some(
        (key) => JSON.stringify(commercial[key].bands) !== JSON.stringify(overridden[key].bands)
      );
      expect(differs, strategyId).toBe(true);
    }
  });

  it("provisional metadata is preserved on the target-/zero-relative investor-target metrics", () => {
    for (const key of ["irr", "npv", "netYieldPreTax", "netYieldPostTax"]) {
      const def = getThresholdDefinition(key, "commercial");
      expect(def?.provisional, key).toBe(true);
      expect(def?.evidenceLevel, key).toBe("provisional");
    }
  });
});
