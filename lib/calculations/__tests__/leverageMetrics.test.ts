import { describe, it, expect } from "vitest";
import {
  calcAllMetrics,
  calcPurchaseLTV,
  calcEstimatedValueLTV,
  calcProjectLeverage,
  calcLTV,
  calcTotalInvestment,
  type DealInputs,
} from "../index";
import { deriveDealVerdict } from "../verdict";
import { classifyMetricForDeal, applicabilityContextFromInputs } from "../applicability";

/**
 * Phase 4.23.1 — Leverage Metrics Implementation.
 *
 * Regression coverage for the three separately-named leverage metrics, and
 * — critically — proof that Purchase LTV (the renamed, byte-identical
 * successor to the old calcLTV()) produces EXACTLY the same verdict
 * behaviour as before this phase. See
 * AssetVerdict_Phase4.23.1_Leverage_Metrics_Implementation.md.
 */
const baseInputs: DealInputs = {
  purchasePrice: 1_000_000,
  marketValue: 1_400_000,
  askingPrice: 1_100_000,
  transferBondCost: 50_000,
  renovationCost: 200_000,
  sourcingFee: 0,
  agentCommission: 5,
  financeSources: [{ loanAmount: 800_000, interestRate: 11, termYears: 20 }],
  wantToSell: false,
  saleYear: null,
  monthlyRent: 25_000,
  occupancyRate: 95,
  additionalIncome: 0,
  recoveries: 0,
  managementFeeValue: 10,
  managementFeeMode: "percent",
  maintenanceCostValue: 5,
  maintenanceCostMode: "percent",
  levies: 0,
  ratesAndTaxes: 1_500,
  insurance: 500,
  waterSewerage: 0,
  securityCleaning: 0,
  electricity: 0,
  badDebtsPct: 3,
  incomeTaxRate: 27,
  capitalGainsTaxRate: 22,
  capitalGrowthRate: 5,
  rentalGrowthRate: 8,
  costInflation: 5,
  discountRate: 10,
  marketCapRate: 10,
  strategy: "buy_to_let",
  numUnits: 1,
  nightlyRate: 0,
  avgOccupiedNights: 0,
  platformFeesPct: 0,
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
  // Deliberately NOT set here — most tests below set it explicitly per case.
  estimatedMarketValue: null,
};

describe("calcPurchaseLTV (Phase 4.23.1, requirement 28)", () => {
  it("Purchase Price R1,000,000, Debt R800,000 -> 80%", () => {
    expect(calcPurchaseLTV(baseInputs)).toBe(80);
  });

  it("debt > purchase price -> 110%, no clamp", () => {
    const inputs: DealInputs = {
      ...baseInputs,
      financeSources: [{ loanAmount: 1_100_000, interestRate: 11, termYears: 20 }],
    };
    expect(calcPurchaseLTV(inputs)).toBeCloseTo(110, 6);
  });

  it("negative purchase price does not produce a negative percentage", () => {
    const inputs: DealInputs = { ...baseInputs, purchasePrice: -1_000_000 };
    const result = calcPurchaseLTV(inputs);
    expect(result).toBe(0);
    expect(result).not.toBeLessThan(0);
  });

  it("zero purchase price -> 0 (sentinel, caught as N/A upstream by applicability)", () => {
    expect(calcPurchaseLTV({ ...baseInputs, purchasePrice: 0 })).toBe(0);
  });

  it("all-cash deal -> 0%, not N/A (0% leverage is a real, meaningful value)", () => {
    expect(calcPurchaseLTV({ ...baseInputs, financeSources: [] })).toBe(0);
  });
});

