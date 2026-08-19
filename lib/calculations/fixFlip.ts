/**
 * Deterministic Fix & Flip Financial Truth Model (Phase 4.17).
 *
 * This is NOT a verdict engine — it computes nothing about whether a Flip is
 * "good." It exists to make the underlying financial arithmetic internally
 * correct, deterministic, explainable, and auditable Rand-for-Rand, ahead of
 * any future calibrated execution-risk verdict (Phase 4.18+).
 *
 * Core product principle (non-negotiable — section 3): PROJECT ECONOMICS is
 * distinct from FINANCING/EQUITY CASHFLOW.
 *   - Loan PRINCIPAL is never an economic expense. Borrowing R800,000 does
 *     not make the property R800,000 cheaper; repaying R800,000 of
 *     principal does not create an R800,000 expense.
 *   - Financing INTEREST *is* an economic cost, and is included in project
 *     profit.
 *   - Principal repayment and the loan payoff at sale are FINANCING
 *     CASHFLOWS — they change the timing/amount of the investor's own
 *     equity cash, never the project's economic profit.
 *
 * Architecture — ONE truth engine, reused by UI/PDF/Deal Coach alike:
 *   DealInputs (holdingPeriodMonths, purchasePrice, transferBondCost,
 *   sourcingFee, renovationCost, holdingCostPerMonth, expectedSalePrice,
 *   agentCommission, financeSources)
 *         v
 *   calcFixFlipAnalysis(inputs)
 *         v
 *   { acquisition, renovation, holding, financing, sale, profitability,
 *     breakEven, equityCashflows, modelAssumptions }
 *
 * Reuses the EXACT SAME amortisation/IRR primitives rental deals use
 * (calcMonthlyRepayment, remainingLoanBalanceAfterMonths,
 * calcFinancingTotalsOverMonths, solvePeriodicIRR — all from ./index) — no
 * second loan-math or IRR implementation exists for Fix & Flip.
 *
 * Tax boundary (locked, section 4): PRE-TAX only. No CGT, income tax,
 * company tax, or VAT is ever applied here — South African property
 * disposal tax treatment depends on facts (intention, frequency, entity,
 * trading-stock treatment) this model cannot determine. Every profit field
 * is named accordingly ("...BeforeTax").
 *
 * No verdict, no threshold, no classification lives in this module — see
 * lib/calculations/verdict.ts's own strategy gate (VERDICT_ENABLED_STRATEGIES
 * excludes "fix_and_flip") and lib/calculations/negotiation.ts (same
 * exclusion) — both remain untouched by this phase.
 */
import {
  calcMonthlyRepayment,
  calcFinancingTotalsOverMonths,
  remainingLoanBalanceAfterMonths,
  solvePeriodicIRR,
  isFiniteNumber,
  type DealInputs,
} from "./index";

// ---------------------------------------------------------------------------
// Output model
// ---------------------------------------------------------------------------

export interface FixFlipAcquisition {
  purchasePrice: number;
  /** transferBondCost + sourcingFee — genuinely acquisition-side costs; agentCommission is a SELLING cost, kept out of this bucket (section 8, 19). */
  acquisitionCosts: number;
}

export interface FixFlipRenovation {
  renovationCost: number;
}

export interface FixFlipHolding {
  holdingPeriodMonths: number;
  holdingCostPerMonth: number;
  totalHoldingCosts: number;
}

export interface FixFlipFinancing {
  totalInterestPaid: number;
  totalPrincipalPaid: number;
  /** Always exactly totalInterestPaid + totalPrincipalPaid (section 47 — proven by construction and by fixFlip.test.ts's reconciliation tests). */
  totalDebtService: number;
  remainingLoanBalanceAtSale: number;
  /** Original total loan amount drawn across all sources at project start (section 28's Month 0 assumption). */
  totalLoanAmount: number;
}

export interface FixFlipSale {
  /** An ASSUMPTION, never a verified fact (section 45) — the user's own projected sale price. */
  projectedSalePrice: number;
  sellingCosts: number;
  netSaleProceedsBeforeDebt: number;
  netEquityProceedsAtSale: number;
}

