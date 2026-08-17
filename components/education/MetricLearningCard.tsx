"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import clsx from "clsx";
import Card from "@/components/ui/Card";
import type { DealMetrics } from "@/lib/calculations";
import type { ApplicabilityContext } from "@/lib/calculations/applicability";
import { getIrrReferenceClassification, type GaugeColor } from "@/lib/calculations/thresholds";
import { explainDealMetric } from "@/lib/education/explainMetric";
import {
  getMetricBreakdown,
  getMetricRawValue,
  METRIC_VALUE_FORMAT,
  type AcquisitionSummary,
} from "@/lib/education/metricBreakdowns";
import { formatMetricValue } from "@/lib/education/format";
import { interpretMetricValue } from "@/lib/education/interpretMetric";
import { getKeyLabel } from "@/lib/education/relationshipChains";
import type { MetricPerspective } from "@/lib/education/metricDefinitions";

const PERSPECTIVE_LABEL: Record<MetricPerspective, string> = {
  property: "Property",
  financing: "Financing",
  investor: "Investor Return",
  flip: "Fix & Flip",
};

const PERSPECTIVE_STYLE: Record<MetricPerspective, string> = {
  property: "bg-[#EAF3FF] text-[#1D4E89]",
  financing: "bg-[#FDF3E7] text-[#8A5A15]",
  investor: "bg-[#EFEAF7] text-[#4B2E83]",
  flip: "bg-av-light-grey text-av-navy",
};

const JUDGEMENT_DOT: Record<GaugeColor, string> = {
  green: "bg-av-green",
  orange: "bg-av-orange",
  red: "bg-av-red",
};

const JUDGEMENT_TEXT: Record<GaugeColor, string> = {
  green: "text-av-green",
  orange: "text-av-orange",
  red: "text-av-red",
};

interface MetricLearningCardProps {
  metricKey: string;
  metrics: DealMetrics;
  dealSummary: AcquisitionSummary;
  strategyId: string;
  applicabilityCtx: ApplicabilityContext;
  currency?: string;
  defaultOpen?: boolean;
  /**
   * The investor's required annual return (DealInputs.discountRate), for
   * display only — target-relative metrics (Equity IRR, Cash-on-Cash) are
   * already classified against the same number via `applicabilityCtx`
   * (Phase 4.1); this is just so the card can show "vs your required
   * return of X%" in plain text next to the judgement.
   */
  discountRate?: number;
  /** Renders "Ask Deal Coach about this" when supplied (Phase 3 hand-off — see components/DealCoachDrawer.tsx). */
  onAskCoach?: (metricKey: string) => void;
  /** Commercial only (Phase 4.7) — omit/undefined for every other strategy so the Break-Even Ratio interpretation never mentions lease term outside Commercial. Null means recorded-as-unknown, not "0 months." */
  leaseTermMonths?: number | null;
}

/**
 * The reusable "Understand Your Deal" card for a single metric: current
 * value, perspective badge, plain-English explanation, and — on expand — the
 * deterministic formula breakdown, what the number means, and connected
 * metrics. Every number shown comes from `metrics` (the deterministic
 * engine's output) or the static registry; this component computes nothing.
 */
