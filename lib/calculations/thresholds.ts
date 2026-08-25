import { isFiniteNumber } from "./index";

/**
 * Declarative threshold system (Phase 4.1).
 *
 * Phase 3.1 fixed a false-fallback bug (no rule silently became "Caution").
 * Phase 4 audited every threshold and found most numeric bands had no
 * documented rationale, several investor-return metrics were judged against
 * arbitrary universal percentages instead of what the investor actually
 * needs, and gauge benchmark markers were separately hardcoded numbers that
 * could — and did — drift out of sync with the classification rule itself.
 *
 * This file is the fix for all three: every threshold is now DATA, not a
 * closure, and it is the single source classification, gauge colour, gauge
 * benchmark marker, education copy, and Deal Coach context all read from.
 * Nothing downstream should ever hardcode a threshold number again.
 */

export type GaugeColor = "green" | "orange" | "red";
/** Visual colour states a gauge/card can render — "neutral" is a UI treatment for "no active judgement," never a financial judgement. */
export type GaugeVisualColor = GaugeColor | "neutral";

/**
 * What KIND of question a classified metric is answering (owner Decision
 * 11). A metric's category must change how its classification is described
 * — an investor-target metric being "green" is never proof of financial
 * safety, and a financial-safety metric being "green" says nothing about
 * whether the investor's own return target is met. These are kept
 * structurally distinct everywhere a classification is consumed.
 */
export type ClassificationCategory =
  | "financial_safety"
  | "operating_quality"
  | "property_performance"
  | "investor_target"
  | "strategy_specific";

export type EvidenceLevel = "strong" | "moderate" | "internal" | "provisional";

/**
 * A classified metric's judgement shape. "cutoff" is a single monotonic
 * boundary (higher-is-better or lower-is-better); "sweet_spot" is a
 * two-sided optimal range (e.g. Cap Rate PP) with no single meaningful
 * benchmark marker — see getMetricBenchmark().
 */
export type ThresholdBands =
  | { shape: "cutoff"; direction: "higher" | "lower"; green: number; orange: number }
  | { shape: "sweet_spot"; greenMin: number; greenMax: number; orangeMin: number; orangeMax: number };

/**
 * How a metric's classification is computed:
 *   - "fixed_bands":     classic Strong/Caution/Weak against calibrated
 *                        numeric bands (ThresholdBands).
 *   - "target_relative": compared against the investor's own required
 *                        return (discountRate) — Equity IRR, Cash-on-Cash.
 *   - "zero_relative":   compared against zero, normalized by the
 *                        investor's own equity invested — Equity NPV.
 *   - "unclassified":    applicable and useful, but AssetVerdict has no
 *                        (or has deliberately removed) a standalone
 *                        judgement for it — see `rationale`.
 */
export type ClassificationModel = "fixed_bands" | "target_relative" | "zero_relative" | "unclassified";

export interface ThresholdDefinition {
  metricKey: string;
  category: ClassificationCategory;
  model: ClassificationModel;
  /** fixed_bands only. */
  bands?: ThresholdBands;
  /**
   * target_relative only — the caution-zone width, in percentage points
   * below the required return, before a metric reads "Below Target" rather
   * than "Near Target". No external evidence exists for any specific width
   * (Phase 4 audit) — this is a small, symmetric, explicitly provisional
   * buffer, not a calibrated figure. See `evidenceLevel`.
   */
  cautionMarginPoints?: number;
  /**
   * zero_relative only — how far NPV can sit from zero, as a fraction of
   * initial equity invested, before it reads "Exceeds"/"Below" rather than
   * "Near" target. Same provisional-buffer caveat as cautionMarginPoints.
   */
  nearZeroTolerance?: number;
  provisional?: boolean;
  evidenceLevel?: EvidenceLevel;
  /**
   * Why this rule (or lack of one) exists. Shown to the user for
   * deliberately-unclassified metrics (Decisions 4, 6, 9) instead of a
   * generic "no benchmark" message, and available to Deal Coach so it can
   * explain rather than merely withhold a judgement.
   */
  rationale?: string;
}

