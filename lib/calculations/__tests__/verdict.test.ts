import { describe, it, expect } from "vitest";
import { calcAllMetrics, type DealInputs } from "../index";
import {
  deriveDealVerdict,
  deriveSafetyState,
  deriveOperatingState,
  deriveTargetState,
  checkStructuralSafetyFailure,
  buildPerformanceContextReasons,
  VERDICT_ENABLED_STRATEGIES,
  VERDICT_MODEL_VERSION,
  type DealVerdictResult,
} from "../verdict";
import type { MetricClassification } from "../thresholds";

const baseInputs: DealInputs = {
  purchasePrice: 0,
  marketValue: 0,
  askingPrice: 0,
  transferBondCost: 0,
  renovationCost: 0,
  sourcingFee: 0,
  agentCommission: 0,
  financeSources: [],
  monthlyRent: 0,
  occupancyRate: 88,
  additionalIncome: 0,
  recoveries: 0,
  managementFeeValue: 10,
  managementFeeMode: "percent",
  maintenanceCostValue: 5,
  maintenanceCostMode: "percent",
  levies: 0,
  ratesAndTaxes: 0,
  insurance: 0,
  waterSewerage: 0,
  securityCleaning: 0,
  electricity: 0,
  badDebtsPct: 2,
  incomeTaxRate: 27,
  capitalGainsTaxRate: 22,
  capitalGrowthRate: 5,
  rentalGrowthRate: 5,
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

function deriveFor(inputs: DealInputs, strategyId: string = inputs.strategy): DealVerdictResult {
  const metrics = calcAllMetrics(inputs);
  return deriveDealVerdict({ strategyId, inputs, metrics });
}

// A synthetic "classified" MetricClassification, for unit-testing the pure
// category-state functions directly against combinations that are
// impossible (or impractical) to reproduce via a real, internally
// consistent DealInputs fixture — e.g. DSCR and Break-Even Ratio classified
// bands can diverge (see verdict.ts's own comment on deriveSafetyState),
// but hitting an EXACT chosen pair of colours via calcAllMetrics would be
// fragile and not actually test anything the real formulas don't already
// guarantee.
type ClassifiedCategory = Extract<MetricClassification, { status: "classified" }>["category"];

function classified(color: "green" | "orange" | "red", category: ClassifiedCategory = "financial_safety"): MetricClassification {
  return {
    status: "classified",
    applicable: true,
    color,
    label: color === "green" ? "Strong" : color === "orange" ? "Caution" : "Weak",
    category,
    model: "fixed_bands",
  } as MetricClassification;
}

const notApplicable: MetricClassification = { status: "not_applicable", applicable: false, color: null, label: null, reason: "test" };
const unclassified: MetricClassification = { status: "unclassified", applicable: true, color: null, label: null, reason: "test" };

describe("checkStructuralSafetyFailure (Phase 4.14 sections 7, 9, 16)", () => {
  it("DSCR < 1.00 with debt → structural failure (test 100)", () => {
    const result = checkStructuralSafetyFailure({ dscr: 0.93, hasDebt: true, breakEvenRatio: 80, cashflowAnnualPreTax: 50_000 });
    expect(result.failed).toBe(true);
    expect(result.reasons.some((r) => r.code === "dscr_below_1")).toBe(true);
  });

  it("DSCR < 1.00 with NO debt never fires (structural check requires hasDebt)", () => {
    const result = checkStructuralSafetyFailure({ dscr: 0.5, hasDebt: false, breakEvenRatio: 80, cashflowAnnualPreTax: 50_000 });
    expect(result.failed).toBe(false);
  });

  it("Break-Even Ratio > 100% → structural failure, even with DSCR looking healthy (test 101, 65)", () => {
    const result = checkStructuralSafetyFailure({ dscr: 1.3, hasDebt: true, breakEvenRatio: 103, cashflowAnnualPreTax: -20_000 });
    expect(result.failed).toBe(true);
    expect(result.reasons.some((r) => r.code === "break_even_above_100")).toBe(true);
    // supporting, non-blocking cashflow reason present but not double-counted
    const cashflowReason = result.reasons.find((r) => r.code === "negative_pretax_cashflow");
    expect(cashflowReason).toBeDefined();
    expect(cashflowReason!.severity).toBe("informational");
    expect(result.reasons.filter((r) => r.severity === "blocking")).toHaveLength(1);
  });

  it("Break-Even Ratio exactly at 90-100% band does NOT structurally fail (test 102, 10)", () => {
    const result = checkStructuralSafetyFailure({ dscr: 1.3, hasDebt: true, breakEvenRatio: 95, cashflowAnnualPreTax: 5_000 });
    expect(result.failed).toBe(false);
  });

  it("Break-Even Ratio exactly 100% is not yet a failure (boundary is strictly greater than 100)", () => {
    const result = checkStructuralSafetyFailure({ dscr: 1.1, hasDebt: true, breakEvenRatio: 100, cashflowAnnualPreTax: 0 });
    expect(result.failed).toBe(false);
  });
});

describe("deriveSafetyState (Phase 4.14 sections 8, 13-21)", () => {
  it("debt-free deal: DSCR not_applicable is removed from evidence, never blocks Strong (test 108, 30-31)", () => {
    const { state, reasons } = deriveSafetyState({ dscr: notApplicable, breakEven: classified("green"), ltv: classified("green") });
    expect(state).toBe("strong");
    expect(reasons).toHaveLength(0);
  });

  it("unclassified PRIMARY safety metric → safety unknown, never Weak (test 109)", () => {
    const { state, reasons } = deriveSafetyState({ dscr: unclassified, breakEven: classified("green"), ltv: classified("green") });
    expect(state).toBe("unknown");
    expect(reasons.some((r) => r.code === "dscr_unclassified")).toBe(true);
  });

  it("unclassified Break-Even also → safety unknown", () => {
    const { state } = deriveSafetyState({ dscr: classified("green"), breakEven: unclassified, ltv: classified("green") });
    expect(state).toBe("unknown");
  });

  it("DSCR caution (>=1.0, classified orange) blocks Strong but is Acceptable, not Weak", () => {
    const { state, reasons } = deriveSafetyState({ dscr: classified("orange"), breakEven: classified("green"), ltv: classified("green") });
    expect(state).toBe("acceptable");
    expect(reasons.some((r) => r.code === "dscr_caution")).toBe(true);
  });

  it("Break-Even 90-100% (classified red, structural check already excluded) blocks Strong, Acceptable not Weak", () => {
    const { state, reasons } = deriveSafetyState({ dscr: classified("green"), breakEven: classified("red"), ltv: classified("green") });
    expect(state).toBe("acceptable");
    expect(reasons.some((r) => r.code === "break_even_high")).toBe(true);
  });

  it("high LTV alone (classified red) blocks Strong but never produces Weak (test 67, 103)", () => {
    const { state, reasons } = deriveSafetyState({ dscr: classified("green"), breakEven: classified("green"), ltv: classified("red") });
    expect(state).toBe("acceptable");
    expect(reasons.some((r) => r.code === "high_ltv")).toBe(true);
  });

  it("LTV caution (orange) does NOT block Strong in this first release", () => {
    const { state, reasons } = deriveSafetyState({ dscr: classified("green"), breakEven: classified("green"), ltv: classified("orange") });
    expect(state).toBe("strong");
    expect(reasons).toHaveLength(0);
  });

  it("everything green → strong", () => {
    const { state } = deriveSafetyState({ dscr: classified("green"), breakEven: classified("green"), ltv: classified("green") });
    expect(state).toBe("strong");
  });
});

describe("deriveOperatingState (Phase 4.14 sections 22-25, 57)", () => {
  it("OER classified green → strong", () => {
    expect(deriveOperatingState(classified("green")).state).toBe("strong");
  });
  it("OER classified orange → acceptable", () => {
    expect(deriveOperatingState(classified("orange")).state).toBe("acceptable");
  });
  it("OER classified red → weak, but this NEVER triggers High Risk on its own (verified at the deriveDealVerdict level below)", () => {
    const { state, reasons } = deriveOperatingState(classified("red"));
    expect(state).toBe("weak");
    expect(reasons[0].code).toBe("high_oer");
  });
  it("OER unclassified → unknown", () => {
    expect(deriveOperatingState(unclassified).state).toBe("unknown");
  });
  it("OER not_applicable → treated as non-blocking (never penalised)", () => {
    const { state, reasons } = deriveOperatingState(notApplicable);
    expect(state).toBe("strong");
    expect(reasons).toHaveLength(0);
  });
});

describe("deriveTargetState (Phase 4.14 sections 31-40)", () => {
  it("IRR >= Required Return → met (raw comparison, not the provisional Near-Target band)", () => {
    const { state } = deriveTargetState({ irrClassification: classified("orange", "investor_target"), irr: 20.1, discountRate: 20 });
    expect(state).toBe("met");
  });
  it("IRR just below Required Return → missed, even if per-metric classification would say Near Target (test 115)", () => {
    const { state, reasons } = deriveTargetState({ irrClassification: classified("orange", "investor_target"), irr: 19.9, discountRate: 20 });
    expect(state).toBe("missed");
    expect(reasons[0].code).toBe("target_missed");
  });
  it("IRR not_applicable (e.g. zero/negative equity) → unknown (test 36, 71)", () => {
    const { state } = deriveTargetState({ irrClassification: notApplicable, irr: NaN, discountRate: 10 });
    expect(state).toBe("unknown");
  });
});

describe("buildPerformanceContextReasons (Phase 4.14 sections 26-27, 56, 69)", () => {
  it("weak Cap Rate PP produces an informational reason only, never blocking", () => {
    const reasons = buildPerformanceContextReasons(classified("red", "property_performance"));
    expect(reasons).toHaveLength(1);
    expect(reasons[0].severity).toBe("informational");
  });
  it("green Cap Rate PP produces no reason at all", () => {
    expect(buildPerformanceContextReasons(classified("green", "property_performance"))).toHaveLength(0);
  });
});

describe("deriveDealVerdict — strategy eligibility (Phase 4.14 sections 1-3, 111-112)", () => {
  it("Fix & Flip now receives an active verdict, delegated to flipVerdict.ts (Phase 4.20, supersedes test 111)", () => {
    // A profitable, target-meeting Flip with no exit-value evidence supplied
    // (deriveFor doesn't pass flipExitValueAnalysis) lands on Promising, not
    // "unavailable" — Fix & Flip is no longer excluded from the rental-style
    // strategy-eligibility gate the way Instalment Sale still is below. See
    // lib/calculations/__tests__/flipVerdict.test.ts for the full Flip
    // verdict policy test suite.
    const inputs: DealInputs = { ...baseInputs, strategy: "fix_and_flip", purchasePrice: 1_000_000, marketValue: 1_000_000, renovationCost: 200_000, expectedSalePrice: 2_000_000, holdingPeriodMonths: 6 };
    const result = deriveFor(inputs);
    expect(result.status).toBe("available");
    if (result.status === "available") {
      expect(result.verdict).toBe("promising");
      expect(result.blockers[0].code).toBe("no_exit_value_evidence");
    }
  });

  it("Instalment Sale is always unavailable (test 112)", () => {
    const inputs: DealInputs = { ...baseInputs, strategy: "instalment_sale", purchasePrice: 1_000_000, marketValue: 1_000_000, instalmentAmount: 15_000, instalmentTerm: 120, instalmentRate: 10 };
    const result = deriveFor(inputs);
    expect(result.status).toBe("unavailable");
    if (result.status === "unavailable") {
      expect(result.reason).toBe("strategy_model_incomplete");
      expect(result.reasons[0].code).toBe("instalment_sale_model_incomplete");
    }
  });

  it("VERDICT_ENABLED_STRATEGIES contains exactly the five approved rental strategies", () => {
    expect([...VERDICT_ENABLED_STRATEGIES].sort()).toEqual(["buy_to_let", "commercial", "multi_let", "str", "student"]);
  });

  it("every verdict result carries the model version tag", () => {
    const result = deriveFor(baseInputs);
    expect(result.verdictModelVersion).toBe(VERDICT_MODEL_VERSION);
  });

  it("Fix & Flip verdicts carry the Flip engine's own model version tag, not the rental one (Phase 4.20)", () => {
    const inputs: DealInputs = { ...baseInputs, strategy: "fix_and_flip", purchasePrice: 1_000_000, marketValue: 1_000_000, renovationCost: 200_000, expectedSalePrice: 2_000_000, holdingPeriodMonths: 6 };
    const result = deriveFor(inputs);
    expect(result.verdictModelVersion).toBe("4.20");
    expect(result.verdictModelVersion).not.toBe(VERDICT_MODEL_VERSION);
  });
});

describe("deriveDealVerdict — integration fixtures (manual verification matrix, section 141)", () => {
  it("Deal A — healthy financing, target met, healthy OER → Strong", () => {
    const inputs: DealInputs = {
      ...baseInputs,
      purchasePrice: 2_000_000, marketValue: 2_000_000,
      financeSources: [{ loanAmount: 1_000_000, interestRate: 10, termYears: 20 }],
      monthlyRent: 35_000,
      occupancyRate: 90,
      managementFeeValue: 8,
      maintenanceCostValue: 3,
      ratesAndTaxes: 1_500,
      insurance: 500,
      discountRate: 8,
      capitalGrowthRate: 5,
      rentalGrowthRate: 5,
    };
    const metrics = calcAllMetrics(inputs);
    // preconditions — document exactly why this fixture should be Strong
    expect(metrics.dscr).toBeGreaterThanOrEqual(1.25);
    expect(metrics.breakEvenRatio).toBeLessThanOrEqual(75);
    expect(metrics.ltv).toBeLessThanOrEqual(60);
    expect(metrics.operatingExpenseRatio).toBeLessThanOrEqual(40);
    expect(metrics.irr).toBeGreaterThanOrEqual(inputs.discountRate);

    const result = deriveDealVerdict({ strategyId: "commercial", inputs, metrics });
    expect(result.status).toBe("available");
    if (result.status === "available") {
      expect(result.verdict).toBe("strong");
      expect(result.categoryStates).toEqual({ safety: "strong", operating: "strong", target: "met" });
      expect(result.blockers).toHaveLength(0);
    }
  });

  it("Deal B — DSCR < 1 overrides an attractive IRR → High Risk (test 60/64, return never hides safety)", () => {
    const inputs: DealInputs = {
      ...baseInputs,
      purchasePrice: 2_000_000, marketValue: 2_000_000,
      financeSources: [{ loanAmount: 1_800_000, interestRate: 13, termYears: 20 }],
      monthlyRent: 14_000,
      occupancyRate: 85,
      discountRate: 5,
      capitalGrowthRate: 12,
      rentalGrowthRate: 8,
    };
    const metrics = calcAllMetrics(inputs);
    expect(metrics.dscr).toBeLessThan(1.0);
    expect(metrics.irr).toBeGreaterThanOrEqual(inputs.discountRate);

    const result = deriveDealVerdict({ strategyId: "commercial", inputs, metrics });
    expect(result.status).toBe("available");
    if (result.status === "available") {
      expect(result.verdict).toBe("high_risk");
      expect(result.categoryStates.safety).toBe("weak");
      expect(result.blockers.some((r) => r.code === "dscr_below_1")).toBe(true);
    }
  });

  it("Deal D — Break-Even ~90-100% band blocks Strong without forcing High Risk → Promising (test 66, 102)", () => {
    // Small, low-cost debt to keep DSCR comfortably >= 1 while operating
    // costs push Break-Even into the severe-but-not-structural band.
    const inputs: DealInputs = {
      ...baseInputs,
      purchasePrice: 1_500_000, marketValue: 1_500_000,
      financeSources: [{ loanAmount: 300_000, interestRate: 8, termYears: 20 }],
      monthlyRent: 20_000,
      occupancyRate: 85,
      managementFeeValue: 25,
      maintenanceCostValue: 20,
      ratesAndTaxes: 3_000,
      insurance: 1_000,
      badDebtsPct: 8,
      discountRate: 6,
      capitalGrowthRate: 5,
      rentalGrowthRate: 5,
    };
    const metrics = calcAllMetrics(inputs);
    expect(metrics.breakEvenRatio).toBeGreaterThan(90);
    expect(metrics.breakEvenRatio).toBeLessThanOrEqual(100);
    expect(metrics.irr).toBeGreaterThanOrEqual(inputs.discountRate);

    const result = deriveDealVerdict({ strategyId: "commercial", inputs, metrics });
    expect(result.status).toBe("available");
    if (result.status === "available") {
      expect(result.verdict).toBe("promising");
      expect(result.categoryStates.safety).toBe("acceptable");
      expect(result.blockers.some((r) => r.code === "break_even_high")).toBe(true);
    }
  });

  it("Deal E — safety healthy, IRR below Required Return → Does Not Meet Target (test 106)", () => {
    const inputs: DealInputs = {
      ...baseInputs,
      purchasePrice: 2_000_000, marketValue: 2_000_000,
      financeSources: [{ loanAmount: 800_000, interestRate: 10, termYears: 20 }],
      monthlyRent: 30_000,
      occupancyRate: 90,
      discountRate: 40, // deliberately aggressive — test 60/107
      capitalGrowthRate: 4,
      rentalGrowthRate: 4,
    };
    const metrics = calcAllMetrics(inputs);
    expect(metrics.dscr).toBeGreaterThanOrEqual(1.0);
    expect(metrics.breakEvenRatio).toBeLessThanOrEqual(90);
    expect(metrics.irr).toBeLessThan(inputs.discountRate);

    const result = deriveDealVerdict({ strategyId: "commercial", inputs, metrics });
    expect(result.status).toBe("available");
    if (result.status === "available") {
      expect(result.verdict).toBe("does_not_meet_target");
      expect(result.categoryStates.target).toBe("missed");
      expect(result.blockers.some((r) => r.code === "target_missed")).toBe(true);
    }
  });

  it("Deal F — debt-free deal reaches Strong; DSCR N/A is not penalised (test 62, 108, mandatory)", () => {
    const inputs: DealInputs = {
      ...baseInputs,
      purchasePrice: 1_500_000, marketValue: 1_500_000,
      financeSources: [],
      monthlyRent: 22_000,
      occupancyRate: 90,
      managementFeeValue: 8,
      maintenanceCostValue: 3,
      ratesAndTaxes: 1_000,
      insurance: 400,
      discountRate: 5,
      capitalGrowthRate: 5,
      rentalGrowthRate: 5,
    };
    const metrics = calcAllMetrics(inputs);
    expect(metrics.dscr).toBe(Infinity);
    expect(metrics.ltv).toBe(0);
    expect(metrics.breakEvenRatio).toBeLessThanOrEqual(75);
    expect(metrics.operatingExpenseRatio).toBeLessThanOrEqual(40);
    expect(metrics.irr).toBeGreaterThanOrEqual(inputs.discountRate);

    const result = deriveDealVerdict({ strategyId: "commercial", inputs, metrics });
    expect(result.status).toBe("available");
    if (result.status === "available") {
      expect(result.verdict).toBe("strong");
      expect(result.categoryStates.safety).toBe("strong");
    }
  });

  it("Deal F variant — debt-free, target missed → Does Not Meet Target, never Promising/High Risk (test 63)", () => {
    const inputs: DealInputs = {
      ...baseInputs,
      purchasePrice: 1_500_000, marketValue: 1_500_000,
      financeSources: [],
      monthlyRent: 22_000,
      occupancyRate: 90,
      managementFeeValue: 8,
      maintenanceCostValue: 3,
      ratesAndTaxes: 1_000,
      insurance: 400,
      discountRate: 40, // aggressive enough that even a debt-free deal misses it
      capitalGrowthRate: 5,
      rentalGrowthRate: 5,
    };
    const metrics = calcAllMetrics(inputs);
    expect(metrics.dscr).toBe(Infinity);
    expect(metrics.irr).toBeLessThan(inputs.discountRate);

    const result = deriveDealVerdict({ strategyId: "commercial", inputs, metrics });
    expect(result.status).toBe("available");
    if (result.status === "available") {
      expect(result.verdict).toBe("does_not_meet_target");
    }
  });

  it("high LTV alone → Promising, never High Risk (test 67, 103)", () => {
    const inputs: DealInputs = {
      ...baseInputs,
      purchasePrice: 1_500_000, marketValue: 1_500_000,
      financeSources: [{ loanAmount: 1_200_000, interestRate: 8, termYears: 20 }], // 80% LTV
      monthlyRent: 25_000,
      occupancyRate: 90,
      managementFeeValue: 8,
      maintenanceCostValue: 3,
      discountRate: 5,
      capitalGrowthRate: 5,
      rentalGrowthRate: 5,
    };
    const metrics = calcAllMetrics(inputs);
    expect(metrics.ltv).toBeGreaterThan(75);
    expect(metrics.dscr).toBeGreaterThanOrEqual(1.25);
    expect(metrics.breakEvenRatio).toBeLessThanOrEqual(75);
    expect(metrics.irr).toBeGreaterThanOrEqual(inputs.discountRate);

    const result = deriveDealVerdict({ strategyId: "commercial", inputs, metrics });
    expect(result.status).toBe("available");
    if (result.status === "available") {
      expect(result.verdict).toBe("promising");
      expect(result.blockers.some((r) => r.code === "high_ltv")).toBe(true);
    }
  });

  it("weak OER alone → Promising, never High Risk (test 68, 104, 58)", () => {
    const inputs: DealInputs = {
      ...baseInputs,
      purchasePrice: 1_500_000, marketValue: 1_500_000,
      financeSources: [],
      monthlyRent: 25_000,
      occupancyRate: 90,
      managementFeeValue: 30,
      maintenanceCostValue: 25,
      ratesAndTaxes: 3_000,
      insurance: 1_000,
      badDebtsPct: 5,
      discountRate: 5,
      capitalGrowthRate: 5,
      rentalGrowthRate: 5,
    };
    const metrics = calcAllMetrics(inputs);
    expect(metrics.operatingExpenseRatio).toBeGreaterThan(60);
    expect(metrics.breakEvenRatio).toBeLessThanOrEqual(90); // opex-heavy but no debt service, stays under the structural/severe band
    expect(metrics.irr).toBeGreaterThanOrEqual(inputs.discountRate);

    const result = deriveDealVerdict({ strategyId: "commercial", inputs, metrics });
    expect(result.status).toBe("available");
    if (result.status === "available") {
      expect(result.verdict).toBe("promising");
      expect(result.categoryStates.operating).toBe("weak");
      expect(result.categoryStates.safety).not.toBe("weak");
      expect(result.blockers.some((r) => r.code === "high_oer")).toBe(true);
    }
  });

  it("weak Cap Rate PP alone (everything else strong) → Strong still reachable (test 69, 59, proves Cap Rate is not a secret gate)", () => {
    const inputs: DealInputs = {
      ...baseInputs,
      purchasePrice: 6_000_000, marketValue: 6_000_000, // inflated purchase price relative to NOI pushes Cap Rate PP low/red
      financeSources: [],
      monthlyRent: 25_000,
      occupancyRate: 90,
      managementFeeValue: 8,
      maintenanceCostValue: 3,
      ratesAndTaxes: 1_000,
      insurance: 400,
      discountRate: 2,
      capitalGrowthRate: 5,
      rentalGrowthRate: 5,
    };
    const metrics = calcAllMetrics(inputs);
    expect(metrics.capRatePP).toBeLessThan(5); // outside the 8-12 sweet spot, red
    expect(metrics.dscr).toBe(Infinity);
    expect(metrics.breakEvenRatio).toBeLessThanOrEqual(75);
    expect(metrics.operatingExpenseRatio).toBeLessThanOrEqual(40);
    expect(metrics.irr).toBeGreaterThanOrEqual(inputs.discountRate);

    const result = deriveDealVerdict({ strategyId: "commercial", inputs, metrics });
    expect(result.status).toBe("available");
    if (result.status === "available") {
      expect(result.verdict).toBe("strong");
      expect(result.reasons.some((r) => r.code === "cap_rate_context" && r.severity === "informational")).toBe(true);
    }
  });

  it("target missed + weak OER → Does Not Meet Target, OER does not escalate to High Risk (test 70)", () => {
    const inputs: DealInputs = {
      ...baseInputs,
      purchasePrice: 1_500_000, marketValue: 1_500_000,
      financeSources: [],
      monthlyRent: 25_000,
      occupancyRate: 90,
      managementFeeValue: 30,
      maintenanceCostValue: 25,
      ratesAndTaxes: 3_000,
      insurance: 1_000,
      discountRate: 40,
      capitalGrowthRate: 5,
      rentalGrowthRate: 5,
    };
    const metrics = calcAllMetrics(inputs);
    expect(metrics.operatingExpenseRatio).toBeGreaterThan(60);
    expect(metrics.irr).toBeLessThan(inputs.discountRate);

    const result = deriveDealVerdict({ strategyId: "commercial", inputs, metrics });
    expect(result.status).toBe("available");
    if (result.status === "available") {
      expect(result.verdict).toBe("does_not_meet_target");
    }
  });

  it("Required Return extremes: Safety and Operating states stay identical, only Target moves (test 41, 107)", () => {
    const inputs: DealInputs = {
      ...baseInputs,
      purchasePrice: 2_000_000, marketValue: 2_000_000,
      financeSources: [{ loanAmount: 1_000_000, interestRate: 10, termYears: 20 }],
      monthlyRent: 35_000,
      occupancyRate: 90,
      managementFeeValue: 8,
      maintenanceCostValue: 3,
      ratesAndTaxes: 1_500,
      insurance: 500,
      capitalGrowthRate: 5,
      rentalGrowthRate: 5,
    };
    const results = [2, 10, 25, 40].map((discountRate) => {
      const scenarioInputs = { ...inputs, discountRate };
      const metrics = calcAllMetrics(scenarioInputs);
      return deriveDealVerdict({ strategyId: "commercial", inputs: scenarioInputs, metrics });
    });
    const safetyStates = results.map((r) => (r.status === "available" ? r.categoryStates.safety : null));
    const operatingStates = results.map((r) => (r.status === "available" ? r.categoryStates.operating : null));
    expect(new Set(safetyStates).size).toBe(1);
    expect(new Set(operatingStates).size).toBe(1);
    // target must actually move across this range — otherwise the test proves nothing
    const targetStates = results.map((r) => (r.status === "available" ? r.categoryStates.target : null));
    expect(new Set(targetStates).size).toBeGreaterThan(1);
  });

  it("IRR just below Required Return → Does Not Meet Target (test 115)", () => {
    const inputs: DealInputs = {
      ...baseInputs,
      purchasePrice: 2_000_000, marketValue: 2_000_000,
      financeSources: [{ loanAmount: 800_000, interestRate: 10, termYears: 20 }],
      monthlyRent: 28_000,
      occupancyRate: 90,
      capitalGrowthRate: 5,
      rentalGrowthRate: 5,
      discountRate: 10,
    };
    const baseMetrics = calcAllMetrics(inputs);
    const justBelow = { ...inputs, discountRate: baseMetrics.irr + 0.1 };
    const result = deriveFor(justBelow, "commercial");
    expect(result.status).toBe("available");
    if (result.status === "available") {
      expect(result.categoryStates.target).toBe("missed");
      expect(result.verdict).toBe("does_not_meet_target");
    }
  });

  it("IRR just above Required Return → target met (test 116)", () => {
    const inputs: DealInputs = {
      ...baseInputs,
      purchasePrice: 2_000_000, marketValue: 2_000_000,
      financeSources: [{ loanAmount: 800_000, interestRate: 10, termYears: 20 }],
      monthlyRent: 28_000,
      occupancyRate: 90,
      capitalGrowthRate: 5,
      rentalGrowthRate: 5,
      discountRate: 10,
    };
    const baseMetrics = calcAllMetrics(inputs);
    const justAbove = { ...inputs, discountRate: baseMetrics.irr - 0.1 };
    const result = deriveFor(justAbove, "commercial");
    expect(result.status).toBe("available");
    if (result.status === "available") {
      expect(result.categoryStates.target).toBe("met");
    }
  });
});

describe("Phase 4.14.1 — OER correction: Strong accepts acceptable, not just strong", () => {
  it("OER Caution (acceptable) + strong Safety + target met → STRONG, not Promising (mandatory, section 12/20)", () => {
    // Debt-free, so DSCR is removed from evidence and LTV is trivially 0/green
    // (§8/§9) — isolates the fix to OER alone. Opex is heavy enough to land
    // OER in commercial's 40-60% Caution band, but with no debt service,
    // Break-Even Ratio equals the same ratio (operatingExpensesAnnual has no
    // finance cost to add), which is still comfortably inside the 75% green
    // band — Safety stays strong regardless of OER.
    const inputs: DealInputs = {
      ...baseInputs,
      purchasePrice: 1_500_000,
      marketValue: 1_500_000,
      financeSources: [],
      monthlyRent: 25_000,
      occupancyRate: 90,
      managementFeeValue: 18,
      maintenanceCostValue: 15,
      ratesAndTaxes: 2_000,
      insurance: 700,
      badDebtsPct: 4,
      discountRate: 5,
      capitalGrowthRate: 5,
      rentalGrowthRate: 5,
    };
    const metrics = calcAllMetrics(inputs);
    expect(metrics.operatingExpenseRatio).toBeGreaterThan(40);
    expect(metrics.operatingExpenseRatio).toBeLessThanOrEqual(60);
    expect(metrics.dscr).toBe(Infinity);
    expect(metrics.ltv).toBe(0);
    expect(metrics.breakEvenRatio).toBeLessThanOrEqual(75);
    expect(metrics.irr).toBeGreaterThanOrEqual(inputs.discountRate);

    const result = deriveDealVerdict({ strategyId: "commercial", inputs, metrics });
    expect(result.status).toBe("available");
    if (result.status === "available") {
      expect(result.categoryStates.safety).toBe("strong");
      expect(result.categoryStates.operating).toBe("acceptable");
      expect(result.categoryStates.target).toBe("met");
      expect(result.verdict).toBe("strong");
      expect(result.blockers).toHaveLength(0);
    }
  });

  it("OER Weak + strong Safety + target met → PROMISING, never Strong or High Risk (section 13)", () => {
    const inputs: DealInputs = {
      ...baseInputs,
      purchasePrice: 1_500_000,
      marketValue: 1_500_000,
      financeSources: [],
      monthlyRent: 25_000,
      occupancyRate: 90,
      managementFeeValue: 30,
      maintenanceCostValue: 25,
      ratesAndTaxes: 3_000,
      insurance: 1_000,
      badDebtsPct: 5,
      discountRate: 5,
      capitalGrowthRate: 5,
      rentalGrowthRate: 5,
    };
    const metrics = calcAllMetrics(inputs);
    expect(metrics.operatingExpenseRatio).toBeGreaterThan(60);
    expect(metrics.dscr).toBe(Infinity);
    expect(metrics.irr).toBeGreaterThanOrEqual(inputs.discountRate);

    const result = deriveDealVerdict({ strategyId: "commercial", inputs, metrics });
    expect(result.status).toBe("available");
    if (result.status === "available") {
      expect(result.categoryStates.operating).toBe("weak");
      expect(result.verdict).toBe("promising");
      expect(result.blockers.some((r) => r.code === "high_oer")).toBe(true);
    }
  });

  it("OER unclassified/missing → operating unknown → cannot satisfy the Strong-eligibility rule (section 14)", () => {
    // None of the five verdict-enabled strategies currently lack an OER
    // threshold definition (thresholds.ts), so an unclassified OER cannot be
    // produced through a real DealInputs fixture on any of them — this
    // tests the rule directly, the same convention Phase 4.14 already used
    // for "unclassified primary safety metric" (see deriveSafetyState tests
    // above), since there is no live combination of inputs that reaches it.
    const unclassified: MetricClassification = { status: "unclassified", applicable: true, color: null, label: null, reason: "test" };
    const { state: operating, reasons } = deriveOperatingState(unclassified);
    expect(operating).toBe("unknown");
    // This is exactly the boolean the engine's Step 6 Strong gate evaluates
    // (lib/calculations/verdict.ts) — "unknown" satisfies neither "strong"
    // nor "acceptable", so it cannot clear Strong, falling through to
    // Promising (proven by the OER-Weak case above sharing the identical
    // fallthrough path) rather than any negative/High-Risk outcome.
    const operatingClearsStrong = operating === "strong" || operating === "acceptable";
    expect(operatingClearsStrong).toBe(false);
    expect(reasons[0].code).toBe("oer_unclassified");
  });
});

describe("Phase 4.14.1 — re-confirmed regressions after the OER correction", () => {
  it("Break-Even > 100% via a real debt-free fixture (opex alone exceeds revenue) → HIGH RISK, DSCR N/A does not rescue it (section 18)", () => {
    const inputs: DealInputs = {
      ...baseInputs,
      purchasePrice: 1_000_000,
      marketValue: 1_000_000,
      financeSources: [],
      monthlyRent: 10_000,
      occupancyRate: 90,
      managementFeeValue: 80,
      maintenanceCostValue: 40,
      ratesAndTaxes: 5_000,
      insurance: 2_000,
      badDebtsPct: 10,
      discountRate: 5,
    };
    const metrics = calcAllMetrics(inputs);
    expect(metrics.dscr).toBe(Infinity);
    expect(metrics.breakEvenRatio).toBeGreaterThan(100);

    const result = deriveDealVerdict({ strategyId: "commercial", inputs, metrics });
    expect(result.status).toBe("available");
    if (result.status === "available") {
      expect(result.verdict).toBe("high_risk");
      expect(result.blockers.some((r) => r.code === "break_even_above_100")).toBe(true);
    }
  });
});

describe("promising_if_negotiated is unreachable (Phase 4.14 sections 5, 43, 113)", () => {
  const fixtures: DealInputs[] = [
    { ...baseInputs, purchasePrice: 2_000_000, marketValue: 2_000_000, financeSources: [{ loanAmount: 1_000_000, interestRate: 10, termYears: 20 }], monthlyRent: 35_000, discountRate: 8 },
    { ...baseInputs, purchasePrice: 2_000_000, marketValue: 2_000_000, financeSources: [{ loanAmount: 1_800_000, interestRate: 13, termYears: 20 }], monthlyRent: 14_000, discountRate: 5, capitalGrowthRate: 12 },
    { ...baseInputs, purchasePrice: 1_500_000, marketValue: 1_500_000, financeSources: [], monthlyRent: 22_000, discountRate: 40 },
    { ...baseInputs, purchasePrice: 1_500_000, marketValue: 1_500_000, financeSources: [{ loanAmount: 1_200_000, interestRate: 8, termYears: 20 }], monthlyRent: 25_000, discountRate: 5 },
    { ...baseInputs, strategy: "buy_to_let", purchasePrice: 1_200_000, marketValue: 1_200_000, financeSources: [{ loanAmount: 600_000, interestRate: 11, termYears: 20 }], monthlyRent: 12_000, discountRate: 12 },
    { ...baseInputs, strategy: "multi_let", purchasePrice: 2_500_000, marketValue: 2_500_000, numUnits: 6, pricePerRoom: 4_500, financeSources: [{ loanAmount: 1_000_000, interestRate: 10, termYears: 20 }], discountRate: 15 },
    { ...baseInputs, strategy: "student", purchasePrice: 3_000_000, marketValue: 3_000_000, singleRoomCount: 10, singleRoomRent: 4_500, financeSources: [{ loanAmount: 1_500_000, interestRate: 10, termYears: 20 }], discountRate: 15 },
    { ...baseInputs, strategy: "str", purchasePrice: 1_800_000, marketValue: 1_800_000, nightlyRate: 900, avgOccupiedNights: 220, financeSources: [{ loanAmount: 900_000, interestRate: 11, termYears: 20 }], discountRate: 18 },
  ];

  it("no fixture in this suite ever produces promising_if_negotiated", () => {
    for (const inputs of fixtures) {
      const result = deriveFor(inputs);
      if (result.status === "available") {
        expect(result.verdict).not.toBe("promising_if_negotiated");
      }
    }
  });
});