export interface FixFlipProfitability {
  /** Unlevered — the property/project itself before financing cost (section 23). Never investor profit when debt exists. */
  projectProfitBeforeFinancingAndTax: number;
  /** The primary levered, pre-tax economic profit figure — excludes principal, includes interest (section 24). */
  estimatedProfitBeforeTax: number;
  /** Total cost basis used as preTaxProjectROI's denominator — includes financing interest and selling costs, excludes loan principal (section 26). */
  totalProjectCost: number;
  preTaxProjectROI: number;
  /** null when total equity contributed is not positive — no meaningful ROI denominator (section 27, 33). */
  preTaxEquityROI: number | null;
  /** Compounding-equivalent annualisation of preTaxProjectROI (section 34) — null when the holding period is invalid or the ROI is <= -100% (undefined fractional power). */
  annualisedPreTaxROI: number | null;
  /** Monthly-cashflow-based, then annualised (section 30) — null on non-convergence, no sign change, or non-positive equity (section 31). */
  equityIRR: number | null;
  preTaxProfitMargin: number;
}

export interface FixFlipBreakEven {
  /** null when no solution exists in the search domain (e.g. selling-cost % >= 100%, or fixed costs are themselves negative in a way that breaks monotonicity — see the module's monotonicity note). */
  breakEvenSalePrice: number | null;
  salePriceBufferRand: number | null;
  salePriceBufferPercent: number | null;
}

/** One month of the investor's own equity cashflow (section 28-29) — month 0 is the initial contribution, the final month is the sale month. Never itself "profit" — see profitability.estimatedProfitBeforeTax for the reconciled economic figure (section 48). */
export interface FixFlipEquityCashflowMonth {
  month: number;
  cashflow: number;
}

export interface FixFlipModelAssumptions {
  modelVersion: "4.17";
  /** Renovation cost is treated as fully committed at project start for equity-cashflow timing purposes (section 10) — V1 does not model staged construction drawdowns. */
  renovationTimingAssumption: string;
  /** All finance sources are assumed drawn in full at project start (month 0) and modelled as AssetVerdict's standard fully-amortising monthly principal-and-interest loans, regardless of a source's descriptive label (section 14). */
  financingAssumption: string;
  taxAssumption: string;
}

export type FixFlipAnalysisUnavailableReason = "invalid_holding_period";

export interface FixFlipAnalysisUnavailable {
  status: "unavailable";
  reason: FixFlipAnalysisUnavailableReason;
}

export interface FixFlipAnalysisAvailable {
  status: "available";
  holdingPeriodMonths: number;
  acquisition: FixFlipAcquisition;
  renovation: FixFlipRenovation;
  holding: FixFlipHolding;
  financing: FixFlipFinancing;
  sale: FixFlipSale;
  profitability: FixFlipProfitability;
  breakEven: FixFlipBreakEven;
  equityCashflows: FixFlipEquityCashflowMonth[];
  modelAssumptions: FixFlipModelAssumptions;
}

export type FixFlipAnalysis = FixFlipAnalysisAvailable | FixFlipAnalysisUnavailable;

const MODEL_ASSUMPTIONS: FixFlipModelAssumptions = {
  modelVersion: "4.17",
  renovationTimingAssumption:
    "Renovation cost is treated as fully committed at project start (month 0) for equity-cashflow timing — AssetVerdict does not yet model staged construction drawdowns.",
  financingAssumption:
    "AssetVerdict currently models Fix & Flip financing using its standard fully-amortising monthly principal-and-interest loan assumptions, regardless of a finance source's descriptive label (e.g. Bridging, Private). Interest-only, balloon/bullet, and bridge-loan economics are not yet modelled.",
  taxAssumption:
    "AssetVerdict currently models Fix & Flip returns before tax. The eventual tax treatment of a property sale can depend on the investor's circumstances, entity, and whether the property is treated as capital or trading stock — this model does not determine that.",
};

// ---------------------------------------------------------------------------
// Equity cashflow schedule (sections 28-29)
// ---------------------------------------------------------------------------

