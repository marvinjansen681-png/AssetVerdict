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
  /**
   * True when classification should be shown as an unverified benchmark
   * rather than an authoritative judgement. Read directly from the
   * declarative threshold definition (`classification.provisional`,
   * lib/calculations/thresholds.ts) — Phase 4.1 removed the separate
   * hardcoded PROVISIONAL_JUDGEMENT_METRICS set this used to duplicate, so
   * there's one source for "is this provisional," not two that could drift
   * out of sync.
   */
  judgementProvisional: boolean;
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
    judgementProvisional: classification.status === "classified" && classification.provisional === true,
  };
}
