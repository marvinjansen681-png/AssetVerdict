import type { DealMetrics } from "@/lib/calculations";
import { formatMetricValue } from "@/lib/education/format";

interface DealMentalModelProps {
  metrics: DealMetrics;
  strategyId: string;
  currency?: string;
}

interface Stage {
  label: string;
  formula: string;
  resultLabel: string;
  resultValue: string;
}

function RentalModel({ metrics, currency }: { metrics: DealMetrics; currency: string }) {
  const stages: Stage[] = [
    {
      label: "Income",
      formula: "Rent + Other Income",
      resultLabel: "Gross Revenue",
      resultValue: formatMetricValue(metrics.grossRevenueAnnual, "currency", currency),
    },
    {
      label: "Property",
      formula: `Gross Revenue − Operating Expenses (${formatMetricValue(metrics.operatingExpensesAnnual, "currency", currency)})`,
      resultLabel: "NOI",
      resultValue: formatMetricValue(metrics.noiAnnual, "currency", currency),
    },
    {
      label: "Financing",
      formula: `NOI − Debt Payments (${formatMetricValue(metrics.annualDebtService, "currency", currency)})`,
      resultLabel: "Cash Flow",
      resultValue: formatMetricValue(metrics.cashflowMonthly * 12, "currency", currency),
    },
    {
      label: "Investor",
      formula: `Initial Equity (${formatMetricValue(metrics.depositRequired, "currency", currency)}) + Cash Flow + Future Sale Value`,
      resultLabel: "Equity IRR",
      resultValue: formatMetricValue(metrics.irr, "percent", currency),
    },
  ];
  return <ModelStages stages={stages} />;
}

function FlipModel({ metrics, currency }: { metrics: DealMetrics; currency: string }) {
  const f = metrics.flipMetrics;
  if (!f) return null;
  const stages: Stage[] = [
    {
      label: "Purchase",
      formula: `Purchase Price + Renovation + Holding Costs + Selling Costs`,
      resultLabel: "Total Cost",
      resultValue: formatMetricValue(f.totalCost, "currency", currency),
    },
    {
      label: "Sale",
      formula: `Expected Sale Price (${formatMetricValue(f.expectedSalePrice, "currency", currency)}) − Total Cost − Tax (${formatMetricValue(f.cgt, "currency", currency)})`,
      resultLabel: "Net Profit",
      resultValue: formatMetricValue(f.netProfit, "currency", currency),
    },
    {
      label: "Return",
      formula: `Net Profit ÷ Total Cost`,
      resultLabel: "ROI / Annualised ROI",
      resultValue: `${formatMetricValue(f.roi, "percent", currency)} / ${formatMetricValue(f.annualisedROI, "percent", currency)}`,
    },
  ];
  return <ModelStages stages={stages} />;
}

function ModelStages({ stages }: { stages: Stage[] }) {
  return (
    <div className="flex flex-col gap-0">
      {stages.map((stage, i) => (
        <div key={stage.label} className="flex flex-col items-stretch">
          <div className="rounded-lg border border-av-light-grey bg-white p-4">
            <span className="text-[10px] font-body font-semibold tracking-wide uppercase text-av-gold">
              {stage.label}
            </span>
            <p className="font-body text-xs text-av-slate mt-1">{stage.formula}</p>
            <div className="flex items-baseline justify-between mt-2">
              <span className="font-body text-sm text-av-navy">{stage.resultLabel}</span>
              <span className="font-mono font-bold text-lg text-av-navy">{stage.resultValue}</span>
            </div>
          </div>
          {i < stages.length - 1 && (
            <div className="flex justify-center py-1" aria-hidden="true">
              <span className="text-av-slate/50 text-base leading-none">↓</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * The single mental-model overview at the top of Understand Your Deal
 * (Phase 2, sections 16-17): four (rental) or three (flip) stages, each
 * showing the real formula and the deal's own number — not a generic
 * diagram. Strategy-aware per section 17: Fix & Flip never sees the rental
 * income/financing flow, since it has no ongoing cashflow to show.
 */
export default function DealMentalModel({ metrics, strategyId, currency = "R" }: DealMentalModelProps) {
  const isFlip = strategyId === "fix_and_flip";
  return (
    <div>
      <h3 className="font-display text-lg text-av-navy mb-1">How This Deal Works</h3>
      <p className="font-body text-sm text-av-slate mb-4">
        {isFlip
          ? "From purchase to sale, in four numbers."
          : "How money moves through this deal, from rent collected to your own return."}
      </p>
      {isFlip ? <FlipModel metrics={metrics} currency={currency} /> : <RentalModel metrics={metrics} currency={currency} />}
    </div>
  );
}