type DefinitionSet = Record<string, ThresholdDefinition>;

const cutoff = (
  category: ClassificationCategory,
  direction: "higher" | "lower",
  green: number,
  orange: number,
  extra: Partial<ThresholdDefinition> = {}
): Omit<ThresholdDefinition, "metricKey"> => ({
  category,
  model: "fixed_bands",
  bands: { shape: "cutoff", direction, green, orange },
  ...extra,
});

const unclassified = (
  category: ClassificationCategory,
  rationale: string
): Omit<ThresholdDefinition, "metricKey"> => ({ category, model: "unclassified", rationale });

// ---------------------------------------------------------------------------
// Commercial (base) definitions — every other rental strategy inherits these
// unless it overrides a specific metric below.
// ---------------------------------------------------------------------------
const COMMERCIAL_DEFINITIONS: DefinitionSet = {
  dscr: {
    metricKey: "dscr",
    ...cutoff("financial_safety", "higher", 1.25, 1.0, {
      evidenceLevel: "moderate",
      rationale: "How many times NOI covers annual debt service — a well-established debt-coverage safety concept. The specific 1.25x/1.0x cutoffs are AssetVerdict's own reference values, not sourced to a named lender.",
    }),
  },
  // Deprecated alias definition — kept byte-identical to `purchaseLtv` below
  // so any surviving classifyMetricForDeal("ltv", ...) call site classifies
  // exactly as before (Phase 4.23.1). New code should use "purchaseLtv".
  ltv: {
    metricKey: "ltv",
    ...cutoff("financial_safety", "lower", 60, 75, {
      evidenceLevel: "internal",
      rationale: "Describes leverage risk in the capital structure, not overall deal quality — a lower LTV is lower risk, not automatically a better investment. Band values are AssetVerdict's own reference, undocumented externally.",
    }),
  },
  // Phase 4.23.1 — the authoritative, verdict-facing leverage metric,
  // renamed from "ltv" for accuracy (Purchase LTV = debt / purchase
  // price). Thresholds/rationale UNCHANGED from the legacy "ltv" entry
  // above — this phase's acceptance rule is that verdict behaviour must
  // not change. Estimated Value LTV and Project Leverage (Phase 4.23.1's
  // two NEW, informational-only metrics) deliberately have NO entry in
  // this file at all — see thresholds.ts's classifyMetricForStrategy,
  // which returns "unclassified" (never a colour) for any metric key with
  // no definition. Do not add bands for them without a dedicated
  // calibration phase.
  purchaseLtv: {
    metricKey: "purchaseLtv",
    ...cutoff("financial_safety", "lower", 60, 75, {
      evidenceLevel: "internal",
      rationale: "Describes leverage risk in the capital structure, not overall deal quality — a lower Purchase LTV is lower risk, not automatically a better investment. Band values are AssetVerdict's own reference, undocumented externally.",
    }),
  },
  breakEvenRatio: {
    metricKey: "breakEvenRatio",
    ...cutoff("financial_safety", "lower", 75, 90, {
      evidenceLevel: "internal",
      rationale: "Share of gross income needed to cover operating costs and debt service — an income-coverage resilience measure, similar in character to DSCR. Band values are AssetVerdict's own reference.",
    }),
  },
  operatingExpenseRatio: {
    metricKey: "operatingExpenseRatio",
    ...cutoff("operating_quality", "lower", 40, 60, {
      evidenceLevel: "internal",
      rationale: "Operating expenses (excl. debt service) as a % of gross revenue — the primary operating-efficiency signal. NOI Margin is its mathematical complement and is deliberately kept informational (Decision 9) so the two never independently double-count the same fact.",
    }),
  },
  utilitiesRatio: {
    metricKey: "utilitiesRatio",
    ...cutoff("operating_quality", "lower", 15, 30, {
      evidenceLevel: "internal",
      rationale: "Utilities as a % of gross revenue. The underlying calculation does not distinguish gross utility cost from tenant recoveries, which limits how much a universal band can mean across strategies — see the Phase 4.1 strategy research note.",
    }),
  },
  noiMargin: {
    metricKey: "noiMargin",
    ...unclassified(
      "operating_quality",
      "Mathematical complement of Operating Expense Ratio under AssetVerdict's current formulas (NOI Margin = 1 − Operating Expense Ratio exactly). Classifying both would double-count one operating-efficiency signal — OER remains the primary judgement; NOI Margin stays fully visible as supporting information (Decision 9)."
    ),
  },
  grossYield: {
    metricKey: "grossYield",
    ...cutoff("property_performance", "higher", 10, 7, {
      evidenceLevel: "internal",
      rationale: "Annual gross revenue as a % of purchase price — a fast, preliminary screen that ignores expenses and financing entirely (already caveated in its own education copy). AssetVerdict's own reference bands, not sourced externally.",
    }),
  },
  capRatePP: {
    metricKey: "capRatePP",
    category: "property_performance",
    model: "fixed_bands",
    // A cap rate well above the 8-12% sweet spot is flagged red (high risk /
    // overpaying signal), not orange — confirmed against the reference app
    // (13.83% Cap Rate PP renders red there), overriding the build prompt's
    // literal "orange >12%" text.
    bands: { shape: "sweet_spot", greenMin: 8, greenMax: 12, orangeMin: 5, orangeMax: 13 },
    evidenceLevel: "internal",
    rationale: "The property's primary acquisition cap-rate metric — operating income measured against what you're actually paying. \"8–12% typical sweet spot\" is AssetVerdict's own reference range; no external source is cited for it.",
  },
  capRateMV: {
    metricKey: "capRateMV",
    ...unclassified(
      "property_performance",
      "Depends on the deal's market-value assumption, which AssetVerdict's data model cannot currently distinguish from a plain user-typed number (the separate, richer property-valuation/AVM record is not linked to the calculation engine's market-value input). Treated as contextual until credible provenance can be established — Cap Rate on Purchase Price is the primary acquisition cap-rate metric (Decision 5)."
    ),
  },
  capRateSpread: {
    metricKey: "capRateSpread",
    ...cutoff("property_performance", "higher", 2, 0, {
      evidenceLevel: "internal",
      rationale: "How much better your deal's cap rate is than your own assumed market cap rate — remains classified, but the market cap rate itself is a user-entered assumption, never verified market data (Decision 10). All copy referencing it must say so explicitly.",
    }),
  },
  paybackPeriod: {
    metricKey: "paybackPeriod",
    ...unclassified(
      "investor_target",
      "Ignores every cashflow after the investor's own equity is recovered, so a fast-payback deal with a weak long-run outlook can read better than a slower deal that compounds well — the metric's own education copy already warns of this. Kept fully visible as supporting information; Equity IRR and Equity NPV are the metrics that account for the full holding period (Decision 6)."
    ),
  },
  irr: {
    metricKey: "irr",
    category: "investor_target",
    model: "target_relative",
    cautionMarginPoints: 2,
    provisional: true,
    evidenceLevel: "provisional",
    rationale: "Primary judgement is now against the investor's own required return (discountRate), not a fixed universal percentage — a fixed band couldn't distinguish genuine deal quality from a return inflated by leverage or optimistic growth assumptions (Decision 1). The 2-percentage-point caution margin has no external evidence behind it; it is a small, symmetric, explicitly provisional buffer, not a calibrated figure. AssetVerdict's previous strategy-specific fixed bands are retained only as secondary reference context — see getIrrReferenceClassification().",
  },
  npv: {
    metricKey: "npv",
    category: "investor_target",
    model: "zero_relative",
    nearZeroTolerance: 0.05,
    provisional: true,
    evidenceLevel: "provisional",
    rationale: "NPV's sign already means something precise: positive means the deal's cashflows, discounted at the investor's own required return, exceed what they put in — this is arithmetic, not an opinion (Decision 2). Normalized by Initial Equity Investment so a R1 NPV on a R10m deal and a R1 NPV on a R100k deal aren't treated identically. The 5%-of-equity \"near zero\" band has no external evidence behind it — a small, symmetric, explicitly provisional tolerance, not a calibrated figure.",
  },
  netYieldPreTax: {
    metricKey: "netYieldPreTax",
    category: "investor_target",
    model: "target_relative",
    cautionMarginPoints: 2,
    provisional: true,
    evidenceLevel: "provisional",
    rationale: "Cash-on-Cash Return (Pre-Tax) vs. the investor's own required return (Decision 3). Note: discountRate is used elsewhere (Equity IRR/NPV) as a hurdle against AFTER-TAX cashflows, so comparing a PRE-tax return against it is the less conceptually clean of AssetVerdict's two Cash-on-Cash comparisons — flagged, not resolved, since inventing a tax adjustment here would itself be an unsupported new rule. See the Phase 4.1 report, Section E.",
  },
  netYieldPostTax: {
    metricKey: "netYieldPostTax",
    category: "investor_target",
    model: "target_relative",
    cautionMarginPoints: 2,
    provisional: true,
    evidenceLevel: "provisional",
    rationale: "Cash-on-Cash Return (Post-Tax) vs. the investor's own required return (Decision 3). This is the cleaner of AssetVerdict's two Cash-on-Cash comparisons: discountRate is already used elsewhere (Equity IRR/NPV) as a hurdle against after-tax cashflows, so an after-tax return compared against it is apples-to-apples.",
  },
};

