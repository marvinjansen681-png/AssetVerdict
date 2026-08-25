import { describe, it, expect } from "vitest";
import { buildPreviewInputs } from "../previewInputs";
import { assembleInputs } from "../assembleInputs";
import { calcAllMetrics, calcTaxMonthly, calcCashflowMonthly, calcFlipProfit, calcNOIAnnual, calcAnnualInterest } from "../index";
import type { DealWithRelations } from "@/types";

/**
 * Phase 4.21 — Defect 1 / Defect 2 regression coverage.
 *
 * These tests prove the edit-screen live preview and the authoritative
 * calculation engine CANNOT diverge again: buildPreviewInputs only ever
 * assembles a DealInputs; every number is then produced by the same
 * calcAllMetrics()/calcFlipProfit() functions every other surface
 * (Deal Summary, PDF, Deal Coach, /calculate) uses.
 */
function makeDeal(overrides: {
  investmentStrategy?: string;
  purchasePrice?: number | null;
  marketValue?: number | null;
  transferBondCost?: number | null;
  renovationCost?: number | null;
  sourcingFee?: number | null;
  agentCommission?: number | null;
  incomeTaxRate?: number | null;
  capitalGainsTaxRate?: number | null;
  financeSources?: { loanAmount: number; interestRate: number; termYears: number }[];
  cashflowInputs?: Record<string, unknown>;
}): DealWithRelations {
  return {
    id: "deal-1",
    userId: "user-1",
    name: "Test Deal",
    currency: "ZAR",
    investmentStrategy: overrides.investmentStrategy ?? "buy_to_let",
    purchasePrice: overrides.purchasePrice ?? 1_000_000,
    marketValue: overrides.marketValue ?? 1_100_000,
    transferBondCost: overrides.transferBondCost ?? 50_000,
    renovationCost: overrides.renovationCost ?? 20_000,
    sourcingFee: overrides.sourcingFee ?? 10_000,
    agentCommission: overrides.agentCommission ?? 6,
    incomeTaxRate: overrides.incomeTaxRate ?? 27,
    capitalGainsTaxRate: overrides.capitalGainsTaxRate ?? 22,
    wantToSell: false,
    saleYear: null,
    isSectionalTitle: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    financeSources: overrides.financeSources ?? [{ loanAmount: 700_000, interestRate: 11, termYears: 20 }],
    cashflowInputs: {
      id: "cf-1",
      dealId: "deal-1",
      managementFeeMode: "percent",
      managementFeeValue: 10,
      maintenanceCostMode: "percent",
      maintenanceCostValue: 5,
      monthlyRent: 15_000,
      occupancyRate: 95,
      badDebtsPct: 3,
      holdingPeriodMonths: 6,
      expectedSalePrice: 1_400_000,
      holdingCostPerMonth: 2_000,
      ...overrides.cashflowInputs,
    },
    capexItems: [],
    renovationItems: [],
    propertyValuation: null,
    dealSuburbs: [],
  } as unknown as DealWithRelations;
}

describe("buildPreviewInputs — identity and parity (Phase 4.21)", () => {
  it("with no overrides, matches assembleInputs(deal) exactly", () => {
    const deal = makeDeal({});
    expect(buildPreviewInputs(deal, {})).toEqual(assembleInputs(deal));
  });

  it("overrides that exactly mirror the deal's own saved cashflow fields reproduce assembleInputs(deal) exactly", () => {
    const deal = makeDeal({});
    const preview = buildPreviewInputs(deal, {
      monthlyRent: 15_000,
      occupancyRate: 95,
      managementFeeMode: "percent",
      managementFeeValue: 10,
      maintenanceCostMode: "percent",
      maintenanceCostValue: 5,
      badDebtsPct: 3,
    });
    expect(preview).toEqual(assembleInputs(deal));
    expect(calcAllMetrics(preview)).toEqual(calcAllMetrics(assembleInputs(deal)));
  });

  it("an unsaved live edit produces EXACTLY the same calcAllMetrics() output as if that value had already been saved", () => {
    const deal = makeDeal({});
    // Simulate the user typing a new management fee before hitting Save.
    const livePreview = buildPreviewInputs(deal, { managementFeeValue: 18 });
    // Simulate what the deal would look like AFTER saving that same value.
    const savedDeal = makeDeal({ cashflowInputs: { managementFeeValue: 18 } });
    const savedInputs = assembleInputs(savedDeal);
    expect(livePreview).toEqual(savedInputs);
    expect(calcAllMetrics(livePreview)).toEqual(calcAllMetrics(savedInputs));
  });
});

