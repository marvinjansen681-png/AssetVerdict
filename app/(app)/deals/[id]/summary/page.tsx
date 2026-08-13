"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useDealMetrics } from "@/hooks/useDealMetrics";
import GaugeDial from "@/components/gauges/GaugeDial";
import MetricCard from "@/components/gauges/MetricCard";
import AccordionSection from "@/components/AccordionSection";
import ScenarioSelector, { type ScenarioKey } from "@/components/ScenarioSelector";
import CashflowTable from "@/components/charts/CashflowTable";
import CapexPieChart from "@/components/charts/CapexPieChart";
import ProjectCashflowChart from "@/components/charts/ProjectCashflowChart";
import SimpleYearTable from "@/components/charts/SimpleYearTable";
import DealCoachDrawer from "@/components/DealCoachDrawer";
import Button from "@/components/ui/Button";
import StrategyBadge from "@/components/StrategyBadge";
import FlipDashboard from "@/components/FlipDashboard";
import FallbackAnalysisCard from "@/components/FallbackAnalysisCard";
import ExitAnalysisCard from "@/components/ExitAnalysisCard";
import UnderstandYourDeal from "@/components/education/UnderstandYourDeal";
import type { StrategyId } from "@/lib/strategies";
import Link from "next/link";
import type { DealMetrics } from "@/lib/calculations";
import { isFiniteNumber } from "@/lib/calculations";
import { getMetricApplicability, applicabilityContextFromMetrics } from "@/lib/calculations/applicability";
import type { CapexItem } from "@/types";
import { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import clsx from "clsx";

function formatCurrency(value: number) {
  const sign = value < 0 ? "-" : "";
  return `${sign}R ${Math.abs(value).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

export default function DealSummaryPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const router = useRouter();
  const searchParams = useSearchParams();
  const scenario = (searchParams.get("scenario") as ScenarioKey) ?? "base";

  const {
    metrics,
    scenarios,
    rentalGrowthRate,
    costInflation,
    capexItems: capexFromApi,
    renovationItems,
    dealName,
    address,
    currency,
    investmentStrategy,
    dealSummary,
    propertyValuation,
    suburbProfile,
    isLoading,
    error,
  } = useDealMetrics(id);

  const [capexItems, setCapexItems] = useState<CapexItem[]>([]);
  useEffect(() => {
    if (capexFromApi) setCapexItems(capexFromApi);
  }, [capexFromApi]);

  const [exporting, setExporting] = useState(false);
  const [understandOpen, setUnderstandOpen] = useState(false);
  const [coachSelection, setCoachSelection] = useState<{ metricKey: string } | null>(null);

  function handleScenarioSelect(s: ScenarioKey) {
    router.push(`/deals/${id}/summary?scenario=${s}`);
  }

  async function handleExportPdf() {
    if (!scenarios || !dealSummary || !dealName) return;
    setExporting(true);
    try {
      const [{ pdf }, { default: DealSummaryPDF }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/lib/pdf/DealSummaryPDF"),
      ]);

      const blob = await pdf(
        <DealSummaryPDF
          dealName={dealName}
          address={address}
          currency={currency ?? "ZAR"}
          strategyId={investmentStrategy ?? "commercial"}
          activeScenario={scenario}
          scenarios={scenarios}
          dealSummary={dealSummary}
          renovationItems={renovationItems}
          propertyValuation={propertyValuation}
          suburbProfile={suburbProfile}
        />
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `AssetVerdict_${dealName.replace(/\s+/g, "_")}_${dateStr}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  const activeMetrics: DealMetrics | undefined = scenarios
    ? scenarios[scenario].metrics
    : metrics;
  const activeProjection = scenarios ? scenarios[scenario].projection : undefined;
  const strategyId = investmentStrategy ?? "commercial";
  const isFlip = strategyId === "fix_and_flip";

  if (isLoading) {
    return (
      <div className="px-4 md:px-8 py-8 max-w-5xl mx-auto">
        <p className="font-body text-av-slate">Calculating your verdict...</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-40 rounded-lg bg-av-light-grey animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    const missingFields = error.missingFields ?? [];
    return (
      <div className="px-4 md:px-8 py-8 max-w-xl mx-auto text-center">
        <h1 className="font-display text-2xl text-av-navy mb-3">
          Complete your deal inputs to see your verdict.
        </h1>
        <ul className="text-left inline-block mb-6">
          {missingFields.map((f) => (
            <li key={f.key} className="font-body text-sm text-av-slate py-1">
              <Link
                href={`/deals/${id}/edit/${f.tab}`}
                className="text-av-navy underline"
              >
                {f.label} → {f.tab}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (!activeMetrics) return null;

  // Equity IRR, Equity NPV, Net Yield (Cash-on-Cash), and Equity Payback
  // Period are all denominated in the investor's own equity, not the
  // property's total cost — with no (or negative) equity invested, i.e. a
  // fully or over-financed deal, they're undefined, not a real 0%/0-years/
  // R0. See lib/calculations/applicability.ts.
  const applicabilityCtx = applicabilityContextFromMetrics(activeMetrics);
  const equityMetricsApplicable = getMetricApplicability("irr", applicabilityCtx).applicable;
  const showIrr = equityMetricsApplicable ? activeMetrics.irr : null;
  const showNpv = equityMetricsApplicable ? activeMetrics.npv : null;
  const showNetYieldPreTax = equityMetricsApplicable ? activeMetrics.netYieldPreTax : null;
  const showNetYieldPostTax = equityMetricsApplicable ? activeMetrics.netYieldPostTax : null;
  const showPaybackPeriod =
    equityMetricsApplicable && isFiniteNumber(activeMetrics.paybackPeriod)
      ? activeMetrics.paybackPeriod
      : null;

  return (
    <div className="px-4 md:px-8 py-8 max-w-5xl mx-auto flex flex-col gap-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="font-display text-2xl text-av-navy">Deal Summary</h1>
          <StrategyBadge strategyId={strategyId} />
          <span className="text-xs font-body font-semibold px-3 py-1 rounded-full bg-av-light-grey text-av-navy capitalize">
            {scenario} Case
          </span>
        </div>
        <div className="flex items-center gap-3">
          <ScenarioSelector
            currentScenario={scenario}
            onSelect={handleScenarioSelect}
          />
          <Button variant="secondary" onClick={handleExportPdf} disabled={exporting}>
            {exporting ? "Exporting..." : "Export PDF"}
          </Button>
        </div>
      </div>

      <AccordionSection title="Scenarios" defaultOpen={false}>
        <p className="font-body text-sm text-av-slate">
          Switch between Bear, Base, and Bull cases above to see how this
          deal&apos;s metrics respond to less favourable or more favourable
          market conditions.
        </p>
      </AccordionSection>

      <p className="font-body text-xs text-av-slate italic -mt-4">
        ℹ️ Thresholds shown are calibrated for {strategyId.replace(/_/g, " ")} investments.
      </p>

      <section className="rounded-lg border border-av-gold/40 bg-av-white p-5 md:p-6">
        <button
          type="button"
          onClick={() => setUnderstandOpen((o) => !o)}
          aria-expanded={understandOpen}
          aria-controls="understand-your-deal-panel"
          className="w-full flex items-center justify-between gap-4 text-left min-h-[44px]"
        >
          <div>
            <h2 className="font-display text-xl text-av-navy">Understand Your Deal</h2>
            <p className="font-body text-sm text-av-slate mt-1">
              Learn what these numbers mean, where they come from, and how they work together.
            </p>
          </div>
          <span className="shrink-0 inline-flex items-center gap-1.5 font-body text-sm font-semibold text-av-navy bg-av-light-grey rounded-md px-4 py-2.5 min-h-[44px]">
            {understandOpen ? "Close" : "Open learning panel"}
            <ChevronDown size={16} className={clsx("transition-transform", understandOpen && "rotate-180")} />
          </span>
        </button>

        {understandOpen && dealSummary && (
          <div id="understand-your-deal-panel" className="mt-6 pt-6 border-t border-av-light-grey">
            <UnderstandYourDeal
              metrics={activeMetrics}
              dealSummary={dealSummary}
              strategyId={strategyId}
              currency={currency === "ZAR" || !currency ? "R" : currency}
              onAskCoach={(metricKey) => setCoachSelection({ metricKey })}
            />
          </div>
        )}
      </section>

      {isFlip && activeMetrics.flipMetrics ? (
        <FlipDashboard flipMetrics={activeMetrics.flipMetrics} currency="R" />
      ) : (
        <>
      <section>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="font-display text-xl text-av-navy">Returns</h2>
          <div className="flex-1 h-[2px] bg-av-gold" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <GaugeDial
            value={showIrr}
            unit="%"
            label="IRR"
            tooltipText="Equity IRR — the annualised return on the cash YOU invest in the deal (after debt financing and tax), over 20 years including the eventual sale. Above 15% is strong. Not applicable if the deal is fully or over-financed (no positive equity invested)."
            metricKey="irr"
            strategyId={strategyId}
            max={40}
            benchmarkValue={15}
          />
          <GaugeDial
            value={showNetYieldPreTax}
            unit="%"
            label="Cash-on-Cash Return (Pre-Tax)"
            tooltipText="A Cash-on-Cash Return: your first-year cashflow after debt service, before tax, as a % of your own cash invested (not the full purchase price)."
            metricKey="netYieldPreTax"
            strategyId={strategyId}
            max={20}
            benchmarkValue={8}
          />
          <GaugeDial
            value={activeMetrics.capRatePP}
            unit="%"
            label="Cap Rate (PP)"
            tooltipText="Net Operating Income as a % of your purchase price — the property's own unlevered return, before financing. 8–12% is the typical commercial sweet spot."
            metricKey="capRatePP"
            strategyId={strategyId}
            max={20}
            benchmarkValue={10}
          />
          <MetricCard
            label="NPV"
            value={showNpv !== null ? formatCurrency(showNpv) : "N/A"}
            tooltipText="Equity NPV — the value this deal creates today, in today's money, on the cash YOU invest, discounted at your required equity return. Not applicable if the deal is fully or over-financed."
            trend={showNpv === null ? "neutral" : showNpv >= 0 ? "positive" : "negative"}
          />
          <GaugeDial
            value={activeMetrics.capRateMV}
            unit="%"
            label="Cap Rate (MV)"
            tooltipText="Net Operating Income as a % of market value. Helps assess if you bought below market."
            metricKey="capRateMV"
            strategyId={strategyId}
            max={20}
            // Phase 4 audit fix: the marker was hardcoded to 10, but the
            // actual rule (COMMERCIAL_THRESHOLDS.capRateMV, thresholds.ts)
            // has always coloured green at >8 — the arrow was pointing at
            // the wrong spot relative to the arc it sits on. This corrects
            // the marker to match the existing, unchanged rule; it does not
            // change any classification.
            benchmarkValue={8}
          />
          <GaugeDial
            value={isFiniteNumber(activeMetrics.dscr) ? activeMetrics.dscr : null}
            unit="x"
            label="DSCR"
            tooltipText="Debt Service Coverage Ratio — how many times your NOI covers your annual debt repayments. Above 1.25x is safe; below 1x means the property can't service its debt. With no debt, DSCR doesn't apply."
            metricKey="dscr"
            strategyId={strategyId}
            max={3}
            benchmarkValue={1.25}
          />
          <GaugeDial
            value={activeMetrics.operatingExpenseRatio}
            unit="%"
            label="Operating Expense Ratio"
            tooltipText="Operating expenses (excl. debt repayments) as a % of gross revenue. Lower is better — below 40% is excellent."
            metricKey="operatingExpenseRatio"
            strategyId={strategyId}
            max={100}
            benchmarkValue={40}
          />
          <GaugeDial
            value={showPaybackPeriod}
            unit="Yrs"
            label="Payback Period"
            tooltipText="How many years before you recover the cash YOU invested, from after-debt-service cashflow alone. Not applicable if the deal is fully or over-financed."
            metricKey="paybackPeriod"
            strategyId={strategyId}
            max={30}
            benchmarkValue={8}
          />
        </div>
      </section>

      <AccordionSection title="Yields & Returns">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <GaugeDial
            value={activeMetrics.grossYield}
            unit="%"
            label="Gross Yield"
            tooltipText="Annual gross revenue as a % of purchase price."
            metricKey="grossYield"
            strategyId={strategyId}
            max={40}
            benchmarkValue={10}
          />
          <GaugeDial
            value={showNetYieldPreTax}
            unit="%"
            label="Cash-on-Cash Return (Pre-Tax)"
            tooltipText="A Cash-on-Cash Return: your first-year cashflow after debt service, before tax, as a % of your own cash invested (not the full purchase price)."
            metricKey="netYieldPreTax"
            strategyId={strategyId}
            max={20}
            benchmarkValue={8}
          />
          <GaugeDial
            value={showNetYieldPostTax}
            unit="%"
            label="Cash-on-Cash Return (Post-Tax)"
            tooltipText="A Cash-on-Cash Return: your first-year cashflow after debt service, after tax, as a % of your own cash invested (not the full purchase price)."
            metricKey="netYieldPostTax"
            strategyId={strategyId}
            max={20}
            benchmarkValue={6}
          />
          <GaugeDial
            value={showIrr}
            unit="%"
            label="IRR"
            tooltipText="Equity IRR over 20 years — the annualised return on the cash YOU invest, after financing and tax."
            metricKey="irr"
            strategyId={strategyId}
            max={40}
            benchmarkValue={15}
          />
          <GaugeDial
            value={activeMetrics.noiMargin}
            unit="%"
            label="NOI Margin"
            tooltipText="NOI as a % of gross revenue. Shows operational efficiency."
            metricKey="noiMargin"
            strategyId={strategyId}
            max={100}
            benchmarkValue={60}
          />
          <MetricCard
            label="NPV"
            value={showNpv !== null ? formatCurrency(showNpv) : "N/A"}
            tooltipText="Equity NPV — the value this deal creates today, in today's money, on the cash YOU invest."
            trend={showNpv === null ? "neutral" : showNpv >= 0 ? "positive" : "negative"}
          />
        </div>
      </AccordionSection>

      <AccordionSection title="Cashflow">
        <CashflowTable
          metrics={activeMetrics}
          rentalGrowthRate={rentalGrowthRate ?? 0}
          costInflation={costInflation ?? 0}
        />
      </AccordionSection>

      <AccordionSection title="Debt & Coverage">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <GaugeDial
            value={isFiniteNumber(activeMetrics.dscr) ? activeMetrics.dscr : null}
            unit="x"
            label="DSCR"
            tooltipText="Debt Service Coverage Ratio — how many times your NOI covers your annual debt repayments. Above 1.25x is safe; below 1x means the property can't service its debt. With no debt, DSCR doesn't apply."
            metricKey="dscr"
            strategyId={strategyId}
            max={3}
            benchmarkValue={1.25}
          />
          <GaugeDial
            value={activeMetrics.ltv}
            unit="%"
            label="LTV"
            tooltipText="Loan-to-Value ratio — your total debt as a % of purchase price."
            metricKey="ltv"
            strategyId={strategyId}
            max={100}
            benchmarkValue={60}
          />
          <GaugeDial
            value={activeMetrics.breakEvenRatio}
            unit="%"
            label="Break-even Ratio"
            tooltipText="The share of gross revenue needed to cover all operating expenses plus debt repayments. Lower is safer."
            metricKey="breakEvenRatio"
            strategyId={strategyId}
            max={100}
            benchmarkValue={75}
          />
        </div>
      </AccordionSection>

      <AccordionSection title="Cost Ratios">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <GaugeDial
            value={activeMetrics.utilitiesRatio}
            unit="%"
            label="Utilities Ratio"
            tooltipText="Utility costs (water, electricity, security) as a % of gross revenue."
            metricKey="utilitiesRatio"
            strategyId={strategyId}
            max={50}
            benchmarkValue={15}
          />
          <GaugeDial
            value={activeMetrics.operatingExpenseRatio}
            unit="%"
            label="Operating Expense Ratio"
            tooltipText="Operating expenses (excl. debt repayments) as a % of gross revenue. Lower is better — below 40% is excellent."
            metricKey="operatingExpenseRatio"
            strategyId={strategyId}
            max={100}
            benchmarkValue={40}
          />
        </div>
      </AccordionSection>

      <AccordionSection title="Valuation">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <GaugeDial
            value={activeMetrics.capRateSpread}
            unit="%"
            label="Cap Rate Spread"
            tooltipText="How much better your deal is vs the market — more than 2% above market is strong, showing you bought below value."
            metricKey="capRateSpread"
            strategyId={strategyId}
            min={-5}
            max={10}
            benchmarkValue={2}
          />
          <GaugeDial
            value={showPaybackPeriod}
            unit="Yrs"
            label="Payback Period"
            tooltipText="The amount of time it takes to recover the cash YOU invested, from after-debt-service cashflow."
            metricKey="paybackPeriod"
            strategyId={strategyId}
            max={30}
            benchmarkValue={8}
          />
        </div>
      </AccordionSection>

      <AccordionSection title="Equity / Debt Ratio">
        {activeProjection ? (
          <SimpleYearTable
            projection={activeProjection}
            rows={[
              { label: "Property Value", get: (p) => p.propertyValue },
              { label: "Remaining Debt", get: (p) => p.remainingDebt },
              {
                label: "Equity",
                get: (p) => p.propertyValue - p.remainingDebt,
              },
            ]}
          />
        ) : null}
      </AccordionSection>

      <AccordionSection title="Operating Profit">
        {activeProjection ? (
          <SimpleYearTable
            projection={activeProjection}
            rows={[{ label: "NOI", get: (p) => p.noi }]}
          />
        ) : null}
      </AccordionSection>

      <AccordionSection title="Net Profit">
        {activeProjection ? (
          <SimpleYearTable
            projection={activeProjection}
            rows={[
              { label: "Cashflow After Tax", get: (p) => p.cashflowForPeriod },
            ]}
          />
        ) : null}
      </AccordionSection>

      <AccordionSection title="Project Cashflow">
        {activeProjection ? (
          <ProjectCashflowChart projection={activeProjection} />
        ) : null}
      </AccordionSection>
        </>
      )}

      <AccordionSection title="Capex Spend">
        <CapexPieChart
          dealId={id}
          capexItems={capexItems}
          onItemAdded={(item) => setCapexItems((prev) => [...prev, item])}
        />
      </AccordionSection>

      {dealSummary && (
        <AccordionSection title="Area Intelligence">
          <div className="flex flex-col gap-4">
            <FallbackAnalysisCard
              strategyId={strategyId as StrategyId}
              isSectionalTitle={dealSummary.isSectionalTitle}
              bedrooms={dealSummary.bedrooms}
              numUnits={dealSummary.numUnits}
              currentMonthlyRent={dealSummary.monthlyRent}
              financeCostMonthly={dealSummary.financeSources.reduce(
                (sum, f) => sum + (f.repaymentAmount ?? 0),
                0
              )}
              suburbProfile={suburbProfile ?? null}
            />
            <ExitAnalysisCard
              purchasePrice={dealSummary.purchasePrice}
              marketValue={dealSummary.marketValue}
              floorSize={dealSummary.floorSize}
              isSectionalTitle={dealSummary.isSectionalTitle}
              capitalGrowthRate={dealSummary.capitalGrowthRate}
              saleYear={dealSummary.saleYear}
              wantToSell={dealSummary.wantToSell}
              propertyValuation={propertyValuation ?? null}
              suburbProfile={suburbProfile ?? null}
            />
          </div>
        </AccordionSection>
      )}

      <DealCoachDrawer
        dealId={id}
        strategyId={strategyId}
        activeScenario={scenario}
        pendingSelection={coachSelection}
        onPendingSelectionHandled={() => setCoachSelection(null)}
      />
    </div>
  );
}
