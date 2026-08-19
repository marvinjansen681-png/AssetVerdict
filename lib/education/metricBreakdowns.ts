/**
 * Deterministic formula-breakdown layer (Phase 2, sections 8-9).
 *
 * This file assembles the ACTUAL numbers behind a metric — e.g. "R157,200 ÷
 * R120,000 = 1.31x" for DSCR — purely by reading already-calculated fields
 * off `DealMetrics` (and the handful of raw acquisition figures the engine
 * doesn't echo back as a "metric," like purchase price). It performs no
 * financial modelling of its own: no discounting, no amortisation, no tax
 * logic. Where a genuinely new number was needed (e.g. Equity NPV's PV
 * split, or Operating Expenses as a standalone total), that number was added
 * to `DealMetrics` in lib/calculations/index.ts — computed by the audited
 * engine — rather than being reconstructed here. This module must never
 * become a second calculation engine.
 */
import type { DealMetrics } from "../calculations";
import type { BreakdownFormat } from "./format";

export interface MetricBreakdownLine {
  label: string;
  value: number;
  format: BreakdownFormat;
}

export interface MetricBreakdown {
  /** Short displayable formula, e.g. "NOI ÷ Annual Debt Payments". */
  formula: string;
  /** The deterministic numerator/denominator components, in display order. */
  lines: MetricBreakdownLine[];
  /** The final value. Callers should treat this as informational only — whether to actually SHOW it (vs an N/A message) is the applicability layer's call, not this module's. */
  result: number;
  resultFormat: BreakdownFormat;
}

/** The subset of an acquisition summary a breakdown might need — deliberately narrower than the full DealSummaryInputs shape from useDealMetrics, to keep lib/education decoupled from hooks. */
export interface AcquisitionSummary {
  purchasePrice: number | null;
  marketValue: number | null;
}

interface GetMetricBreakdownParams {
  metricKey: string;
  metrics: DealMetrics;
  dealSummary: AcquisitionSummary;
}

const line = (label: string, value: number, format: BreakdownFormat): MetricBreakdownLine => ({
  label,
  value,
  format,
});

/**
 * Resolve a registry metric key to its current value on this deal, handling
 * the handful of keys that don't map straight onto a top-level DealMetrics
 * field: flip metrics live under `metrics.flipMetrics`, `initialEquityInvestment`
 * is numerically `depositRequired` (see calcInitialEquityInvestment's doc
 * comment), and `equity` has no single "current" scalar — it's a year-by-year
 * projection figure, not a point-in-time DealMetrics field — so this
 * deliberately returns null for it rather than picking an arbitrary year.
 */
export function getMetricRawValue(metricKey: string, metrics: DealMetrics): number | null {
  if (metricKey === "initialEquityInvestment") return metrics.depositRequired;
  if (metricKey === "equity") return null;

  // Phase 4.17: annualisedROI's compounding-equivalent figure lives on the
  // Fix & Flip financial model, not the legacy linear FlipMetrics field — use
  // it when available so every surface (Deal Coach included) quotes the same
  // number as the FlipDashboard/PDF headline.
  if (metricKey === "annualisedROI" && metrics.fixFlipAnalysis?.status === "available") {
    return metrics.fixFlipAnalysis.profitability.annualisedPreTaxROI;
  }

  if (metrics.flipMetrics && metricKey in metrics.flipMetrics) {
    const flipValue = (metrics.flipMetrics as unknown as Record<string, unknown>)[metricKey];
    return typeof flipValue === "number" ? flipValue : null;
  }

  const value = (metrics as unknown as Record<string, unknown>)[metricKey];
  return typeof value === "number" ? value : null;
}

/** The natural display unit for each metric's headline value — mirrors the `unit` prop already used by GaugeDial on the Deal Summary dashboard. */
export const METRIC_VALUE_FORMAT: Record<string, BreakdownFormat> = {
  totalInvestment: "currency",
  totalLoanAmount: "currency",
  depositRequired: "currency",
  initialEquityInvestment: "currency",
  grossRevenueAnnual: "currency",
  noiAnnual: "currency",
  cashflowMonthly: "currency",
  capRatePP: "percent",
  capRateMV: "percent",
  grossYield: "percent",
  netYieldPreTax: "percent",
  netYieldPostTax: "percent",
  dscr: "multiple",
  ltv: "percent",
  breakEvenRatio: "percent",
  operatingExpenseRatio: "percent",
  utilitiesRatio: "percent",
  noiMargin: "percent",
  capRateSpread: "percent",
  paybackPeriod: "years",
  irr: "percent",
  npv: "currency",
  equity: "currency",
  totalCost: "currency",
  holdingCosts: "currency",
  grossProfit: "currency",
  netProfit: "currency",
  roi: "percent",
  annualisedROI: "percent",
  profitMargin: "percent",
};

