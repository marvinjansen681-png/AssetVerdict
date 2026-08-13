import { describe, it, expect } from "vitest";
import { calcAllMetrics, calcMonthlyRepayment, type DealInputs, type DealMetrics, type FlipMetrics } from "../../calculations";
import { classifyMetricForStrategy } from "../../calculations/thresholds";
import { applicabilityContextFromInputs } from "../../calculations/applicability";
import {
  METRIC_DEFINITIONS,
  getMetricDefinition,
  getMetricGroupsForStrategy,
  getMetricsByPerspective,
} from "../metricDefinitions";
import { explainDealMetric } from "../explainMetric";

const RENTAL_METRIC_KEYS: (keyof DealMetrics)[] = [
  "totalInvestment",
  "totalLoanAmount",
  "depositRequired",
  "grossRevenueAnnual",
  "noiAnnual",
  "capRatePP",
  "capRateMV",
  "grossYield",
  "netYieldPreTax",
  "netYieldPostTax",
  "dscr",
  "ltv",
  "breakEvenRatio",
  "operatingExpenseRatio",
  "utilitiesRatio",
  "noiMargin",
  "capRateSpread",
  "paybackPeriod",
  "irr",
  "npv",
  "cashflowMonthly",
];

// Registry-only keys that don't map 1:1 to a DealMetrics field:
// - "equity" is derived from projection data in the UI.
// - "initialEquityInvestment" is Total Investment less Total Loan Amount —
//   numerically depositRequired, but named separately for the return-calc
//   relationship chains (Phase 1.1, section 4/16).
const OTHER_REGISTRY_ONLY_KEYS = ["equity", "initialEquityInvestment"];

const FLIP_METRIC_KEYS: (keyof FlipMetrics)[] = [
  "totalCost",
  "grossProfit",
  "netProfit",
  "roi",
  "annualisedROI",
  "profitMargin",
  "holdingCosts",
];