describe("calcEstimatedValueLTV (Phase 4.23.1, requirement 28)", () => {
  it("Estimated Current Market Value R1,400,000, Debt R800,000 -> 57.142857...%", () => {
    const inputs: DealInputs = { ...baseInputs, estimatedMarketValue: 1_400_000 };
    expect(calcEstimatedValueLTV(inputs)).toBeCloseTo(57.142857, 5);
  });

  it("value BELOW purchase price is a valid, correctly-handled case (never forced to match Purchase LTV)", () => {
    const inputs: DealInputs = { ...baseInputs, estimatedMarketValue: 900_000 };
    expect(calcPurchaseLTV(inputs)).toBe(80);
    expect(calcEstimatedValueLTV(inputs)).toBeCloseTo(88.888889, 5);
  });

  it("missing estimated market value -> null, NEVER silently falls back to Purchase LTV or Purchase Price", () => {
    const inputs: DealInputs = { ...baseInputs, estimatedMarketValue: null };
    expect(calcEstimatedValueLTV(inputs)).toBeNull();
    // Explicitly not the Purchase LTV value (80), which a silent fallback would produce.
    expect(calcEstimatedValueLTV(inputs)).not.toBe(80);
  });

  it("estimatedMarketValue entirely absent from the input object (undefined) also returns null", () => {
    const { estimatedMarketValue: _drop, ...rest } = baseInputs;
    void _drop;
    expect(calcEstimatedValueLTV(rest as DealInputs)).toBeNull();
  });

  it("zero or negative estimated market value -> null, never a negative/Infinity percentage", () => {
    expect(calcEstimatedValueLTV({ ...baseInputs, estimatedMarketValue: 0 })).toBeNull();
    expect(calcEstimatedValueLTV({ ...baseInputs, estimatedMarketValue: -500_000 })).toBeNull();
  });

  it("all-cash deal with a valid estimate -> 0%, not N/A", () => {
    const inputs: DealInputs = { ...baseInputs, estimatedMarketValue: 1_400_000, financeSources: [] };
    expect(calcEstimatedValueLTV(inputs)).toBe(0);
  });

  it("a blank marketValue defaulting to purchasePrice (legacy DealInputs.marketValue behaviour) never leaks into Estimated Value LTV", () => {
    // marketValue itself may equal purchasePrice via assembleInputs' fallback
    // (Phase 4.23 audit finding) — but estimatedMarketValue is independent
    // and, if genuinely null, must still yield null here regardless of what
    // `marketValue` says.
    const inputs: DealInputs = { ...baseInputs, marketValue: baseInputs.purchasePrice, estimatedMarketValue: null };
    expect(calcEstimatedValueLTV(inputs)).toBeNull();
  });
});

describe("calcProjectLeverage (Phase 4.23.1, requirement 28)", () => {
  it("Total Investment R1,250,000, Debt R800,000 -> 64%", () => {
    expect(calcTotalInvestment(baseInputs)).toBe(1_250_000);
    expect(calcProjectLeverage(baseInputs)).toBeCloseTo(64, 6);
  });

  it("uses the SAME calcTotalInvestment() as the rest of the app — no second cost aggregation", () => {
    const inputs: DealInputs = { ...baseInputs, renovationCost: 350_000 };
    const expected = (800_000 / calcTotalInvestment(inputs)) * 100;
    expect(calcProjectLeverage(inputs)).toBeCloseTo(expected, 6);
  });

  it("Total Investment <= 0 -> null, never NaN/Infinity", () => {
    const inputs: DealInputs = {
      ...baseInputs,
      purchasePrice: 0,
      transferBondCost: 0,
      renovationCost: 0,
      sourcingFee: 0,
    };
    expect(calcTotalInvestment(inputs)).toBe(0);
    expect(calcProjectLeverage(inputs)).toBeNull();
  });

  it("all-cash deal -> 0%, not N/A", () => {
    expect(calcProjectLeverage({ ...baseInputs, financeSources: [] })).toBe(0);
  });
});

describe("Worked three-metric example (Phase 4.23.1, requirement 10/28)", () => {
  it("Purchase Price R1,000,000 / Estimated Value R1,400,000 / Total Investment R1,250,000 / Debt R800,000", () => {
    const inputs: DealInputs = { ...baseInputs, estimatedMarketValue: 1_400_000 };
    const metrics = calcAllMetrics(inputs);

    expect(metrics.purchaseLtv).toBeCloseTo(80, 6);
    expect(metrics.estimatedValueLtv).toBeCloseTo(57.142857, 4);
    expect(metrics.projectLeverage).toBeCloseTo(64, 6);

    // The three genuinely diverge — no single metric can stand in for the others.
    expect(metrics.purchaseLtv).not.toBeCloseTo(metrics.estimatedValueLtv!, 0);
    expect(metrics.purchaseLtv).not.toBeCloseTo(metrics.projectLeverage!, 0);
  });

  it("all-cash deal: every applicable leverage metric legitimately shows 0%, not N/A", () => {
    const inputs: DealInputs = { ...baseInputs, estimatedMarketValue: 1_400_000, financeSources: [] };
    const metrics = calcAllMetrics(inputs);
    expect(metrics.purchaseLtv).toBe(0);
    expect(metrics.estimatedValueLtv).toBe(0);
    expect(metrics.projectLeverage).toBe(0);
  });
});

describe("DealMetrics.ltv legacy alias (Phase 4.23.1, requirement 26)", () => {
  it("ltv always equals purchaseLtv exactly, for every scenario", () => {
    for (const scenario of [
      baseInputs,
      { ...baseInputs, purchasePrice: 2_500_000, financeSources: [{ loanAmount: 2_000_000, interestRate: 12, termYears: 20 }] },
      { ...baseInputs, financeSources: [] },
      { ...baseInputs, purchasePrice: 0 },
    ]) {
      const metrics = calcAllMetrics(scenario);
      expect(metrics.ltv).toBe(metrics.purchaseLtv);
    }
  });

  it("calcLTV() delegates directly to calcPurchaseLTV() — never a second formula", () => {
    expect(calcLTV(baseInputs)).toBe(calcPurchaseLTV(baseInputs));
  });
});