/**
 * Assemble the deterministic formula breakdown for `metricKey`, or undefined
 * if this metric doesn't have a component breakdown (e.g. it's a single
 * already-final figure like Gross Revenue itself).
 */
export function getMetricBreakdown({
  metricKey,
  metrics,
  dealSummary,
}: GetMetricBreakdownParams): MetricBreakdown | undefined {
  switch (metricKey) {
    case "dscr":
      return {
        formula: "NOI ÷ Annual Debt Payments",
        lines: [
          line("Annual NOI", metrics.noiAnnual, "currency"),
          line("Annual Debt Payments", metrics.annualDebtService, "currency"),
        ],
        result: metrics.dscr,
        resultFormat: "multiple",
      };

    case "ltv":
      return {
        formula: "Total Loan Amount ÷ Purchase Price",
        lines: [
          line("Total Loan Amount", metrics.totalLoanAmount, "currency"),
          line("Purchase Price", dealSummary.purchasePrice ?? 0, "currency"),
        ],
        result: metrics.ltv,
        resultFormat: "percent",
      };

    case "capRatePP":
      return {
        formula: "Annual NOI ÷ Purchase Price",
        lines: [
          line("Annual NOI", metrics.noiAnnual, "currency"),
          line("Purchase Price", dealSummary.purchasePrice ?? 0, "currency"),
        ],
        result: metrics.capRatePP,
        resultFormat: "percent",
      };

    case "capRateMV":
      return {
        formula: "Annual NOI ÷ Market Value",
        lines: [
          line("Annual NOI", metrics.noiAnnual, "currency"),
          line("Market Value", dealSummary.marketValue ?? 0, "currency"),
        ],
        result: metrics.capRateMV,
        resultFormat: "percent",
      };

    case "grossYield":
      return {
        formula: "Annual Gross Revenue ÷ Purchase Price",
        lines: [
          line("Annual Gross Revenue", metrics.grossRevenueAnnual, "currency"),
          line("Purchase Price", dealSummary.purchasePrice ?? 0, "currency"),
        ],
        result: metrics.grossYield,
        resultFormat: "percent",
      };

    case "netYieldPreTax":
      return {
        formula: "Annual Cash Flow After Debt Service (pre-tax) ÷ Initial Equity Investment",
        lines: [
          line("Annual Pre-Tax Cash Flow", metrics.cashflowAnnualPreTax, "currency"),
          line("Initial Equity Investment", metrics.depositRequired, "currency"),
        ],
        result: metrics.netYieldPreTax,
        resultFormat: "percent",
      };

    case "netYieldPostTax":
      return {
        formula: "Annual Cash Flow After Debt Service (post-tax) ÷ Initial Equity Investment",
        lines: [
          line("Annual Post-Tax Cash Flow", metrics.cashflowMonthly * 12, "currency"),
          line("Initial Equity Investment", metrics.depositRequired, "currency"),
        ],
        result: metrics.netYieldPostTax,
        resultFormat: "percent",
      };

    case "operatingExpenseRatio":
      return {
        formula: "Operating Expenses (excl. debt) ÷ Gross Revenue",
        lines: [
          line("Operating Expenses", metrics.operatingExpensesAnnual, "currency"),
          line("Gross Revenue", metrics.grossRevenueAnnual, "currency"),
        ],
        result: metrics.operatingExpenseRatio,
        resultFormat: "percent",
      };

    case "noiMargin":
      return {
        formula: "Annual NOI ÷ Gross Revenue",
        lines: [
          line("Annual NOI", metrics.noiAnnual, "currency"),
          line("Gross Revenue", metrics.grossRevenueAnnual, "currency"),
        ],
        result: metrics.noiMargin,
        resultFormat: "percent",
      };

    case "utilitiesRatio":
      return {
        formula: "Utilities ÷ Gross Revenue",
        lines: [
          line("Utilities", metrics.operatingCostsMonthly.utilities * 12, "currency"),
          line("Gross Revenue", metrics.grossRevenueAnnual, "currency"),
        ],
        result: metrics.utilitiesRatio,
        resultFormat: "percent",
      };

    case "breakEvenRatio":
      return {
        formula: "(Operating Expenses + Annual Debt Service) ÷ Gross Revenue",
        lines: [
          line("Operating Expenses", metrics.operatingExpensesAnnual, "currency"),
          line("Annual Debt Service", metrics.annualDebtService, "currency"),
          line("Gross Revenue", metrics.grossRevenueAnnual, "currency"),
        ],
        result: metrics.breakEvenRatio,
        resultFormat: "percent",
      };

    case "paybackPeriod":
      return {
        formula: "Initial Equity Investment ÷ Annual Net Cash Flow",
        lines: [
          line("Initial Equity Investment", metrics.depositRequired, "currency"),
          line("Annual Net Cash Flow", metrics.cashflowMonthly * 12, "currency"),
        ],
        result: metrics.paybackPeriod,
        resultFormat: "years",
      };

    case "irr": {
      const holdYears = metrics.irrSummary.holdPeriodYears;
      return {
        formula: "Annualised return that equates your cash flows to your initial equity",
        lines: [
          line("Initial Equity Invested", metrics.irrSummary.initialEquityInvestment, "currency"),
          line(`Total Projected Cash Flow (${holdYears} yrs)`, metrics.irrSummary.totalProjectedCashflow, "currency"),
          line(`Projected Equity at Sale (Yr ${holdYears})`, metrics.irrSummary.terminalValueAtExit, "currency"),
        ],
        result: metrics.irrSummary.irr,
        resultFormat: "percent",
      };
    }

    case "npv":
      return {
        formula: "PV(Future Cash Flows + Sale Proceeds) − Initial Equity Invested",
        lines: [
          line("Initial Equity Invested", metrics.npvBreakdown.initialEquityInvestment, "currency"),
          line(
            `Present Value of Cash Flows (at ${metrics.npvBreakdown.discountRate}% required return)`,
            metrics.npvBreakdown.presentValueOfOperatingCashflows,
            "currency"
          ),
          line("Present Value of Eventual Sale", metrics.npvBreakdown.presentValueOfTerminalValue, "currency"),
        ],
        result: metrics.npvBreakdown.npv,
        resultFormat: "currency",
      };

    // ------------------------------------------------------------------
    // Fix & Flip
    // ------------------------------------------------------------------
    case "totalCost": {
      const f = metrics.flipMetrics;
      if (!f) return undefined;
      return {
        // Phase 4.17: acquisition costs (transfer/bond + sourcing fee) and
        // financing interest during the hold were previously missing from
        // this total entirely — see calcFlipProfit's doc comment. Loan
        // PRINCIPAL is deliberately never a line here — it is financing
        // cashflow, not a project cost (see lib/calculations/fixFlip.ts).
        formula: "Purchase Price + Acquisition Costs + Renovation Cost + Holding Costs + Financing Interest + Agent Commission",
        lines: [
          line("Purchase Price", f.purchasePrice, "currency"),
          line("Acquisition Costs", f.acquisitionCosts, "currency"),
          line("Renovation Cost", f.renovationCost, "currency"),
          line("Holding Costs", f.holdingCosts, "currency"),
          line("Financing Interest", f.financingInterest, "currency"),
          line("Agent Commission", f.agentFee, "currency"),
        ],
        result: f.totalCost,
        resultFormat: "currency",
      };
    }

    case "grossProfit": {
      const f = metrics.flipMetrics;
      if (!f) return undefined;
      return {
        formula: "Expected Sale Price − Total Cost",
        lines: [
          line("Expected Sale Price", f.expectedSalePrice, "currency"),
          line("Total Cost", f.totalCost, "currency"),
        ],
        result: f.grossProfit,
        resultFormat: "currency",
      };
    }

    case "netProfit": {
      const f = metrics.flipMetrics;
      if (!f) return undefined;
      return {
        formula: "= Gross Profit (no tax deducted)",
        lines: [line("Gross Profit", f.grossProfit, "currency")],
        result: f.netProfit,
        resultFormat: "currency",
      };
    }

    case "roi": {
      const f = metrics.flipMetrics;
      if (!f) return undefined;
      return {
        formula: "Estimated Profit Before Tax ÷ Total Cost",
        lines: [
          line("Estimated Profit Before Tax", f.netProfit, "currency"),
          line("Total Cost", f.totalCost, "currency"),
        ],
        result: f.roi,
        resultFormat: "percent",
      };
    }

    case "annualisedROI": {
      const f = metrics.flipMetrics;
      if (!f) return undefined;
      const a = metrics.fixFlipAnalysis?.status === "available" ? metrics.fixFlipAnalysis : null;
      if (a && a.profitability.annualisedPreTaxROI !== null) {
        return {
          formula: "(1 + Pre-Tax ROI) ^ (12 ÷ Holding Period Months) − 1",
          lines: [
            line("Pre-Tax ROI", a.profitability.preTaxProjectROI, "percent"),
            line("Holding Period (months)", a.holdingPeriodMonths, "number"),
          ],
          result: a.profitability.annualisedPreTaxROI,
          resultFormat: "percent",
        };
      }
      return {
        formula: "Pre-Tax ROI ÷ Holding Period (years)",
        lines: [line("Pre-Tax ROI", f.roi, "percent")],
        result: f.annualisedROI,
        resultFormat: "percent",
      };
    }

    case "profitMargin": {
      const f = metrics.flipMetrics;
      if (!f) return undefined;
      return {
        formula: "Estimated Profit Before Tax ÷ Expected Sale Price",
        lines: [
          line("Estimated Profit Before Tax", f.netProfit, "currency"),
          line("Expected Sale Price", f.expectedSalePrice, "currency"),
        ],
        result: f.profitMargin,
        resultFormat: "percent",
      };
    }

    default:
      return undefined;
  }
}