describe("Metric Knowledge Registry", () => {
  it("has a definition for every core DealMetrics field the calc engine produces (except structured sub-objects)", () => {
    for (const key of RENTAL_METRIC_KEYS) {
      expect(getMetricDefinition(key), `missing definition for "${key}"`).toBeDefined();
    }
  });

  it("has a definition for Equity, derived from projection data outside DealMetrics", () => {
    for (const key of OTHER_REGISTRY_ONLY_KEYS) {
      expect(getMetricDefinition(key), `missing definition for "${key}"`).toBeDefined();
    }
  });

  it("has a definition for every Fix & Flip metric", () => {
    for (const key of FLIP_METRIC_KEYS) {
      expect(getMetricDefinition(key), `missing definition for "${key}"`).toBeDefined();
    }
  });

  it("every definition's `key` field matches its registry key", () => {
    for (const [registryKey, def] of Object.entries(METRIC_DEFINITIONS)) {
      expect(def.key).toBe(registryKey);
    }
  });

  it("every affectedBy/affects/relatedMetrics reference is either a known metric key or a real DealInputs field", () => {
    const knownMetricKeys = new Set(Object.keys(METRIC_DEFINITIONS));
    // Raw input fields the relationship graph is allowed to reference as chain
    // starting points (see DealInputs in lib/calculations/index.ts).
    const knownInputKeys = new Set([
      "purchasePrice",
      "marketValue",
      "transferBondCost",
      "renovationCost",
      "sourcingFee",
      "monthlyRent",
      "occupancyRate",
      "additionalIncome",
      "recoveries",
      "capitalGrowthRate",
      "rentalGrowthRate",
    ]);
    for (const def of Object.values(METRIC_DEFINITIONS)) {
      for (const ref of [...def.affectedBy, ...def.affects, ...def.relatedMetrics]) {
        expect(
          knownMetricKeys.has(ref) || knownInputKeys.has(ref),
          `"${def.key}" references unknown key "${ref}"`
        ).toBe(true);
      }
    }
  });

  it("tags property-level and investor-level return metrics distinctly (section 20: property ≠ financing ≠ investor return)", () => {
    // Cap Rate / Gross Yield are the property's own, unlevered performance.
    for (const key of ["capRatePP", "capRateMV", "grossYield"]) {
      expect(getMetricDefinition(key)!.perspective, key).toBe("property");
    }
    // Equity IRR / Equity NPV / Net Yield (Cash-on-Cash) / Payback are what
    // the investor personally earns, after financing.
    for (const key of ["irr", "npv", "netYieldPreTax", "netYieldPostTax", "paybackPeriod"]) {
      expect(getMetricDefinition(key)!.perspective, key).toBe("investor");
    }
    // LTV / DSCR / Break-Even Ratio describe the financing/debt structure itself.
    for (const key of ["ltv", "dscr", "breakEvenRatio"]) {
      expect(getMetricDefinition(key)!.perspective, key).toBe("financing");
    }
  });

  it("every metric has a perspective, and getMetricsByPerspective partitions the full set", () => {
    const all = Object.values(METRIC_DEFINITIONS);
    const partitioned = [
      ...getMetricsByPerspective("property"),
      ...getMetricsByPerspective("financing"),
      ...getMetricsByPerspective("investor"),
      ...getMetricsByPerspective("flip"),
    ];
    expect(partitioned).toHaveLength(all.length);
  });

  it("names IRR and NPV explicitly as Equity IRR / Equity NPV in their full names, while keeping short dashboard labels", () => {
    expect(getMetricDefinition("irr")!.name).toBe("Equity IRR");
    expect(getMetricDefinition("irr")!.shortName).toBe("IRR");
    expect(getMetricDefinition("npv")!.name).toBe("Equity NPV");
    expect(getMetricDefinition("npv")!.shortName).toBe("NPV");
  });

  it("describes Break-Even Ratio as income coverage, never as literal occupancy (section 14 owner decision)", () => {
    const def = getMetricDefinition("breakEvenRatio")!;
    expect(def.simpleExplanation.toLowerCase()).not.toContain("occupancy rate");
    expect(def.simpleExplanation).toContain("percentage of gross income");
  });

  it("groups fix_and_flip strategy into flip-only metrics, and every other strategy into rental groups", () => {
    const flipGroups = getMetricGroupsForStrategy("fix_and_flip");
    expect(flipGroups).toHaveLength(1);
    expect(flipGroups[0].category).toBe("flip");
    expect(flipGroups[0].metricKeys).toContain("roi");
    expect(flipGroups[0].metricKeys).not.toContain("dscr");

    for (const strategy of ["commercial", "buy_to_let", "multi_let", "student", "str", "instalment_sale"]) {
      const groups = getMetricGroupsForStrategy(strategy);
      const allKeys = groups.flatMap((g) => g.metricKeys);
      expect(allKeys).toContain("dscr");
      expect(allKeys).not.toContain("roi");
    }
  });
});

