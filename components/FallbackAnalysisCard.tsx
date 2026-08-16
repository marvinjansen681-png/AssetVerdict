"use client";

import { calcRentSuggestion } from "@/lib/area-suggestions";
import { hasFallbackAnalysisContent } from "@/lib/areaIntelligence";
import type { StrategyId } from "@/lib/strategies";
import type { SuburbProfile } from "@/types";

interface FallbackAnalysisCardProps {
  strategyId: StrategyId;
  isSectionalTitle: boolean;
  bedrooms: number | null;
  numUnits: number | null;
  studentRoomMix?: { singleRoomCount: number; sharingRoomCount: number; sharingBedsPerRoom: number } | null;
  currentMonthlyRent: number | null;
  financeCostMonthly: number;
  suburbProfile: SuburbProfile | null;
}

export default function FallbackAnalysisCard({
  strategyId,
  isSectionalTitle,
  bedrooms,
  numUnits,
  studentRoomMix,
  currentMonthlyRent,
  financeCostMonthly,
  suburbProfile,
}: FallbackAnalysisCardProps) {
  if (!hasFallbackAnalysisContent(strategyId)) return null;

  const suggestion = calcRentSuggestion({
    strategy: strategyId,
    isSectionalTitle,
    bedrooms,
    numUnits,
    studentRoomMix,
    suburbProfile,
    currentMonthlyRent,
  });

  if (!suggestion.available || suggestion.fallbackEstimate === null) {
    return (
      <div className="rounded-lg border border-dashed border-av-light-grey p-5">
        <h3 className="font-display text-lg text-av-navy mb-2">Fallback Analysis</h3>
        <p className="text-sm font-body text-av-slate">
          Link a suburb profile with rental price data to see what this deal would earn on a
          conventional long-term lease if your primary strategy underperforms.
        </p>
      </div>
    );
  }

  const covers = suggestion.fallbackEstimate >= financeCostMonthly;
  const coverageRatio = financeCostMonthly > 0 ? suggestion.fallbackEstimate / financeCostMonthly : null;

  const strategyLabel =
    strategyId === "str" ? "short-term bookings dry up" : "you can't keep rooms filled individually";

  return (
    <div className="rounded-lg border border-av-light-grey p-5">
      <h3 className="font-display text-lg text-av-navy mb-1">Fallback Analysis</h3>
      <p className="text-xs font-body text-av-slate mb-4">
        If {strategyLabel}, could this property still cover its bond as a standard single-tenancy
        lease?
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-body text-sm mb-4">
        <div className="rounded-md bg-av-light-grey/50 p-3">
          <div className="text-xs text-av-slate mb-1">Conventional Fallback Rent</div>
          <div className="font-mono text-lg text-av-navy">
            R {suggestion.fallbackEstimate.toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </div>
        </div>
        <div className="rounded-md bg-av-light-grey/50 p-3">
          <div className="text-xs text-av-slate mb-1">Monthly Debt Service</div>
          <div className="font-mono text-lg text-av-navy">
            R {financeCostMonthly.toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>

      <div
        className={`rounded-md p-4 font-body text-sm flex items-center justify-between ${
          covers ? "bg-av-green/10 text-av-green" : "bg-av-red/10 text-av-red"
        }`}
      >
        <span className="font-semibold">
          {covers ? "Fallback rent covers debt service" : "Fallback rent does not cover debt service"}
        </span>
        {coverageRatio !== null && <span className="font-mono">{coverageRatio.toFixed(2)}x</span>}
      </div>
      <p className="text-xs font-body text-av-slate/80 mt-2">
        Based on the {suggestion.band?.label ?? "matched"} band from {suggestion.suburbName}. Does not
        account for operating expenses beyond debt service — treat as a directional floor, not a full
        underwrite.
      </p>
    </div>
  );
}
