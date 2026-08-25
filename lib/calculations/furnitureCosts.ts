/**
 * Furniture, Setup & Renovation Cost Integrity (Phase 4.22).
 *
 * The ONE authoritative source for turning a list of furniture/setup/
 * renovation line items into the financial figures that feed the deal —
 * used by the edit-tab UI (live preview), the /renovation API route
 * (server-authoritative persistence), and the PDF/summary display. No
 * second implementation of "budget cost", "cost used", or "contingency"
 * may exist anywhere else in the app — see the module's own repository-wide
 * search note in the Phase 4.22 report.
 *
 * Core architecture:
 *
 *   line item primitives (quantity, unitCost, budgeted, quoted)
 *         v
 *   calcFurnitureItemBudgetCost()  <- Quantity x Unit Cost, authoritative
 *         v
 *   calcFurnitureItemResult()      <- + quotedCost, variance, costUsed
 *         v
 *   calcFurnitureCostSummary()     <- totals + contingency + grand total
 *         v
 *   Deal.renovationCost (= grandTotal) -> calcTotalInvestment() (unchanged,
 *   single field, Phase 4.21's engine already reads it — see
 *   lib/calculations/index.ts's calcTotalInvestment / assembleInputs.ts)
 *
 * Cost hierarchy per item (requirement 4): if a valid Quoted Cost exists,
 * it is the Cost Used; otherwise the Calculated Budget Cost is used. The
 * two are NEVER summed (requirement 16 — no double counting).
 *
 * Contingency (requirements 7-9): modelled as a single percentage, applied
 * to the SAME Cost Used basis as the underlying items (requirement 8's
 * preferred convention) — never stored as a stale fixed Rand amount, and
 * never a repeatable line item a user could accidentally duplicate (see
 * CONTINGENCY_CATEGORY and the dedicated single-control UI in
 * RenovationBudget.tsx). No new database column was needed: a Contingency
 * row's `unitCost` field is repurposed to hold the percentage (0-100) and
 * its `quantity` is always null for this category — see
 * isUnitPricingEngaged's doc comment for why this can never be confused
 * with an ordinary Rand unit cost.
 */
import { isFiniteNumber } from "./index";

/** The one reserved category name for the single contingency control — never an ordinary repeatable line item (Phase 4.22). */
export const CONTINGENCY_CATEGORY = "Contingency";

export interface FurnitureLineItemInput {
  category: string;
  /** Directly-typed lump sum — authoritative ONLY when unit pricing was never engaged for this row (both quantity and unitCost are null). Ignored/recomputed whenever unit pricing IS engaged (requirement 2/13). */
  budgeted: number;
  quoted: number | null;
  quantity: number | null;
  /** For an ordinary item: Rand cost per unit. For the reserved Contingency category: the contingency percentage (0-100) — see the module doc comment. */
  unitCost: number | null;
}

/**
 * Whether this row has ever engaged unit pricing — i.e. at least one of
 * Quantity/Unit Cost has a value. Once engaged, BOTH are required for a
 * valid Budget Cost (requirement 3): an incomplete pair must never fall
 * back to a stale previously-computed number.
 */
export function isUnitPricingEngaged(item: Pick<FurnitureLineItemInput, "quantity" | "unitCost">): boolean {
  return item.quantity !== null || item.unitCost !== null;
}

function isValidNonNegative(value: number | null): value is number {
  return isFiniteNumber(value) && value >= 0;
}

/**
 * Authoritative Budget Cost for one ordinary (non-Contingency) line item
 * (requirement 2/3):
 *   - Unit pricing engaged + both primitives valid -> Quantity x Unit Cost.
 *   - Unit pricing engaged but incomplete (one cleared/invalid) -> null.
 *     NEVER the old, stale, pre-clearing amount.
 *   - Unit pricing never engaged (both null) -> the item's own directly-
 *     typed `budgeted` lump sum (there is no primitive to recompute this
 *     from, so it is trusted as entered).
 */
export function calcFurnitureItemBudgetCost(
  item: Pick<FurnitureLineItemInput, "quantity" | "unitCost" | "budgeted">
): number | null {
  if (!isUnitPricingEngaged(item)) return item.budgeted;
  if (isValidNonNegative(item.quantity) && isValidNonNegative(item.unitCost)) {
    return item.quantity * item.unitCost;
  }
  return null;
}

export interface FurnitureLineItemResult {
  /** null only when unit pricing is engaged but incomplete — see calcFurnitureItemBudgetCost. */
  budgetCost: number | null;
  /** null when no valid quote is recorded — never a fake 0 (requirement 4). */
  quotedCost: number | null;
  /** quotedCost - (budgetCost ?? 0). null (N/A) when no quote exists — never a fake 0 (requirement 4). */
  variance: number | null;
  /** The single number this item contributes to the deal: quotedCost if present, otherwise (budgetCost ?? 0) — NEVER quotedCost + budgetCost (requirement 16). */
  costUsed: number;
}

