"use client";

import type { NegotiationAnalysis, NegotiationObjective, NegotiationTargetResult } from "@/lib/calculations/negotiation";
import {
  NEGOTIATION_OBJECTIVE_LABEL,
  NEGOTIATION_UNAVAILABLE_COPY,
  UNSUPPORTED_FINANCING_STRUCTURE_EXPLAINER,
  TARGET_PRICE_EXPLAINER,
  FIXED_LTV_ASSUMPTION_EXPLAINER,
  describeAlreadyMeets,
  describeFixedLtvLimitation,
} from "@/lib/education/negotiationCopy";
import { formatVerdictReason } from "@/lib/education/verdictCopy";
import clsx from "clsx";

interface NegotiationCardProps {
  negotiation: NegotiationAnalysis;
  currency?: string;
}

function formatRand(value: number, currency: string): string {
  const sign = value < 0 ? "-" : "";
  return `${sign}${currency} ${Math.abs(Math.round(value)).toLocaleString("en-US")}`;
}

function ObjectiveRow({
  objective,
  result,
  currency,
  emphasise,
}: {
  objective: NegotiationObjective;
  result: NegotiationTargetResult;
  currency: string;
  emphasise?: boolean;
}) {
  const label = NEGOTIATION_OBJECTIVE_LABEL[objective];

  return (
    <div className={clsx("py-3", !emphasise && "border-t border-av-light-grey/70")}>
      <p className={clsx("font-body font-semibold text-av-navy", emphasise ? "text-sm" : "text-xs uppercase tracking-wide text-av-slate")}>
        {label}
      </p>

      {result.status === "already_meets" && (
        <p className={clsx("font-body text-av-green mt-1", emphasise ? "text-base" : "text-sm")}>
          {describeAlreadyMeets(objective, result.currentPrice, currency)}
        </p>
      )}

      {result.status === "solvable" && (
        <div className="mt-1">
          <p className={clsx("font-display text-av-navy", emphasise ? "text-2xl" : "text-lg")}>
            {formatRand(result.targetPrice, currency)}
          </p>
          <p className="font-body text-xs text-av-slate mt-0.5">
            Reduction needed: {formatRand(result.reductionRand, currency)} ({result.reductionPercent.toFixed(1)}%)
          </p>
        </div>
      )}

      {result.status === "not_achievable_by_price" && (
        <div className="mt-1">
          <p className="font-body text-sm text-av-slate">
            Not achievable through purchase-price negotiation alone.
          </p>
          {result.blockers.length > 0 && (
            <ul className="font-body text-xs text-av-slate/90 mt-1 space-y-1 list-disc list-inside">
              {result.blockers.map((b, i) => (
                <li key={`${b.code}-${i}`}>{formatVerdictReason(b, currency)}</li>
              ))}
            </ul>
          )}
          {describeFixedLtvLimitation(result) && (
            <p className="font-body text-xs text-av-slate/80 mt-1 italic">{describeFixedLtvLimitation(result)}</p>
          )}
        </div>
      )}

      {result.status === "unavailable" && (
        <p className="font-body text-sm text-av-slate mt-1">{NEGOTIATION_UNAVAILABLE_COPY[result.reason]}</p>
      )}
    </div>
  );
}

export default function NegotiationCard({ negotiation, currency = "R" }: NegotiationCardProps) {
  // Every objective becomes "unavailable" together for these three reasons
  // (see analyzeNegotiation's guards) — checking meetRequiredReturn alone is
  // sufficient and matches the other three objectives by construction.
  const wholeCardUnavailableReason =
    negotiation.meetRequiredReturn.status === "unavailable" ? negotiation.meetRequiredReturn.reason : null;

  if (wholeCardUnavailableReason) {
    return (
      <div className="rounded-lg border border-av-light-grey p-5 bg-av-light-grey/30">
        <h3 className="font-display text-lg text-av-navy mb-1">Negotiation Analysis</h3>
        <p className="font-body text-sm text-av-slate">{NEGOTIATION_UNAVAILABLE_COPY[wholeCardUnavailableReason]}</p>
        {wholeCardUnavailableReason === "unsupported_financing_structure" && (
          <p className="font-body text-xs text-av-slate/80 mt-2">{UNSUPPORTED_FINANCING_STRUCTURE_EXPLAINER}</p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-av-light-grey p-5 bg-white">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <h3 className="font-display text-lg text-av-navy">Negotiation Analysis</h3>
        <span className="font-body text-xs text-av-slate">
          Asking Price: <span className="font-semibold text-av-navy">{formatRand(negotiation.currentPrice, currency)}</span>
        </span>
      </div>

      <ObjectiveRow objective="meet_required_return" result={negotiation.meetRequiredReturn} currency={currency} emphasise />

      <div className="mt-2">
        <ObjectiveRow objective="clear_structural_safety" result={negotiation.clearStructuralSafety} currency={currency} />
        <ObjectiveRow objective="reach_strong" result={negotiation.reachStrong} currency={currency} />
        <ObjectiveRow objective="reach_promising" result={negotiation.reachPromising} currency={currency} />
      </div>

      <div className="border-t border-av-light-grey/70 mt-3 pt-3 space-y-2">
        <p className="font-body text-[11px] text-av-slate/80">{TARGET_PRICE_EXPLAINER}</p>
        <p className="font-body text-[11px] text-av-slate/70">{FIXED_LTV_ASSUMPTION_EXPLAINER}</p>
        <p className="font-body text-[11px] text-av-slate/70">
          These are mathematical target prices, not a prediction that the seller will accept them, and not investment
          advice.
        </p>
      </div>
    </div>
  );
}
