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
    expect(entry.classification).toEqual({ status: "unclassified" });
    // Never a Strong/Caution/Weak string, and never provisional.
    expect((entry.classification as { label?: string })?.label).toBeUndefined();
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
      expect(entry.classification, metricKey).toEqual({ status: "unclassified" });
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