// ---------------------------------------------------------------------------
// Strategy overrides — only the metrics that genuinely differ per strategy.
// Everything else inherits COMMERCIAL_DEFINITIONS unchanged.
// ---------------------------------------------------------------------------
const BUY_TO_LET_DEFINITIONS: DefinitionSet = {
  ...COMMERCIAL_DEFINITIONS,
  dscr: { metricKey: "dscr", ...cutoff("financial_safety", "higher", 1.2, 1.0, { evidenceLevel: "internal", rationale: COMMERCIAL_DEFINITIONS.dscr.rationale }) },
  grossYield: { metricKey: "grossYield", ...cutoff("property_performance", "higher", 8, 5, { evidenceLevel: "internal", rationale: COMMERCIAL_DEFINITIONS.grossYield.rationale }) },
  operatingExpenseRatio: { metricKey: "operatingExpenseRatio", ...cutoff("operating_quality", "lower", 45, 65, { evidenceLevel: "internal", rationale: COMMERCIAL_DEFINITIONS.operatingExpenseRatio.rationale }) },
};

const MULTI_LET_DEFINITIONS: DefinitionSet = {
  ...COMMERCIAL_DEFINITIONS,
  dscr: { metricKey: "dscr", ...cutoff("financial_safety", "higher", 1.3, 1.0, { evidenceLevel: "internal", rationale: COMMERCIAL_DEFINITIONS.dscr.rationale }) },
  grossYield: { metricKey: "grossYield", ...cutoff("property_performance", "higher", 12, 8, { evidenceLevel: "internal", rationale: COMMERCIAL_DEFINITIONS.grossYield.rationale }) },
  operatingExpenseRatio: { metricKey: "operatingExpenseRatio", ...cutoff("operating_quality", "lower", 50, 70, { evidenceLevel: "internal", rationale: COMMERCIAL_DEFINITIONS.operatingExpenseRatio.rationale }) },
};

