/**
 * Combines a metric's static definition with an ALREADY-CALCULATED value and
 * its strategy-aware judgement into one object a future "Understand Your
 * Deal" panel can render directly.
 *
 * This module computes NOTHING. `calculatedValue` must come from
 * calcAllMetrics() (or a FlipMetrics object) in lib/calculations — the
 * deterministic engine remains the only source of deal-specific numbers.
 * This file only attaches education content and a judgement label to a
 * number someone else already calculated.
 */
import { isFiniteNumber } from "../calculations";
import {
  classifyMetricForDeal,
  type ApplicabilityContext,
  type MetricApplicability,
} from "../calculations/applicability";
import type { MetricClassification } from "../calculations/thresholds";
import { getMetricDefinition, type MetricDefinition } from "./metricDefinitions";

export interface DealMetricExplanation {
  definition: MetricDefinition;
  /** The deterministic engine's output for this metric on this deal, or null if not applicable (e.g. infinite payback period, DSCR with no debt). */
  value: number | null;
  /** Strategy-aware judgement derived from lib/calculations/thresholds.ts — never a hard-coded number. */
  classification: MetricClassification;
  /** Plain-English reason when classification.applicable is false — e.g. "No debt financing is being used". */
  applicabilityReason?: MetricApplicability["reason"];
  /** True when classification should be shown as an unverified benchmark rather than an authoritative judgement — see isJudgementProvisional(). */
  judgementProvisional: boolean;
}

/**
 * Metrics whose threshold bands haven't been recalibrated against a recently
 * corrected formula. IRR's green/orange/red bands were tuned against the
 * pre-Phase-1.1 calculation, which used Total Investment (not the investor's
 * own equity) as its base — the corrected Equity IRR runs meaningfully
 * higher for a financed deal, so the old bands would over-state how "Strong"
 * a leveraged deal's IRR is. Per the Phase 2 owner decision, the bands
 * themselves are NOT changed here; the education layer instead marks the
 * judgement as provisional rather than presenting it as authoritative.
 */
const PROVISIONAL_JUDGEMENT_METRICS = new Set(["irr"]);

/** Whether `metricKey`'s strategy-aware judgement should be shown as an unverified benchmark rather than asserted outright. */
export function isJudgementProvisional(metricKey: string): boolean {
  return PROVISIONAL_JUDGEMENT_METRICS.has(metricKey);
}

/**
 * Look up a metric's education content and pair it with a value the caller
 * already obtained from the calculation engine, plus its strategy-aware
 * judgement. Returns undefined if `key` isn't in the registry yet.
 *
 * `ctx` supplies the denominators (purchase price, equity invested, etc.)
 * needed to tell a genuine 0%/0-years answer apart from a "can't calculate
 * this" fallback — see lib/calculations/applicability.ts. It's optional and
 * defaults to `{}`: an omitted context field is treated as "no evidence
 * either way," so callers that don't have the full picture yet still behave
 * exactly as before (only classifying on non-finite values).
 */
export function explainDealMetric(
  key: string,
  calculatedValue: number | null | undefined,
  strategyId: string,
  ctx: ApplicabilityContext = {}
): DealMetricExplanation | undefined {
  const definition = getMetricDefinition(key);
  if (!definition) return undefined;

  const classification = classifyMetricForDeal(key, calculatedValue, ctx, strategyId);

  return {
    definition,
    value: isFiniteNumber(calculatedValue) ? calculatedValue : null,
    classification,
    applicabilityReason: classification.reason,
    judgementProvisional: isJudgementProvisional(key),
  };
}
