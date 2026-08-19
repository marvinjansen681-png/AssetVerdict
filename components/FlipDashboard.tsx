import MetricCard from "@/components/gauges/MetricCard";
import GaugeDial from "@/components/gauges/GaugeDial";
import FlipWaterfallChart from "@/components/charts/FlipWaterfallChart";
import type { FlipMetrics } from "@/lib/calculations";
import type { FixFlipAnalysis } from "@/lib/calculations/fixFlip";
import clsx from "clsx";

interface FlipDashboardProps {
  flipMetrics: FlipMetrics;
  /** Phase 4.17 — the full deterministic Fix & Flip financial model. Optional so this component still renders (with just the legacy summary) if the fetch predates this field. */
  fixFlipAnalysis?: FixFlipAnalysis;
  currency?: string;
}

function fmt(n: number, currency = "R") {
  const sign = n < 0 ? "-" : "";
  return `${sign}${currency} ${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function fmtPct(n: number, decimals = 1) {
  return `${n.toFixed(decimals)}%`;
}

function Row({ label, value, bold, border }: { label: string; value: string; bold?: boolean; border?: boolean }) {
  return (
    <div className={clsx("flex justify-between py-1.5", border && "border-b border-av-light-grey pb-3", bold && "font-semibold")}>
      <span className={clsx(!bold && "text-av-slate")}>{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

export default function FlipDashboard({ flipMetrics, fixFlipAnalysis, currency = "R" }: FlipDashboardProps) {
  const a = fixFlipAnalysis?.status === "available" ? fixFlipAnalysis : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          label="Estimated Profit Before Tax"
          value={fmt(flipMetrics.netProfit, currency)}
          tooltipText="Profit after purchase, acquisition costs, renovation, holding costs, financing interest, and agent commission, before any tax. Loan principal is never treated as an expense — see the Financing section below. AssetVerdict does not automatically deduct tax on Fix & Flip disposals — the tax character of a flip (capital gain vs. revenue) depends on the transaction's own facts. An absolute rand amount has no meaning without deal size, so it isn't independently classified — see Pre-Tax ROI and Annualised Pre-Tax ROI for the size-normalized figures (currently unclassified pending recalibration — Phase 4.10)."
          trend="neutral"
        />
        <GaugeDial
          value={flipMetrics.roi}
          unit="%"
          label="Pre-Tax ROI"
          tooltipText="Estimated pre-tax profit as a % of total project cost (purchase + acquisition costs + renovation + holding + financing interest + agent fee). Currently unclassified — its previous bands were calibrated on a post-tax figure and no longer apply (Phase 4.10)."
          metricKey="roi"
          strategyId="fix_and_flip"
          max={60}
        />
        <GaugeDial
          value={a?.profitability.annualisedPreTaxROI ?? flipMetrics.annualisedROI}
          unit="%"
          label="Annualised Pre-Tax ROI"
          tooltipText="Pre-Tax ROI compounded to a 12-month-equivalent rate — (1 + Pre-Tax ROI)^(12 / holding months) − 1 — so deals of different lengths are comparable on a like-for-like annual basis. Currently unclassified — its previous bands were calibrated on a post-tax figure and no longer apply (Phase 4.10)."
          metricKey="annualisedROI"
          strategyId="fix_and_flip"
          max={100}
        />
      </div>

      <div className="rounded-lg border border-av-light-grey p-6 font-body text-sm max-w-md">
        <h3 className="font-display text-base text-av-navy mb-2">Cost Breakdown</h3>
        <Row label="Purchase Price" value={fmt(flipMetrics.purchasePrice, currency)} />
        <Row label="Acquisition Costs" value={fmt(flipMetrics.acquisitionCosts, currency)} />
        <Row label="Renovation Cost" value={fmt(flipMetrics.renovationCost, currency)} />
        <Row label="Holding Costs" value={fmt(flipMetrics.holdingCosts, currency)} />
        <Row label="Financing Interest" value={fmt(flipMetrics.financingInterest, currency)} />
        <Row label="Agent Commission" value={fmt(flipMetrics.agentFee, currency)} border />
        <Row label="Total Cost" value={fmt(flipMetrics.totalCost, currency)} bold />
        <Row label="Expected Sale Price" value={fmt(flipMetrics.expectedSalePrice, currency)} border />
        <Row label="Gross Profit" value={fmt(flipMetrics.grossProfit, currency)} border />
        <div className="flex justify-between py-2 text-base font-bold">
          <span>ESTIMATED PROFIT BEFORE TAX</span>
          {/* Informational only, no colour judgement — an absolute rand
              amount isn't independently classified (Decision 4). Pre-tax:
              AssetVerdict does not deduct tax on Fix & Flip disposals
              (Phase 4.10) — see the tooltip above. */}
          <span className="font-mono text-av-navy">{fmt(flipMetrics.netProfit, currency)}</span>
        </div>
        <p className="text-xs font-body text-av-slate/80 pt-1">
          {a?.modelAssumptions.taxAssumption ??
            "AssetVerdict currently reports Fix & Flip returns before tax. The tax character of a property disposal is not determined by this model."}
        </p>
      </div>

      <div>
        <h3 className="font-display text-lg text-av-navy mb-3">Deal Waterfall</h3>
        <FlipWaterfallChart flipMetrics={flipMetrics} />
      </div>

      {a && (
        <>
          <div className="rounded-lg border border-av-light-grey p-6 font-body text-sm max-w-md">
            <h3 className="font-display text-base text-av-navy mb-2">Financing</h3>
            <Row label="Total Loan Amount" value={fmt(a.financing.totalLoanAmount, currency)} />
            <Row label="Debt Service During Hold" value={fmt(a.financing.totalDebtService, currency)} />
            <Row label="— Interest Paid" value={fmt(a.financing.totalInterestPaid, currency)} />
            <Row label="— Principal Repaid" value={fmt(a.financing.totalPrincipalPaid, currency)} border />
            <Row label="Remaining Balance at Sale" value={fmt(a.financing.remainingLoanBalanceAtSale, currency)} bold />
            <p className="text-xs font-body text-av-slate/80 pt-2">{a.modelAssumptions.financingAssumption}</p>
          </div>

          <div className="rounded-lg border border-av-light-grey p-6 font-body text-sm max-w-md">
            <h3 className="font-display text-base text-av-navy mb-2">Break-Even &amp; Equity Return</h3>
            <Row
              label="Break-Even Sale Price"
              value={a.breakEven.breakEvenSalePrice === null ? "N/A" : fmt(a.breakEven.breakEvenSalePrice, currency)}
            />
            <Row
              label="Sale-Price Buffer"
              value={
                a.breakEven.salePriceBufferRand === null
                  ? "N/A"
                  : `${fmt(a.breakEven.salePriceBufferRand, currency)} (${fmtPct(a.breakEven.salePriceBufferPercent ?? 0)})`
              }
              border
            />
            <Row
              label="Pre-Tax Equity ROI"
              value={a.profitability.preTaxEquityROI === null ? "N/A" : fmtPct(a.profitability.preTaxEquityROI)}
            />
            <Row
              label="Pre-Tax Equity IRR (annualised)"
              value={a.profitability.equityIRR === null ? "N/A" : fmtPct(a.profitability.equityIRR)}
            />
            <p className="text-xs font-body text-av-slate/80 pt-2">
              The break-even sale price is the price at which Estimated Profit Before Tax is approximately zero — it is
              a mathematical target, not a prediction of what the property will sell for. Equity IRR is based on the
              actual monthly timing of your cash invested and returned, then annualised.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
