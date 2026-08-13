/**
 * Deal Coach context builder (Phase 3, section 5-6).
 *
 * Calculation Engine → Education/Threshold Truth → Context Builder → Deal Coach
 *
 * This file turns already-calculated, already-classified data into the
 * bounded `DealCoachContext` object the AI is allowed to see. It computes
 * NOTHING financial itself — every number here was produced by
 * lib/calculations (via calcAllMetrics/calcScenarios, called by the route
 * handler with server-recomputed DealInputs) and every piece of education
 * content comes from lib/education, exactly the same functions the
 * "Understand Your Deal" UI uses. This guarantees Deal Coach can never say
 * something about a metric that the deterministic engine and Phase 2's
 * education layer don't already say.
 *
 * Context is SELECTIVE (section 6): which metrics get included, and how much
 * detail each one carries, depends on the intent. A DSCR question gets DSCR
 * in full plus its direct drivers; a scenario question gets a compact
 * headline comparison table, not three full metric sets or 20-year
 * projections; a broad "explain this deal" question gets every metric
 * relevant to the strategy, but only in summary form (no formula
 * breakdowns) to keep the payload bounded.
 */
import type { DealInputs, DealMetrics } from "../calculations";
import type { Scenarios } from "../calculations/scenarios";
import {
  getMetricApplicability,
  applicabilityContextFromInputs,
  applicabilityContextFromMetrics,
  type ApplicabilityContext,
} from "../calculations/applicability";
import { explainDealMetric } from "../education/explainMetric";
import {
  getMetricBreakdown,
  getMetricRawValue,
  METRIC_VALUE_FORMAT,
  type AcquisitionSummary,
} from "../education/metricBreakdowns";
import { interpretMetricValue } from "../education/interpretMetric";
import { formatMetricValue } from "../education/format";
import { getMetricGroupsForStrategy, getMetricDefinition } from "../education/metricDefinitions";
import { getKeyLabel } from "../education/relationshipChains";
import { getStrategy } from "../strategies";
import type {
  DealCoachContext,
  DealCoachIntent,
  DealCoachMetricEntry,
  DealCoachSelection,
  ScenarioKey,
} from "./dealCoachTypes";

const HEADLINE_METRICS_RENTAL = ["dscr", "cashflowMonthly", "irr", "ltv", "breakEvenRatio", "netYieldPreTax"];
const HEADLINE_METRICS_FLIP = ["netProfit", "roi", "annualisedROI", "profitMargin"];

const SCENARIO_NOTE: Record<ScenarioKey, string> = {
  bear: "Bear case: rental/capital growth and occupancy shifted down by the deal's configured sensitivity factors.",
  base: "Base case: reflects the deal's modelled inputs exactly as entered.",
  bull: "Bull case: rental/capital growth and occupancy shifted up by the deal's configured sensitivity factors.",
};

function buildMetricEntry(params: {
  metricKey: string;
  metrics: DealMetrics;
  dealSummary: AcquisitionSummary;
  strategyId: string;
  applicabilityCtx: ApplicabilityContext;
  detail: "full" | "light";
  currency: string;
}): DealCoachMetricEntry | undefined {
  const { metricKey, metrics, dealSummary, strategyId, applicabilityCtx, detail, currency } = params;
  const rawValue = getMetricRawValue(metricKey, metrics);
  const explanation = explainDealMetric(metricKey, rawValue, strategyId, applicabilityCtx);
  if (!explanation) return undefined;

  const { definition, classification, applicabilityReason, judgementProvisional, value } = explanation;
  const format = METRIC_VALUE_FORMAT[metricKey] ?? "number";

  const entry: DealCoachMetricEntry = {
    key: metricKey,
    name: definition.name,
    shortName: definition.shortName,
    category: definition.category,
    perspective: definition.perspective,
    value: classification.applicable ? value : null,
    formattedValue: classification.applicable ? formatMetricValue(value, format, currency) : "N/A",
    applicable: classification.applicable,
    applicabilityReason,
    // Phase 3.1: distinguish "AssetVerdict judged this X" from "AssetVerdict
    // has no calibrated benchmark for this metric" — never collapse the
    // latter into a fake label. See MetricClassification in thresholds.ts.
    classification: !classification.applicable
      ? undefined
      : classification.status === "classified"
        ? { status: "classified", label: classification.label, provisional: judgementProvisional }
        : { status: "unclassified" },
    simpleExplanation: definition.simpleExplanation,
  };

  if (!classification.applicable) return entry;

  if (rawValue !== null) {
    entry.interpretation = interpretMetricValue(metricKey, rawValue);
  }

  if (detail === "full") {
    entry.whyItMatters = definition.whyItMatters;
    const breakdown = getMetricBreakdown({ metricKey, metrics, dealSummary });
    if (breakdown) {
      entry.breakdown = {
        formula: breakdown.formula,
        lines: breakdown.lines.map((l) => ({ label: l.label, value: formatMetricValue(l.value, l.format, currency) })),
        result: formatMetricValue(breakdown.result, breakdown.resultFormat, currency),
      };
    }
    entry.affectedBy = definition.affectedBy.map(getKeyLabel);
    entry.affects = definition.affects.map(getKeyLabel);
  }

  return entry;
}

