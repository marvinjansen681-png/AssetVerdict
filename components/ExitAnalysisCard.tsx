"use client";

import type { PropertyValuation, SuburbProfile } from "@/types";

interface ExitAnalysisCardProps {
  purchasePrice: number | null;
  marketValue: number | null;
  floorSize: number | null;
  isSectionalTitle: boolean;
  capitalGrowthRate: number | null;
  saleYear: number | null;
  wantToSell: boolean;
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
  marketValue,
  floorSize,
  isSectionalTitle,
  capitalGrowthRate,
  saleYear,
  wantToSell,
  propertyValuation,
  suburbProfile,
}: ExitAnalysisCardProps) {
  const hasContext = !!propertyValuation || !!suburbProfile;
  if (!hasContext && !wantToSell) return null;

  const projectedSalePrice =
    wantToSell && marketValue && capitalGrowthRate !== null && saleYear
      ? marketValue * Math.pow(1 + capitalGrowthRate / 100, saleYear)
      : null;

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
        Resale prospects based on comparable sales, market valuation, and suburb transaction
        benchmarks.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-body text-sm">
        {projectedSalePrice !== null && (
          <div className="rounded-md bg-av-light-grey/50 p-3">
            <div className="text-xs text-av-slate mb-1">Projected Sale Price (Year {saleYear})</div>
            <div className="font-mono text-lg text-av-navy">{fmtCurrency(projectedSalePrice)}</div>
          </div>
        )}

        {propertyValuation?.estimatedValue && (
          <div className="rounded-md bg-av-light-grey/50 p-3">
            <div className="text-xs text-av-slate mb-1">AVM Estimated Value</div>
            <div className="font-mono text-lg text-av-navy">{fmtCurrency(propertyValuation.estimatedValue)}</div>
            {avmDelta !== null && (
              <div className={`text-xs mt-1 ${avmDelta >= 0 ? "text-av-green" : "text-av-red"}`}>
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

      {!propertyValuation && !suburbProfile && (
        <p className="text-xs font-body text-av-slate mt-3">
          Add a property valuation or link a suburb profile for comparable sales and exit market
          context.
        </p>
      )}
    </div>
  );
}
