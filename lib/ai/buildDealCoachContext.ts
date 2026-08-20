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
import { calcHoldPeriodYears, isFiniteNumber } from "../calculations";
import type { Scenarios } from "../calculations/scenarios";
import {
  getMetricApplicability,
  applicabilityContextFromInputs,
  applicabilityContextFromMetrics,
  type ApplicabilityContext,
} from "../calculations/applicability";
import { explainDealMetric } from "../education/explainMetric";
import { getIrrReferenceClassification } from "../calculations/thresholds";
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
import { getStrategy, type StrategyId } from "../strategies";
import { calcFlipExitValueAnalysis, type FlipExitValuationInput, type FlipExitValueScenarioCase } from "../calculations/fixFlipExitValue";
import { calcRentSuggestion } from "../area-suggestions";
import type { SuburbProfile } from "../../types";
import { deriveDealVerdict, type DealVerdictResult } from "../calculations/verdict";
import {
  analyzeNegotiation,
  deriveNegotiationOpportunity,
  type NegotiationAnalysis,
  type NegotiationObjective,
  type NegotiationTargetResult,
} from "../calculations/negotiation";
import {
  NEGOTIATION_OBJECTIVE_LABEL,
  NEGOTIATION_OPPORTUNITY_TITLE,
  NEGOTIATION_OPPORTUNITY_DISCLAIMER,
  FIXED_LTV_ASSUMPTION_EXPLAINER,
  describeNegotiationResult,
  describeNegotiationOpportunity,
} from "../education/negotiationCopy";
import type {
  DealCoachContext,
  DealCoachIntent,
  DealCoachMetricEntry,
  DealCoachNegotiation,
  DealCoachNegotiationObjective,
  DealCoachNegotiationOpportunity,
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
  /** Commercial only — see BuildDealCoachContextParams.leaseTermMonths. */
  leaseTermMonths?: number | null;
}): DealCoachMetricEntry | undefined {
  const { metricKey, metrics, dealSummary, strategyId, applicabilityCtx, detail, currency, leaseTermMonths } = params;
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
    // latter into a fake label. Phase 4.1 adds `category`/`model` so the
    // coach always knows WHY a metric is being judged (financial safety vs.
    // investor target), never just what colour it got. See
    // MetricClassification in thresholds.ts.
    classification: !classification.applicable
      ? undefined
      : classification.status === "classified"
        ? { status: "classified", label: classification.label, provisional: judgementProvisional, category: classification.category, model: classification.model }
        : { status: "unclassified", category: classification.category, reason: classification.reason },
    simpleExplanation: definition.simpleExplanation,
  };

  if (classification.status === "classified") {
    if (
      (classification.model === "target_relative" || classification.model === "zero_relative") &&
      typeof applicabilityCtx.discountRate === "number"
    ) {
      entry.targetContext = { requiredReturn: applicabilityCtx.discountRate };
    }
    // Only ever computed for an applicable, classified IRR — never for a
    // not_applicable deal (e.g. over-financed, no positive equity), where
    // the raw solver output is a finite but semantically meaningless number.
    if (metricKey === "irr" && rawValue !== null) {
      const ref = getIrrReferenceClassification(rawValue, strategyId);
      if (ref) {
        entry.secondaryReference = {
          label: "reference range",
          withinRange: ref.withinRange,
          classificationLabel: ref.label,
          provisional: true,
        };
      }
    }
  }

  if (!classification.applicable) return entry;

  if (rawValue !== null) {
    entry.interpretation = interpretMetricValue(metricKey, rawValue, {
      holdPeriodYears: metrics.irrSummary.holdPeriodYears,
      isPlannedSale: metrics.exitSummary?.isPlannedSale ?? false,
      leaseTermMonths: strategyId === "commercial" ? leaseTermMonths ?? null : undefined,
      utilityContext: {
        billsIncludedMonthly: metrics.operatingCostsMonthly.billsIncludedMonthly,
        recoveriesMonthly: metrics.revenueMonthly.recoveries,
      },
    });
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

  if (inputs.wantToSell && isFiniteNumber(inputs.saleYear) && inputs.saleYear > 0) {
    flags.push({
      field: "saleYear",
      value: `Year ${calcHoldPeriodYears(inputs)}`,
      note: "Your deal currently assumes a sale in this year — IRR and NPV exit and discount at this point rather than the 20-year default. Treat this as an assumption to verify, not a confirmed exit plan.",
    });
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
    const holdYears = calcHoldPeriodYears(inputs);
    flags.push({
      field: "capitalGrowthRate",
      value: `${inputs.capitalGrowthRate}%/yr`,
      note: `Long-run capital growth is assumed above 6% a year — a materially optimistic assumption to hold for ${holdYears} years.`,
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

function buildNegotiationObjectiveEntry(
  objective: NegotiationObjective,
  result: NegotiationTargetResult,
  currency: string
): DealCoachNegotiationObjective {
  const entry: DealCoachNegotiationObjective = {
    objective,
    label: NEGOTIATION_OBJECTIVE_LABEL[objective],
    status: result.status,
    explanation: describeNegotiationResult(result, currency),
  };
  if (result.status === "already_meets" || result.status === "solvable") {
    entry.targetPrice = formatMetricValue(result.targetPrice, "currency", currency);
  }
  if (result.status === "solvable") {
    entry.reductionRand = formatMetricValue(result.reductionRand, "currency", currency);
    entry.reductionPercent = `${result.reductionPercent.toFixed(1)}%`;
  }
  return entry;
}

/**
 * Compact, pre-formatted conditional Negotiation Opportunity (Phase 4.16) —
 * reuses deriveNegotiationOpportunity (which itself reuses `currentVerdict`
 * and `negotiation.reachStrong`, already computed) and the ONE copy layer
 * (negotiationCopy.ts) the Summary UI/PDF also read from. No second
 * "is this deal promising if negotiated" judgement exists anywhere else.
 */
function buildDealCoachNegotiationOpportunity(
  currentVerdict: DealVerdictResult,
  negotiation: NegotiationAnalysis,
  currency: string
): DealCoachNegotiationOpportunity {
  const opportunity = deriveNegotiationOpportunity(currentVerdict, negotiation);
  const entry: DealCoachNegotiationOpportunity = {
    status: opportunity.status,
    title: NEGOTIATION_OPPORTUNITY_TITLE[opportunity.status],
    description: describeNegotiationOpportunity(opportunity, currency),
  };
  if (opportunity.status === "promising_if_negotiated") {
    entry.targetPrice = formatMetricValue(opportunity.targetPrice, "currency", currency);
    entry.reductionRand = formatMetricValue(opportunity.reductionRand, "currency", currency);
    entry.reductionPercent = `${opportunity.reductionPercent.toFixed(1)}%`;
    entry.resultingVerdict = opportunity.resultingVerdict;
    entry.disclaimer = NEGOTIATION_OPPORTUNITY_DISCLAIMER;
  }
  return entry;
}

/**
 * Compact, pre-formatted negotiation summary (Phase 4.15/4.16) — reuses the
 * ONE negotiation engine (analyzeNegotiation) and the ONE copy layer
 * (negotiationCopy.ts) the Summary UI and PDF also read from, so Deal Coach
 * can never describe a target price differently from what the user already
 * sees on screen. Always Base-case (see `inputs` doc comment above — it's
 * never scenario-shifted), same rule as verdict.
 */
function buildDealCoachNegotiation(
  inputs: DealInputs,
  strategyId: string,
  currency: string,
  currentVerdict: DealVerdictResult
): DealCoachNegotiation {
  const negotiation: NegotiationAnalysis = analyzeNegotiation(inputs, strategyId);
  return {
    currentPrice: formatMetricValue(negotiation.currentPrice, "currency", currency),
    fixedLtvNote: FIXED_LTV_ASSUMPTION_EXPLAINER,
    opportunity: buildDealCoachNegotiationOpportunity(currentVerdict, negotiation, currency),
    objectives: [
      buildNegotiationObjectiveEntry("meet_required_return", negotiation.meetRequiredReturn, currency),
      buildNegotiationObjectiveEntry("clear_structural_safety", negotiation.clearStructuralSafety, currency),
      buildNegotiationObjectiveEntry("reach_strong", negotiation.reachStrong, currency),
      buildNegotiationObjectiveEntry("reach_promising", negotiation.reachPromising, currency),
    ],
  };
}

/**
 * Compact, pre-formatted Fix & Flip financial model (Phase 4.17) — reuses
 * the ONE Fix & Flip engine (calcFixFlipAnalysis, already attached to
 * `metrics.fixFlipAnalysis` by calcAllMetrics) and formats every figure
 * with the SAME formatMetricValue the Summary UI/PDF use. No second
 * calculation of any Flip figure exists here.
 */
function buildDealCoachFixFlipAnalysis(metrics: DealMetrics, currency: string): DealCoachContext["fixFlipAnalysis"] {
  const a = metrics.fixFlipAnalysis;
  if (!a) return undefined;
  if (a.status === "unavailable") return { status: "unavailable" };

  const cur = (v: number) => formatMetricValue(v, "currency", currency);
  const pct = (v: number | null) => (v === null ? undefined : `${v.toFixed(1)}%`);

  return {
    status: "available",
    holdingPeriodMonths: a.holdingPeriodMonths,
    purchasePrice: cur(a.acquisition.purchasePrice),
    acquisitionCosts: cur(a.acquisition.acquisitionCosts),
    renovationCost: cur(a.renovation.renovationCost),
    totalHoldingCosts: cur(a.holding.totalHoldingCosts),
    totalLoanAmount: cur(a.financing.totalLoanAmount),
    totalInterestPaid: cur(a.financing.totalInterestPaid),
    totalPrincipalPaid: cur(a.financing.totalPrincipalPaid),
    remainingLoanBalanceAtSale: cur(a.financing.remainingLoanBalanceAtSale),
    projectedSalePrice: cur(a.sale.projectedSalePrice),
    sellingCosts: cur(a.sale.sellingCosts),
    projectProfitBeforeFinancingAndTax: cur(a.profitability.projectProfitBeforeFinancingAndTax),
    estimatedProfitBeforeTax: cur(a.profitability.estimatedProfitBeforeTax),
    preTaxProjectROI: pct(a.profitability.preTaxProjectROI),
    preTaxEquityROI: pct(a.profitability.preTaxEquityROI),
    annualisedPreTaxROI: pct(a.profitability.annualisedPreTaxROI),
    equityIRR: pct(a.profitability.equityIRR),
    preTaxProfitMargin: pct(a.profitability.preTaxProfitMargin),
    breakEvenSalePrice: a.breakEven.breakEvenSalePrice === null ? undefined : cur(a.breakEven.breakEvenSalePrice),
    salePriceBufferRand: a.breakEven.salePriceBufferRand === null ? undefined : cur(a.breakEven.salePriceBufferRand),
    salePriceBufferPercent: pct(a.breakEven.salePriceBufferPercent),
    financingAssumption: a.modelAssumptions.financingAssumption,
    taxAssumption: a.modelAssumptions.taxAssumption,
    renovationTimingAssumption: a.modelAssumptions.renovationTimingAssumption,
  };
}

/**
 * Compact, pre-formatted Fix & Flip exit-value evidence/scenario model
 * (Phase 4.19) — reuses the ONE exit-value engine (calcFlipExitValueAnalysis,
 * which itself reuses calcFixFlipAnalysis for every scenario). No second
 * calculation, comparison, or haircut of any kind exists here — every field
 * is a direct read of that function's own output, formatted with the SAME
 * formatMetricValue the Summary UI/PDF use.
 */
function buildDealCoachFlipScenario(scenarioCase: { salePrice: number; sameAsBase: boolean; summary: FlipExitValueScenarioCase["summary"] }, currency: string) {
  const cur = (v: number) => formatMetricValue(v, "currency", currency);
  const pct = (v: number | null) => (v === null ? undefined : `${v.toFixed(1)}%`);
  const { summary } = scenarioCase;
  return {
    salePrice: cur(scenarioCase.salePrice),
    sameAsBase: scenarioCase.sameAsBase,
    estimatedProfitBeforeTax: cur(summary.estimatedProfitBeforeTax),
    preTaxProjectROI: pct(summary.preTaxProjectROI) ?? "N/A",
    equityIRR: pct(summary.equityIRR),
    salePriceBufferRand: summary.salePriceBufferRand === null ? undefined : cur(summary.salePriceBufferRand),
    salePriceBufferPercent: pct(summary.salePriceBufferPercent),
    targetState: summary.targetState,
  };
}

function buildDealCoachFlipExitValueAnalysis(
  inputs: DealInputs,
  valuation: FlipExitValuationInput | null,
  currency: string
): DealCoachContext["fixFlipExitValueAnalysis"] {
  const result = calcFlipExitValueAnalysis({ inputs, valuation });
  if (result.status === "unavailable") return { status: "unavailable" };

  const { evidence } = result;
  const cur = (v: number) => formatMetricValue(v, "currency", currency);

  return {
    status: "available",
    expectedSalePrice: cur(result.expectedSalePrice),
    evidenceStatus: evidence.status,
    reportSource: evidence.reportSource ?? undefined,
    reportDate: evidence.reportDate ? new Date(evidence.reportDate).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" }) : undefined,
    valuationAgeDays: evidence.valuationAgeDays,
    recordedEstimate: evidence.estimatedValue !== undefined ? cur(evidence.estimatedValue) : undefined,
    recordedRangeLow: evidence.valueConfidenceLow !== undefined ? cur(evidence.valueConfidenceLow) : undefined,
    recordedRangeHigh: evidence.valueConfidenceHigh !== undefined ? cur(evidence.valueConfidenceHigh) : undefined,
    rangePosition: evidence.rangePosition,
    expectedVsEstimate:
      evidence.expectedVsEstimateRand !== undefined
        ? `${evidence.expectedVsEstimateRand >= 0 ? "+" : ""}${cur(evidence.expectedVsEstimateRand)}${
            evidence.expectedVsEstimatePercent !== undefined ? ` (${evidence.expectedVsEstimatePercent >= 0 ? "+" : ""}${evidence.expectedVsEstimatePercent.toFixed(1)}%)` : ""
          }`
        : undefined,
    valuationConfidenceLabel: evidence.valuationConfidence ?? undefined,
    comparableCount: evidence.comparableCount,
    valuationPointCase: result.valuationPointCase ? buildDealCoachFlipScenario(result.valuationPointCase, currency) : undefined,
    conservativeCase: result.conservativeCase
      ? {
          ...buildDealCoachFlipScenario(result.conservativeCase, currency),
          survivesConservativeCase: result.conservativeCase.survivesConservativeCase,
          meetsRequiredReturnInConservativeCase: result.conservativeCase.meetsRequiredReturnInConservativeCase,
        }
      : undefined,
  };
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
  /**
   * Base-case metrics, for verdict derivation only (Phase 4.14 section 97 —
   * the verdict is always Base-case, regardless of `activeScenario`).
   * Optional: falls back to `metrics` when omitted, which is correct
   * whenever the caller's `metrics` already IS the base case (the common
   * case, and every existing call site before Phase 4.14). A caller
   * currently viewing Bear/Bull (where `metrics` is scenario-shifted) must
   * supply this explicitly so the verdict doesn't silently use the wrong
   * scenario — see app/api/deals/[id]/coach/route.ts.
   */
  baseMetrics?: DealMetrics;
  /** Only required (and only used) when intent is "compare_scenarios". */
  scenarios?: Scenarios;
  /**
   * Raw ingredients for the area-based rent estimate (lib/area-suggestions.ts)
   * — property-description fields that live on the Deal, not DealInputs, so
   * the caller must supply them. Omit entirely (or pass suburbProfile: null)
   * when no suburb profile is linked; the coach then simply has no area
   * estimate to reference, rather than one built from a stale/empty guess.
   */
  areaSuggestionInputs?: {
    suburbProfile: SuburbProfile | null;
    isSectionalTitle: boolean;
    bedrooms: number | null;
    numUnits: number | null;
  } | null;
  /**
   * Commercial only (Phase 4.7) — the deal's own recorded lease-term fact
   * (CashflowInputs.leaseTermMonths). Null means "not recorded," never "0
   * months remaining." Only meaningful when strategyId is "commercial";
   * ignored for every other strategy so the coach never mentions lease term
   * outside Commercial.
   */
  leaseTermMonths?: number | null;
  /**
   * Fix & Flip only (Phase 4.19) — raw property-valuation evidence, mapped
   * onto the narrow FlipExitValuationInput shape by the caller (see
   * fixFlipExitValue.ts's own doc comment on why this stays decoupled from
   * the full Prisma-hydrated PropertyValuation relation). Omit or pass null
   * when no valuation record exists — the coach then simply has no numeric
   * evidence to compare against, never an invented one.
   */
  propertyValuation?: FlipExitValuationInput | null;
}

export function buildDealCoachContext(params: BuildDealCoachContextParams): DealCoachContext {
  const { inputs, metrics, dealName, address, currency, strategyId, activeScenario, selection, intent, dealSummary, baseMetrics, scenarios, areaSuggestionInputs, leaseTermMonths, propertyValuation } = params;
  const strategy = getStrategy(strategyId);
  const applicabilityCtx: ApplicabilityContext = {
    ...applicabilityContextFromInputs(inputs),
  };
  const verdict = deriveDealVerdict({ strategyId, inputs, metrics: baseMetrics ?? metrics });
  const negotiation = buildDealCoachNegotiation(inputs, strategyId, currency, verdict);
  const fixFlipAnalysis = strategyId === "fix_and_flip" ? buildDealCoachFixFlipAnalysis(metrics, currency) : undefined;
  const fixFlipExitValueAnalysis =
    strategyId === "fix_and_flip" ? buildDealCoachFlipExitValueAnalysis(inputs, propertyValuation ?? null, currency) : undefined;

  // ---- Area rent context: only when a suburb is linked AND the deal's own
  // assumption is known AND the strategy-specific estimate actually resolved
  // — never an invented figure (section 10/27).
  let areaRentContext: DealCoachContext["deal"]["areaRentContext"];
  if (areaSuggestionInputs?.suburbProfile) {
    const totalSingleBeds = inputs.singleRoomCount;
    const totalSharingBeds = inputs.sharingRoomCount * inputs.sharingBedsPerRoom;

    const studentRentAggregate = totalSingleBeds * inputs.singleRoomRent + totalSharingBeds * inputs.sharingRoomRent;
    const yourAssumption: number | null =
      strategyId === "student"
        ? studentRentAggregate > 0
          ? studentRentAggregate
          : null
        : strategyId === "multi_let"
          ? inputs.pricePerRoom > 0
            ? inputs.pricePerRoom * inputs.numUnits
            : null
          : inputs.monthlyRent > 0
            ? inputs.monthlyRent
            : null;

    const suggestion = calcRentSuggestion({
      strategy: strategyId as StrategyId,
      isSectionalTitle: areaSuggestionInputs.isSectionalTitle,
      bedrooms: areaSuggestionInputs.bedrooms,
      numUnits: areaSuggestionInputs.numUnits,
      studentRoomMix:
        strategyId === "student"
          ? {
              singleRoomCount: inputs.singleRoomCount,
              sharingRoomCount: inputs.sharingRoomCount,
              sharingBedsPerRoom: inputs.sharingBedsPerRoom,
            }
          : undefined,
      suburbProfile: areaSuggestionInputs.suburbProfile,
      currentMonthlyRent: yourAssumption,
    });

    if (suggestion.available && suggestion.primaryEstimate !== null) {
      areaRentContext = {
        basisLabel: suggestion.primaryLabel,
        estimate: suggestion.primaryEstimate,
        yourAssumption,
        fallbackRangeLow: suggestion.band?.low ?? null,
        fallbackRangeHigh: suggestion.band?.high ?? null,
      };
    }
  }

  const deal: DealCoachContext["deal"] = {
    name: dealName,
    strategyId,
    strategyLabel: strategy.label,
    currency,
    address,
    holdPeriod: metrics.exitSummary
      ? { years: metrics.exitSummary.holdPeriodYears, isPlannedSale: metrics.exitSummary.isPlannedSale }
      : undefined,
    areaRentContext,
    commercialContext: strategyId === "commercial" ? { leaseTermMonths: leaseTermMonths ?? null } : undefined,
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
    return { deal, scenario, metrics: [], scenarioComparison: comparison, verdict, negotiation, fixFlipAnalysis, fixFlipExitValueAnalysis, selection };
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
      leaseTermMonths,
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
          leaseTermMonths,
        });
        if (entry) entries.push(entry);
      }
    }

    return { deal, scenario, metrics: entries, verdict, negotiation, fixFlipAnalysis, fixFlipExitValueAnalysis, selection };
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
        leaseTermMonths,
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
    verdict,
    negotiation,
    fixFlipAnalysis,
    fixFlipExitValueAnalysis,
    selection,
  };
}