const STUDENT_DEFINITIONS: DefinitionSet = {
  ...COMMERCIAL_DEFINITIONS,
  grossYield: { metricKey: "grossYield", ...cutoff("property_performance", "higher", 10, 7, { evidenceLevel: "internal", rationale: COMMERCIAL_DEFINITIONS.grossYield.rationale }) },
  operatingExpenseRatio: { metricKey: "operatingExpenseRatio", ...cutoff("operating_quality", "lower", 55, 75, { evidenceLevel: "internal", rationale: COMMERCIAL_DEFINITIONS.operatingExpenseRatio.rationale }) },
};

const STR_DEFINITIONS: DefinitionSet = {
  ...COMMERCIAL_DEFINITIONS,
  grossYield: { metricKey: "grossYield", ...cutoff("property_performance", "higher", 15, 10, { evidenceLevel: "internal", rationale: COMMERCIAL_DEFINITIONS.grossYield.rationale }) },
  operatingExpenseRatio: { metricKey: "operatingExpenseRatio", ...cutoff("operating_quality", "lower", 50, 70, { evidenceLevel: "internal", rationale: COMMERCIAL_DEFINITIONS.operatingExpenseRatio.rationale }) },
};

const INSTALMENT_SALE_DEFINITIONS: DefinitionSet = {
  ...COMMERCIAL_DEFINITIONS,
  grossYield: { metricKey: "grossYield", ...cutoff("property_performance", "higher", 8, 5, { evidenceLevel: "internal", rationale: COMMERCIAL_DEFINITIONS.grossYield.rationale }) },
};

