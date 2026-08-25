import { describe, it, expect } from "vitest";
import { calcFurnitureCostSummary, calcFurnitureItemBudgetCost, type FurnitureLineItemInput } from "../furnitureCosts";
import {
  calcAllMetrics,
  calcTotalInvestment,
  calcInitialEquityInvestment,
  type DealInputs,
} from "../index";

/**
 * Phase 4.22, requirements 17-18: prove Furniture/Setup Cost Used flows into
 * Total Investment exactly once, and that every downstream return metric
 * updates deterministically from that same authoritative number — nothing
 * downstream is manually re-derived, it changes purely because
 * calcTotalInvestment's own input changed.
 */
const baseInputs: DealInputs = {
  purchasePrice: 2_000_000,
  marketValue: 2_200_000,
  askingPrice: 2_300_000,
  transferBondCost: 150_000,
  renovationCost: 0, // set per-test from calcFurnitureCostSummary
  sourcingFee: 50_000,
  agentCommission: 5,
  financeSources: [{ loanAmount: 1_400_000, interestRate: 11, termYears: 20 }],
  wantToSell: false,
  saleYear: null,
  monthlyRent: 30_000, // positive pre-tax cashflow, so the "more equity -> lower %" intuition below actually holds
  occupancyRate: 95,
  additionalIncome: 0,
  recoveries: 0,
  managementFeeValue: 10,
  managementFeeMode: "percent",
  maintenanceCostValue: 5,
  maintenanceCostMode: "percent",
  levies: 0,
  ratesAndTaxes: 2_000,
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
};

describe("Total Investment reconciliation (Phase 4.22, requirement 17)", () => {
  it("Purchase Price + Transfer/Bond + Sourcing + Furniture Cost Used = Total Investment, exactly", () => {
    const items = [
      { category: "Bedroom Furniture", budgeted: 60_000, quoted: 70_000, quantity: null, unitCost: null },
      { category: "Kitchen Equipment", budgeted: 30_000, quoted: null, quantity: null, unitCost: null },
    ];
    const summary = calcFurnitureCostSummary(items, 10);
    // Cost Used: 70,000 (quote wins) + 30,000 (no quote) = 100,000; + 10% contingency = 110,000.
    expect(summary.grandTotal).toBe(110_000);

    const inputs: DealInputs = { ...baseInputs, renovationCost: summary.grandTotal };
    const expectedTotalInvestment =
      inputs.purchasePrice + inputs.transferBondCost + inputs.sourcingFee + summary.grandTotal;
    expect(calcTotalInvestment(inputs)).toBe(expectedTotalInvestment);
    expect(calcTotalInvestment(inputs)).toBe(2_310_000); // 2,000,000 + 150,000 + 50,000 + 110,000
  });

  it("appears exactly once — Total Investment does not also add Budget alongside Cost Used", () => {
    const items = [{ category: "Bedroom Furniture", budgeted: 25_000, quoted: 32_000, quantity: null, unitCost: null }];
    const summary = calcFurnitureCostSummary(items, null);
    const inputs: DealInputs = { ...baseInputs, renovationCost: summary.grandTotal };
    const totalInvestment = calcTotalInvestment(inputs);
    const doubleCountedWrong =
      inputs.purchasePrice + inputs.transferBondCost + inputs.sourcingFee + 25_000 + 32_000;
    expect(totalInvestment).not.toBe(doubleCountedWrong);
    expect(totalInvestment).toBe(inputs.purchasePrice + inputs.transferBondCost + inputs.sourcingFee + 32_000);
  });
});

describe("Downstream returns respond deterministically to a furniture cost change (Phase 4.22, requirement 18)", () => {
  it("Furniture Cost Used R100,000 -> R150,000 increases Total Investment by exactly R50,000, and every downstream metric reconciles to the unmodified engine", () => {
    const lowInputs: DealInputs = { ...baseInputs, renovationCost: 100_000 };
    const highInputs: DealInputs = { ...baseInputs, renovationCost: 150_000 };

    const totalInvestmentDelta = calcTotalInvestment(highInputs) - calcTotalInvestment(lowInputs);
    expect(totalInvestmentDelta).toBe(50_000);

    const equityDelta = calcInitialEquityInvestment(highInputs) - calcInitialEquityInvestment(lowInputs);
    // No financing change between the two — the extra cost is pure
    // additional equity required (Total Investment rose, loan amount did
    // not), so equity must rise by exactly the same R50,000.
    expect(equityDelta).toBe(50_000);

    const lowMetrics = calcAllMetrics(lowInputs);
    const highMetrics = calcAllMetrics(highInputs);

    // Nothing here is manually re-derived — every figure below is read
    // straight from calcAllMetrics(), proving the change flows through the
    // unmodified engine deterministically.
    expect(highMetrics.totalInvestment - lowMetrics.totalInvestment).toBe(50_000);
    expect(highMetrics.depositRequired - lowMetrics.depositRequired).toBe(50_000);
    // A larger equity base for the same cashflow numerator means Cash-on-
    // Cash Return and IRR must be lower (or equal), never higher.
    expect(highMetrics.netYieldPreTax).toBeLessThanOrEqual(lowMetrics.netYieldPreTax);
    expect(highMetrics.irr).toBeLessThanOrEqual(lowMetrics.irr);
    expect(highMetrics.npv).toBeLessThan(lowMetrics.npv); // strictly lower initial outlay for the same projected cashflows
    expect(highMetrics.paybackPeriod).toBeGreaterThanOrEqual(lowMetrics.paybackPeriod);
  });
});

describe("Preview/persisted parity (Phase 4.22, requirement 20)", () => {
  it("the client's live-preview grand total and the server's post-save recomputed grand total are identical for the same raw inputs", () => {
    // The "live preview" path: items as the UI holds them (client may have
    // computed budgeted locally too, e.g. via the same updateItem logic).
    const clientItems: FurnitureLineItemInput[] = [
      { category: "Bedroom Furniture", budgeted: 25_000, quoted: null, quantity: 10, unitCost: 2_500 },
      { category: "Kitchen Equipment", budgeted: 18_000, quoted: 21_000, quantity: null, unitCost: null },
    ];
    const clientPreview = calcFurnitureCostSummary(clientItems, 10);

    // The "server persistence" path: recompute budgetCost from primitives
    // exactly as upsertRenovationItems does before ever calling
    // calcFurnitureCostSummary — proving the two call sites can never drift
    // even if the client's own locally-cached `budgeted` were wrong/stale.
    const serverRecomputed: FurnitureLineItemInput[] = clientItems.map((i) => ({
      ...i,
      budgeted: calcFurnitureItemBudgetCost(i) ?? 0,
    }));
    const serverSaved = calcFurnitureCostSummary(serverRecomputed, 10);

    expect(serverSaved.grandTotal).toBe(clientPreview.grandTotal);
    expect(serverSaved).toEqual(clientPreview);
  });
});
