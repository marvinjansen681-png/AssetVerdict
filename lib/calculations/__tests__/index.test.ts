import { describe, it, expect } from "vitest";
import {
  calcAllMetrics,
  calcEffectiveMonthlyRevenue,
  calcMonthlyRepayment,
  calcIRR,
  calcNPV,
  calcDSCR,
  calcLTV,
  calcCapRatePP,
  calcCapRateMV,
  calcGrossYield,
  calcNetYieldPreTax,
  calcNetYieldPostTax,
  calcPaybackPeriod,
  calcOperatingExpenseRatio,
  calcBreakEvenRatio,
  calcNOIMargin,
  calcNOIAnnual,
  calcTotalInvestment,
  calcTotalLoanAmount,
  calcDepositRequired,
  calcInitialEquityInvestment,
  calcTotalRemainingLoanBalance,
  calcCashflowAnnual,
  buildEquityCashflows,
  calcNPVBreakdown,
  calcIRRSummary,
  calcOperatingExpensesAnnual,
  calcAnnualDebtService,
  calcTerminalValue,
  calc20YearProjection,
  calcAnnualDebtServiceForYear,
  calcHoldPeriodYears,
  calcBillsIncludedMonthly,
  calcBillsIncludedUnitCount,
  calcOperatingCostsMonthly,
  calcExitSummary,
  calcStudentCapacity,
  isFiniteNumber,
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

// ---------------------------------------------------------------------------
// Edge-case fixtures
// ---------------------------------------------------------------------------

/** All-cash purchase: no finance sources, so no debt service anywhere. Equity == Total Investment. */
const noFinanceInputs: DealInputs = {
  ...sampleInputs,
  financeSources: [],
};

/**
 * A realistic, partially-financed deal with POSITIVE equity: just the single
 * primary bank loan from `sampleInputs` (the second loan there is a
 * deliberate over-leverage stress fixture for DSCR — see below). This is the
 * base fixture for all Equity IRR / Equity NPV / Cash-on-Cash tests, since
 * `sampleInputs` itself has NEGATIVE initial equity (its two loans total
 * R7.5M against a R6.07M total investment) and is kept only for the
 * pre-existing DSCR-under-stress and cost-ratio tests that don't depend on
 * the sign of equity.
 */
const leveredSampleInputs: DealInputs = {
  ...sampleInputs,
  financeSources: [sampleInputs.financeSources[0]],
};

/** Heavily geared deal: a single loan far exceeding purchase price — negative equity. */
const highLeverageInputs: DealInputs = {
  ...sampleInputs,
  financeSources: [
    {
      loanAmount: 9_000_000,
      interestRate: 15,
      termYears: 15,
      repaymentAmount: calcMonthlyRepayment(9_000_000, 15, 15),
    },
  ],
};

/** Loan amount exactly equal to total investment — initial equity is exactly zero. */
const zeroEquityInputs: DealInputs = {
  ...sampleInputs,
  financeSources: [
    {
      loanAmount: calcTotalInvestment(sampleInputs),
      interestRate: 15,
      termYears: 15,
      repaymentAmount: calcMonthlyRepayment(calcTotalInvestment(sampleInputs), 15, 15),
    },
  ],
};

/** Fully vacant property: zero occupancy drives gross revenue to zero. */
const zeroRevenueInputs: DealInputs = {
  ...sampleInputs,
  occupancyRate: 0,
  additionalIncome: 0,
  recoveries: 0,
};

/** Zero purchase price — a degenerate input that price-denominated ratios must guard against. */
const zeroPurchasePriceInputs: DealInputs = {
  ...sampleInputs,
  purchasePrice: 0,
};

/** Zero total investment (every acquisition cost line is zero) — for ratios denominated in total investment. */
const zeroTotalInvestmentInputs: DealInputs = {
  ...sampleInputs,
  purchasePrice: 0,
  transferBondCost: 0,
  renovationCost: 0,
  sourcingFee: 0,
};

/**
 * Deep negative cashflow, based on the single-loan (positive-equity) fixture
 * so that Equity-based ratios produce a real, meaningful negative number
 * rather than hitting the "no positive equity" guard.
 */
const negativeCashflowInputs: DealInputs = {
  ...leveredSampleInputs,
  monthlyRent: 20_000,
  occupancyRate: 50,
};

// ---------------------------------------------------------------------------
// Initial Equity Investment
// ---------------------------------------------------------------------------

describe("calcInitialEquityInvestment", () => {
  it("equals Total Investment − Total Loan Amount, and matches calcDepositRequired", () => {
    for (const inputs of [sampleInputs, leveredSampleInputs, noFinanceInputs, highLeverageInputs]) {
      const expected = calcTotalInvestment(inputs) - calcTotalLoanAmount(inputs);
      expect(calcInitialEquityInvestment(inputs)).toBeCloseTo(expected, 6);
      expect(calcInitialEquityInvestment(inputs)).toBeCloseTo(calcDepositRequired(inputs), 6);
    }
  });

  it("equals Total Investment for an all-cash purchase (no debt raised)", () => {
    expect(calcInitialEquityInvestment(noFinanceInputs)).toBeCloseTo(
      calcTotalInvestment(noFinanceInputs),
      6
    );
  });

  it("is negative when the loan amount exceeds total investment (over-financed deal)", () => {
    expect(calcInitialEquityInvestment(highLeverageInputs)).toBeLessThan(0);
  });

  it("is exactly zero when the loan amount exactly equals total investment", () => {
    expect(calcInitialEquityInvestment(zeroEquityInputs)).toBeCloseTo(0, 4);
  });
});

// ---------------------------------------------------------------------------
// buildEquityCashflows — the shared stream behind Equity IRR and Equity NPV
// ---------------------------------------------------------------------------

describe("buildEquityCashflows", () => {
  it("year 0 is -Initial Equity Investment, not -Total Investment", () => {
    const cashflows = buildEquityCashflows(leveredSampleInputs);
    expect(cashflows[0]).toBeCloseTo(-calcInitialEquityInvestment(leveredSampleInputs), 4);
    expect(cashflows[0]).not.toBeCloseTo(-calcTotalInvestment(leveredSampleInputs), 4);
  });

  it("has 21 entries: year 0 through year 20", () => {
    expect(buildEquityCashflows(leveredSampleInputs)).toHaveLength(21);
  });

  it("years 1-19 equal calc20YearProjection's after-debt-service, after-tax cashflow", () => {
    const cashflows = buildEquityCashflows(leveredSampleInputs);
    const annualCashflow = calcCashflowAnnual(leveredSampleInputs, false);
    // Year 1 has no growth escalation yet, so it matches the flat annual figure directly.
    expect(cashflows[1]).toBeCloseTo(annualCashflow, 0);
  });

  it("year 20 includes a positive terminal value on top of that year's operating cashflow", () => {
    const cashflows = buildEquityCashflows(leveredSampleInputs);
    const annualCashflow = calcCashflowAnnual(leveredSampleInputs, false);
    // With 3% capital growth over 20 years, terminal value should dwarf a single year's cashflow.
    expect(cashflows[20]).toBeGreaterThan(annualCashflow * 5);
  });
});

// ---------------------------------------------------------------------------
// Phase 2 education-layer support: calcNPVBreakdown, calcIRRSummary, and the
// newly-public calcOperatingExpensesAnnual / calcAnnualDebtService /
// calcTerminalValue. These must reconcile exactly with the numbers calcNPV /
// calcIRR / calcOperatingExpenseRatio / calcDSCR already produce — the
// education layer is not allowed to show a different number than the engine.
// ---------------------------------------------------------------------------

describe("calcNPVBreakdown", () => {
  it("reconciles to calcNPV(): initialEquity, PV(cashflows), and PV(terminal) combine to the same NPV", () => {
    const breakdown = calcNPVBreakdown(leveredSampleInputs);
    const npv = calcNPV(leveredSampleInputs);
    expect(breakdown.npv).toBeCloseTo(npv, 4);
    expect(
      breakdown.presentValueOfOperatingCashflows + breakdown.presentValueOfTerminalValue - breakdown.initialEquityInvestment
    ).toBeCloseTo(npv, 4);
  });

  it("initialEquityInvestment matches calcInitialEquityInvestment()", () => {
    expect(calcNPVBreakdown(leveredSampleInputs).initialEquityInvestment).toBeCloseTo(
      calcInitialEquityInvestment(leveredSampleInputs),
      4
    );
  });

  it("carries the discount rate used", () => {
    expect(calcNPVBreakdown(leveredSampleInputs).discountRate).toBe(leveredSampleInputs.discountRate);
  });

  it("stays finite for an all-cash deal", () => {
    const breakdown = calcNPVBreakdown(noFinanceInputs);
    expect(Number.isFinite(breakdown.npv)).toBe(true);
    expect(Number.isFinite(breakdown.presentValueOfOperatingCashflows)).toBe(true);
    expect(Number.isFinite(breakdown.presentValueOfTerminalValue)).toBe(true);
  });
});

describe("calcIRRSummary", () => {
  it("reconciles: irr matches calcIRR(), initialEquityInvestment matches calcInitialEquityInvestment()", () => {
    const summary = calcIRRSummary(leveredSampleInputs);
    expect(summary.irr).toBeCloseTo(calcIRR(leveredSampleInputs), 6);
    expect(summary.initialEquityInvestment).toBeCloseTo(calcInitialEquityInvestment(leveredSampleInputs), 4);
  });

  it("totalProjectedCashflow equals the sum of all 20 years' cashflowForPeriod", () => {
    const summary = calcIRRSummary(leveredSampleInputs);
    const projection = calc20YearProjection(leveredSampleInputs);
    const expected = projection.reduce((sum, p) => sum + p.cashflowForPeriod, 0);
    expect(summary.totalProjectedCashflow).toBeCloseTo(expected, 4);
  });

  it("terminalValueAtExit matches calcTerminalValue() for the same 20-year projection", () => {
    const summary = calcIRRSummary(leveredSampleInputs);
    const projection = calc20YearProjection(leveredSampleInputs);
    expect(summary.terminalValueAtExit).toBeCloseTo(calcTerminalValue(leveredSampleInputs, projection, 20), 4);
  });

  it("holdPeriodYears defaults to 20 when wantToSell is not set", () => {
    expect(calcIRRSummary(leveredSampleInputs).holdPeriodYears).toBe(20);
  });
});

describe("calcOperatingExpensesAnnual / calcAnnualDebtService (now public for breakdown display)", () => {
  it("calcOperatingExpensesAnnual reconciles with calcOperatingExpenseRatio", () => {
    const opex = calcOperatingExpensesAnnual(leveredSampleInputs);
    const grossRevenue = calcEffectiveMonthlyRevenue(leveredSampleInputs) * 12;
    expect((opex / grossRevenue) * 100).toBeCloseTo(calcOperatingExpenseRatio(leveredSampleInputs), 6);
  });

  it("calcAnnualDebtService reconciles with calcDSCR's denominator", () => {
    const debtService = calcAnnualDebtService(leveredSampleInputs);
    const noi = calcNOIAnnual(leveredSampleInputs);
    expect(noi / debtService).toBeCloseTo(calcDSCR(leveredSampleInputs), 6);
  });

  it("calcAnnualDebtService is 0 for an all-cash deal", () => {
    expect(calcAnnualDebtService(noFinanceInputs)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// NPV (Equity NPV)
// ---------------------------------------------------------------------------

describe("calcNPV", () => {
  it("subtracts the initial EQUITY investment (not total investment) at a punitively high discount rate", () => {
    // At a punitively high discount rate, the present value of every future
    // cashflow and the terminal value collapses toward zero, so NPV should
    // converge on -Initial Equity Investment. Before the Phase 1 fix, calcNPV
    // never subtracted anything; before the Phase 1.1 fix, it subtracted the
    // unlevered Total Investment instead of the investor's actual equity.
    const punitiveDiscountInputs: DealInputs = { ...leveredSampleInputs, discountRate: 1_000_000_000 };
    const npv = calcNPV(punitiveDiscountInputs);
    const equity = calcInitialEquityInvestment(leveredSampleInputs);
    expect(Math.abs(npv - -equity) / equity).toBeLessThan(0.001);
  });

  it("is internally consistent with IRR on a realistic, positively-geared deal: discounting at the IRR yields ~0 NPV", () => {
    // IRR is, by definition, the discount rate at which NPV is zero. calcIRR
    // solves this using buildEquityCashflows(), the exact same stream calcNPV
    // discounts, so re-running calcNPV at the IRR it found should land NPV
    // very close to zero (small residual only from Newton-Raphson's numerical
    // tolerance).
    const irrPct = calcIRR(leveredSampleInputs);
    const npvAtIRR = calcNPV({ ...leveredSampleInputs, discountRate: irrPct });
    expect(Math.abs(npvAtIRR)).toBeLessThan(1);
  });

  it("is internally consistent with IRR for an all-cash deal too", () => {
    const irrPct = calcIRR(noFinanceInputs);
    const npvAtIRR = calcNPV({ ...noFinanceInputs, discountRate: irrPct });
    expect(Math.abs(npvAtIRR)).toBeLessThan(1);
  });

  it("stays finite for a no-finance purchase", () => {
    expect(Number.isFinite(calcNPV(noFinanceInputs))).toBe(true);
  });

  it("stays finite (does not throw or produce NaN) for a deliberately over-leveraged, negative-equity deal", () => {
    // sampleInputs' two loans total more than its total investment. This is a
    // genuinely degenerate case for a return-on-equity calculation (there's no
    // real "return" concept on a negative investment), so IRR/NPV are only
    // guaranteed to stay finite here, not to reconcile with each other the way
    // they do for a normal, positive-equity deal — the applicability layer
    // (lib/calculations/applicability.ts) is what flags this case as N/A for
    // display, rather than the low-level math being forced to "look normal."
    expect(Number.isFinite(calcIRR(sampleInputs))).toBe(true);
    expect(Number.isFinite(calcNPV(sampleInputs))).toBe(true);
  });

  it("increases with a higher capital growth rate (positive terminal value effect)", () => {
    const lowGrowth = calcNPV({ ...leveredSampleInputs, capitalGrowthRate: 1 });
    const highGrowth = calcNPV({ ...leveredSampleInputs, capitalGrowthRate: 6 });
    expect(highGrowth).toBeGreaterThan(lowGrowth);
  });

  it("decreases as the discount rate (required equity return) rises", () => {
    const lowRate = calcNPV({ ...leveredSampleInputs, discountRate: 5 });
    const highRate = calcNPV({ ...leveredSampleInputs, discountRate: 25 });
    expect(highRate).toBeLessThan(lowRate);
  });

  it("decreases as capital gains tax rate rises, all else equal (CGT reduces terminal value)", () => {
    const lowCGT = calcNPV({ ...leveredSampleInputs, capitalGainsTaxRate: 5 });
    const highCGT = calcNPV({ ...leveredSampleInputs, capitalGainsTaxRate: 40 });
    expect(highCGT).toBeLessThan(lowCGT);
  });
});

// ---------------------------------------------------------------------------
// IRR (Equity IRR)
// ---------------------------------------------------------------------------

describe("calcIRR", () => {
  it("returns a finite, clamped percentage even under deep negative cashflow", () => {
    const irr = calcIRR(negativeCashflowInputs);
    expect(Number.isFinite(irr)).toBe(true);
    expect(irr).toBeGreaterThanOrEqual(-99);
    expect(irr).toBeLessThanOrEqual(1000);
  });

  it("handles a no-finance purchase without throwing", () => {
    expect(Number.isFinite(calcIRR(noFinanceInputs))).toBe(true);
  });

  it("changes when financing changes, because equity and debt service both change — but property performance does not (leverage affects the investor, not the property)", () => {
    const unlevered = calcAllMetrics(noFinanceInputs);
    const levered = calcAllMetrics(leveredSampleInputs);

    // The property itself performs identically either way...
    expect(calcNOIAnnual(noFinanceInputs)).toBeCloseTo(calcNOIAnnual(leveredSampleInputs), 4);
    expect(unlevered.capRatePP).toBeCloseTo(levered.capRatePP, 6);

    // ...but the investor's return is a different number once financing is introduced.
    // This deliberately does NOT assert a direction (more leverage isn't
    // always better or worse) — only that debt is a real input to the
    // investor-return calculation, not a no-op.
    expect(unlevered.irr).not.toBeCloseTo(levered.irr, 2);
  });

  it("is not applicable in a meaningful return sense once equity is zero or negative — stays finite, not asserted close to any particular value", () => {
    expect(Number.isFinite(calcIRR(zeroEquityInputs))).toBe(true);
    expect(Number.isFinite(calcIRR(highLeverageInputs))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Operating Expense Ratio
// ---------------------------------------------------------------------------

describe("calcOperatingExpenseRatio", () => {
  it("excludes debt service: is identical for a no-finance and a financed version of the same deal", () => {
    const noFinanceRatio = calcOperatingExpenseRatio(noFinanceInputs);
    const financedRatio = calcOperatingExpenseRatio(sampleInputs);
    expect(noFinanceRatio).toBeCloseTo(financedRatio, 6);
  });

  it("is complementary to NOI Margin (both computed off the same excl.-finance expense base)", () => {
    const ratio = calcOperatingExpenseRatio(sampleInputs);
    const margin = calcNOIMargin(sampleInputs);
    expect(ratio + margin).toBeCloseTo(100, 6);
  });

  it("changes when a genuine operating expense (e.g. maintenance) changes", () => {
    const higherMaintenance: DealInputs = { ...sampleInputs, maintenanceCostValue: 20 };
    expect(calcOperatingExpenseRatio(higherMaintenance)).toBeGreaterThan(
      calcOperatingExpenseRatio(sampleInputs)
    );
  });

  it("returns 0 for zero gross revenue rather than dividing by zero", () => {
    expect(calcOperatingExpenseRatio(zeroRevenueInputs)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Break-Even Ratio
// ---------------------------------------------------------------------------

describe("calcBreakEvenRatio", () => {
  it("equals the Operating Expense Ratio plus debt service as a % of revenue", () => {
    const grossRevenue = calcEffectiveMonthlyRevenue(sampleInputs) * 12;
    const annualDebtService = sampleInputs.financeSources.reduce(
      (sum, f) => sum + f.repaymentAmount * 12,
      0
    );
    const expected = calcOperatingExpenseRatio(sampleInputs) + (annualDebtService / grossRevenue) * 100;
    expect(calcBreakEvenRatio(sampleInputs)).toBeCloseTo(expected, 4);
  });

  it("equals the Operating Expense Ratio exactly when there is no debt", () => {
    expect(calcBreakEvenRatio(noFinanceInputs)).toBeCloseTo(
      calcOperatingExpenseRatio(noFinanceInputs),
      6
    );
  });

  it("is always >= Operating Expense Ratio once any debt service exists", () => {
    expect(calcBreakEvenRatio(sampleInputs)).toBeGreaterThanOrEqual(
      calcOperatingExpenseRatio(sampleInputs)
    );
  });

  it("returns 0 for zero gross revenue rather than dividing by zero", () => {
    expect(calcBreakEvenRatio(zeroRevenueInputs)).toBe(0);
  });

  it("rises sharply under very high leverage", () => {
    expect(calcBreakEvenRatio(highLeverageInputs)).toBeGreaterThan(
      calcBreakEvenRatio(sampleInputs)
    );
  });
});

// ---------------------------------------------------------------------------
// DSCR
// ---------------------------------------------------------------------------

describe("calcDSCR", () => {
  it("is Infinity (not 0) for a no-finance / zero-debt purchase — there is no debt to fail to cover", () => {
    expect(calcDSCR(noFinanceInputs)).toBe(Infinity);
  });

  it("computes NOI / Annual Debt Service for a financed deal", () => {
    const metrics = calcAllMetrics(sampleInputs);
    const annualDebtService = sampleInputs.financeSources.reduce(
      (sum, f) => sum + f.repaymentAmount * 12,
      0
    );
    expect(calcDSCR(sampleInputs)).toBeCloseTo(metrics.noiAnnual / annualDebtService, 6);
  });

  it("drops under very high leverage", () => {
    expect(calcDSCR(highLeverageInputs)).toBeLessThan(calcDSCR(sampleInputs));
  });

  it("survives a JSON round-trip as null (the codebase's established Infinity convention)", () => {
    const roundTripped = JSON.parse(JSON.stringify({ dscr: calcDSCR(noFinanceInputs) }));
    expect(roundTripped.dscr).toBeNull();
    expect(isFiniteNumber(roundTripped.dscr)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// LTV
// ---------------------------------------------------------------------------

describe("calcLTV", () => {
  it("computes total loan amount as a % of purchase price", () => {
    const totalLoan = sampleInputs.financeSources.reduce((sum, f) => sum + f.loanAmount, 0);
    expect(calcLTV(sampleInputs)).toBeCloseTo((totalLoan / sampleInputs.purchasePrice) * 100, 6);
  });

  it("is 0 for a no-finance purchase", () => {
    expect(calcLTV(noFinanceInputs)).toBe(0);
  });

  it("can exceed 100% under very high leverage without throwing", () => {
    expect(calcLTV(highLeverageInputs)).toBeGreaterThan(100);
  });

  it("returns 0 for zero purchase price rather than dividing by zero", () => {
    expect(calcLTV(zeroPurchasePriceInputs)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Cap Rate (PP) / Cap Rate (MV)
// ---------------------------------------------------------------------------

describe("calcCapRatePP / calcCapRateMV", () => {
  it("returns 0 for zero purchase price / zero market value", () => {
    expect(calcCapRatePP(zeroPurchasePriceInputs)).toBe(0);
    expect(calcCapRateMV({ ...sampleInputs, marketValue: 0 })).toBe(0);
  });

  it("is unaffected by financing choices (NOI excludes debt service)", () => {
    expect(calcCapRatePP(noFinanceInputs)).toBeCloseTo(calcCapRatePP(sampleInputs), 6);
  });
});

// ---------------------------------------------------------------------------
// Gross Yield (property-level, unlevered) / Net Yield (AssetVerdict's name
// for Cash-on-Cash Return — equity-level, levered) — see section 8/9 of the
// Phase 1.1 brief. "Net Yield" is deliberately measured against the
// investor's own cash (calcInitialEquityInvestment), not total investment,
// because its numerator (calcCashflowAnnual) is already after debt service.
// ---------------------------------------------------------------------------

describe("calcGrossYield / calcNetYieldPreTax / calcNetYieldPostTax", () => {
  it("Gross Yield returns 0 for zero purchase price", () => {
    expect(calcGrossYield(zeroPurchasePriceInputs)).toBe(0);
  });

  it("Net Yield returns 0 for zero total investment (equity is also 0 with no debt)", () => {
    expect(calcNetYieldPreTax(zeroTotalInvestmentInputs)).toBe(0);
    expect(calcNetYieldPostTax(zeroTotalInvestmentInputs)).toBe(0);
  });

  it("Net Yield returns 0 (not a divide-by-zero) when equity is zero or negative", () => {
    expect(calcNetYieldPreTax(zeroEquityInputs)).toBe(0);
    expect(calcNetYieldPostTax(zeroEquityInputs)).toBe(0);
    expect(calcNetYieldPreTax(highLeverageInputs)).toBe(0);
  });

  it("Cash-on-Cash formula: equals Annual Cashflow After Debt Service ÷ Initial Equity Investment × 100", () => {
    const equity = calcInitialEquityInvestment(leveredSampleInputs);
    const preTaxCashflow = calcCashflowAnnual(leveredSampleInputs, true);
    const postTaxCashflow = calcCashflowAnnual(leveredSampleInputs, false);
    expect(calcNetYieldPreTax(leveredSampleInputs)).toBeCloseTo((preTaxCashflow / equity) * 100, 4);
    expect(calcNetYieldPostTax(leveredSampleInputs)).toBeCloseTo((postTaxCashflow / equity) * 100, 4);
  });

  it("post-tax yield is never greater than pre-tax yield when NOI exceeds finance cost", () => {
    expect(calcNetYieldPostTax(leveredSampleInputs)).toBeLessThanOrEqual(
      calcNetYieldPreTax(leveredSampleInputs)
    );
  });

  it("is negative for a deeply negative-cashflow deal with positive equity", () => {
    expect(calcNetYieldPostTax(negativeCashflowInputs)).toBeLessThan(0);
  });

  it("differs from an unlevered (all-cash) reading of the same property — confirms it is genuinely a levered, equity-level metric", () => {
    expect(calcNetYieldPreTax(leveredSampleInputs)).not.toBeCloseTo(
      calcNetYieldPreTax(noFinanceInputs),
      2
    );
  });
});

// ---------------------------------------------------------------------------
// Payback Period (Equity Payback Period — same denominator fix as Net Yield)
// ---------------------------------------------------------------------------

describe("calcPaybackPeriod", () => {
  it("computes Initial Equity Investment / Annual Net Cashflow for a positive-cashflow, positive-equity deal", () => {
    const equity = calcInitialEquityInvestment(leveredSampleInputs);
    const annualCashflow = calcCashflowAnnual(leveredSampleInputs, false);
    expect(annualCashflow).toBeGreaterThan(0);
    expect(calcPaybackPeriod(leveredSampleInputs)).toBeCloseTo(equity / annualCashflow, 4);
  });

  it("is Infinity for a deal with negative annual cashflow", () => {
    expect(calcPaybackPeriod(negativeCashflowInputs)).toBe(Infinity);
  });

  it("is 0 (already 'paid back') rather than a divide-by-zero when equity is zero or negative and cashflow is positive", () => {
    // zeroEquityInputs / highLeverageInputs carry heavy debt service, so check
    // this against a case with genuinely zero equity and positive cashflow by
    // construction: an all-cash deal has no meaningful zero-equity case, so
    // assert directly on the guard using zeroEquityInputs regardless of its
    // cashflow sign — a non-positive-cashflow deal already returns Infinity
    // first, so this only exercises the equity guard when cashflow is positive.
    if (calcCashflowAnnual(zeroEquityInputs, false) > 0) {
      expect(calcPaybackPeriod(zeroEquityInputs)).toBe(0);
    }
  });

  it("stays finite for the all-cash purchase (equity equals total investment here)", () => {
    expect(Number.isFinite(calcPaybackPeriod(noFinanceInputs))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Remaining debt at sale / terminal value
// ---------------------------------------------------------------------------

describe("calcTotalRemainingLoanBalance and its effect on Equity IRR/NPV", () => {
  it("amortises down over time and reaches 0 at the loan term", () => {
    const balanceYear1 = calcTotalRemainingLoanBalance(leveredSampleInputs, 1);
    const balanceYear10 = calcTotalRemainingLoanBalance(leveredSampleInputs, 10);
    const loanAmount = leveredSampleInputs.financeSources[0].loanAmount;
    expect(balanceYear1).toBeLessThan(loanAmount);
    expect(balanceYear10).toBeLessThan(balanceYear1);
    expect(calcTotalRemainingLoanBalance(leveredSampleInputs, leveredSampleInputs.financeSources[0].termYears)).toBe(0);
  });

  it("a longer remaining balance at sale (later payoff) reduces NPV, all else equal", () => {
    const shortTerm = calcNPV({
      ...leveredSampleInputs,
      financeSources: [{ ...leveredSampleInputs.financeSources[0], termYears: 10 }],
    });
    const longTerm = calcNPV({
      ...leveredSampleInputs,
      financeSources: [{ ...leveredSampleInputs.financeSources[0], termYears: 25 }],
    });
    // A longer term leaves more debt outstanding at year 20 (less paid off),
    // which reduces the equity proceeds captured in the terminal value.
    expect(longTerm).toBeLessThan(shortTerm);
  });
});

// ---------------------------------------------------------------------------
// Phase 4.8: financing-model audit bug fix. calc20YearProjection previously
// computed `financeCostAnnual` ONCE before the year loop and reused that
// constant for all 20 years, so a loan that fully matured partway through
// the projection kept being "paid" (debt service, and therefore tax, never
// dropped) even though remainingDebt correctly reached zero — an internal
// contradiction within the same YearlyProjection row. calcAnnualDebtServiceForYear
// fixes this by mirroring remainingLoanBalance()'s own maturity convention
// (a source with termYears <= year has fully amortised BY THE END of that
// year, so it stops contributing debt service the year AFTER it matures).
// ---------------------------------------------------------------------------
describe("calcAnnualDebtServiceForYear (Phase 4.8 bug fix)", () => {
  const shortLoan = { loanAmount: 1_000_000, interestRate: 10, termYears: 5, repaymentAmount: calcMonthlyRepayment(1_000_000, 10, 5) };
  const longLoan = { loanAmount: 800_000, interestRate: 10, termYears: 20, repaymentAmount: calcMonthlyRepayment(800_000, 10, 20) };

  it("a single loan contributes its full annual repayment through its final year, then zero", () => {
    const inputs: DealInputs = { ...sampleInputs, financeSources: [shortLoan] };
    expect(calcAnnualDebtServiceForYear(inputs, 1)).toBeCloseTo(shortLoan.repaymentAmount * 12, 4);
    expect(calcAnnualDebtServiceForYear(inputs, 5)).toBeCloseTo(shortLoan.repaymentAmount * 12, 4); // final year of payments
    expect(calcAnnualDebtServiceForYear(inputs, 6)).toBe(0); // matured — no more debt service
    expect(calcAnnualDebtServiceForYear(inputs, 10)).toBe(0);
  });

  it("with two loans of different terms, only the still-active loan's repayment counts after the shorter one matures", () => {
    const inputs: DealInputs = { ...sampleInputs, financeSources: [shortLoan, longLoan] };
    expect(calcAnnualDebtServiceForYear(inputs, 5)).toBeCloseTo((shortLoan.repaymentAmount + longLoan.repaymentAmount) * 12, 4);
    expect(calcAnnualDebtServiceForYear(inputs, 6)).toBeCloseTo(longLoan.repaymentAmount * 12, 4);
    expect(calcAnnualDebtServiceForYear(inputs, 20)).toBeCloseTo(longLoan.repaymentAmount * 12, 4);
    expect(calcAnnualDebtServiceForYear(inputs, 21)).toBe(0);
  });

  it("cash purchase (no finance sources) contributes zero in every year", () => {
    const inputs: DealInputs = { ...sampleInputs, financeSources: [] };
    expect(calcAnnualDebtServiceForYear(inputs, 1)).toBe(0);
    expect(calcAnnualDebtServiceForYear(inputs, 20)).toBe(0);
  });
});

describe("calc20YearProjection — debt service stops when a loan matures (Phase 4.8 bug fix)", () => {
  const shortLoan = { loanAmount: 1_000_000, interestRate: 10, termYears: 5, repaymentAmount: calcMonthlyRepayment(1_000_000, 10, 5) };
  const inputs: DealInputs = {
    ...sampleInputs,
    purchasePrice: 1_000_000,
    transferBondCost: 0,
    renovationCost: 0,
    sourcingFee: 0,
    marketValue: 1_000_000,
    capitalGrowthRate: 3,
    financeSources: [shortLoan],
  };
  const projection = calc20YearProjection(inputs);

  it("financeCost matches the full repayment through the loan's final year", () => {
    expect(projection[4].financeCost).toBeCloseTo(shortLoan.repaymentAmount * 12, 4); // year 5
  });

  it("financeCost drops to zero the year after the loan matures, exactly when remainingDebt reaches zero", () => {
    expect(projection[4].remainingDebt).toBe(0); // year 5 — matured by year-end
    expect(projection[5].financeCost).toBe(0); // year 6
    expect(projection[9].financeCost).toBe(0); // year 10
  });

  it("cashflow rises materially once debt service stops, and tax becomes payable again", () => {
    const year5 = projection[4];
    const year6 = projection[5];
    expect(year6.cashflowForPeriod).toBeGreaterThan(year5.cashflowForPeriod);
    expect(year6.taxAmount).toBeGreaterThan(0);
  });

  it("years before maturity are completely unaffected by the fix", () => {
    expect(projection[0].financeCost).toBeCloseTo(shortLoan.repaymentAmount * 12, 4); // year 1
    expect(projection[3].financeCost).toBeCloseTo(shortLoan.repaymentAmount * 12, 4); // year 4
  });

  it("terminal equity / Equity IRR / NPV for a sale after loan maturity no longer understate post-maturity cashflow", () => {
    const partialDeposit: DealInputs = { ...inputs, financeSources: [{ ...shortLoan, loanAmount: 700_000, repaymentAmount: calcMonthlyRepayment(700_000, 10, 5) }] };
    const saleAtYear10 = { ...partialDeposit, wantToSell: true, saleYear: 10 };
    const irr = calcIRR(saleAtYear10);
    const npv = calcNPV(saleAtYear10);
    // Regression floor confirmed against the fixed engine (Phase 4.8) — before
    // the fix these were materially lower (irr ~15.7%, npv ~R195,807) because
    // years 6-10 wrongly kept subtracting the matured loan's repayment.
    expect(irr).toBeGreaterThan(20);
    expect(npv).toBeGreaterThan(450_000);
  });
});

// ---------------------------------------------------------------------------
// Phase 4.3: Bills Included — the user's own per-room/bed estimate, folded
// into utilities by the calculation engine (not the form) so raw inputs stay
// raw and there is exactly one place the economic total gets computed.
// ---------------------------------------------------------------------------

describe("calcBillsIncludedMonthly / calcBillsIncludedUnitCount", () => {
  const multiLetInputs: DealInputs = {
    ...sampleInputs,
    strategy: "multi_let",
    numUnits: 6,
    pricePerRoom: 4_000,
    billsIncluded: true,
    billsIncludedAmount: 500,
  };

  const studentInputs: DealInputs = {
    ...sampleInputs,
    strategy: "student",
    singleRoomCount: 4,
    sharingRoomCount: 3,
    sharingBedsPerRoom: 2,
    billsIncluded: true,
    billsIncludedAmount: 350,
  };

  it("is 0 when billsIncluded is off, regardless of a stored amount", () => {
    expect(calcBillsIncludedMonthly({ ...multiLetInputs, billsIncluded: false })).toBe(0);
  });

  it("is 0 when billsIncluded is on but the amount was never recorded (null, not 0)", () => {
    expect(calcBillsIncludedMonthly({ ...multiLetInputs, billsIncludedAmount: null })).toBe(0);
  });

  it("multi_let: unit count is numUnits, and the monthly total is amount x numUnits", () => {
    expect(calcBillsIncludedUnitCount(multiLetInputs)).toBe(6);
    expect(calcBillsIncludedMonthly(multiLetInputs)).toBe(500 * 6);
  });

  it("student: unit count is single beds + (sharing rooms x beds/room), not numUnits", () => {
    // 4 single beds + 3 sharing rooms x 2 beds/room = 10 beds, independent of numUnits.
    expect(calcBillsIncludedUnitCount(studentInputs)).toBe(10);
    expect(calcBillsIncludedMonthly(studentInputs)).toBe(350 * 10);
  });

  it("flows into calcOperatingCostsMonthly's utilities total and its own billsIncludedMonthly field", () => {
    const withBills = calcOperatingCostsMonthly(multiLetInputs);
    const withoutBills = calcOperatingCostsMonthly({ ...multiLetInputs, billsIncluded: false });
    expect(withBills.billsIncludedMonthly).toBe(3_000);
    expect(withBills.utilities - withoutBills.utilities).toBeCloseTo(3_000, 4);
    expect(withBills.total - withoutBills.total).toBeCloseTo(3_000, 4);
  });
});

// ---------------------------------------------------------------------------
// Phase 4.3: Hold Period — wantToSell/saleYear now drive the actual exit year
// for Equity IRR/NPV via calcHoldPeriodYears(), replacing the hardcoded
// 20-year horizon. buildEquityCashflows() remains the single stream behind
// both, sliced consistently, so the NPV-at-IRR≈0 invariant must still hold at
// any hold period.
// ---------------------------------------------------------------------------

describe("calcHoldPeriodYears", () => {
  it("defaults to 20 when wantToSell is not set", () => {
    expect(calcHoldPeriodYears(leveredSampleInputs)).toBe(20);
  });

  it("defaults to 20 when wantToSell is true but saleYear is not set", () => {
    expect(calcHoldPeriodYears({ ...leveredSampleInputs, wantToSell: true, saleYear: null })).toBe(20);
  });

  it("uses saleYear when wantToSell is true", () => {
    expect(calcHoldPeriodYears({ ...leveredSampleInputs, wantToSell: true, saleYear: 7 })).toBe(7);
  });

  it("ignores saleYear when wantToSell is false", () => {
    expect(calcHoldPeriodYears({ ...leveredSampleInputs, wantToSell: false, saleYear: 7 })).toBe(20);
  });

  it("clamps to the 20-year projection table", () => {
    expect(calcHoldPeriodYears({ ...leveredSampleInputs, wantToSell: true, saleYear: 45 })).toBe(20);
  });
});

describe("hold period wired into buildEquityCashflows / calcIRR / calcNPV", () => {
  it("a shorter hold period produces a shorter cash-flow stream, exiting at that year", () => {
    const year7 = buildEquityCashflows({ ...leveredSampleInputs, wantToSell: true, saleYear: 7 });
    const year20 = buildEquityCashflows({ ...leveredSampleInputs, wantToSell: false, saleYear: null });
    expect(year7).toHaveLength(8); // t=0..7
    expect(year20).toHaveLength(21); // t=0..20
  });

  it("year-0 outflow (initial equity) is unaffected by hold period", () => {
    const year7 = buildEquityCashflows({ ...leveredSampleInputs, wantToSell: true, saleYear: 7 });
    const year20 = buildEquityCashflows({ ...leveredSampleInputs, wantToSell: false, saleYear: null });
    expect(year7[0]).toBeCloseTo(year20[0], 4);
  });

  it("exiting earlier changes IRR and NPV relative to the 20-year default", () => {
    const inputs7 = { ...leveredSampleInputs, wantToSell: true, saleYear: 7 };
    const inputs20 = { ...leveredSampleInputs, wantToSell: false, saleYear: null };
    expect(calcIRR(inputs7)).not.toBeCloseTo(calcIRR(inputs20), 2);
    expect(calcNPV(inputs7)).not.toBeCloseTo(calcNPV(inputs20), 2);
  });

  it("NPV-at-IRR≈0 invariant holds at a shorter hold period, not just at 20 years", () => {
    const inputs = { ...leveredSampleInputs, wantToSell: true, saleYear: 12 };
    const irr = calcIRR(inputs);
    const npvAtIrr = calcNPV({ ...inputs, discountRate: irr });
    expect(npvAtIrr).toBeCloseTo(0, -1);
  });

  it("calcIRRSummary and calcNPVBreakdown report the same holdPeriodYears and reconcile to calcIRR/calcNPV", () => {
    const inputs = { ...leveredSampleInputs, wantToSell: true, saleYear: 12 };
    const irrSummary = calcIRRSummary(inputs);
    const npvBreakdown = calcNPVBreakdown(inputs);
    expect(irrSummary.holdPeriodYears).toBe(12);
    expect(npvBreakdown.holdPeriodYears).toBe(12);
    expect(irrSummary.irr).toBeCloseTo(calcIRR(inputs), 6);
    expect(npvBreakdown.npv).toBeCloseTo(calcNPV(inputs), 4);
  });

  it("calcTerminalValue at the hold year matches the terminal value baked into buildEquityCashflows", () => {
    const inputs = { ...leveredSampleInputs, wantToSell: true, saleYear: 12 };
    const holdYears = calcHoldPeriodYears(inputs);
    const projection = calc20YearProjection(inputs);
    const terminalValue = calcTerminalValue(inputs, projection, holdYears);
    const cashflows = buildEquityCashflows(inputs);
    const operatingCashflowAtExit = projection[holdYears - 1].cashflowForPeriod;
    expect(cashflows[holdYears]).toBeCloseTo(operatingCashflowAtExit + terminalValue, 4);
  });

  it("existing deals (wantToSell false) are byte-for-byte unaffected: same IRR/NPV as before this change", () => {
    // Regression guard for the migration-safety requirement: historical
    // financial outputs for existing deals must not silently change.
    const inputs = { ...leveredSampleInputs }; // wantToSell/saleYear both undefined
    expect(calcHoldPeriodYears(inputs)).toBe(20);
    expect(buildEquityCashflows(inputs)).toHaveLength(21);
  });
});

// ---------------------------------------------------------------------------
// Phase 4.4: calcExitSummary — the single decomposed exit truth Exit
// Analysis, education, and Deal Coach must all read from, rather than each
// re-deriving a projected sale price independently.
// ---------------------------------------------------------------------------

describe("calcExitSummary", () => {
  it("saleYear = 7: holdPeriodYears and isPlannedSale reflect the planned sale", () => {
    const inputs = { ...leveredSampleInputs, wantToSell: true, saleYear: 7 };
    const summary = calcExitSummary(inputs);
    expect(summary.holdPeriodYears).toBe(7);
    expect(summary.isPlannedSale).toBe(true);
  });

  it("saleYear = 12: holdPeriodYears and isPlannedSale reflect the planned sale", () => {
    const inputs = { ...leveredSampleInputs, wantToSell: true, saleYear: 12 };
    const summary = calcExitSummary(inputs);
    expect(summary.holdPeriodYears).toBe(12);
    expect(summary.isPlannedSale).toBe(true);
  });

  it("no planned sale: holdPeriodYears is the 20-year analysis horizon default, isPlannedSale is false", () => {
    const inputs = { ...leveredSampleInputs, wantToSell: false, saleYear: null };
    const summary = calcExitSummary(inputs);
    expect(summary.holdPeriodYears).toBe(20);
    expect(summary.isPlannedSale).toBe(false);
  });

  it("the three decomposed components net to exactly terminalEquityValue", () => {
    const inputs = { ...leveredSampleInputs, wantToSell: true, saleYear: 7 };
    const summary = calcExitSummary(inputs);
    expect(
      summary.projectedPropertyValueAtExit - summary.remainingDebtAtExit - summary.capitalGainsTaxAtExit
    ).toBeCloseTo(summary.terminalEquityValue, 4);
  });

  it("terminalEquityValue matches calcTerminalValue for the same hold year — one shared exit truth", () => {
    for (const saleYear of [7, 12]) {
      const inputs = { ...leveredSampleInputs, wantToSell: true, saleYear };
      const summary = calcExitSummary(inputs);
      const projection = calc20YearProjection(inputs);
      expect(summary.terminalEquityValue).toBeCloseTo(calcTerminalValue(inputs, projection, saleYear), 4);
    }
  });

  it("projectedPropertyValueAtExit matches the projection table's own propertyValue at that year", () => {
    const inputs = { ...leveredSampleInputs, wantToSell: true, saleYear: 12 };
    const summary = calcExitSummary(inputs);
    const projection = calc20YearProjection(inputs);
    expect(summary.projectedPropertyValueAtExit).toBeCloseTo(projection[11].propertyValue, 4);
  });

  it("calcAllMetrics exposes exitSummary for a rental deal", () => {
    const inputs = { ...leveredSampleInputs, wantToSell: true, saleYear: 7 };
    const metrics = calcAllMetrics(inputs);
    expect(metrics.exitSummary).toBeDefined();
    expect(metrics.exitSummary!.holdPeriodYears).toBe(7);
  });

  it("calcAllMetrics omits exitSummary for Fix & Flip — that strategy's exit economics are calcFlipProfit's, not a rental hold-period read", () => {
    const inputs = { ...leveredSampleInputs, strategy: "fix_and_flip" };
    const metrics = calcAllMetrics(inputs);
    expect(metrics.exitSummary).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Phase 4.4: calcStudentCapacity — the one deterministic source of Student
// room/bed structure. Financial calculations (calcBillsIncludedUnitCount)
// and advisory features (Area Intelligence) must both read from here rather
// than reconstructing their own count or falling back to numUnits.
// ---------------------------------------------------------------------------

describe("calcStudentCapacity", () => {
  it("4 single rooms + 3 sharing rooms x 2 beds = 7 rooms, 10 beds", () => {
    const capacity = calcStudentCapacity({
      singleRoomCount: 4,
      sharingRoomCount: 3,
      sharingBedsPerRoom: 2,
    });
    expect(capacity.roomCount).toBe(7);
    expect(capacity.bedCount).toBe(10);
  });

  it("rooms and beds are not interchangeable when sharing rooms hold 3 beds", () => {
    const capacity = calcStudentCapacity({
      singleRoomCount: 0,
      sharingRoomCount: 2,
      sharingBedsPerRoom: 3,
    });
    expect(capacity.roomCount).toBe(2);
    expect(capacity.bedCount).toBe(6);
  });

  it("calcBillsIncludedUnitCount for a student deal uses bedCount, not numUnits", () => {
    const inputs: DealInputs = {
      ...leveredSampleInputs,
      strategy: "student",
      numUnits: 999, // deliberately unrelated — must be ignored for student
      singleRoomCount: 4,
      sharingRoomCount: 3,
      sharingBedsPerRoom: 2,
    };
    expect(calcBillsIncludedUnitCount(inputs)).toBe(10);
  });
});
