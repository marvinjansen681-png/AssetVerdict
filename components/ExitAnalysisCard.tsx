"use client";

import type { PropertyValuation, SuburbProfile } from "@/types";
import type { ExitSummary } from "@/lib/calculations";
import { hasMeaningfulPropertyValuation } from "@/lib/propertyValuation";
import { hasExitAnalysisContent } from "@/lib/areaIntelligence";

interface ExitAnalysisCardProps {
  purchasePrice: number | null;
  floorSize: number | null;
  isSectionalTitle: boolean;
  /** The engine's own exit breakdown (lib/calculations calcExitSummary) — undefined for Fix & Flip, which has its own exit economics (see FlipDashboard/calcFlipProfit) that don't fit a rental hold-period read. */
  exitSummary?: ExitSummary;
  propertyValuation: PropertyValuation | null;
  suburbProfile: SuburbProfile | null;
}

function fmtCurrency(n: number | null | undefined) {
  return n !== null && n !== undefined
    ? `R ${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
    : "--";
}

export default function ExitAnalysisCard({
  purchasePrice,
  floorSize,
  isSectionalTitle,
  exitSummary,
  propertyValuation,
  suburbProfile,
}: ExitAnalysisCardProps) {
  // hasExitAnalysisContent is the single source of truth for this
  // early-return, shared with the parent Area Intelligence accordion so the
  // two can never drift apart. hasValuationEvidence below is narrower — it
  // excludes exitSummary — and drives the "add a valuation" hint further
  // down, which must still show even when exitSummary alone kept this card
  // from returning null.
  if (!hasExitAnalysisContent({ propertyValuation, suburbProfile, exitSummary })) return null;
  const hasValuationEvidence = hasMeaningfulPropertyValuation(propertyValuation) || !!suburbProfile;

  const dealPricePerSqm =
    purchasePrice && floorSize && floorSize > 0 ? purchasePrice / floorSize : null;

  const comparableAvgPricePerSqm =
    propertyValuation && propertyValuation.comparables.length > 0
      ? propertyValuation.comparables
          .map((c) => c.pricePerSqm)
          .filter((v): v is number => v !== null && v !== undefined)
          .reduce((sum, v, _, arr) => sum + v / arr.length, 0) || null
      : null;

  const suburbAvgPurchasePrice = suburbProfile
    ? isSectionalTitle
      ? suburbProfile.stAvgPurchasePrice
      : suburbProfile.fhAvgPurchasePrice
    : null;

  const avmDelta =
    propertyValuation?.estimatedValue && purchasePrice
      ? ((propertyValuation.estimatedValue - purchasePrice) / purchasePrice) * 100
      : null;

  return (
    <div className="rounded-lg border border-av-light-grey p-5">
      <h3 className="font-display text-lg text-av-navy mb-1">Exit Analysis</h3>
      <p className="text-xs font-body text-av-slate mb-4">
        Deterministic exit figures from your deal&apos;s own assumptions, plus market context
        where available.
      </p>

      {exitSummary && (
        <div className="rounded-md border border-av-light-grey p-4 mb-4">
          <h4 className="font-body text-sm font-semibold text-av-navy mb-1">
            Equity IRR / NPV Exit — Year {exitSummary.holdPeriodYears}
          </h4>
          <p className="text-xs font-body text-av-slate mb-3">
            {exitSummary.isPlannedSale
              ? `Your deal currently assumes a sale in Year ${exitSummary.holdPeriodYears}.`
              : "No planned sale year is entered, so AssetVerdict uses a 20-year analysis horizon for Equity IRR and Equity NPV — this is a modelling assumption, not a prediction that you'll sell in Year 20."}
          </p>
          <div className="flex flex-col gap-2 font-body text-sm">
            <div className="flex justify-between">
              <span className="text-av-slate">Projected Property Value at Exit</span>
              <span className="font-mono text-av-navy">
                {fmtCurrency(exitSummary.projectedPropertyValueAtExit)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-av-slate">Less Selling Costs (Agent Commission)</span>
              <span className="font-mono text-av-navy">
                -{fmtCurrency(exitSummary.sellingCostsAtExit)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-av-slate">Less Remaining Debt</span>
              <span className="font-mono text-av-navy">
                -{fmtCurrency(exitSummary.remainingDebtAtExit)}
              </span>
            </div>
            <div className="flex justify-between border-b border-av-light-grey pb-2">
              <span className="text-av-slate">Less Estimated Capital Gains Tax</span>
              <span className="font-mono text-av-navy">
                -{fmtCurrency(exitSummary.capitalGainsTaxAtExit)}
              </span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Estimated Net Equity at Exit</span>
              <span className="font-mono text-av-navy">
                {fmtCurrency(exitSummary.terminalEquityValue)}
              </span>
            </div>
          </div>
          <p className="text-xs font-body text-av-slate/80 mt-3">
            This is the same terminal value your Equity IRR and Equity NPV are calculated from.
            Property value at exit isn&apos;t what you&apos;d actually walk away with — selling
            costs, remaining debt, and capital gains tax come off first.
          </p>
          <p className="text-xs font-body text-av-slate/80 mt-2">
            AssetVerdict uses a simplified CGT estimate: your estimated sale proceeds (property
            value less selling costs) against a base cost of your purchase price of{" "}
            {fmtCurrency(exitSummary.cgtBaseCost)}, at your Effective CGT Rate. Actual base cost may
            include other qualifying acquisition and improvement costs not separately modelled
            here — this is not a calculation of actual tax liability.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-body text-sm">
        {propertyValuation?.estimatedValue && (
          <div className="rounded-md bg-av-light-grey/50 p-3">
            <div className="text-xs text-av-slate mb-1">AVM Estimated Value</div>
            <div className="font-mono text-lg text-av-navy">{fmtCurrency(propertyValuation.estimatedValue)}</div>
            {avmDelta !== null && (
              <div className="text-xs mt-1 text-av-slate">
                {avmDelta >= 0 ? "+" : ""}
                {avmDelta.toFixed(1)}% vs. purchase price
              </div>
            )}
          </div>
        )}

        {dealPricePerSqm !== null && (
          <div className="rounded-md bg-av-light-grey/50 p-3">
            <div className="text-xs text-av-slate mb-1">This Deal — Price / sqm</div>
            <div className="font-mono text-lg text-av-navy">
              R {dealPricePerSqm.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </div>
          </div>
        )}

        {comparableAvgPricePerSqm !== null && (
          <div className="rounded-md bg-av-light-grey/50 p-3">
            <div className="text-xs text-av-slate mb-1">Comparable Sales — Avg Price / sqm</div>
            <div className="font-mono text-lg text-av-navy">
              R {comparableAvgPricePerSqm.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </div>
            <div className="text-xs text-av-slate mt-1">
              Based on {propertyValuation!.comparables.length} comparable sale(s)
            </div>
          </div>
        )}

        {suburbAvgPurchasePrice !== null && suburbAvgPurchasePrice !== undefined && (
          <div className="rounded-md bg-av-light-grey/50 p-3 md:col-span-2">
            <div className="text-xs text-av-slate mb-1">
              Suburb Avg Purchase Price ({isSectionalTitle ? "Sectional Title" : "Freehold"})
            </div>
            <div className="font-mono text-lg text-av-navy">{fmtCurrency(suburbAvgPurchasePrice)}</div>
          </div>
        )}
      </div>

      {!hasValuationEvidence && (
        <p className="text-xs font-body text-av-slate mt-3">
          Add a property valuation or link a suburb profile for comparable sales and exit market
          context.
        </p>
      )}
    </div>
  );
}
