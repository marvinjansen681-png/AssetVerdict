/**
 * "What does YOUR number mean?" — deterministic, template-driven plain-
 * English interpretation of an already-calculated value (Phase 2, section
 * 13). No LLM, no free text generation: every sentence below is a fixed
 * template with the deal's own number substituted in. If a metric isn't
 * covered here, the UI simply omits this section for that card rather than
 * fabricating a sentence.
 */
import { round } from "./format";

const fmtR = (value: number) => `R${Math.abs(round(value, 0)).toLocaleString("en-US")}`;
const pct = (value: number, decimals = 1) => round(value, decimals);

/**
 * Returns a plain-English sentence translating `value` for `metricKey`, or
 * undefined if this metric has no template (or the value isn't a real,
 * applicable number — callers should check applicability before calling).
 * `context.holdPeriodYears`/`isPlannedSale` let the IRR sentence name the
 * deal's actual exit year and say whether it's the user's own planned sale or
 * AssetVerdict's 20-year analysis-horizon default (see calcExitSummary in
 * lib/calculations) — never implying a default horizon is a sale prediction.
 * `context.leaseTermMonths` (Phase 4.7, Commercial only — omit/undefined for
 * every other strategy) adds objective lease-runway context to Break-Even
 * Ratio without ever turning it into a safety judgement. `context.utilityContext`
 * (Phase 4.7) lets the Utilities Ratio sentence stay honest about measuring
 * gross cost only — never netting the deal's generic `recoveries` income
 * against it, since AssetVerdict has no way to confirm how much of a
 * recoveries figure specifically reimburses utilities (see Section G of the
 * Phase 4.6 report).
 */
export function interpretMetricValue(
  metricKey: string,
  value: number,
  context?: {
    holdPeriodYears?: number;
    isPlannedSale?: boolean;
    leaseTermMonths?: number | null;
    utilityContext?: { billsIncludedMonthly: number; recoveriesMonthly: number };
  }
): string | undefined {
  const holdPeriodYears = context?.holdPeriodYears ?? 20;
  const isPlannedSale = context?.isPlannedSale ?? false;
  switch (metricKey) {
    case "dscr":
      return `The property currently produces R${round(value, 2).toFixed(2)} of operating income for every R1.00 required for debt payments.`;

    case "ltv":
      return `Around R${pct(value, 0)} of every R100 of the purchase price is financed with debt.`;

    case "operatingExpenseRatio":
      return `About R${pct(value, 0)} of every R100 of gross revenue is currently being used by operating expenses, before debt repayments.`;

    case "noiMargin":
      return `About R${pct(value, 0)} of every R100 of gross revenue remains as NOI after operating expenses.`;

    case "utilitiesRatio": {
      const base = `About R${pct(value, 0)} of every R100 of gross revenue goes toward gross utility costs (water, electricity, security, and any bills-included estimate).`;
      const uc = context?.utilityContext;
      if (!uc) return base;
      const parts = [base];
      if (uc.billsIncludedMonthly > 0) {
        parts.push(
          `Your operating-cost assumptions include ${fmtR(uc.billsIncludedMonthly)}/month of bills included in the rental arrangement.`
        );
      }
      if (uc.recoveriesMonthly > 0) {
        parts.push(
          `Your deal also includes ${fmtR(uc.recoveriesMonthly)}/month of recoveries income — AssetVerdict treats this as generic revenue and doesn't assume it specifically reimburses utility costs, so this ratio isn't your net utility exposure.`
        );
      }
      return parts.join(" ");
    }

    case "breakEvenRatio": {
      const base = `About ${pct(value, 0)}% of gross revenue is needed to cover operating expenses and debt payments — the rest is your margin for error before this deal stops covering itself.`;
      if (context?.leaseTermMonths === undefined) return base;
      return context.leaseTermMonths !== null
        ? `${base} This deal currently has ${context.leaseTermMonths} months remaining on the recorded commercial lease, which provides additional context when assessing income resilience.`
        : `${base} No commercial lease term is currently recorded, so AssetVerdict cannot use lease duration as additional context when explaining this income stream.`;
    }

    case "netYieldPreTax":
      return `Based on your current assumptions, your pre-tax annual cash flow equals about ${pct(value)}% of the cash you initially invested.`;

    case "netYieldPostTax":
      return `Based on your current assumptions, your after-tax annual cash flow equals about ${pct(value)}% of the cash you initially invested.`;

    case "capRatePP":
      return `This property's operating income equals about ${pct(value)}% of what you're paying for it, each year — before any financing is considered.`;

    case "capRateMV":
      return `This property's operating income equals about ${pct(value)}% of its current market value, each year.`;

    case "capRateSpread":
      return value >= 0
        ? `Based on your assumed market cap rate, this deal's cap rate is about ${pct(Math.abs(value))} percentage points ABOVE it — a signal you may be buying below what you've assumed the market typically pays for this income.`
        : `Based on your assumed market cap rate, this deal's cap rate is about ${pct(Math.abs(value))} percentage points BELOW it — a signal you may be paying above what you've assumed the market typically pays for this income.`;

    case "grossYield":
      return `Before any costs, this property's rent equals about ${pct(value)}% of the purchase price each year.`;

    case "paybackPeriod":
      return `At the current cash flow, it would take about ${pct(value, 1)} years to recover the cash you personally invested.`;

    case "irr":
      return isPlannedSale
        ? `Over your assumed ${holdPeriodYears}-year hold — including your planned sale in Year ${holdPeriodYears} — this deal is projected to return about ${pct(value)}% a year on the cash you invest.`
        : `Over AssetVerdict's ${holdPeriodYears}-year analysis horizon — including an assumed sale at that point, since no planned sale year is entered — this deal is projected to return about ${pct(value)}% a year on the cash you invest.`;

    case "npv":
      return value >= 0
        ? `In today's money, this deal is projected to create about ${fmtR(value)} of value beyond what your required return alone would earn.`
        : `In today's money, this deal is projected to fall about ${fmtR(value)} short of the value your required return alone would earn.`;

    // Fix & Flip
    case "roi":
      return `This flip is projected to return about ${pct(value)}% on every rand you put into it — purchase, renovation, holding, and selling costs combined.`;

    case "annualisedROI":
      return `Adjusted for how long you expect to hold this property, this flip is projected to return about ${pct(value)}% on an annualised basis.`;

    case "profitMargin":
      return `About ${pct(value)}% of the expected sale price is projected to be your net profit — the rest covers your costs and tax.`;

    default:
      return undefined;
  }
}
