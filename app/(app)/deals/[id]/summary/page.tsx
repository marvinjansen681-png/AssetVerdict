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
import MentorDrawer from "@/components/MentorDrawer";
import Button from "@/components/ui/Button";
import StrategyBadge from "@/components/StrategyBadge";
import FlipDashboard from "@/components/FlipDashboard";
import Link from "next/link";
import type { DealMetrics } from "@/lib/calculations";
import { isFiniteNumber } from "@/lib/calculations";
import type { CapexItem } from "@/types";
import { useState, useEffect } from "react";

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
    isLoading,
    error,
  } = useDealMetrics(id);

  const [capexItems, setCapexItems] = useState<CapexItem[]>([]);
  useEffect(() => {
    if (capexFromApi) setCapexItems(capexFromApi);
  }, [capexFromApi]);

  const [exporting, setExporting] = useState(false);

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
            value={activeMetrics.irr}
            unit="%"
            label="IRR"
            tooltipText="Internal Rate of Return — the annualised return on your total investment over 20 years. Above 15% is strong."
            metricKey="irr"
            strategyId={strategyId}
            max={40}
            benchmarkValue={15}
          />
          <GaugeDial
            value={activeMetrics.netYieldPreTax}
            unit="%"
            label="Net Yield Yr 1 (pre-tax)"
            tooltipText="Your first-year net income as a % of total investment, before tax."
            metricKey="netYieldPreTax"
            strategyId={strategyId}
            max={20}
            benchmarkValue={8}
          />
          <GaugeDial
            value={activeMetrics.capRatePP}
            unit="%"
            label="Cap Rate (PP)"
            tooltipText="Net Operating Income as a % of your purchase price. 8–12% is the typical commercial sweet spot."
            metricKey="capRatePP"
            strategyId={strategyId}
            max={20}
            benchmarkValue={10}
          />
          <MetricCard
            label="NPV"
            value={formatCurrency(activeMetrics.npv)}
            tooltipText="Net Present Value — the total value created by this deal in today's money, discounted at your discount rate."
            trend={activeMetrics.npv >= 0 ? "positive" : "negative"}
          />
          <GaugeDial
            value={activeMetrics.capRateMV}
            unit="%"
            label="Cap Rate (MV)"
            tooltipText="Net Operating Income as a % of market value. Helps assess if you bought below market."
            metricKey="capRateMV"
            strategyId={strategyId}
            max={20}
            benchmarkValue={10}
          />
          <GaugeDial
            value={activeMetrics.dscr}
            unit="x"
            label="Debt Service Ratio"
            tooltipText="How many times your NOI covers your debt repayments. Above 1.25 is safe; below 1 means the property can't service its debt."
            metricKey="dscr"
            strategyId={strategyId}
            max={3}
            benchmarkValue={1.25}
          />
          <GaugeDial
            value={activeMetrics.operatingExpenseRatio}
            unit="%"
            label="Operating Expense Ratio"
            tooltipText="Total expenses as a % of gross revenue. Lower is better — below 40% is excellent."
            metricKey="operatingExpenseRatio"
            strategyId={strategyId}
            max={100}
            benchmarkValue={40}
          />
          <GaugeDial
            value={
              isFiniteNumber(activeMetrics.paybackPeriod)
                ? activeMetrics.paybackPeriod
                : null
            }
            unit="Yrs"
            label="Payback Period"
            tooltipText="How many years before you recover your total investment from cashflow alone."
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
            value={activeMetrics.netYieldPreTax}
            unit="%"
            label="Net Yield Yr 1 (pre-tax)"
            tooltipText="Your first-year net income as a % of total investment, before tax."
            metricKey="netYieldPreTax"
            strategyId={strategyId}
            max={20}
            benchmarkValue={8}
          />
          <GaugeDial
            value={activeMetrics.netYieldPostTax}
            unit="%"
            label="Net Yield Yr 1 (post-tax)"
            tooltipText="Your first-year net income as a % of total investment, after tax."
            metricKey="netYieldPostTax"
            strategyId={strategyId}
            max={20}
            benchmarkValue={6}
          />
          <GaugeDial
            value={activeMetrics.irr}
            unit="%"
            label="IRR"
            tooltipText="Internal Rate of Return over 20 years."
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
            value={formatCurrency(activeMetrics.npv)}
            tooltipText="Net Present Value — the total value created by this deal in today's money."
            trend={activeMetrics.npv >= 0 ? "positive" : "negative"}
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
            value={activeMetrics.dscr}
            unit="x"
            label="Debt Service Ratio"
            tooltipText="How many times your NOI covers your debt repayments. Above 1.25 is safe; below 1 means the property can't service its debt."
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
            tooltipText="The occupancy rate needed to cover all costs including debt. Lower is safer."
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
            tooltipText="Total expenses as a % of gross revenue. Lower is better — below 40% is excellent."
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
            value={
              isFiniteNumber(activeMetrics.paybackPeriod)
                ? activeMetrics.paybackPeriod
                : null
            }
            unit="Yrs"
            label="Payback Period"
            tooltipText="The Payback Period refers to the amount of time it takes to recover the cost of your investment."
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

      <MentorDrawer dealId={id} />
    </div>
  );
}
