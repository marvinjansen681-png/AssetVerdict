/**
 * Live edit-form preview inputs (Phase 4.21 — Calculation Integrity
 * Correction).
 *
 * An edit tab (Cashflow, Fix & Flip) needs to show the investor what their
 * NOI/tax/cashflow/profit would look like BEFORE they save — but it must
 * never compute that preview with its own, second copy of AssetVerdict's
 * financial formulas. This module is the one sanctioned way to bridge that
 * gap: it builds a temporary DealInputs by starting from the deal's own
 * last-saved state (assembleInputs — the exact same starting point the
 * server-authoritative /calculate route uses) and overlaying whichever
 * fields the current form is actively editing.
 *
 * The result is an ordinary DealInputs — callers pass it straight into
 * calcAllMetrics(), calcProvisionsMonthly(), calcFlipProfit(), etc. No
 * formula lives in this file; it only assembles inputs.
 */
import { assembleInputs } from "./assembleInputs";
import type { DealInputs } from "./index";
import type { DealWithRelations } from "@/types";

export function buildPreviewInputs(
  deal: DealWithRelations,
  overrides: Partial<DealInputs>
): DealInputs {
  return { ...assembleInputs(deal), ...overrides };
}