// Fix & Flip has its own metric family entirely — no Commercial inheritance.
const FIX_AND_FLIP_DEFINITIONS: DefinitionSet = {
  // Phase 4.10: roi and annualisedROI were previously classified against
  // bands calibrated on a POST-CGT profit figure. Now that Fix & Flip
  // profit is reported pre-tax (capitalGainsTaxRate is no longer
  // automatically deducted — see calcFlipProfit's doc comment), those old
  // 25/15 and 40/25 bands no longer reflect what the metric actually
  // measures. Rather than silently keep a stale threshold or invent a new
  // one without calibration evidence, both are deliberately unclassified
  // pending a future recalibration phase — the rand/percentage values
  // remain fully visible, just without a Strong/Caution/Weak judgement.
  roi: {
    metricKey: "roi",
    ...unclassified(
      "strategy_specific",
      "Definition changed pending recalibration (Phase 4.10): this is now a pre-tax return figure, since Fix & Flip profit is no longer automatically taxed at the capital-gains rate. The previous 25%/15% bands were calibrated against a post-tax figure and no longer apply — no new threshold has been set."
    ),
  },
  annualisedROI: {
    metricKey: "annualisedROI",
    ...unclassified(
      "strategy_specific",
      "Definition changed pending recalibration (Phase 4.10): this is now a pre-tax return figure, since Fix & Flip profit is no longer automatically taxed at the capital-gains rate. The previous 40%/25% bands were calibrated against a post-tax figure and no longer apply — no new threshold has been set."
    ),
  },
  netProfit: {
    metricKey: "netProfit",
    ...unclassified(
      "strategy_specific",
      "An absolute rand amount has no meaning without deal size — R148,200 profit reads identically on a R1.4m flip and a R20m one. Removed from standalone Strong/Weak judgement (Decision 4); the rand value remains fully visible. Now also reported pre-tax (Phase 4.10) — see ROI/Annualised ROI's own notes on why their bands are currently unclassified too."
    ),
  },
};

const STRATEGY_DEFINITIONS: Record<string, DefinitionSet> = {
  commercial: COMMERCIAL_DEFINITIONS,
  buy_to_let: BUY_TO_LET_DEFINITIONS,
  multi_let: MULTI_LET_DEFINITIONS,
  student: STUDENT_DEFINITIONS,
  str: STR_DEFINITIONS,
  fix_and_flip: FIX_AND_FLIP_DEFINITIONS,
  instalment_sale: INSTALMENT_SALE_DEFINITIONS,
};

