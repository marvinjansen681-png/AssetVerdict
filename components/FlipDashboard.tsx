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
          label="Estimated Profit Before Tax"
          value={fmt(flipMetrics.netProfit, currency)}
          tooltipText="Profit after all costs and agent commission, before any tax. AssetVerdict does not automatically deduct tax on Fix & Flip disposals — the tax character of a flip (capital gain vs. revenue) depends on the transaction's own facts. An absolute rand amount has no meaning without deal size, so it isn't independently classified — see Pre-Tax ROI and Annualised Pre-Tax ROI for the size-normalized figures (currently unclassified pending recalibration — Phase 4.10)."
          trend="neutral"
        />
        <GaugeDial
          value={flipMetrics.roi}
          unit="%"
          label="Pre-Tax ROI"
          tooltipText="Estimated pre-tax profit as a % of total cost (purchase + renovation + holding + agent fee). Currently unclassified — its previous bands were calibrated on a post-tax figure and no longer apply (Phase 4.10)."
          metricKey="roi"
          strategyId="fix_and_flip"
          max={60}
        />
        <GaugeDial
          value={flipMetrics.annualisedROI}
          unit="%"
          label="Annualised Pre-Tax ROI"
          tooltipText="Pre-Tax ROI adjusted for holding period, so deals of different lengths are comparable. Currently unclassified — its previous bands were calibrated on a post-tax figure and no longer apply (Phase 4.10)."
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
        <div className="flex justify-between py-1 border-b border-av-light-grey pb-3">
          <span className="text-av-slate">Gross Profit</span>
          <span className="font-mono">{fmt(flipMetrics.grossProfit, currency)}</span>
        </div>
        <div className="flex justify-between py-2 text-base font-bold">
          <span>ESTIMATED PROFIT BEFORE TAX</span>
          {/* Informational only, no colour judgement — an absolute rand
              amount isn't independently classified (Decision 4). Pre-tax:
              AssetVerdict does not deduct tax on Fix & Flip disposals
              (Phase 4.10) — see the tooltip above. */}
          <span className="font-mono text-av-navy">{fmt(flipMetrics.netProfit, currency)}</span>
        </div>
        <p className="text-xs font-body text-av-slate/80 pt-1">
          AssetVerdict currently reports Fix &amp; Flip returns before tax. The tax character of a
          property disposal is not determined by this model.
        </p>
      </div>

      <div>
        <h3 className="font-display text-lg text-av-navy mb-3">Deal Waterfall</h3>
        <FlipWaterfallChart flipMetrics={flipMetrics} />
      </div>
    </div>
  );
}