describe("VERDICT PARITY — Purchase LTV must produce IDENTICAL verdict behaviour to the old LTV metric (Phase 4.23.1, critical acceptance rule)", () => {
  const strategyId = "buy_to_let";

  it("classifying 'ltv' and 'purchaseLtv' for the same deal produces byte-identical MetricClassification objects", () => {
    for (const scenario of [
      baseInputs, // ~high leverage (80%) -> red under 60/75 bands
      { ...baseInputs, financeSources: [{ loanAmount: 400_000, interestRate: 11, termYears: 20 }] }, // 40% -> green
      { ...baseInputs, financeSources: [{ loanAmount: 650_000, interestRate: 11, termYears: 20 }] }, // 65% -> orange
      { ...baseInputs, financeSources: [] }, // 0% -> green
      { ...baseInputs, purchasePrice: 0 }, // not_applicable
    ]) {
      const metrics = calcAllMetrics(scenario);
      const ctx = applicabilityContextFromInputs(scenario);
      const legacy = classifyMetricForDeal("ltv", metrics.ltv, ctx, strategyId);
      const renamed = classifyMetricForDeal("purchaseLtv", metrics.purchaseLtv, ctx, strategyId);
      // Compare everything that drives actual behaviour (status, colour,
      // label, model, bands-derived classification) — the `reason` text is
      // deliberately reworded ("Purchase LTV" vs "LTV") for terminology
      // accuracy and is intentionally excluded from this equality check.
      const { reason: _legacyReason, ...legacyBehaviour } = legacy as Record<string, unknown>;
      const { reason: _renamedReason, ...renamedBehaviour } = renamed as Record<string, unknown>;
      void _legacyReason;
      void _renamedReason;
      expect(renamedBehaviour).toEqual(legacyBehaviour);
    }
  });

  it("Safety State / Overall Verdict are unchanged for a high-leverage deal (80% Purchase LTV -> red -> blocks Strong, exactly as the old LTV metric did)", () => {
    const metrics = calcAllMetrics(baseInputs);
    expect(metrics.purchaseLtv).toBe(80); // > 75 red cutoff
    const verdict = deriveDealVerdict({ strategyId, inputs: baseInputs, metrics });
    expect(verdict.status).toBe("available");
    if (verdict.status === "available") {
      // High LTV alone never independently creates High Risk (Phase 4.14) —
      // it can only ever block "strong". Confirm it's still doing exactly that.
      expect(verdict.verdict).not.toBe("strong");
      expect(verdict.categoryStates.safety).not.toBe("strong");
    }
  });

  it("Safety State / Overall Verdict are unchanged for a low-leverage deal (40% Purchase LTV -> green -> no leverage-driven downgrade)", () => {
    const inputs: DealInputs = {
      ...baseInputs,
      financeSources: [{ loanAmount: 400_000, interestRate: 11, termYears: 20 }],
    };
    const metrics = calcAllMetrics(inputs);
    expect(metrics.purchaseLtv).toBe(40); // <= 60 green cutoff
    const verdict = deriveDealVerdict({ strategyId, inputs, metrics });
    expect(verdict.status).toBe("available");
    if (verdict.status === "available") {
      // Safety must not be blocked BY LEVERAGE specifically at 40% — whatever
      // the overall verdict is, it is not because of a high_ltv reason.
      expect(verdict.reasons.some((r) => r.code === "high_ltv")).toBe(false);
    }
  });

  it("Estimated Value LTV and Project Leverage never appear in verdict reasons, blockers, or category states — informational only", () => {
    const inputs: DealInputs = { ...baseInputs, estimatedMarketValue: 1_400_000 };
    const metrics = calcAllMetrics(inputs);
    const verdict = deriveDealVerdict({ strategyId, inputs, metrics });
    expect(verdict.status).toBe("available");
    if (verdict.status === "available") {
      const allReasons = [...verdict.reasons, ...verdict.blockers];
      expect(allReasons.some((r) => r.metric === "estimatedValueLtv")).toBe(false);
      expect(allReasons.some((r) => r.metric === "projectLeverage")).toBe(false);
    }
  });

  it("thresholds.ts bands for purchaseLtv are byte-identical to the legacy ltv bands (60/75, lower-is-better)", async () => {
    const { getThresholdDefinition } = await import("../thresholds");
    const legacy = getThresholdDefinition("ltv", strategyId);
    const renamed = getThresholdDefinition("purchaseLtv", strategyId);
    expect(renamed?.bands).toEqual(legacy?.bands);
    expect(renamed?.model).toBe(legacy?.model);
  });

  it("estimatedValueLtv and projectLeverage have NO threshold definition — deliberately unclassified, never reusing Purchase LTV's bands", async () => {
    const { getThresholdDefinition } = await import("../thresholds");
    expect(getThresholdDefinition("estimatedValueLtv", strategyId)).toBeUndefined();
    expect(getThresholdDefinition("projectLeverage", strategyId)).toBeUndefined();
  });
});