/** Full threshold definition set for a given strategy, falling back to Commercial defaults. */
export function getStrategyDefinitions(strategyId: string): DefinitionSet {
  return STRATEGY_DEFINITIONS[strategyId] ?? COMMERCIAL_DEFINITIONS;
}

/** The single threshold definition for one metric on one strategy, if any. */
export function getThresholdDefinition(metricKey: string, strategyId: string): ThresholdDefinition | undefined {
  return getStrategyDefinitions(strategyId)[metricKey];
}

/**
 * Whether AssetVerdict gives `metric` an ACTIVE judgement on this strategy —
 * false both when no definition exists at all, and when one exists but is
 * deliberately model:"unclassified" (Decisions 4, 6, 9). The single source
 * of truth for "does AssetVerdict have an opinion on this metric."
 */
export function hasCalibratedThreshold(metric: string, strategyId: string): boolean {
  const def = getThresholdDefinition(metric, strategyId);
  return !!def && def.model !== "unclassified";
}

/**
 * Plain-English judgement label. Two distinct vocabularies (owner Decision
 * 11 / section 9): fixed-bands metrics (safety/operating/property) keep
 * AssetVerdict's existing Strong/Caution/Weak language; target- and
 * zero-relative metrics (investor return) use Exceeds/Near/Below Target —
 * language that says "vs. your goal," never "vs. an absolute standard,"
 * so an investor-return judgement can never read as a safety judgement.
 */
export type ClassificationLabel = "Strong" | "Caution" | "Weak" | "Exceeds Target" | "Near Target" | "Below Target";

const FIXED_BANDS_LABEL: Record<GaugeColor, ClassificationLabel> = { green: "Strong", orange: "Caution", red: "Weak" };
const TARGET_LABEL: Record<GaugeColor, ClassificationLabel> = { green: "Exceeds Target", orange: "Near Target", red: "Below Target" };

function labelForModel(color: GaugeColor, model: ClassificationModel): ClassificationLabel {
  return model === "target_relative" || model === "zero_relative" ? TARGET_LABEL[color] : FIXED_BANDS_LABEL[color];
}

function evaluateBands(bands: ThresholdBands, value: number): GaugeColor {
  if (bands.shape === "cutoff") {
    const { direction, green, orange } = bands;
    if (direction === "higher") return value >= green ? "green" : value >= orange ? "orange" : "red";
    return value <= green ? "green" : value <= orange ? "orange" : "red";
  }
  if (value >= bands.greenMin && value <= bands.greenMax) return "green";
  if (value >= bands.orangeMin && value <= bands.orangeMax) return "orange";
  return "red";
}

/**
 * Denominators a target-/zero-relative classification needs, beyond the
 * metric's own value. `discountRate` and `initialEquityInvestment` are the
 * same fields already threaded through ApplicabilityContext
 * (lib/calculations/applicability.ts) — see classifyMetricForDeal, which
 * builds this automatically so most callers never construct it by hand.
 */
export interface ClassificationContext {
  /** The investor's required annual return, as a plain percentage number (e.g. 12 = 12%) — DealInputs.discountRate. */
  discountRate?: number;
  /** Total Investment less Total Loan Amount — used to normalize Equity NPV so deal size doesn't bias the judgement. */
  initialEquityInvestment?: number;
}

/**
 * Classification integrity (Phase 3.1) + declarative model (Phase 4.1): a
 * metric's judgement is one of three DISTINCT states, never collapsed into
 * each other —
 *   - "classified":     an active rule (fixed_bands / target_relative /
 *                        zero_relative) exists and produced a real
 *                        judgement. Carries `category` and `model` so
 *                        consumers (education UI, Deal Coach) always know
 *                        WHY a metric is being judged, not just what colour
 *                        it got.
 *   - "unclassified":   the metric is applicable, but AssetVerdict has no
 *                        active judgement for it — either no rule was ever
 *                        defined, or one was deliberately removed
 *                        (Decisions 4/6/9, see `reason`). Never presents as
 *                        a colour.
 *   - "not_applicable":  the metric doesn't apply to this deal at all (e.g.
 *                        DSCR with no debt) — see applicability.ts.
 */
