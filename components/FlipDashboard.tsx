import MetricCard from "@/components/gauges/MetricCard";
import GaugeDial from "@/components/gauges/GaugeDial";
import FlipWaterfallChart from "@/components/charts/FlipWaterfallChart";
import type { FlipMetrics } from "@/lib/calculations";

interface FlipDashboardProps {
  flipMetrics: FlipMetrics;
  currency?: string;
}

function fmt(n: number, currency = "R") {
  const sign = n < 0 ? "-" : "";
  return `${sign}${currency} ${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export default function FlipDashboard({ flipMetrics, currency = "R" }: FlipDashboardProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          label="Net Profit"
          value={fmt(flipMetrics.netProfit, currency)}
          tooltipText="Profit after all costs, agent commission, and capital gains tax. An absolute rand amount has no meaning without deal size, so it isn't independently classified — see ROI and Annualised ROI for the size-normalized judgement (Decision 4)."
          trend="neutral"
        />
        <GaugeDial
          value={flipMetrics.roi}
          unit="%"
          label="ROI"
          tooltipText="Net profit as a % of total cost (purchase + renovation + holding + agent fee)."
          metricKey="roi"
          strategyId="fix_and_flip"
          max={60}
        />
        <GaugeDial
          value={flipMetrics.annualisedROI}
          unit="%"
          label="Annualised ROI"
          tooltipText="ROI adjusted for holding period, so deals of different lengths are comparable."
          metricKey="annualisedROI"
          strategyId="fix_and_flip"
          max={100}
        />
      </div>

      <div className="rounded-lg border border-av-light-grey p-6 font-body text-sm max-w-md">
        <div className="flex justify-between py-1">
          <span className="text-av-slate">Purchase Price</span>
          <span className="font-mono">{fmt(flipMetrics.purchasePrice, currency)}</span>
        </div>
        <div className="flex justify-between py-1">
          <span className="text-av-slate">Total Renovation Cost</span>
          <span className="font-mono">{fmt(flipMetrics.renovationCost, currency)}</span>
        </div>
        <div className="flex justify-between py-1">
          <span className="text-av-slate">Holding Costs</span>
          <span className="font-mono">{fmt(flipMetrics.holdingCosts, currency)}</span>
        </div>
        <div className="flex justify-between py-1 border-b border-av-light-grey pb-3">
          <span className="text-av-slate">Agent Commission</span>
          <span className="font-mono">{fmt(flipMetrics.agentFee, currency)}</span>
        </div>
        <div className="flex justify-between py-2 font-semibold">
          <span>Total Cost</span>
          <span className="font-mono">{fmt(flipMetrics.totalCost, currency)}</span>
        </div>
        <div className="flex justify-between py-1 border-b border-av-light-grey pb-3">
          <span className="text-av-slate">Expected Sale Price</span>
          <span className="font-mono">{fmt(flipMetrics.expectedSalePrice, currency)}</span>
        </div>
        <div className="flex justify-between py-1">
          <span className="text-av-slate">Gross Profit</span>
          <span className="font-mono">{fmt(flipMetrics.grossProfit, currency)}</span>
        </div>
        <div className="flex justify-between py-1 border-b border-av-light-grey pb-3">
          <span className="text-av-slate">Capital Gains Tax</span>
          <span className="font-mono text-av-red">-{fmt(flipMetrics.cgt, currency)}</span>
        </div>
        <div className="flex justify-between py-2 text-base font-bold">
          <span>NET PROFIT</span>
          {/* Informational only, no colour judgement — an absolute rand
              amount isn't independently classified (Decision 4). */}
          <span className="font-mono text-av-navy">{fmt(flipMetrics.netProfit, currency)}</span>
        </div>
      </div>

      <div>
        <h3 className="font-display text-lg text-av-navy mb-3">Deal Waterfall</h3>
        <FlipWaterfallChart flipMetrics={flipMetrics} />
      </div>
    </div>
  );
}