describe("explainDealMetric — deal-specific explanation prep (definition vs judgement separation)", () => {
  const bankRepayment = 68_579.77;
  const sampleInputs: DealInputs = {
    purchasePrice: 5_055_000,
    marketValue: 5_500_000,
    askingPrice: 6_900_000,
    transferBondCost: 309_072,
    renovationCost: 200_000,
    sourcingFee: 505_500,
    agentCommission: 0,
    financeSources: [
      { loanAmount: 4_900_000, interestRate: 15, termYears: 15, repaymentAmount: bankRepayment },
    ],
    monthlyRent: 200_000,
    occupancyRate: 88,
    additionalIncome: 0,
    recoveries: 0,
    managementFeeValue: 15,
    managementFeeMode: "percent",
    maintenanceCostValue: 5,
    maintenanceCostMode: "percent",
    levies: 0,
    ratesAndTaxes: 19_000,
    insurance: 6_500,
    waterSewerage: 2_000,
    securityCleaning: 17_500,
    electricity: 2_000,
    badDebtsPct: 5,
    incomeTaxRate: 27,
    capitalGainsTaxRate: 22,
    capitalGrowthRate: 3,
    rentalGrowthRate: 8,
    costInflation: 5,
    discountRate: 10,
    marketCapRate: 10,
    strategy: "commercial",
    numUnits: 1,
    nightlyRate: 0,
    avgOccupiedNights: 200,
    platformFeesPct: 15,
    billsIncluded: false,
    academicYearWeeks: 42,
    pricePerRoom: 0,
    singleRoomCount: 0,
    singleRoomRent: 0,
    singleRoomNsfasBeds: 0,
    sharingRoomCount: 0,
    sharingBedsPerRoom: 2,
    sharingRoomRent: 0,
    sharingRoomNsfasBeds: 0,
    nsfasCycleMonths: 10,
    privateCycleMonths: 12,
    houseParentCost: 0,
    internetCost: 0,
    netflixCost: 0,
    gasRefillCost: 0,
    wasteRemovalCost: 0,
    holdingPeriodMonths: 6,
    expectedSalePrice: 0,
    holdingCostPerMonth: 0,
    instalmentAmount: 0,
    instalmentTerm: 240,
    instalmentRate: 0,
  };

  it("pairs the deterministic engine's own DSCR value with static education content and a judgement — never computing DSCR itself", () => {
    const metrics = calcAllMetrics(sampleInputs);
    const explanation = explainDealMetric("dscr", metrics.dscr, "commercial");

    expect(explanation).toBeDefined();
    expect(explanation!.value).toBe(metrics.dscr); // value is passed through, not recomputed
    expect(explanation!.definition.name).toBe("Debt Service Coverage Ratio");
    expect(explanation!.classification.applicable).toBe(true);
    expect(["Strong", "Caution", "Weak"]).toContain(explanation!.classification.label);
  });

  it("reports DSCR as not applicable (no colour judgement) for a no-finance deal, rather than a false 'Weak'", () => {
    const noFinanceInputs: DealInputs = { ...sampleInputs, financeSources: [] };
    const metrics = calcAllMetrics(noFinanceInputs);
    const explanation = explainDealMetric("dscr", metrics.dscr, "commercial");

    expect(explanation!.value).toBeNull();
    expect(explanation!.classification.applicable).toBe(false);
    expect(explanation!.classification.label).toBeNull();
  });

  it("keeps the same classification whether reached via classifyMetricForStrategy directly or via explainDealMetric", () => {
    const metrics = calcAllMetrics(sampleInputs);
    const direct = classifyMetricForStrategy("breakEvenRatio", metrics.breakEvenRatio, "buy_to_let");
    const viaExplain = explainDealMetric("breakEvenRatio", metrics.breakEvenRatio, "buy_to_let");
    expect(viaExplain!.classification).toEqual(direct);
  });

  it("gives Equity IRR a real judgement for a normally-financed deal when passed an applicability context", () => {
    const metrics = calcAllMetrics(sampleInputs);
    const ctx = applicabilityContextFromInputs(sampleInputs);
    const explanation = explainDealMetric("irr", metrics.irr, "commercial", ctx);
    expect(explanation!.classification.applicable).toBe(true);
    expect(explanation!.classification.color).not.toBeNull();
  });

  it("reports Equity IRR/NPV/Net Yield/Payback Period as not applicable (never a colour) for an over-financed, negative-equity deal", () => {
    const overFinanced: DealInputs = {
      ...sampleInputs,
      financeSources: [
        {
          loanAmount: 10_000_000,
          interestRate: 15,
          termYears: 15,
          repaymentAmount: calcMonthlyRepayment(10_000_000, 15, 15),
        },
      ],
    };
    const metrics = calcAllMetrics(overFinanced);
    const ctx = applicabilityContextFromInputs(overFinanced);
    for (const key of ["irr", "npv", "netYieldPreTax", "netYieldPostTax", "paybackPeriod"] as const) {
      const explanation = explainDealMetric(key, metrics[key], "commercial", ctx);
      expect(explanation!.classification.applicable, key).toBe(false);
      expect(explanation!.classification.color, key).toBeNull();
      expect(explanation!.applicabilityReason, key).toBeTruthy();
    }
  });

  it("without a context argument (Phase 1 call sites), still behaves exactly as before — only non-finite values are treated as not applicable", () => {
    const metrics = calcAllMetrics(sampleInputs);
    // No ctx passed: equity-based rules have no evidence, so a genuinely
    // finite (even if degenerate) IRR/NPV value is still classified normally.
    const explanation = explainDealMetric("irr", metrics.irr, "commercial");
    expect(explanation!.classification.applicable).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Phase 3.1 — Classification Integrity Fix: a missing threshold must never
  // present as "Caution." Gross Revenue and NOI are real, applicable numbers
  // with no calibrated AssetVerdict benchmark — explainDealMetric must report
  // that honestly (status "unclassified"), not via the old orange fallback.
  // -------------------------------------------------------------------------

  it("reports Gross Revenue and NOI as unclassified — applicable, but no Strong/Caution/Weak label — never a false 'Caution'", () => {
    const metrics = calcAllMetrics(sampleInputs);
    for (const key of ["grossRevenueAnnual", "noiAnnual"] as const) {
      const explanation = explainDealMetric(key, metrics[key], "commercial");
      expect(explanation, key).toBeDefined();
      expect(explanation!.classification.status, key).toBe("unclassified");
      expect(explanation!.classification.applicable, key).toBe(true);
      expect(explanation!.classification.label, key).toBeNull();
      expect(explanation!.classification.color, key).toBeNull();
      // The value itself is still real and shown — unclassified is not "no data".
      expect(explanation!.value, key).toBe(metrics[key]);
    }
  });

  it("DSCR still receives a real, calibrated classification (regression: the fix must not turn genuinely-rated metrics into unclassified ones)", () => {
    const metrics = calcAllMetrics(sampleInputs);
    const explanation = explainDealMetric("dscr", metrics.dscr, "commercial");
    expect(explanation!.classification.status).toBe("classified");
    expect(["Strong", "Caution", "Weak"]).toContain(explanation!.classification.label);
  });

  it("N/A metrics remain status 'not_applicable', distinct from 'unclassified'", () => {
    const noFinanceInputs: DealInputs = { ...sampleInputs, financeSources: [] };
    const metrics = calcAllMetrics(noFinanceInputs);
    const explanation = explainDealMetric("dscr", metrics.dscr, "commercial");
    expect(explanation!.classification.status).toBe("not_applicable");
    expect(explanation!.classification.status).not.toBe("unclassified");
  });

  it("Equity IRR keeps status 'classified' with provisional=true — provisional never demotes a real classification to unclassified", () => {
    const metrics = calcAllMetrics(sampleInputs);
    const ctx = applicabilityContextFromInputs(sampleInputs);
    const explanation = explainDealMetric("irr", metrics.irr, "commercial", ctx);
    expect(explanation!.classification.status).toBe("classified");
    expect(explanation!.judgementProvisional).toBe(true);
  });

  it("Fix & Flip: Total Cost, Holding Costs, Gross Profit, and Profit Margin are unclassified (no calibrated rule) — not auto-labelled Caution", () => {
    const flipInputs: DealInputs = {
      ...sampleInputs,
      strategy: "fix_and_flip",
      financeSources: [],
      renovationCost: 150_000,
      expectedSalePrice: 1_600_000,
      holdingPeriodMonths: 4,
      holdingCostPerMonth: 15_000,
    };
    const metrics = calcAllMetrics(flipInputs);
    const flip = metrics.flipMetrics!;
    for (const key of ["totalCost", "holdingCosts", "grossProfit", "profitMargin"] as const) {
      const explanation = explainDealMetric(key, flip[key], "fix_and_flip");
      expect(explanation, key).toBeDefined();
      expect(explanation!.classification.status, key).toBe("unclassified");
      expect(explanation!.classification.label, key).toBeNull();
    }
  });

  it("Fix & Flip: ROI, Annualised ROI, and Net Profit remain genuinely classified (regression + the annualisedROI key-casing bug fix)", () => {
    const flipInputs: DealInputs = {
      ...sampleInputs,
      strategy: "fix_and_flip",
      financeSources: [],
      renovationCost: 150_000,
      expectedSalePrice: 1_600_000,
      holdingPeriodMonths: 4,
      holdingCostPerMonth: 15_000,
    };
    const metrics = calcAllMetrics(flipInputs);
    const flip = metrics.flipMetrics!;
    for (const key of ["roi", "annualisedROI", "netProfit"] as const) {
      const explanation = explainDealMetric(key, flip[key], "fix_and_flip");
      expect(explanation, key).toBeDefined();
      expect(explanation!.classification.status, key).toBe("classified");
      expect(["Strong", "Caution", "Weak"]).toContain(explanation!.classification.label);
    }
  });
});

// ---------------------------------------------------------------------------
// Phase 2, section 26: registry-to-UI integrity + strategy filtering.
// ---------------------------------------------------------------------------

describe("Phase 2 — registry-to-UI integrity", () => {
  it("every metric key in every strategy's groups has a definition, a display label, and only valid relationship references", () => {
    const knownKeys = new Set(Object.keys(METRIC_DEFINITIONS));
    const strategies = ["commercial", "buy_to_let", "multi_let", "student", "str", "instalment_sale", "fix_and_flip"];

    for (const strategyId of strategies) {
      const groups = getMetricGroupsForStrategy(strategyId);
      expect(groups.length, strategyId).toBeGreaterThan(0);

      for (const group of groups) {
        expect(group.metricKeys.length, `${strategyId}/${group.label}`).toBeGreaterThan(0);
        for (const key of group.metricKeys) {
          const def = getMetricDefinition(key);
          expect(def, `${strategyId}/${group.label} missing definition for "${key}"`).toBeDefined();
          // Display label: either shortName or name must be a non-empty string.
          expect((def!.shortName ?? def!.name).length, key).toBeGreaterThan(0);
          for (const ref of [...def!.affectedBy, ...def!.affects, ...def!.relatedMetrics]) {
            // Every relationship reference is either another registry key, or
            // a raw DealInputs field (never a dangling/typo'd key) — same
            // known-input allowlist validated in the Phase 1.1 relationship test.
            const isKnownInput = [
              "purchasePrice", "marketValue", "transferBondCost", "renovationCost", "sourcingFee",
              "monthlyRent", "occupancyRate", "additionalIncome", "recoveries",
              "capitalGrowthRate", "rentalGrowthRate",
            ].includes(ref);
            expect(knownKeys.has(ref) || isKnownInput, `"${key}" (in ${strategyId}) references unknown key "${ref}"`).toBe(true);
          }
        }
      }
    }
  });

  it("fix_and_flip's groups contain ONLY flip-perspective metrics — no rental metric leaks in", () => {
    const groups = getMetricGroupsForStrategy("fix_and_flip");
    const allKeys = groups.flatMap((g) => g.metricKeys);
    for (const key of allKeys) {
      expect(getMetricDefinition(key)!.perspective, key).toBe("flip");
    }
    // Spot-check: rental-only metrics must not appear.
    for (const rentalOnlyKey of ["dscr", "ltv", "irr", "npv", "capRatePP", "breakEvenRatio"]) {
      expect(allKeys).not.toContain(rentalOnlyKey);
    }
  });

  it("every rental strategy's groups contain NO flip-perspective metrics", () => {
    for (const strategyId of ["commercial", "buy_to_let", "multi_let", "student", "str", "instalment_sale"]) {
      const groups = getMetricGroupsForStrategy(strategyId);
      const allKeys = groups.flatMap((g) => g.metricKeys);
      for (const key of allKeys) {
        expect(getMetricDefinition(key)!.perspective, `${strategyId}/${key}`).not.toBe("flip");
      }
      // Spot-check: flip-only return metrics must not appear.
      for (const flipOnlyKey of ["roi", "annualisedROI", "profitMargin", "totalCost", "grossProfit", "netProfit"]) {
        expect(allKeys, strategyId).not.toContain(flipOnlyKey);
      }
    }
  });
});
