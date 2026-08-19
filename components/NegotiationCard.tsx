"use client";

import type { NegotiationAnalysis, NegotiationObjective, NegotiationOpportunity, NegotiationTargetResult } from "@/lib/calculations/negotiation";
import {
  NEGOTIATION_OBJECTIVE_LABEL,
  NEGOTIATION_UNAVAILABLE_COPY,
  UNSUPPORTED_FINANCING_STRUCTURE_EXPLAINER,
  TARGET_PRICE_EXPLAINER,
  FIXED_LTV_ASSUMPTION_EXPLAINER,
  NEGOTIATION_OPPORTUNITY_TITLE,
  NEGOTIATION_OPPORTUNITY_DISCLAIMER,
  describeAlreadyMeets,
  describeFixedLtvLimitation,
  describeNegotiationOpportunity,
} from "@/lib/education/negotiationCopy";
import { formatVerdictReason } from "@/lib/education/verdictCopy";
import clsx from "clsx";

interface NegotiationCardProps {
  negotiation: NegotiationAnalysis;
  opportunity?: NegotiationOpportunity;
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

/**
 * Phase 4.16 — the conditional Negotiation Opportunity status. Deliberately
 * SECONDARY to the "Negotiation Analysis" header above it and to the
 * current Overall Verdict (VerdictCard, rendered before this whole card on
 * the Summary page) — this never overrides or restates the current-price
 * verdict, it only adds a conditional fact on top of it (section 27
 * hierarchy). Every field is shown as plain text (section 36 accessibility
 * — never colour-only), and the mandatory seller-acceptance disclaimer
 * always accompanies the qualifying case.
 */
function OpportunityBanner({ opportunity, currency }: { opportunity: NegotiationOpportunity; currency: string }) {
  if (opportunity.status === "unavailable") return null; // the whole-card unavailable state above already covers this

  const isPromising = opportunity.status === "promising_if_negotiated";
  const title = NEGOTIATION_OPPORTUNITY_TITLE[opportunity.status];
  const description = describeNegotiationOpportunity(opportunity, currency);

  return (
    <div
      className={clsx(
        "rounded-md p-3 mb-3 border",
        isPromising ? "bg-av-gold/10 border-av-gold/40" : "bg-av-light-grey/40 border-av-light-grey"
      )}
    >
      <p className="font-body text-xs font-semibold uppercase tracking-wide text-av-slate mb-1">Negotiation Opportunity</p>
      <p className={clsx("font-display text-lg", isPromising ? "text-av-gold" : "text-av-navy")}>{title}</p>
      <p className="font-body text-sm text-av-slate mt-1">{description}</p>

      {isPromising && opportunity.status === "promising_if_negotiated" && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <p className="font-body text-[11px] text-av-slate uppercase tracking-wide">Maximum Price to Reach Strong</p>
            <p className="font-display text-base text-av-navy">{formatRand(opportunity.targetPrice, currency)}</p>
          </div>
          <div>
            <p className="font-body text-[11px] text-av-slate uppercase tracking-wide">Reduction Required</p>
            <p className="font-display text-base text-av-navy">
              {formatRand(opportunity.reductionRand, currency)} ({opportunity.reductionPercent.toFixed(1)}%)
            </p>
          </div>
          <div className="col-span-2">
            <p className="font-body text-[11px] text-av-slate uppercase tracking-wide">Result at Target Price</p>
            <p className="font-body text-sm font-semibold text-av-green">Strong</p>
          </div>
        </div>
      )}

      {isPromising && <p className="font-body text-[11px] text-av-slate/80 mt-3 italic">{NEGOTIATION_OPPORTUNITY_DISCLAIMER}</p>}
    </div>
  );
}

export default function NegotiationCard({ negotiation, opportunity, currency = "R" }: NegotiationCardProps) {
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

      {opportunity && <OpportunityBanner opportunity={opportunity} currency={currency} />}

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