/** Deterministic, rule-based signals about which of the deal's own inputs look like assumptions worth verifying — the AI turns these into due-diligence questions, it does not invent the underlying facts. Only flags that actually trigger for THIS deal are included (section 16: tailor, don't dump a checklist). */
function buildAssumptionFlags(inputs: DealInputs, strategyId: string): { field: string; value: string; note: string }[] {
  const flags: { field: string; value: string; note: string }[] = [];
  const isFlip = strategyId === "fix_and_flip";

  if (!isFlip) {
    if (inputs.occupancyRate >= 99) {
      flags.push({
        field: "occupancyRate",
        value: `${inputs.occupancyRate}%`,
        note: "Occupancy is assumed at or near 100% — effectively no vacancy is modelled.",
      });
    }
    if (inputs.renovationCost === 0) {
      flags.push({
        field: "renovationCost",
        value: "R0",
        note: "No renovation/condition budget is included in this deal.",
      });
    }
    if (inputs.financeSources.length === 0) {
      flags.push({
        field: "financeSources",
        value: "none",
        note: "This deal is modelled as an all-cash purchase — no financing terms are being verified here.",
      });
    }
    if (inputs.badDebtsPct === 0) {
      flags.push({
        field: "badDebtsPct",
        value: "0%",
        note: "No bad debt / rent-collection loss provision is included.",
      });
    }
  }

  if (inputs.marketValue > 0 && inputs.purchasePrice > 0 && inputs.marketValue > inputs.purchasePrice * 1.05) {
    const premiumPct = Math.round(((inputs.marketValue - inputs.purchasePrice) / inputs.purchasePrice) * 100);
    flags.push({
      field: "marketValue",
      value: `${premiumPct}% above purchase price`,
      note: "The assumed market value is materially higher than the purchase price.",
    });
  }

  if (inputs.capitalGrowthRate > 6) {
    flags.push({
      field: "capitalGrowthRate",
      value: `${inputs.capitalGrowthRate}%/yr`,
      note: "Long-run capital growth is assumed above 6% a year — a materially optimistic assumption to hold for 20 years.",
    });
  }

  if (!isFlip && inputs.rentalGrowthRate > 8) {
    flags.push({
      field: "rentalGrowthRate",
      value: `${inputs.rentalGrowthRate}%/yr`,
      note: "Rental growth is assumed above 8% a year, sustained over the projection.",
    });
  }

  if (isFlip) {
    if (inputs.holdingPeriodMonths <= 2) {
      flags.push({
        field: "holdingPeriodMonths",
        value: `${inputs.holdingPeriodMonths} months`,
        note: "A very short holding period is assumed for purchase, renovation, and resale.",
      });
    }
    if (inputs.renovationCost === 0) {
      flags.push({
        field: "renovationCost",
        value: "R0",
        note: "No renovation budget is included despite this being a Fix & Flip deal.",
      });
    }
  }

  return flags;
}

function resolveRelatedMetricKeys(definitionKeys: string[], strategyId: string): string[] {
  const strategyKeys = new Set(getMetricGroupsForStrategy(strategyId).flatMap((g) => g.metricKeys));
  const related: string[] = [];
  for (const key of definitionKeys) {
    if (strategyKeys.has(key) && getMetricDefinition(key) && !related.includes(key)) {
      related.push(key);
    }
    if (related.length >= 4) break;
  }
  return related;
}

