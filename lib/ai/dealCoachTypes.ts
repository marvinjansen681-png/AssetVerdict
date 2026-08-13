/**
 * Shared types for the AssetVerdict Deal Coach (Phase 3).
 *
 * These types describe the boundary between the deterministic app and the
 * AI: `DealCoachContext` is the ONLY thing the model ever sees about a deal.
 * It is assembled server-side by lib/ai/buildDealCoachContext.ts from
 * already-calculated values (lib/calculations, lib/education) — never from
 * raw database records, and never from client-supplied numbers.
 */

export type ScenarioKey = "bear" | "base" | "bull";

/**
 * What the user has focused on. Structured, not inferred from UI text — see
 * Phase 3 brief section 9. A metric hand-off from a learning card always
 * produces `{ type: "metric", metricKey }`; anything else is `{ type: "deal" }`.
 */
export type DealCoachSelection = { type: "metric"; metricKey: string } | { type: "deal" };

/**
 * The fixed set of things a user can ask Deal Coach — every quick-action
 * button maps to one of these, and free-text messages default to
 * "general_question" (or "explain_metric" when a metric is selected). This
 * is what drives how much context gets built (section 6 of the brief) —
 * there is no separate "quick action answer engine": buttons just pre-fill
 * `message` and `intent` and go through the same request path as typed
 * questions.
 */
export type DealCoachIntent =
  | "explain_metric"
  | "explain_deal_simple"
  | "identify_risks"
  | "identify_strengths"
  | "list_assumptions_to_verify"
  | "identify_failure_modes"
  | "compare_scenarios"
  | "due_diligence"
  | "teach_deal"
  | "general_question";

export interface DealCoachMessage {
  role: "user" | "assistant";
  content: string;
}

/** A single deal-metric fact as Deal Coach is allowed to know it — never a raw calculation, always the engine's own output plus the registry's own education content. */
export interface DealCoachMetricEntry {
  key: string;
  name: string;
  shortName?: string;
  category: string;
  /** property / financing / investor / flip — see lib/education/metricDefinitions.ts. */
  perspective: string;
  value: number | null;
  formattedValue: string;
  applicable: boolean;
  applicabilityReason?: string;
  /**
   * Explicit classification status (Phase 3.1, section 9) — the coach must
   * be able to tell "AssetVerdict judged this Caution" apart from
   * "AssetVerdict has no calibrated benchmark for this metric at all."
   * Undefined only when `applicable` is false (not_applicable is already
   * conveyed by `applicable`/`applicabilityReason`).
   */
  classification?:
    | { status: "classified"; label: "Strong" | "Caution" | "Weak"; provisional: boolean }
    | { status: "unclassified"; provisional?: undefined };
  simpleExplanation: string;
  whyItMatters?: string;
  /** Only populated for a single selected metric or a small "closely related" set — never for every metric in a broad context, to keep payloads bounded. */
  breakdown?: {
    formula: string;
    lines: { label: string; value: string }[];
    result: string;
  };
  interpretation?: string;
  /** Human labels, already resolved — never raw registry keys. */
  affectedBy?: string[];
  affects?: string[];
}

export interface DealCoachContext {
  deal: {
    name: string;
    strategyId: string;
    strategyLabel: string;
    currency: string;
    address?: string | null;
  };
  scenario: {
    active: ScenarioKey;
    note: string;
  };
  /** The bounded set of metrics relevant to this request — see buildDealCoachContext.ts for how breadth is chosen per intent. */
  metrics: DealCoachMetricEntry[];
  /** Only present for intent "compare_scenarios": headline metrics per scenario, not full 20-year projections. */
  scenarioComparison?: Record<ScenarioKey, Record<string, string>>;
  /** Deterministic, rule-based flags (e.g. "occupancy assumed at 100%") — the engine identifies WHAT is assumption-heavy; the AI turns that into due-diligence questions, never the reverse. */
  assumptionFlags?: { field: string; value: string; note: string }[];
  selection: DealCoachSelection;
}

export interface DealCoachRequestBody {
  message: string;
  intent?: DealCoachIntent;
  selectedMetric?: string;
  activeScenario?: ScenarioKey;
  conversation?: DealCoachMessage[];
}

export interface DealCoachResponse {
  answer: string;
  referencedMetrics?: string[];
  suggestedFollowUps?: string[];
}