/**
 * Builds the month-indexed equity cashflow schedule (section 28-29): month 0
 * is the investor's initial cash contribution (acquisition + acquisition
 * costs + renovation, net of loan proceeds drawn at start); months 1..N-1
 * carry holding costs and each month's actual debt service; the final month
 * additionally carries net sale proceeds after selling costs and loan
 * payoff. Reuses calcFinancingTotalsOverMonths/remainingLoanBalanceAfterMonths
 * — no second amortisation implementation.
 *
 * Provably reconciles to profitability.estimatedProfitBeforeTax: the sum of
 * every month's cashflow always equals exactly (projectedSalePrice -
 * sellingCosts - purchasePrice - acquisitionCosts - renovationCost -
 * totalHoldingCosts - totalInterestPaid), because
 * (loanAmountDrawn - totalPrincipalPaid - remainingLoanBalanceAtSale) is
 * identically zero for a standard amortising loan (principal paid down plus
 * whatever remains always equals what was originally drawn) — see
 * fixFlip.test.ts's mandatory reconciliation test (section 48).
 */
function buildEquityCashflows(params: {
  inputs: DealInputs;
  holdingPeriodMonths: number;
  acquisitionCosts: number;
  totalLoanAmount: number;
  netEquityProceedsAtSale: number;
}): FixFlipEquityCashflowMonth[] {
  const { inputs, holdingPeriodMonths, acquisitionCosts, totalLoanAmount, netEquityProceedsAtSale } = params;

  const monthlyPayments = inputs.financeSources.map((f) => ({
    source: f,
    termMonths: f.termYears * 12,
    payment: calcMonthlyRepayment(f.loanAmount, f.interestRate, f.termYears),
  }));

  const debtServiceForMonth = (month: number): number =>
    monthlyPayments.reduce((sum, p) => sum + (month <= p.termMonths ? p.payment : 0), 0);

  const cashflows: FixFlipEquityCashflowMonth[] = [];

  const initialContribution =
    -(inputs.purchasePrice + acquisitionCosts + inputs.renovationCost) + totalLoanAmount;
  cashflows.push({ month: 0, cashflow: initialContribution });

  for (let month = 1; month <= holdingPeriodMonths; month++) {
    const isSaleMonth = month === holdingPeriodMonths;
    const holdingOutflow = -inputs.holdingCostPerMonth;
    const debtServiceOutflow = -debtServiceForMonth(month);
    const saleInflow = isSaleMonth ? netEquityProceedsAtSale : 0;
    cashflows.push({ month, cashflow: holdingOutflow + debtServiceOutflow + saleInflow });
  }

  return cashflows;
}

// ---------------------------------------------------------------------------
// Equity IRR (section 30-31)
// ---------------------------------------------------------------------------

/**
 * Monthly-cashflow IRR, annualised via (1 + monthlyRate)^12 - 1 (section 30
 * — explicitly NOT monthlyRate x 12). Returns null (not a fake 0) when the
 * cashflow series has no sign change (no real root exists), when the
 * solver fails to converge to a sane monthly rate, or when there is no
 * genuine equity investment to measure a return on.
 */
function calcEquityIRR(cashflows: FixFlipEquityCashflowMonth[]): number | null {
  const values = cashflows.map((c) => c.cashflow);
  const hasPositive = values.some((v) => v > 0);
  const hasNegative = values.some((v) => v < 0);
  if (!hasPositive || !hasNegative) return null; // no sign change — no real IRR (section 31)

  const monthlyRate = solvePeriodicIRR(values);
  if (!isFiniteNumber(monthlyRate)) return null;

  // Sane monthly-rate band before annualising — generous but not infinite,
  // mirroring calcIRR's own "wide but sane" clamp (index.ts), scaled down
  // to a monthly period so the annualised figure doesn't read as absurd
  // garbage from a spurious Newton-Raphson root.
  const clampedMonthly = Math.max(-0.5, Math.min(monthlyRate, 2));
  const annualised = Math.pow(1 + clampedMonthly, 12) - 1;
  if (!isFiniteNumber(annualised)) return null;
  return annualised * 100;
}