/** One line item's full result — budget/quote/variance/cost-used (requirement 4). Not meaningful for the reserved Contingency row; use calcFurnitureCostSummary's own contingency fields for that. */
export function calcFurnitureItemResult(
  item: Pick<FurnitureLineItemInput, "quantity" | "unitCost" | "budgeted" | "quoted">
): FurnitureLineItemResult {
  const budgetCost = calcFurnitureItemBudgetCost(item);
  const quotedCost = isValidNonNegative(item.quoted) ? item.quoted : null;
  const variance = quotedCost === null ? null : quotedCost - (budgetCost ?? 0);
  const costUsed = quotedCost !== null ? quotedCost : (budgetCost ?? 0);
  return { budgetCost, quotedCost, variance, costUsed };
}

export interface FurnitureCostSummary {
  /** Sum of every non-Contingency item's budgetCost (null items contribute 0). */
  budgetTotal: number;
  /** Sum of quotedCost across only the items that actually have a valid quote (requirement 6 — "Total Quotes Entered", not a full-package total). */
  quotedTotal: number;
  /** Sum of every non-Contingency item's costUsed — quote-or-budget per item, never both (requirement 16). Excludes contingency. */
  costUsedTotal: number;
  /** The single contingency percentage in force, or null if no contingency is set. */
  contingencyPct: number | null;
  /** The base the percentage is applied to — costUsedTotal (requirement 8's preferred convention: contingency tracks the SAME cost-used basis as the underlying items, so a quote replacing a budget updates contingency too). */
  contingencyBase: number;
  contingencyAmount: number;
  /** costUsedTotal + contingencyAmount — the ONE number that becomes Deal.renovationCost / "Cost Used in Deal" (requirement 17). */
  grandTotal: number;
}

/**
 * The one authoritative roll-up (requirement 14). `items` must exclude the
 * reserved Contingency row (contingency is supplied separately as a plain
 * percentage — see the module doc comment on why it is not an ordinary line
 * item). Pure; never mutates its inputs.
 */
export function calcFurnitureCostSummary(
  items: FurnitureLineItemInput[],
  contingencyPct: number | null
): FurnitureCostSummary {
  let budgetTotal = 0;
  let quotedTotal = 0;
  let costUsedTotal = 0;

  for (const item of items) {
    const result = calcFurnitureItemResult(item);
    budgetTotal += result.budgetCost ?? 0;
    if (result.quotedCost !== null) quotedTotal += result.quotedCost;
    costUsedTotal += result.costUsed;
  }

  const pct = isFiniteNumber(contingencyPct) && contingencyPct > 0 ? contingencyPct : null;
  const contingencyBase = costUsedTotal;
  const contingencyAmount = pct !== null ? contingencyBase * (pct / 100) : 0;

  return {
    budgetTotal,
    quotedTotal,
    costUsedTotal,
    contingencyPct: pct,
    contingencyBase,
    contingencyAmount,
    grandTotal: costUsedTotal + contingencyAmount,
  };
}

/**
 * Best-effort, read-time-only inference of an equivalent contingency
 * percentage from PRE-Phase-4.22 saved data, where a "Contingency" category
 * row stored a plain Rand `budgeted` amount (never a percentage — that
 * concept didn't exist yet) and, occasionally, more than one such row could
 * exist (the old UI never prevented duplicates). Never mutates the deal;
 * purely a display/hydration convenience for the edit screen the first time
 * it loads a pre-4.22 deal. See the Phase 4.22 report's "Remaining
 * Limitations" section — this is a one-time, approximate conversion, not a
 * database migration.
 *
 * Preference order:
 *   1. A single existing row that already looks like the NEW format
 *      (quantity null, unitCost a plausible 0-100 percentage) — read
 *      directly, no inference needed.
 *   2. Otherwise, infer a percentage from the legacy stored Rand amount(s)
 *      relative to the CURRENT non-contingency cost-used total.
 */
export function inferLegacyContingencyPct(
  legacyContingencyItems: Pick<FurnitureLineItemInput, "budgeted" | "quantity" | "unitCost">[],
  currentNonContingencyCostUsedTotal: number
): number | null {
  if (legacyContingencyItems.length === 0) return null;

  const newFormatRow = legacyContingencyItems.find(
    (i) => i.quantity === null && isValidNonNegative(i.unitCost) && i.unitCost! <= 100
  );
  if (newFormatRow) return newFormatRow.unitCost;

  if (!(currentNonContingencyCostUsedTotal > 0)) return null;
  const legacyRandTotal = legacyContingencyItems.reduce((sum, i) => sum + (i.budgeted || 0), 0);
  return (legacyRandTotal / currentNonContingencyCostUsedTotal) * 100;
}