export type MetricClassification =
  | {
      status: "classified";
      applicable: true;
      color: GaugeColor;
      label: ClassificationLabel;
      category: ClassificationCategory;
      model: Exclude<ClassificationModel, "unclassified">;
      provisional?: boolean;
      reason?: string;
    }
  | { status: "unclassified"; applicable: true; color: null; label: null; category?: ClassificationCategory; reason: string }
  | { status: "not_applicable"; applicable: false; color: null; label: null; reason: string };

/**
 * Classification-first primitive (Phase 3.1/4.1): looks up the calibrated
 * definition BEFORE producing anything visual. A missing or deliberately
 * unclassified definition is reported as "unclassified," never coerced into
 * a colour. target_relative/zero_relative metrics fall back to
 * "unclassified" (not a colour) if the context they need isn't supplied —
 * in the live app `discountRate` always exists (DealInputs.discountRate is
 * required, defaulting to 10), so this is a defensive fallback for partial
 * callers, not a state real deals should hit.
 */
export function classifyMetricForStrategy(
  metric: string,
  value: number | null | undefined,
  strategyId: string,
  ctx: ClassificationContext = {}
): MetricClassification {
  if (!isFiniteNumber(value)) {
    return {
      status: "not_applicable",
      applicable: false,
      color: null,
      label: null,
      reason: "No finite value is available for this metric",
    };
  }

  const def = getThresholdDefinition(metric, strategyId);
  if (!def || def.model === "unclassified") {
    return {
      status: "unclassified",
      applicable: true,
      color: null,
      label: null,
      category: def?.category,
      reason: def?.rationale ?? "AssetVerdict has no calibrated benchmark for this metric.",
    };
  }

  if (def.model === "fixed_bands") {
    if (!def.bands) {
      return { status: "unclassified", applicable: true, color: null, label: null, category: def.category, reason: "Threshold definition is missing its bands." };
    }
    const color = evaluateBands(def.bands, value);
    return { status: "classified", applicable: true, color, label: labelForModel(color, def.model), category: def.category, model: def.model, provisional: def.provisional, reason: def.rationale };
  }

  if (def.model === "target_relative") {
    if (!isFiniteNumber(ctx.discountRate)) {
      return { status: "unclassified", applicable: true, color: null, label: null, category: def.category, reason: "No required-return assumption is available to compare this metric against." };
    }
    const margin = def.cautionMarginPoints ?? 0;
    const diff = value - ctx.discountRate;
    const color: GaugeColor = diff >= 0 ? "green" : diff >= -margin ? "orange" : "red";
    return { status: "classified", applicable: true, color, label: labelForModel(color, def.model), category: def.category, model: def.model, provisional: def.provisional, reason: def.rationale };
  }

  // zero_relative
  if (!isFiniteNumber(ctx.initialEquityInvestment) || !(ctx.initialEquityInvestment > 0)) {
    return { status: "unclassified", applicable: true, color: null, label: null, category: def.category, reason: "No positive equity investment is available to normalize this metric against." };
  }
  const tolerance = def.nearZeroTolerance ?? 0;
  const normalized = value / ctx.initialEquityInvestment;
  const color: GaugeColor = normalized > tolerance ? "green" : normalized >= -tolerance ? "orange" : "red";
  return { status: "classified", applicable: true, color, label: labelForModel(color, def.model), category: def.category, model: def.model, provisional: def.provisional, reason: def.rationale };
}

/**
 * Gauge colour using the generic (Commercial) threshold table — DERIVED
 * from classification, never the reverse.
 */
export function getGaugeColor(metric: string, value: number, ctx: ClassificationContext = {}): GaugeVisualColor {
  return getGaugeColorForStrategy(metric, value, "commercial", ctx);
}

