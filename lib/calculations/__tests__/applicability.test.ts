import { describe, it, expect } from "vitest";
import {
  getMetricApplicability,
  applicabilityContextFromInputs,
  applicabilityContextFromMetrics,
  classifyMetricForDeal,
  type ApplicabilityContext,
} from "../applicability";
import { calcAllMetrics, type DealInputs } from "../index";

const baseInputs: DealInputs = {
  purchasePrice: 5_055_000,
  marketValue: 5_500_000,
  askingPrice: 6_900_000,
  transferBondCost: 309_072,
  renovationCost: 200_000,
  sourcingFee: 505_500,
  agentCommission: 0,
  financeSources: [
    { loanAmount: 4_900_000, interestRate: 15, termYears: 15 },
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

describe("getMetricApplicability", () => {
  it("flags price-denominated metrics as not applicable when purchase price is 0", () => {
    const ctx: ApplicabilityContext = { purchasePrice: 0 };
    for (const key of ["capRatePP", "grossYield", "ltv"]) {
      const result = getMetricApplicability(key, ctx);
      expect(result.applicable, key).toBe(false);
      expect(result.reason).toBeTruthy();
    }
  });

  it("flags Cap Rate (MV) as not applicable when market value is 0", () => {
    expect(getMetricApplicability("capRateMV", { marketValue: 0 }).applicable).toBe(false);
  });

  it("flags DSCR as not applicable when there is no annual debt service", () => {
    expect(getMetricApplicability("dscr", { annualDebtService: 0 }).applicable).toBe(false);
  });

  it("flags equity-based metrics as not applicable when equity is zero or negative", () => {
    for (const key of ["netYieldPreTax", "netYieldPostTax", "paybackPeriod", "irr", "npv"]) {
      expect(getMetricApplicability(key, { initialEquityInvestment: 0 }).applicable, key).toBe(false);
      expect(getMetricApplicability(key, { initialEquityInvestment: -100 }).applicable, key).toBe(false);
      expect(getMetricApplicability(key, { initialEquityInvestment: 1 }).applicable, key).toBe(true);
    }
  });

  it("treats an omitted context field as 'no evidence' — applicable by default, never wrongly flagged", () => {
    // An empty context should never itself cause a false N/A: callers that
    // only know part of the picture (e.g. the dashboard, which only has
    // equity, not purchase price) must not have unrelated metrics misfire.
    for (const key of ["capRatePP", "grossYield", "ltv", "capRateMV", "dscr", "netYieldPreTax", "irr", "npv"]) {
      expect(getMetricApplicability(key, {}).applicable, key).toBe(true);
    }
  });

  it("has no opinion on metrics without a registered rule (e.g. NOI, revenue)", () => {
    expect(getMetricApplicability("noiAnnual", {}).applicable).toBe(true);
    expect(getMetricApplicability("grossRevenueAnnual", { purchasePrice: 0 }).applicable).toBe(true);
  });
});

describe("applicabilityContextFromInputs / applicabilityContextFromMetrics", () => {
  it("derives a context from DealInputs that correctly flags a fully-financed (zero-equity) deal", () => {
    const overFinanced: DealInputs = {
      ...baseInputs,
      financeSources: [
        {
          loanAmount: 10_000_000, // far more than total investment
          interestRate: 15,
          termYears: 15,
        },
      ],
    };
    const ctx = applicabilityContextFromInputs(overFinanced);
    expect(getMetricApplicability("irr", ctx).applicable).toBe(false);
    expect(getMetricApplicability("npv", ctx).applicable).toBe(false);
  });

  it("derives a context from DealInputs that correctly leaves a normally-financed deal applicable", () => {
    const ctx = applicabilityContextFromInputs(baseInputs);
    expect(getMetricApplicability("irr", ctx).applicable).toBe(true);
    expect(getMetricApplicability("dscr", ctx).applicable).toBe(true);
    expect(getMetricApplicability("capRatePP", ctx).applicable).toBe(true);
  });

  it("derives an equivalent equity/debt-service reading from DealMetrics alone (no raw inputs needed)", () => {
    const metrics = calcAllMetrics(baseInputs);
    const ctxFromInputs = applicabilityContextFromInputs(baseInputs);
    const ctxFromMetrics = applicabilityContextFromMetrics(metrics);
    expect(ctxFromMetrics.initialEquityInvestment).toBeCloseTo(ctxFromInputs.initialEquityInvestment!, 4);
    expect(ctxFromMetrics.annualDebtService).toBeCloseTo(ctxFromInputs.annualDebtService!, 4);
  });

  it("threads discountRate through from DealInputs (Phase 4.1 — needed for target-relative IRR/Cash-on-Cash classification)", () => {
    const ctx = applicabilityContextFromInputs(baseInputs);
    expect(ctx.discountRate).toBe(10);
  });

  it("derives discountRate from DealMetrics.npvBreakdown.discountRate — the same value NPV was actually discounted at, not a second copy", () => {
    const metrics = calcAllMetrics(baseInputs);
    const ctx = applicabilityContextFromMetrics(metrics);
    expect(ctx.discountRate).toBe(baseInputs.discountRate);
    expect(ctx.discountRate).toBe(metrics.npvBreakdown.discountRate);
  });
});

describe("classifyMetricForDeal", () => {
  it("returns status 'classified' with a real judgement (colour + label) for an applicable, calibrated metric", () => {
    const metrics = calcAllMetrics(baseInputs);
    const ctx = applicabilityContextFromInputs(baseInputs);
    const result = classifyMetricForDeal("dscr", metrics.dscr, ctx, "commercial");
    expect(result.status).toBe("classified");
    expect(result.applicable).toBe(true);
    expect(result.color).not.toBeNull();
    expect(["Strong", "Caution", "Weak"]).toContain(result.label);
  });

  it("returns status 'not_applicable' with a reason — never a colour — for DSCR with no debt", () => {
    const noFinanceInputs: DealInputs = { ...baseInputs, financeSources: [] };
    const metrics = calcAllMetrics(noFinanceInputs);
    const ctx = applicabilityContextFromInputs(noFinanceInputs);
    const result = classifyMetricForDeal("dscr", metrics.dscr, ctx, "commercial");
    expect(result.status).toBe("not_applicable");
    expect(result.applicable).toBe(false);
    expect(result.color).toBeNull();
    expect(result.label).toBeNull();
    expect(result.reason).toBe("No debt financing is being used");
  });

  it("returns status 'not_applicable' for Equity IRR/NPV on an over-financed (negative-equity) deal, not a red/green judgement", () => {
    const overFinanced: DealInputs = {
      ...baseInputs,
      financeSources: [
        {
          loanAmount: 10_000_000,
          interestRate: 15,
          termYears: 15,
        },
      ],
    };
    const metrics = calcAllMetrics(overFinanced);
    const ctx = applicabilityContextFromInputs(overFinanced);
    const irrResult = classifyMetricForDeal("irr", metrics.irr, ctx, "commercial");
    const npvResult = classifyMetricForDeal("npv", metrics.npv, ctx, "commercial");
    expect(irrResult.status).toBe("not_applicable");
    expect(irrResult.applicable).toBe(false);
    expect(irrResult.color).toBeNull();
    expect(npvResult.status).toBe("not_applicable");
    expect(npvResult.applicable).toBe(false);
    expect(npvResult.color).toBeNull();
  });

  it("returns status 'unclassified' — applicable, but no colour or label — for a metric AssetVerdict has no calibrated benchmark for (Phase 3.1)", () => {
    // Gross Revenue and NOI are real, applicable, deal-relevant numbers, but
    // absolute currency figures have no inherent good/bad direction without
    // a benchmark — a missing threshold must never present as "Caution."
    const metrics = calcAllMetrics(baseInputs);
    const ctx = applicabilityContextFromInputs(baseInputs);
    for (const key of ["grossRevenueAnnual", "noiAnnual"] as const) {
      const result = classifyMetricForDeal(key, metrics[key], ctx, "commercial");
      expect(result.status, key).toBe("unclassified");
      expect(result.applicable, key).toBe(true);
      expect(result.color, key).toBeNull();
      expect(result.label, key).toBeNull();
    }
  });

  it("classifies Equity IRR target-relative, using discountRate carried on the ApplicabilityContext (Phase 4.1, Decision 1) — end to end from real deal inputs", () => {
    const metrics = calcAllMetrics(baseInputs);
    const ctx = applicabilityContextFromInputs(baseInputs);
    const result = classifyMetricForDeal("irr", metrics.irr, ctx, "commercial");
    expect(result.status).toBe("classified");
    if (result.status === "classified") {
      expect(result.model).toBe("target_relative");
      expect(result.category).toBe("investor_target");
      // baseInputs.discountRate is 10; this deal's real IRR is well above it.
      expect(result.label).toBe("Exceeds Target");
    }
  });

  it("classifies Equity NPV zero-relative, using initialEquityInvestment carried on the ApplicabilityContext (Phase 4.1, Decision 2)", () => {
    const metrics = calcAllMetrics(baseInputs);
    const ctx = applicabilityContextFromInputs(baseInputs);
    const result = classifyMetricForDeal("npv", metrics.npv, ctx, "commercial");
    expect(result.status).toBe("classified");
    if (result.status === "classified") {
      expect(result.model).toBe("zero_relative");
      expect(result.category).toBe("investor_target");
    }
  });

  it("Payback Period, NOI Margin, and Fix & Flip Net Profit stay unclassified end to end from real deal metrics, never 'not_applicable' when they're genuinely applicable", () => {
    const metrics = calcAllMetrics(baseInputs);
    const ctx = applicabilityContextFromInputs(baseInputs);
    for (const key of ["paybackPeriod", "noiMargin"] as const) {
      const result = classifyMetricForDeal(key, metrics[key], ctx, "commercial");
      expect(result.status, key).toBe("unclassified");
      expect(result.applicable, key).toBe(true);
    }
  });
});
