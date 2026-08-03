import { describe, it, expect } from "vitest";
import {
  calcAllMetrics,
  calcGrossRevenueAnnual,
  calcFlipProfit,
  type DealInputs,
} from "../index";

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
  managementFeeValue: 15,
  managementFeeMode: "percent",
  maintenanceCostValue: 5,
  maintenanceCostMode: "percent",
  levies: 0,
  ratesAndTaxes: 0,
  insurance: 0,
  waterSewerage: 0,
  securityCleaning: 0,
  electricity: 0,
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
  holdingPeriodMonths: 6,
  expectedSalePrice: 0,
  holdingCostPerMonth: 0,
  instalmentAmount: 0,
  instalmentTerm: 240,
  instalmentRate: 0,
};

describe("strategy-specific revenue calculations", () => {
  it("Buy to Let: uses standard monthly rent x occupancy", () => {
    const inputs: DealInputs = {
      ...baseInputs,
      strategy: "buy_to_let",
      purchasePrice: 1_500_000,
      monthlyRent: 12_000,
      occupancyRate: 92,
      managementFeeValue: 10,
    };
    const metrics = calcAllMetrics(inputs);
    expect(metrics.grossYield).toBeGreaterThan(8);
  });

  it("HMO (multi_let): grossRevenue = rooms x pricePerRoom x occupancy x 12", () => {
    const inputs: DealInputs = {
      ...baseInputs,
      strategy: "multi_let",
      purchasePrice: 2_000_000,
      numUnits: 6,
      pricePerRoom: 4_000,
      occupancyRate: 85,
      managementFeeValue: 15,
      billsIncluded: true,
    };
    const expected = 6 * 4000 * 0.85 * 12;
    expect(calcGrossRevenueAnnual(inputs)).toBeCloseTo(expected, 0);
  });

  it("Student: annualRevenue = rooms x pricePerWeek x academicWeeks x occupancy", () => {
    const inputs: DealInputs = {
      ...baseInputs,
      strategy: "student",
      numUnits: 10,
      pricePerRoom: 3_500,
      academicYearWeeks: 42,
      occupancyRate: 95,
    };
    const expected = 10 * 3500 * 42 * 0.95;
    expect(calcGrossRevenueAnnual(inputs)).toBeCloseTo(expected, -1);
  });

  it("STR: grossRevenue = nightlyRate x occupiedNights", () => {
    const inputs: DealInputs = {
      ...baseInputs,
      strategy: "str",
      nightlyRate: 850,
      avgOccupiedNights: 200,
      platformFeesPct: 15,
    };
    const expected = 850 * 200;
    expect(calcGrossRevenueAnnual(inputs)).toBeCloseTo(expected, 0);
  });

  it("Fix & Flip: netProfit and roi computed via calcFlipProfit", () => {
    // Note: the V2 plan's own worked example for these inputs claims "roi > 20%",
    // but with holdingCostPerMonth left at its default (0, unspecified in the
    // plan), totalCost = 1,200,000 + 300,000 + 0 + (1,950,000*5%) = 1,597,500;
    // grossProfit = 352,500; netProfit after 22% CGT = 274,950; roi = 17.21%.
    // We assert the correctly-derived value rather than the plan's approximate one.
    const inputs: DealInputs = {
      ...baseInputs,
      strategy: "fix_and_flip",
      purchasePrice: 1_200_000,
      renovationCost: 300_000,
      expectedSalePrice: 1_950_000,
      holdingPeriodMonths: 8,
      agentCommission: 5,
      capitalGainsTaxRate: 22,
    };
    const flip = calcFlipProfit(inputs);
    expect(flip.netProfit).toBeGreaterThan(0);
    expect(flip.roi).toBeCloseTo(17.21, 1);

    // Strategy-branched revenue must be zero — profit is a lump event, not cashflow.
    expect(calcGrossRevenueAnnual(inputs)).toBe(0);
  });

  it("Instalment Sale: grossRevenue = instalmentAmount x 12", () => {
    const inputs: DealInputs = {
      ...baseInputs,
      strategy: "instalment_sale",
      purchasePrice: 2_500_000,
      instalmentAmount: 35_000,
      instalmentTerm: 240,
    };
    const expected = 35_000 * 12;
    expect(calcGrossRevenueAnnual(inputs)).toBeCloseTo(expected, 0);
  });
});
