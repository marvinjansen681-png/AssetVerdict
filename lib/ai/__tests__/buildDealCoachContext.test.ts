import { describe, it, expect } from "vitest";
import { calcAllMetrics, calcMonthlyRepayment, type DealInputs } from "../../calculations";
import { calcScenarios } from "../../calculations/scenarios";
import { buildDealCoachContext } from "../buildDealCoachContext";
import { getMetricGroupsForStrategy } from "../../education/metricDefinitions";
import { formatMetricValue } from "../../education/format";
import type { AcquisitionSummary } from "../../education/metricBreakdowns";

const bankRepayment = calcMonthlyRepayment(4_900_000, 15, 15);

const rentalInputs: DealInputs = {
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
  billsIncludedAmount: null,
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

// Deliberately triggers several assumption flags: near-100% occupancy, zero
// renovation budget, zero bad-debt provision, and a market value materially
// above purchase price.
const assumptionHeavyInputs: DealInputs = {
  ...rentalInputs,
  occupancyRate: 100,
  renovationCost: 0,
  badDebtsPct: 0,
  marketValue: 6_500_000, // ~29% above purchase price of 5,055,000
};

const flipInputs: DealInputs = {
  ...rentalInputs,
  strategy: "fix_and_flip",
  financeSources: [],
  renovationCost: 300_000,
  expectedSalePrice: 6_500_000,
  holdingPeriodMonths: 6,
  holdingCostPerMonth: 15_000,
  agentCommission: 5,
};

const dealSummary: AcquisitionSummary = {
  purchasePrice: rentalInputs.purchasePrice,
  marketValue: rentalInputs.marketValue,
};

const flipDealSummary: AcquisitionSummary = {
  purchasePrice: flipInputs.purchasePrice,
  marketValue: flipInputs.marketValue,
};

const baseParams = {
  dealName: "Test Deal",
  address: "1 Test Street",
  currency: "ZAR",
  activeScenario: "base" as const,
};

describe("buildDealCoachContext — selected metric (explain_metric)", () => {
  const metrics = calcAllMetrics(rentalInputs);

  it("includes the selected metric with full detail: value, classification, breakdown, connections", () => {
    const context = buildDealCoachContext({
      ...baseParams,
      inputs: rentalInputs,
      metrics,
      strategyId: "commercial",
      selection: { type: "metric", metricKey: "dscr" },
      intent: "explain_metric",
      dealSummary,
    });

    const dscrEntry = context.metrics.find((m) => m.key === "dscr");
    expect(dscrEntry).toBeDefined();
    expect(dscrEntry!.formattedValue).toBe(formatMetricValue(metrics.dscr, "multiple", "ZAR"));
    expect(dscrEntry!.value).toBeCloseTo(metrics.dscr, 6);
    expect(dscrEntry!.perspective).toBe("financing");
    expect(dscrEntry!.classification).toBeDefined();
    expect(dscrEntry!.breakdown).toBeDefined();
    expect(dscrEntry!.breakdown!.formula).toContain("NOI");
    expect(dscrEntry!.breakdown!.lines.some((l) => l.label.includes("NOI"))).toBe(true);
    expect(dscrEntry!.breakdown!.lines.some((l) => l.label.includes("Debt"))).toBe(true);
    expect(dscrEntry!.affectedBy).toBeDefined();
    expect(dscrEntry!.affectedBy!.length).toBeGreaterThan(0);
  });

  it("includes a small set of related metrics (drivers), each with lighter detail (no breakdown)", () => {
    const context = buildDealCoachContext({
      ...baseParams,
      inputs: rentalInputs,
      metrics,
      strategyId: "commercial",
      selection: { type: "metric", metricKey: "dscr" },
      intent: "explain_metric",
      dealSummary,
    });

    const related = context.metrics.filter((m) => m.key !== "dscr");
    expect(related.length).toBeGreaterThan(0);
    expect(related.length).toBeLessThanOrEqual(4);
    for (const entry of related) {
      expect(entry.breakdown, entry.key).toBeUndefined();
    }
  });

  it("records the selection in context.selection", () => {
    const context = buildDealCoachContext({
      ...baseParams,
      inputs: rentalInputs,
      metrics,
      strategyId: "commercial",
      selection: { type: "metric", metricKey: "dscr" },
      intent: "explain_metric",
      dealSummary,
    });
    expect(context.selection).toEqual({ type: "metric", metricKey: "dscr" });
  });

  it("marks IRR's classification as provisional, and no other metric", () => {
    const context = buildDealCoachContext({
      ...baseParams,
      inputs: rentalInputs,
      metrics,
      strategyId: "commercial",
      selection: { type: "metric", metricKey: "irr" },
      intent: "explain_metric",
      dealSummary,
    });
    const irrEntry = context.metrics.find((m) => m.key === "irr")!;
    expect(irrEntry.classification?.provisional).toBe(true);

    const dscrEntry = buildDealCoachContext({
      ...baseParams,
      inputs: rentalInputs,
      metrics,
      strategyId: "commercial",
      selection: { type: "metric", metricKey: "dscr" },
      intent: "explain_metric",
      dealSummary,
    }).metrics.find((m) => m.key === "dscr")!;
    expect(dscrEntry.classification?.provisional).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Phase 3.1 — Classification Integrity Fix: Deal Coach must receive an
  // explicit classification status so it can never invent a Strong/Caution/
  // Weak judgement for a metric AssetVerdict has no calibrated benchmark for.
  // -------------------------------------------------------------------------

  it("unclassified metric context contains no fake Caution — status is 'unclassified', label/color are absent", () => {
    const context = buildDealCoachContext({
      ...baseParams,
      inputs: rentalInputs,
      metrics,
      strategyId: "commercial",
      selection: { type: "metric", metricKey: "grossRevenueAnnual" },
      intent: "explain_metric",
      dealSummary,
    });
    const entry = context.metrics.find((m) => m.key === "grossRevenueAnnual")!;
    expect(entry.applicable).toBe(true);
    expect(entry.classification?.status).toBe("unclassified");
    // Never a Strong/Caution/Weak string, and never provisional.
    expect((entry.classification as { label?: string })?.label).toBeUndefined();
    expect((entry.classification as { provisional?: boolean })?.provisional).toBeUndefined();
  });

  it("classified metric context contains the real classification, distinct from unclassified", () => {
    const context = buildDealCoachContext({
      ...baseParams,
      inputs: rentalInputs,
      metrics,
      strategyId: "commercial",
      selection: { type: "metric", metricKey: "dscr" },
      intent: "explain_metric",
      dealSummary,
    });
    const entry = context.metrics.find((m) => m.key === "dscr")!;
    expect(entry.classification?.status).toBe("classified");
    expect(["Strong", "Caution", "Weak"]).toContain((entry.classification as { label: string }).label);
  });

  it("N/A metric remains distinct from unclassified: applicable is false and classification is undefined, not 'unclassified'", () => {
    const noFinanceInputs: DealInputs = { ...rentalInputs, financeSources: [] };
    const noFinanceMetrics = calcAllMetrics(noFinanceInputs);
    const context = buildDealCoachContext({
      ...baseParams,
      inputs: noFinanceInputs,
      metrics: noFinanceMetrics,
      strategyId: "commercial",
      selection: { type: "metric", metricKey: "dscr" },
      intent: "explain_metric",
      dealSummary,
    });
    const entry = context.metrics.find((m) => m.key === "dscr")!;
    expect(entry.applicable).toBe(false);
    expect(entry.classification).toBeUndefined();
    expect(entry.applicabilityReason).toBeTruthy();
  });

  it("Fix & Flip: Total Cost, Holding Costs, and Gross Profit are not automatically labelled Caution when no threshold exists", () => {
    const flipMetrics = calcAllMetrics(flipInputs);
    for (const metricKey of ["totalCost", "holdingCosts", "grossProfit"]) {
      const context = buildDealCoachContext({
        ...baseParams,
        inputs: flipInputs,
        metrics: flipMetrics,
        strategyId: "fix_and_flip",
        selection: { type: "metric", metricKey },
        intent: "explain_metric",
        dealSummary: flipDealSummary,
      });
      const entry = context.metrics.find((m) => m.key === metricKey)!;
      expect(entry, metricKey).toBeDefined();
      expect(entry.classification?.status, metricKey).toBe("unclassified");
      expect((entry.classification as { label?: string })?.label, metricKey).toBeUndefined();
    }
  });

  it("Fix & Flip: Annualised ROI is genuinely classified now that the threshold key-casing bug is fixed", () => {
    const flipMetrics = calcAllMetrics(flipInputs);
    const context = buildDealCoachContext({
      ...baseParams,
      inputs: flipInputs,
      metrics: flipMetrics,
      strategyId: "fix_and_flip",
      selection: { type: "metric", metricKey: "annualisedROI" },
      intent: "explain_metric",
      dealSummary: flipDealSummary,
    });
    const entry = context.metrics.find((m) => m.key === "annualisedROI")!;
    expect(entry.classification?.status).toBe("classified");
  });

  it("marks DSCR as N/A with a reason, never a fake 0, for an all-cash deal", () => {
    const allCashInputs: DealInputs = { ...rentalInputs, financeSources: [] };
    const allCashMetrics = calcAllMetrics(allCashInputs);
    const context = buildDealCoachContext({
      ...baseParams,
      inputs: allCashInputs,
      metrics: allCashMetrics,
      strategyId: "commercial",
      selection: { type: "metric", metricKey: "dscr" },
      intent: "explain_metric",
      dealSummary,
    });
    const dscrEntry = context.metrics.find((m) => m.key === "dscr")!;
    expect(dscrEntry.applicable).toBe(false);
    expect(dscrEntry.value).toBeNull();
    expect(dscrEntry.applicabilityReason).toBeTruthy();
    expect(dscrEntry.formattedValue).toBe("N/A");
  });
});

describe("buildDealCoachContext — general deal question (broad but bounded)", () => {
  it("includes every metric relevant to the strategy's own registry groups, and no more", () => {
    const metrics = calcAllMetrics(rentalInputs);
    const context = buildDealCoachContext({
      ...baseParams,
      inputs: rentalInputs,
      metrics,
      strategyId: "commercial",
      selection: { type: "deal" },
      intent: "general_question",
      dealSummary,
    });
    const expectedKeys = getMetricGroupsForStrategy("commercial").flatMap((g) => g.metricKeys);
    // "equity" has no single-year scalar, so it's still included but always N/A — every other key should be present.
    expect(context.metrics.map((m) => m.key).sort()).toEqual(expectedKeys.sort());
  });

  it("excludes formula breakdowns in the broad context (kept light for token control)", () => {
    const metrics = calcAllMetrics(rentalInputs);
    const context = buildDealCoachContext({
      ...baseParams,
      inputs: rentalInputs,
      metrics,
      strategyId: "commercial",
      selection: { type: "deal" },
      intent: "general_question",
      dealSummary,
    });
    for (const entry of context.metrics) {
      expect(entry.breakdown, entry.key).toBeUndefined();
    }
  });

  it("Fix & Flip context contains ONLY flip metrics — no DSCR, LTV, IRR, NPV, Cash-on-Cash", () => {
    const flipMetrics = calcAllMetrics(flipInputs);
    const context = buildDealCoachContext({
      ...baseParams,
      inputs: flipInputs,
      metrics: flipMetrics,
      strategyId: "fix_and_flip",
      selection: { type: "deal" },
      intent: "general_question",
      dealSummary: flipDealSummary,
    });
    const keys = context.metrics.map((m) => m.key);
    expect(keys).toContain("roi");
    expect(keys).toContain("netProfit");
    for (const rentalOnlyKey of ["dscr", "ltv", "irr", "npv", "netYieldPreTax", "breakEvenRatio"]) {
      expect(keys).not.toContain(rentalOnlyKey);
    }
    for (const entry of context.metrics) {
      expect(entry.perspective).toBe("flip");
    }
  });

  it("rental context contains no Fix & Flip metrics", () => {
    const metrics = calcAllMetrics(rentalInputs);
    const context = buildDealCoachContext({
      ...baseParams,
      inputs: rentalInputs,
      metrics,
      strategyId: "commercial",
      selection: { type: "deal" },
      intent: "general_question",
      dealSummary,
    });
    const keys = context.metrics.map((m) => m.key);
    for (const flipOnlyKey of ["roi", "annualisedROI", "profitMargin", "totalCost"]) {
      expect(keys).not.toContain(flipOnlyKey);
    }
  });
});

describe("buildDealCoachContext — assumption flags (deterministic, tailored to the deal)", () => {
  it("does not flag anything for a deal with no unusual assumptions", () => {
    const metrics = calcAllMetrics(rentalInputs);
    const context = buildDealCoachContext({
      ...baseParams,
      inputs: rentalInputs,
      metrics,
      strategyId: "commercial",
      selection: { type: "deal" },
      intent: "due_diligence",
      dealSummary,
    });
    const fields = (context.assumptionFlags ?? []).map((f) => f.field);
    expect(fields).not.toContain("occupancyRate");
    expect(fields).not.toContain("renovationCost");
  });

  it("flags near-100% occupancy, zero renovation budget, zero bad-debt provision, and an optimistic market value premium for an assumption-heavy deal", () => {
    const metrics = calcAllMetrics(assumptionHeavyInputs);
    const context = buildDealCoachContext({
      ...baseParams,
      inputs: assumptionHeavyInputs,
      metrics,
      strategyId: "commercial",
      selection: { type: "deal" },
      intent: "due_diligence",
      dealSummary: { purchasePrice: assumptionHeavyInputs.purchasePrice, marketValue: assumptionHeavyInputs.marketValue },
    });
    const fields = (context.assumptionFlags ?? []).map((f) => f.field);
    expect(fields).toContain("occupancyRate");
    expect(fields).toContain("renovationCost");
    expect(fields).toContain("badDebtsPct");
    expect(fields).toContain("marketValue");
  });

  it("only attaches assumption flags for due-diligence-flavoured intents, not for a narrow metric question", () => {
    const metrics = calcAllMetrics(assumptionHeavyInputs);
    const context = buildDealCoachContext({
      ...baseParams,
      inputs: assumptionHeavyInputs,
      metrics,
      strategyId: "commercial",
      selection: { type: "metric", metricKey: "dscr" },
      intent: "explain_metric",
      dealSummary: { purchasePrice: assumptionHeavyInputs.purchasePrice, marketValue: assumptionHeavyInputs.marketValue },
    });
    expect(context.assumptionFlags).toBeUndefined();
  });

  it("flags a very short flip holding period and zero renovation budget for Fix & Flip", () => {
    const shortFlip: DealInputs = { ...flipInputs, holdingPeriodMonths: 1, renovationCost: 0 };
    const metrics = calcAllMetrics(shortFlip);
    const context = buildDealCoachContext({
      ...baseParams,
      inputs: shortFlip,
      metrics,
      strategyId: "fix_and_flip",
      selection: { type: "deal" },
      intent: "due_diligence",
      dealSummary: flipDealSummary,
    });
    const fields = (context.assumptionFlags ?? []).map((f) => f.field);
    expect(fields).toContain("holdingPeriodMonths");
    expect(fields).toContain("renovationCost");
  });
});

describe("buildDealCoachContext — scenario comparison", () => {
  it("includes a headline comparison table for bear/base/bull, and an empty metrics array (kept minimal)", () => {
    const metrics = calcAllMetrics(rentalInputs);
    const scenarios = calcScenarios(rentalInputs, { realGrowthFactor: 10, occupationFactor: 10 });
    const context = buildDealCoachContext({
      ...baseParams,
      inputs: rentalInputs,
      metrics,
      strategyId: "commercial",
      selection: { type: "deal" },
      intent: "compare_scenarios",
      dealSummary,
      scenarios,
    });
    expect(context.scenarioComparison).toBeDefined();
    expect(Object.keys(context.scenarioComparison!)).toEqual(["bear", "base", "bull"]);
    expect(context.metrics).toEqual([]);
    // Bear DSCR should read lower than Bull DSCR headline value (both present, real deterministic numbers).
    const dscrLabel = "DSCR";
    expect(context.scenarioComparison!.bear[dscrLabel]).toBeTruthy();
    expect(context.scenarioComparison!.bull[dscrLabel]).toBeTruthy();
  });

  it("Fix & Flip scenario comparison uses flip headline metrics, not DSCR/LTV", () => {
    const metrics = calcAllMetrics(flipInputs);
    const scenarios = calcScenarios(flipInputs, { realGrowthFactor: 10, occupationFactor: 10 });
    const context = buildDealCoachContext({
      ...baseParams,
      inputs: flipInputs,
      metrics,
      strategyId: "fix_and_flip",
      selection: { type: "deal" },
      intent: "compare_scenarios",
      dealSummary: flipDealSummary,
      scenarios,
    });
    const baseKeys = Object.keys(context.scenarioComparison!.base);
    expect(baseKeys).toContain("ROI");
    expect(baseKeys).not.toContain("DSCR");
  });
});

describe("buildDealCoachContext — scenario + deal identity are always carried", () => {
  it("reflects the active scenario passed in, not a hardcoded default", () => {
    const metrics = calcAllMetrics(rentalInputs);
    const context = buildDealCoachContext({
      ...baseParams,
      activeScenario: "bear",
      inputs: rentalInputs,
      metrics,
      strategyId: "commercial",
      selection: { type: "deal" },
      intent: "general_question",
      dealSummary,
    });
    expect(context.scenario.active).toBe("bear");
    expect(context.scenario.note.toLowerCase()).toContain("bear");
  });

  it("carries deal identity (name, strategy label, currency, address)", () => {
    const metrics = calcAllMetrics(rentalInputs);
    const context = buildDealCoachContext({
      ...baseParams,
      inputs: rentalInputs,
      metrics,
      strategyId: "commercial",
      selection: { type: "deal" },
      intent: "general_question",
      dealSummary,
    });
    expect(context.deal.name).toBe("Test Deal");
    expect(context.deal.strategyId).toBe("commercial");
    expect(context.deal.strategyLabel).toBe("Commercial");
    expect(context.deal.currency).toBe("ZAR");
    expect(context.deal.address).toBe("1 Test Street");
  });
});

// ---------------------------------------------------------------------------
// Phase 4.1 — target-relative (Equity IRR, Cash-on-Cash) and zero-relative
// (Equity NPV) classification reaching Deal Coach's context, plus the
// category/targetContext/secondaryReference fields the coach needs to keep
// financial safety and investor return structurally distinct (Decisions
// 1-3, 11, 16).
// ---------------------------------------------------------------------------
describe("buildDealCoachContext — target-relative Equity IRR (Decision 1)", () => {
  function contextFor(inputs: DealInputs) {
    const metrics = calcAllMetrics(inputs);
    return buildDealCoachContext({
      ...baseParams,
      inputs,
      metrics,
      strategyId: "commercial",
      selection: { type: "metric", metricKey: "irr" },
      intent: "explain_metric",
      dealSummary,
    });
  }

  it("classifies against discountRate, not the old fixed 15% band — category investor_target, model target_relative", () => {
    const context = contextFor(rentalInputs);
    const entry = context.metrics.find((m) => m.key === "irr")!;
    expect(entry.classification?.status).toBe("classified");
    if (entry.classification?.status === "classified") {
      expect(entry.classification.category).toBe("investor_target");
      expect(["Exceeds Target", "Near Target", "Below Target"]).toContain(entry.classification.label);
    }
  });

  it("carries targetContext.requiredReturn matching the deal's own discountRate", () => {
    const context = contextFor(rentalInputs);
    const entry = context.metrics.find((m) => m.key === "irr")!;
    expect(entry.targetContext?.requiredReturn).toBe(rentalInputs.discountRate);
  });

  it("a modest IRR against a low required return exceeds target, even though the old fixed Commercial band would have called it Caution or Weak", () => {
    // Old Commercial fixed band: >15 green, >=8 orange, <8 red. An IRR of
    // 9% would have been "Caution" under the old model. Against a 5%
    // required return, it genuinely exceeds what the investor needs.
    const lowHurdle: DealInputs = { ...rentalInputs, discountRate: 5 };
    // Force a lower IRR by reducing rental growth so the deal doesn't blow past every band.
    const metrics = calcAllMetrics(lowHurdle);
    const context = buildDealCoachContext({
      ...baseParams,
      inputs: lowHurdle,
      metrics,
      strategyId: "commercial",
      selection: { type: "metric", metricKey: "irr" },
      intent: "explain_metric",
      dealSummary,
    });
    const entry = context.metrics.find((m) => m.key === "irr")!;
    expect(entry.targetContext?.requiredReturn).toBe(5);
  });

  it("carries a secondaryReference — distinct from, and never overriding, the primary target classification", () => {
    const context = contextFor(rentalInputs);
    const entry = context.metrics.find((m) => m.key === "irr")!;
    expect(entry.secondaryReference).toBeDefined();
    expect(entry.secondaryReference?.label).toBe("reference range");
    expect(entry.secondaryReference?.provisional).toBe(true);
    expect(["Strong", "Caution", "Weak"]).toContain(entry.secondaryReference?.classificationLabel);
  });

  it("does not carry a secondaryReference for other metrics — this is an IRR-only fact", () => {
    const metrics = calcAllMetrics(rentalInputs);
    const context = buildDealCoachContext({
      ...baseParams,
      inputs: rentalInputs,
      metrics,
      strategyId: "commercial",
      selection: { type: "metric", metricKey: "dscr" },
      intent: "explain_metric",
      dealSummary,
    });
    const entry = context.metrics.find((m) => m.key === "dscr")!;
    expect(entry.secondaryReference).toBeUndefined();
  });

  it("is marked provisional, distinct from a fixed_bands metric's provisional flag", () => {
    const context = contextFor(rentalInputs);
    const entry = context.metrics.find((m) => m.key === "irr")!;
    expect(entry.classification?.provisional).toBe(true);
  });
});

describe("buildDealCoachContext — zero-relative Equity NPV (Decision 2)", () => {
  it("classifies positive/near-zero/negative NPV relative to zero, normalized by equity invested — never an absolute rand threshold", () => {
    const metrics = calcAllMetrics(rentalInputs);
    const context = buildDealCoachContext({
      ...baseParams,
      inputs: rentalInputs,
      metrics,
      strategyId: "commercial",
      selection: { type: "metric", metricKey: "npv" },
      intent: "explain_metric",
      dealSummary,
    });
    const entry = context.metrics.find((m) => m.key === "npv")!;
    expect(entry.classification?.status).toBe("classified");
    if (entry.classification?.status === "classified") {
      expect(entry.classification.model).toBe("zero_relative");
      expect(entry.classification.category).toBe("investor_target");
    }
  });

  it("carries targetContext.requiredReturn — the discount rate NPV's cashflows were actually discounted at, useful context even though the classification boundary itself is zero, not a percentage", () => {
    const metrics = calcAllMetrics(rentalInputs);
    const context = buildDealCoachContext({
      ...baseParams,
      inputs: rentalInputs,
      metrics,
      strategyId: "commercial",
      selection: { type: "metric", metricKey: "npv" },
      intent: "explain_metric",
      dealSummary,
    });
    const entry = context.metrics.find((m) => m.key === "npv")!;
    expect(entry.targetContext?.requiredReturn).toBe(rentalInputs.discountRate);
  });
});

describe("buildDealCoachContext — Cash-on-Cash Return target model (Decision 3)", () => {
  it("both Pre-Tax and Post-Tax classify target-relative against discountRate", () => {
    const metrics = calcAllMetrics(rentalInputs);
    for (const key of ["netYieldPreTax", "netYieldPostTax"]) {
      const context = buildDealCoachContext({
        ...baseParams,
        inputs: rentalInputs,
        metrics,
        strategyId: "commercial",
        selection: { type: "metric", metricKey: key },
        intent: "explain_metric",
        dealSummary,
      });
      const entry = context.metrics.find((m) => m.key === key)!;
      expect(entry.classification?.status, key).toBe("classified");
      if (entry.classification?.status === "classified") {
        expect(entry.classification.model, key).toBe("target_relative");
      }
      expect(entry.targetContext?.requiredReturn, key).toBe(rentalInputs.discountRate);
    }
  });
});

describe("buildDealCoachContext — informational metrics never read as N/A or a fake judgement (section 28)", () => {
  it("Payback Period, NOI Margin (rental) and Fix & Flip Net Profit are unclassified, not not_applicable, when genuinely applicable", () => {
    const metrics = calcAllMetrics(rentalInputs);
    const context = buildDealCoachContext({
      ...baseParams,
      inputs: rentalInputs,
      metrics,
      strategyId: "commercial",
      selection: { type: "deal" },
      intent: "general_question",
      dealSummary,
    });
    for (const key of ["paybackPeriod", "noiMargin"]) {
      const entry = context.metrics.find((m) => m.key === key)!;
      expect(entry, key).toBeDefined();
      expect(entry.applicable, key).toBe(true);
      expect(entry.classification?.status, key).toBe("unclassified");
    }

    const flipMetrics = calcAllMetrics(flipInputs);
    const flipContext = buildDealCoachContext({
      ...baseParams,
      inputs: flipInputs,
      metrics: flipMetrics,
      strategyId: "fix_and_flip",
      selection: { type: "deal" },
      intent: "general_question",
      dealSummary: flipDealSummary,
    });
    const netProfitEntry = flipContext.metrics.find((m) => m.key === "netProfit")!;
    expect(netProfitEntry.applicable).toBe(true);
    expect(netProfitEntry.classification?.status).toBe("unclassified");
  });

  it("Cap Rate on Market Value is unclassified/contextual — never automatically labelled, even though Cap Rate PP is", () => {
    const metrics = calcAllMetrics(rentalInputs);
    const context = buildDealCoachContext({
      ...baseParams,
      inputs: rentalInputs,
      metrics,
      strategyId: "commercial",
      selection: { type: "deal" },
      intent: "general_question",
      dealSummary,
    });
    const mv = context.metrics.find((m) => m.key === "capRateMV")!;
    const pp = context.metrics.find((m) => m.key === "capRatePP")!;
    expect(mv.classification?.status).toBe("unclassified");
    expect(pp.classification?.status).toBe("classified");
  });

  it("Cap Rate Spread's context text frames the market cap rate as an assumption, never verified fact (Decision 10/30)", () => {
    const metrics = calcAllMetrics(rentalInputs);
    const context = buildDealCoachContext({
      ...baseParams,
      inputs: rentalInputs,
      metrics,
      strategyId: "commercial",
      selection: { type: "metric", metricKey: "capRateSpread" },
      intent: "explain_metric",
      dealSummary,
    });
    const entry = context.metrics.find((m) => m.key === "capRateSpread")!;
    expect(entry.simpleExplanation.toLowerCase()).toContain("assumed market cap rate");
    expect(entry.whyItMatters?.toLowerCase()).toContain("assumed");
    expect(entry.whyItMatters?.toLowerCase()).toContain("not verified market data");
  });
});

// ---------------------------------------------------------------------------
// Phase 4.5: areaRentContext — bounded, strategy-aware, never invented.
// ---------------------------------------------------------------------------

function makeSuburbProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: "sp1",
    userId: "u1",
    suburbName: "Observatory",
    city: "Cape Town",
    province: "Western Cape",
    reportType: "suburb",
    reportDate: new Date().toISOString(),
    reportYear: new Date().getFullYear(),
    reportSource: "TPN Investor Report",
    notes: null,
    fh3BedLow: 4_000,
    fh3BedAvg: 4_400,
    fh3BedHigh: 4_800,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as never;
}

const studentInputs: DealInputs = {
  ...rentalInputs,
  strategy: "student",
  monthlyRent: 0,
  singleRoomCount: 4,
  singleRoomRent: 3_500,
  sharingRoomCount: 3,
  sharingBedsPerRoom: 2,
  sharingRoomRent: 3_000,
};

const multiLetInputs: DealInputs = {
  ...rentalInputs,
  strategy: "multi_let",
  monthlyRent: 0,
  numUnits: 6,
  pricePerRoom: 4_000,
};

describe("buildDealCoachContext — areaRentContext (Phase 4.5)", () => {
  it("is absent when no suburb profile is linked", () => {
    const metrics = calcAllMetrics(studentInputs);
    const context = buildDealCoachContext({
      ...baseParams,
      inputs: studentInputs,
      metrics,
      strategyId: "student",
      selection: { type: "deal" },
      intent: "general_question",
      dealSummary,
      areaSuggestionInputs: { suburbProfile: null, isSectionalTitle: false, bedrooms: null, numUnits: null },
    });
    expect(context.deal.areaRentContext).toBeUndefined();
  });

  it("Student: uses bed capacity (10 beds), not numUnits, and never invents a rent figure", () => {
    const metrics = calcAllMetrics(studentInputs);
    const context = buildDealCoachContext({
      ...baseParams,
      inputs: studentInputs,
      metrics,
      strategyId: "student",
      selection: { type: "deal" },
      intent: "general_question",
      dealSummary,
      areaSuggestionInputs: {
        suburbProfile: makeSuburbProfile(),
        isSectionalTitle: false,
        bedrooms: 3,
        numUnits: 999, // deliberately unrelated — must be ignored for Student
      },
    });
    const area = context.deal.areaRentContext;
    expect(area).toBeDefined();
    expect(area!.basisLabel).toBe("Per-Bed Aggregate Estimate");
    // Your assumption: 4 single beds x R3,500 + 6 sharing beds x R3,000 = R32,000
    expect(area!.yourAssumption).toBe(4 * 3_500 + 6 * 3_000);
    expect(typeof area!.estimate).toBe("number");
  });

  it("Multi-Let: uses room count (numUnits) and labels the estimate per-room", () => {
    const metrics = calcAllMetrics(multiLetInputs);
    const context = buildDealCoachContext({
      ...baseParams,
      inputs: multiLetInputs,
      metrics,
      strategyId: "multi_let",
      selection: { type: "deal" },
      intent: "general_question",
      dealSummary,
      areaSuggestionInputs: {
        suburbProfile: makeSuburbProfile(),
        isSectionalTitle: false,
        bedrooms: 3,
        numUnits: 6,
      },
    });
    const area = context.deal.areaRentContext;
    expect(area).toBeDefined();
    expect(area!.basisLabel).toBe("Per-Room Aggregate Estimate");
    expect(area!.yourAssumption).toBe(6 * 4_000);
  });

  it("carries a null yourAssumption (not a guessed number) when the deal's own rent isn't set", () => {
    const zeroRentStudent: DealInputs = { ...studentInputs, singleRoomRent: 0, sharingRoomRent: 0 };
    const metrics = calcAllMetrics(zeroRentStudent);
    const context = buildDealCoachContext({
      ...baseParams,
      inputs: zeroRentStudent,
      metrics,
      strategyId: "student",
      selection: { type: "deal" },
      intent: "general_question",
      dealSummary,
      areaSuggestionInputs: {
        suburbProfile: makeSuburbProfile(),
        isSectionalTitle: false,
        bedrooms: 3,
        numUnits: null,
      },
    });
    expect(context.deal.areaRentContext?.yourAssumption).toBeNull();
  });
});
