import { describe, it, expect } from "vitest";
import {
  calcAllMetrics,
  calcEffectiveMonthlyRevenue,
  calcMonthlyRepayment,
  type DealInputs,
} from "../index";

// Sample deal from AssetVerdict_Build_Prompts.md, PROMPT 21, cross-checked
// against real reference-app screenshots (the "70% LTV" shown there was
// computed against an earlier R7,000,000 purchase-price snapshot of the
// same deal, giving the R4,900,000 loan amount used below).
const bankRepayment = calcMonthlyRepayment(4_900_000, 15, 15);
const dcsrRepayment = calcMonthlyRepayment(2_600_000, 15.25, 15);

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
    { loanAmount: 2_600_000, interestRate: 15.25, termYears: 15, repaymentAmount: dcsrRepayment },
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
  holdingPeriodMonths: 6,
  expectedSalePrice: 0,
  holdingCostPerMonth: 0,
  instalmentAmount: 0,
  instalmentTerm: 240,
  instalmentRate: 0,
};

describe("calculation engine — sample deal", () => {
  // Verified against the real reference app: R4,900,000 @ 15%/15yr -> R68,579.77,
  // R2,600,000 @ 15.25%/15yr -> R36,835.49.
  it("computes amortised repayments matching the reference app", () => {
    expect(bankRepayment).toBeCloseTo(68_579.77, 0);
    expect(dcsrRepayment).toBeCloseTo(36_835.49, 0);
  });

  it("computes effective monthly revenue as rent x occupancy", () => {
    const effective = calcEffectiveMonthlyRevenue(sampleInputs);
    expect(effective).toBeCloseTo(176_000, -1); // 200,000 * 0.88
  });

  // Note: PROMPT 21's "≈31%" gross yield figure is copied from a different
  // mockup example (R131,325/mo revenue) elsewhere in the build plan, not
  // from this R200,000-rent sample deal. With this deal's own inputs,
  // grossYield = (200,000 * 0.88 * 12) / 5,055,000 ≈ 41.8%, which is what
  // we assert here.
  it("computes gross yield from this deal's own inputs", () => {
    const metrics = calcAllMetrics(sampleInputs);
    expect(metrics.grossYield).toBeCloseTo(41.8, 0);
  });

  it("computes a DSCR near or below 1.0 with both loans", () => {
    const metrics = calcAllMetrics(sampleInputs);
    expect(metrics.dscr).toBeLessThan(1.3);
    expect(metrics.dscr).toBeGreaterThan(0.5);
  });

  it("computes IRR and NPV as finite numbers", () => {
    const metrics = calcAllMetrics(sampleInputs);
    expect(Number.isFinite(metrics.irr)).toBe(true);
    expect(Number.isFinite(metrics.npv)).toBe(true);
  });
});