export default function MetricLearningCard({
  metricKey,
  metrics,
  dealSummary,
  strategyId,
  applicabilityCtx,
  currency = "R",
  defaultOpen = false,
  discountRate,
  onAskCoach,
  leaseTermMonths,
}: MetricLearningCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  const rawValue = getMetricRawValue(metricKey, metrics);
  const explanation = explainDealMetric(metricKey, rawValue, strategyId, applicabilityCtx);
  if (!explanation) return null;

  const { definition, classification, applicabilityReason, judgementProvisional } = explanation;
  const valueFormat = METRIC_VALUE_FORMAT[metricKey] ?? "number";
  const applicable = classification.applicable;
  const displayValue = applicable ? formatMetricValue(rawValue, valueFormat, currency) : "N/A";

  const breakdown = applicable ? getMetricBreakdown({ metricKey, metrics, dealSummary }) : undefined;
  const interpretation =
    applicable && rawValue !== null
      ? interpretMetricValue(metricKey, rawValue, {
          holdPeriodYears: metrics.irrSummary.holdPeriodYears,
          isPlannedSale: metrics.exitSummary?.isPlannedSale ?? false,
          leaseTermMonths: strategyId === "commercial" ? leaseTermMonths ?? null : undefined,
          utilityContext: {
            billsIncludedMonthly: metrics.operatingCostsMonthly.billsIncludedMonthly,
            recoveriesMonthly: metrics.revenueMonthly.recoveries,
          },
        })
      : undefined;

  const perspectiveLabel = PERSPECTIVE_LABEL[definition.perspective];
  const perspectiveStyle = PERSPECTIVE_STYLE[definition.perspective];

  return (
    <Card className="p-4 md:p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-body font-semibold text-av-navy text-[15px]">{definition.name}</h3>
            {definition.shortName && definition.shortName !== definition.name && (
              <span className="font-mono text-xs text-av-slate">{definition.shortName}</span>
            )}
          </div>
          <span
            className={clsx(
              "inline-block mt-1.5 text-[10px] font-body font-semibold tracking-wide uppercase px-2 py-0.5 rounded",
              perspectiveStyle
            )}
          >
            {perspectiveLabel}
          </span>
        </div>
        <div className="font-mono font-bold text-xl text-av-navy shrink-0">{displayValue}</div>
      </div>

      <p className="font-body text-sm text-av-slate mt-3 leading-relaxed">{definition.simpleExplanation}</p>

      <div className="mt-3">
        {!applicable ? (
          <p className="font-body text-xs text-av-slate">
            <span className="font-semibold text-av-navy">N/A.</span>{" "}
            {applicabilityReason ?? "This metric doesn't apply to this deal."}
          </p>
        ) : classification.status === "classified" ? (
          <>
            <p className="font-body text-xs flex items-center gap-1.5 flex-wrap">
              <span className="text-av-slate font-semibold">
                {classification.model === "fixed_bands" ? "AssetVerdict view:" : "vs. your target:"}
              </span>
              <span className={clsx("inline-block w-2 h-2 rounded-full", JUDGEMENT_DOT[classification.color])} aria-hidden="true" />
              <span className={clsx("font-semibold", JUDGEMENT_TEXT[classification.color])}>
                {classification.label}
              </span>
              {classification.model !== "fixed_bands" && typeof discountRate === "number" && (
                <span className="text-av-slate">— your required return is {discountRate}%</span>
              )}
            </p>
            {judgementProvisional && (
              <p className="font-body text-[11px] text-av-slate italic mt-1">
                {classification.model === "fixed_bands"
                  ? "Provisional benchmark — thresholds for this metric are being recalibrated and shouldn't be read as final."
                  : "This comparison uses a small, explicitly provisional margin around your required return, not an externally calibrated figure."}
              </p>
            )}
            {metricKey === "irr" && rawValue !== null && (
              <p className="font-body text-[11px] text-av-slate mt-1">
                AssetVerdict reference (provisional):{" "}
                {(() => {
                  const ref = getIrrReferenceClassification(rawValue, strategyId);
                  return ref ? `${ref.withinRange ? "Within" : "Outside"} current reference range (${ref.label})` : "Not available";
                })()}
              </p>
            )}
          </>
        ) : (
          // "unclassified" — applicable, but AssetVerdict has no active
          // judgement for this metric, either because no rule was ever
          // defined or one was deliberately removed (Decisions 4/6/9). This
          // must never fall back to a coloured "Caution" — a missing or
          // removed threshold is not a judgement. `applicabilityReason`
          // carries the specific, documented reason from the threshold
          // definition itself rather than a generic message.
          <p className="font-body text-xs text-av-slate/70 italic">
            {applicabilityReason ?? "No AssetVerdict benchmark is currently applied to this metric."}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        className="mt-4 flex items-center gap-1.5 text-xs font-body font-semibold text-av-navy min-h-[44px] -ml-1 pl-1 pr-2"
      >
        <span>{open ? "Show less" : "Understand this number"}</span>
        <ChevronDown size={16} className={clsx("transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div id={panelId} className="mt-2 flex flex-col gap-4 border-t border-av-light-grey pt-4">
          <section>
            <h4 className="font-body text-[11px] font-semibold tracking-wide uppercase text-av-slate mb-1">
              Why it matters
            </h4>
            <p className="font-body text-sm text-av-navy leading-relaxed">{definition.whyItMatters}</p>
          </section>

          <section>
            <h4 className="font-body text-[11px] font-semibold tracking-wide uppercase text-av-slate mb-1">
              How your deal calculates it
            </h4>
            <p className="font-mono text-xs text-av-slate mb-2">{definition.formulaLabel}</p>
            {breakdown ? (
              <div className="rounded-md bg-av-light-grey/60 p-3 flex flex-col gap-1">
                {breakdown.lines.map((l) => (
                  <div key={l.label} className="flex items-center justify-between gap-3 text-xs font-body">
                    <span className="text-av-slate">{l.label}</span>
                    <span className="font-mono text-av-navy">{formatMetricValue(l.value, l.format, currency)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-3 text-sm font-body font-semibold pt-1.5 mt-1 border-t border-av-slate/15">
                  <span className="text-av-navy">Result</span>
                  <span className="font-mono text-av-navy">
                    {formatMetricValue(breakdown.result, breakdown.resultFormat, currency)}
                  </span>
                </div>
              </div>
            ) : (
              <p className="font-body text-sm text-av-navy leading-relaxed">{definition.formulaExplanation}</p>
            )}
          </section>

          {interpretation && (
            <section>
              <h4 className="font-body text-[11px] font-semibold tracking-wide uppercase text-av-slate mb-1">
                What your number means
              </h4>
              <p className="font-body text-sm text-av-navy leading-relaxed">{interpretation}</p>
            </section>
          )}

          {definition.commonMistake && (
            <section>
              <h4 className="font-body text-[11px] font-semibold tracking-wide uppercase text-av-slate mb-1">
                Common mistake
              </h4>
              <p className="font-body text-sm text-av-navy leading-relaxed">{definition.commonMistake}</p>
            </section>
          )}

          {(definition.affectedBy.length > 0 || definition.affects.length > 0) && (
            <section>
              <h4 className="font-body text-[11px] font-semibold tracking-wide uppercase text-av-slate mb-2">
                Connected metrics
              </h4>
              <div className="flex flex-col gap-2">
                {definition.affectedBy.length > 0 && (
                  <div className="text-xs font-body">
                    <span className="text-av-slate">Affected by: </span>
                    <span className="text-av-navy">
                      {definition.affectedBy.map(getKeyLabel).join(", ")}
                    </span>
                  </div>
                )}
                {definition.affects.length > 0 && (
                  <div className="text-xs font-body">
                    <span className="text-av-slate">Can affect: </span>
                    <span className="text-av-navy">{definition.affects.map(getKeyLabel).join(", ")}</span>
                  </div>
                )}
              </div>
            </section>
          )}

          {onAskCoach && (
            <button
              type="button"
              onClick={() => onAskCoach(metricKey)}
              className="self-start font-body text-xs font-semibold text-av-navy underline decoration-av-gold decoration-2 underline-offset-4 min-h-[44px] -ml-1 pl-1 pr-2"
            >
              Ask Deal Coach about this
            </button>
          )}
        </div>
      )}
    </Card>
  );
}