export interface BuildDealCoachContextParams {
  inputs: DealInputs;
  metrics: DealMetrics;
  dealName: string;
  address?: string | null;
  currency: string;
  strategyId: string;
  activeScenario: ScenarioKey;
  selection: DealCoachSelection;
  intent: DealCoachIntent;
  dealSummary: AcquisitionSummary;
  /** Only required (and only used) when intent is "compare_scenarios". */
  scenarios?: Scenarios;
}

export function buildDealCoachContext(params: BuildDealCoachContextParams): DealCoachContext {
  const { inputs, metrics, dealName, address, currency, strategyId, activeScenario, selection, intent, dealSummary, scenarios } = params;
  const strategy = getStrategy(strategyId);
  const applicabilityCtx: ApplicabilityContext = {
    ...applicabilityContextFromInputs(inputs),
  };

  const deal: DealCoachContext["deal"] = {
    name: dealName,
    strategyId,
    strategyLabel: strategy.label,
    currency,
    address,
  };
  const scenario: DealCoachContext["scenario"] = { active: activeScenario, note: SCENARIO_NOTE[activeScenario] };

  // ---- Scenario comparison: a compact headline table, nothing else -------
  if (intent === "compare_scenarios" && scenarios) {
    const isFlip = strategyId === "fix_and_flip";
    const headlineKeys = isFlip ? HEADLINE_METRICS_FLIP : HEADLINE_METRICS_RENTAL;
    const comparison = { bear: {}, base: {}, bull: {} } as DealCoachContext["scenarioComparison"];
    (["bear", "base", "bull"] as ScenarioKey[]).forEach((key) => {
      const scenarioMetrics = scenarios[key].metrics;
      const scenarioCtx: ApplicabilityContext = {
        ...applicabilityContextFromMetrics(scenarioMetrics),
        purchasePrice: dealSummary.purchasePrice ?? undefined,
        marketValue: dealSummary.marketValue ?? undefined,
      };
      const row: Record<string, string> = {};
      for (const metricKey of headlineKeys) {
        const rawValue = getMetricRawValue(metricKey, scenarioMetrics);
        const applicability = getMetricApplicability(metricKey, scenarioCtx);
        const format = METRIC_VALUE_FORMAT[metricKey] ?? "number";
        const label = getMetricDefinition(metricKey)?.shortName ?? metricKey;
        row[label] = applicability.applicable ? formatMetricValue(rawValue, format, currency) : "N/A";
      }
      comparison![key] = row;
    });
    return { deal, scenario, metrics: [], scenarioComparison: comparison, selection };
  }

  // ---- Single selected metric: full detail + a few close drivers --------
  if (intent === "explain_metric" && selection.type === "metric") {
    const primary = buildMetricEntry({
      metricKey: selection.metricKey,
      metrics,
      dealSummary,
      strategyId,
      applicabilityCtx,
      detail: "full",
      currency,
    });
    const entries: DealCoachMetricEntry[] = primary ? [primary] : [];

    const definition = getMetricDefinition(selection.metricKey);
    if (definition) {
      const relatedKeys = resolveRelatedMetricKeys([...definition.affectedBy, ...definition.affects], strategyId).filter(
        (k) => k !== selection.metricKey
      );
      for (const key of relatedKeys) {
        const entry = buildMetricEntry({
          metricKey: key,
          metrics,
          dealSummary,
          strategyId,
          applicabilityCtx,
          detail: "light",
          currency,
        });
        if (entry) entries.push(entry);
      }
    }

    return { deal, scenario, metrics: entries, selection };
  }

  // ---- Broad deal context: every strategy-relevant metric, light detail --
  const groups = getMetricGroupsForStrategy(strategyId);
  const entries: DealCoachMetricEntry[] = [];
  for (const group of groups) {
    for (const key of group.metricKeys) {
      const entry = buildMetricEntry({
        metricKey: key,
        metrics,
        dealSummary,
        strategyId,
        applicabilityCtx,
        detail: "light",
        currency,
      });
      if (entry) entries.push(entry);
    }
  }

  const includeAssumptions =
    intent === "due_diligence" ||
    intent === "list_assumptions_to_verify" ||
    intent === "identify_risks" ||
    intent === "identify_failure_modes" ||
    intent === "teach_deal" ||
    intent === "general_question" ||
    intent === "explain_deal_simple";

  return {
    deal,
    scenario,
    metrics: entries,
    assumptionFlags: includeAssumptions ? buildAssumptionFlags(inputs, strategyId) : undefined,
    selection,
  };
}