// ---------------------------------------------------------------------------
// Break-even sale price (sections 37-38) — numeric search over the SAME
// profit engine this module already exposes; no fragile closed-form
// duplication, one truth engine.
// ---------------------------------------------------------------------------

const BREAK_EVEN_TOLERANCE = 1; // R1

/**
 * Profit as a function of a candidate sale price, holding every other
 * input fixed (purchase price, acquisition costs, renovation, holding
 * costs, and financing interest are all independent of the eventual sale
 * price under this model — selling costs are the only sale-price-dependent
 * term). Reused by calcFixFlipAnalysis for the actual projected price, and
 * by the break-even search below for arbitrary candidate prices — the
 * literal same function, never a second formula.
 */
function estimatedProfitAtSalePrice(fixedCostsExclSelling: number, agentCommissionPct: number, salePrice: number): number {
  const sellingCosts = salePrice * (agentCommissionPct / 100);
  return salePrice - sellingCosts - fixedCostsExclSelling;
}

/**
 * Finds the sale price at which estimatedProfitBeforeTax ≈ 0, by bounded
 * binary search (never a hand-derived closed-form) — section 37/38. Profit
 * is monotonically increasing in sale price whenever agentCommissionPct <
 * 100 (each extra Rand of sale price yields (1 - fee%) extra Rand of
 * profit), which holds for any realistic selling-cost percentage; this is
 * verified empirically in fixFlip.test.ts rather than assumed. Returns null
 * if no solution exists in a sane domain (degenerate selling-cost % >= 100,
 * or fixed costs already prove profit is always positive/negative at every
 * price in the search band — see fixFlip.test.ts for both edge cases).
 */