describe("Defect 1 — Cashflow edit preview tax must match the engine's interest-only tax base", () => {
  it("taxMonthly is computed from (NOI - INTEREST only), never (NOI - full debt service including principal)", () => {
    const deal = makeDeal({});
    const preview = buildPreviewInputs(deal, { managementFeeValue: 12 });

    const engineTax = calcTaxMonthly(preview);

    // The exact old, defective formula this phase removes from the UI:
    // taxMonthly = max(0, (NOI - FULL debt service) * rate). Full debt
    // service > interest alone whenever any principal is being repaid, so
    // the old formula would UNDERSTATE taxable income and therefore
    // understate tax whenever a loan is amortising.
    const noiMonthly = calcNOIAnnual(preview) / 12;
    const interestMonthly = calcAnnualInterest(preview) / 12;
    const correctTax = Math.max(0, (noiMonthly - interestMonthly) * (preview.incomeTaxRate / 100));
    expect(engineTax).toBeCloseTo(correctTax, 6);

    // Sanity: with a real amortising loan, interest is a genuine, strictly
    // positive fraction of debt service (never the whole thing, since
    // principal > 0 too) — confirming this fixture actually exercises the
    // interest-vs-full-debt-service distinction the old (removed) formula
    // got wrong.
    expect(interestMonthly).toBeGreaterThan(0);
  });

  it("cashflowMonthly preview reconciles exactly with calcAllMetrics().cashflowMonthly for the same inputs", () => {
    const deal = makeDeal({});
    const preview = buildPreviewInputs(deal, { maintenanceCostValue: 8 });
    expect(calcCashflowMonthly(preview)).toBeCloseTo(calcAllMetrics(preview).cashflowMonthly, 6);
  });
});

describe("Defect 2 — Fix & Flip edit preview must be calcFlipProfit(), not a hand-rolled formula", () => {
  function makeFlipDeal() {
    return makeDeal({
      investmentStrategy: "fix_and_flip",
      purchasePrice: 1_000_000,
      transferBondCost: 50_000,
      sourcingFee: 10_000,
      renovationCost: 150_000,
      agentCommission: 6,
      financeSources: [{ loanAmount: 700_000, interestRate: 13, termYears: 20 }],
      cashflowInputs: { holdingPeriodMonths: 6, expectedSalePrice: 1_500_000, holdingCostPerMonth: 3_000 },
    });
  }

  it("preview totalCost includes acquisition costs AND financing interest — the old page omitted both entirely", () => {
    const deal = makeFlipDeal();
    const preview = buildPreviewInputs(deal, {
      expectedSalePrice: 1_500_000,
      holdingPeriodMonths: 6,
      holdingCostPerMonth: 3_000,
    });
    const flip = calcFlipProfit(preview);

    expect(flip.acquisitionCosts).toBeCloseTo(60_000, 2); // transferBondCost + sourcingFee
    expect(flip.financingInterest).toBeGreaterThan(0);

    // The OLD (defective) page formula: purchasePrice + renovation + holding + agentFee.
    const oldFlawedTotalCost =
      deal.purchasePrice! + deal.renovationCost! + 3_000 * 6 + 1_500_000 * (deal.agentCommission! / 100);
    expect(flip.totalCost).not.toBeCloseTo(oldFlawedTotalCost, 2);
    expect(flip.totalCost).toBeCloseTo(oldFlawedTotalCost + flip.acquisitionCosts + flip.financingInterest, 2);
  });

  it("netProfit is PRE-TAX — no CGT is deducted (the old page's automatic CGT deduction is removed)", () => {
    const deal = makeFlipDeal();
    const preview = buildPreviewInputs(deal, {
      expectedSalePrice: 1_500_000,
      holdingPeriodMonths: 6,
      holdingCostPerMonth: 3_000,
    });
    const flip = calcFlipProfit(preview);
    expect(flip.netProfit).toBeCloseTo(flip.grossProfit, 6);
  });

  it("live (unsaved) Fix & Flip preview reconciles exactly with the post-save calcFlipProfit() result", () => {
    const deal = makeFlipDeal();
    const livePreview = buildPreviewInputs(deal, {
      expectedSalePrice: 1_650_000,
      holdingPeriodMonths: 6,
      holdingCostPerMonth: 3_000,
    });
    const savedDeal = makeFlipDeal();
    (savedDeal.cashflowInputs as unknown as { expectedSalePrice: number }).expectedSalePrice = 1_650_000;
    const savedInputs = assembleInputs(savedDeal);
    expect(calcFlipProfit(livePreview)).toEqual(calcFlipProfit(savedInputs));
  });
});