/**
 * Gauge colour using the definitions calibrated for the given strategy.
 * Returns "neutral" — never "orange" — when there's no active judgement;
 * callers (GaugeDial, the PDF) must render "neutral" as a neutral/grey
 * state, not amber, since it carries no red/amber/green meaning.
 */
export function getGaugeColorForStrategy(
  metric: string,
  value: number,
  strategyId: string,
  ctx: ClassificationContext = {}
): GaugeVisualColor {
  const classification = classifyMetricForStrategy(metric, value, strategyId, ctx);
  return classification.status === "classified" ? classification.color : "neutral";
}

/**
 * The single visual benchmark marker for a gauge, DERIVED from the same
 * definition driving its colour (Decision 7) — this is what structurally
 * prevents the "arrow points at the wrong strategy's number" bug the Phase
 * 4 audit found: there is no second, separately-maintained number for a UI
 * component to get out of sync with.
 *   - fixed_bands "cutoff"     → the green boundary.
 *   - fixed_bands "sweet_spot" → undefined. A two-sided range has no single
 *                                meaningful marker; inventing one (e.g. the
 *                                midpoint) would misrepresent the rule.
 *   - target_relative          → the investor's own discountRate, if supplied.
 *   - zero_relative            → 0 — the metric's own zero-relative meaning.
 *   - unclassified             → undefined.
 */
export function getMetricBenchmark(params: {
  metricKey: string;
  strategyId: string;
  discountRate?: number;
}): number | undefined {
  const def = getThresholdDefinition(params.metricKey, params.strategyId);
  if (!def) return undefined;
  if (def.model === "fixed_bands" && def.bands?.shape === "cutoff") return def.bands.green;
  if (def.model === "target_relative") return params.discountRate;
  if (def.model === "zero_relative") return 0;
  return undefined;
}

// ---------------------------------------------------------------------------
// Equity IRR reference band (Decision 1/6): AssetVerdict's previous
// strategy-specific fixed bands, retained ONLY as secondary reference
// context — never the primary judgement, and always labelled as such.
// Values are unchanged from before Phase 4.1; only their role changed.
// ---------------------------------------------------------------------------
const IRR_REFERENCE_BANDS: Record<string, ThresholdBands> = {
  commercial: { shape: "cutoff", direction: "higher", green: 15, orange: 8 },
  buy_to_let: { shape: "cutoff", direction: "higher", green: 12, orange: 8 },
  multi_let: { shape: "cutoff", direction: "higher", green: 18, orange: 12 },
  student: { shape: "cutoff", direction: "higher", green: 15, orange: 10 },
  str: { shape: "cutoff", direction: "higher", green: 20, orange: 12 },
  instalment_sale: { shape: "cutoff", direction: "higher", green: 10, orange: 7 },
};

export interface IrrReferenceClassification {
  color: GaugeColor;
  label: "Strong" | "Caution" | "Weak";
  withinRange: boolean;
  evidenceLevel: EvidenceLevel;
  provisional: true;
}

/**
 * Secondary-only reference: "does this IRR sit within AssetVerdict's
 * previous reference range for this strategy" — a separate fact from the
 * primary target-relative classification, never used to override it. See
 * the section 6 UI example in the Phase 4.1 brief: "Target result:
 * Exceeded / AssetVerdict reference: Within current reference range."
 */
export function getIrrReferenceClassification(value: number, strategyId: string): IrrReferenceClassification | undefined {
  if (!isFiniteNumber(value)) return undefined;
  const bands = IRR_REFERENCE_BANDS[strategyId] ?? IRR_REFERENCE_BANDS.commercial;
  const color = evaluateBands(bands, value);
  return { color, label: FIXED_BANDS_LABEL[color] as "Strong" | "Caution" | "Weak", withinRange: color === "green", evidenceLevel: "provisional", provisional: true };
}