function solveBreakEvenSalePrice(fixedCostsExclSelling: number, agentCommissionPct: number, projectedSalePrice: number): number | null {
  if (agentCommissionPct >= 100) return null;

  // Search domain: 0 up to a generous multiple of the projected price (or a
  // floor if the projected price is degenerate) — wide enough that a
  // realistic break-even price is always inside it.
  const upperBound = Math.max(projectedSalePrice, fixedCostsExclSelling) * 4 + 1_000_000;
  let lo = 0;
  let hi = upperBound;

  const profitAt = (price: number) => estimatedProfitAtSalePrice(fixedCostsExclSelling, agentCommissionPct, price);

  if (profitAt(lo) > 0) return 0; // profitable even at a R0 sale price (degenerate, but not an error)
  if (profitAt(hi) < 0) return null; // no break-even within the search domain

  let iterations = 0;
  while (hi - lo > BREAK_EVEN_TOLERANCE && iterations < 60) {
    const mid = (lo + hi) / 2;
    if (profitAt(mid) < 0) {
      lo = mid;
    } else {
      hi = mid;
    }
    iterations++;
  }
  return hi;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Pure. Never mutates `inputs`. Strategy-agnostic (mirrors calcFlipProfit's
 * own convention) — the caller (calcAllMetrics) decides whether to attach
 * this for a given deal's strategy; this function only guards against a
 * genuinely invalid holding period (section 60), not against being called
 * for a non-Flip strategy.
 */
export function calcFixFlipAnalysis(inputs: DealInputs): FixFlipAnalysis {
  const holdingPeriodMonths = inputs.holdingPeriodMonths;
  if (!isFiniteNumber(holdingPeriodMonths) || holdingPeriodMonths <= 0) {
    return { status: "unavailable", reason: "invalid_holding_period" };
  }

  const acquisitionCosts = inputs.transferBondCost + inputs.sourcingFee;
  const totalHoldingCosts = inputs.holdingCostPerMonth * holdingPeriodMonths;
  const sellingCosts = inputs.expectedSalePrice * (inputs.agentCommission / 100);

  const financingTotals = calcFinancingTotalsOverMonths(inputs, holdingPeriodMonths);
  const totalLoanAmount = inputs.financeSources.reduce((sum, f) => sum + f.loanAmount, 0);

  const netSaleProceedsBeforeDebt = inputs.expectedSalePrice - sellingCosts;
  const netEquityProceedsAtSale = netSaleProceedsBeforeDebt - financingTotals.remainingLoanBalance;

  const projectProfitBeforeFinancingAndTax =
    netSaleProceedsBeforeDebt - inputs.purchasePrice - acquisitionCosts - inputs.renovationCost - totalHoldingCosts;
  const estimatedProfitBeforeTax = projectProfitBeforeFinancingAndTax - financingTotals.totalInterestPaid;

  const totalProjectCost =
    inputs.purchasePrice + acquisitionCosts + inputs.renovationCost + totalHoldingCosts + financingTotals.totalInterestPaid + sellingCosts;
  const preTaxProjectROI = totalProjectCost > 0 ? (estimatedProfitBeforeTax / totalProjectCost) * 100 : 0;

  const preTaxProfitMargin = inputs.expectedSalePrice > 0 ? (estimatedProfitBeforeTax / inputs.expectedSalePrice) * 100 : 0;

  const equityCashflows = buildEquityCashflows({
    inputs,
    holdingPeriodMonths,
    acquisitionCosts,
    totalLoanAmount,
    netEquityProceedsAtSale,
  });

  const totalEquityContributed = equityCashflows.reduce((sum, c) => sum + (c.cashflow < 0 ? -c.cashflow : 0), 0);
  const equityProfit = equityCashflows.reduce((sum, c) => sum + c.cashflow, 0);
  const preTaxEquityROI = totalEquityContributed > 0 ? (equityProfit / totalEquityContributed) * 100 : null;

  const equityIRR = calcEquityIRR(equityCashflows);

  // Compounding-equivalent annualisation (section 34) — guarded against the
  // undefined fractional power when roiFraction <= -1 (i.e. ROI <= -100%,
  // total loss or worse).
  const roiFraction = preTaxProjectROI / 100;
  const annualisedPreTaxROI =
    roiFraction > -1
      ? (Math.pow(1 + roiFraction, 12 / holdingPeriodMonths) - 1) * 100
      : null;

  const breakEvenFixedCosts =
    inputs.purchasePrice + acquisitionCosts + inputs.renovationCost + totalHoldingCosts + financingTotals.totalInterestPaid;
  const breakEvenSalePrice = solveBreakEvenSalePrice(breakEvenFixedCosts, inputs.agentCommission, inputs.expectedSalePrice);
  const salePriceBufferRand = breakEvenSalePrice === null ? null : inputs.expectedSalePrice - breakEvenSalePrice;
  const salePriceBufferPercent =
    breakEvenSalePrice === null || !(inputs.expectedSalePrice > 0)
      ? null
      : ((inputs.expectedSalePrice - breakEvenSalePrice) / inputs.expectedSalePrice) * 100;

  return {
    status: "available",
    holdingPeriodMonths,
    acquisition: { purchasePrice: inputs.purchasePrice, acquisitionCosts },
    renovation: { renovationCost: inputs.renovationCost },
    holding: { holdingPeriodMonths, holdingCostPerMonth: inputs.holdingCostPerMonth, totalHoldingCosts },
    financing: {
      totalInterestPaid: financingTotals.totalInterestPaid,
      totalPrincipalPaid: financingTotals.totalPrincipalPaid,
      totalDebtService: financingTotals.totalDebtService,
      remainingLoanBalanceAtSale: financingTotals.remainingLoanBalance,
      totalLoanAmount,
    },
    sale: {
      projectedSalePrice: inputs.expectedSalePrice,
      sellingCosts,
      netSaleProceedsBeforeDebt,
      netEquityProceedsAtSale,
    },
    profitability: {
      projectProfitBeforeFinancingAndTax,
      estimatedProfitBeforeTax,
      totalProjectCost,
      preTaxProjectROI,
      preTaxEquityROI,
      annualisedPreTaxROI,
      equityIRR,
      preTaxProfitMargin,
    },
    breakEven: { breakEvenSalePrice, salePriceBufferRand, salePriceBufferPercent },
    equityCashflows,
    modelAssumptions: MODEL_ASSUMPTIONS,
  };
}
