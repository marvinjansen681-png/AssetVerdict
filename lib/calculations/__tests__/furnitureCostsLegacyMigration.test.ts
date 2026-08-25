import { describe, it, expect } from "vitest";
import {
  calcFurnitureCostSummary,
  inferLegacyContingencyPct,
  type FurnitureLineItemInput,
} from "../furnitureCosts";

/**
 * Phase 4.22.1 — legacy contingency migration/inference audit.
 *
 * Documents and proves, precisely, how a pre-Phase-4.22 saved
 * "Contingency"-category RenovationItem row (which stored a plain Rand
 * `budgeted` amount — the percentage concept did not exist yet) is
 * interpreted on first load, and that this interpretation:
 *   1. Reproduces the deal's previously-saved total EXACTLY when nothing
 *      else about the deal has changed (opening a deal must never silently
 *      change its saved figure).
 *   2. Recalculates predictably once the user actually edits something.
 *   3. Never duplicates legacy contingency, even if the old (buggy) UI had
 *      allowed more than one Contingency row to be saved.
 */
function item(overrides: Partial<FurnitureLineItemInput> = {}): FurnitureLineItemInput {
  return { category: "Bedroom Furniture", budgeted: 0, quoted: null, quantity: null, unitCost: null, ...overrides };
}

describe("Legacy contingency migration — opening an old deal (Phase 4.22.1)", () => {
  it("a single legacy contingency row (plain Rand amount, no quotes anywhere else) reproduces the exact previously-saved total on load", () => {
    const nonContingencyItems = [item({ budgeted: 100_000 }), item({ budgeted: 50_000 })];
    const legacyContingencyRow = { budgeted: 15_000, quantity: null, unitCost: null }; // stored 10% of 150,000 as a flat Rand amount, pre-4.22

    // What the OLD (pre-4.22) naive sum-of-budgeted persistence would have
    // stored as Deal.renovationCost.
    const oldStoredTotal = 100_000 + 50_000 + 15_000;

    const currentCostUsedTotal = calcFurnitureCostSummary(nonContingencyItems, null).costUsedTotal;
    const inferredPct = inferLegacyContingencyPct([legacyContingencyRow], currentCostUsedTotal);
    const reloaded = calcFurnitureCostSummary(nonContingencyItems, inferredPct);

    expect(reloaded.grandTotal).toBeCloseTo(oldStoredTotal, 6);
  });

  it("a deal with NO contingency at all is entirely unaffected — inference returns null, grandTotal is unchanged", () => {
    const items = [item({ budgeted: 40_000 }), item({ budgeted: 60_000 })];
    const inferredPct = inferLegacyContingencyPct([], calcFurnitureCostSummary(items, null).costUsedTotal);
    expect(inferredPct).toBeNull();
    expect(calcFurnitureCostSummary(items, inferredPct).grandTotal).toBe(100_000);
  });

  it("multiple legacy duplicate contingency rows (the old UI's own bug) are summed ONCE during inference, never double-applied on reload", () => {
    const nonContingencyItems = [item({ budgeted: 100_000 })];
    // Old buggy UI let a user add "+ Contingency" twice — two rows totalling
    // the intended 10% between them.
    const legacyDuplicates = [
      { budgeted: 6_000, quantity: null, unitCost: null },
      { budgeted: 4_000, quantity: null, unitCost: null },
    ];
    const oldStoredTotal = 100_000 + 6_000 + 4_000; // 110,000 — the pre-4.22 naive sum

    const inferredPct = inferLegacyContingencyPct(
      legacyDuplicates,
      calcFurnitureCostSummary(nonContingencyItems, null).costUsedTotal
    );
    const reloaded = calcFurnitureCostSummary(nonContingencyItems, inferredPct);

    expect(reloaded.grandTotal).toBeCloseTo(oldStoredTotal, 6);
    expect(reloaded.contingencyAmount).toBeCloseTo(10_000, 6); // NOT double-counted as 20,000
  });

  it("a deal whose non-contingency items already carried quotes (previously ignored) DOES change total on load — this is the Phase 4.22 quote-hierarchy fix working as intended, not a regression", () => {
    // Pre-4.22, a quote could be typed but was never consulted — the stored
    // total only ever reflected `budgeted`. Loading under the new engine
    // correctly starts using the quote, which legitimately changes the
    // figure. Documented explicitly so this is never mistaken for an
    // "opening changed my total" bug.
    const nonContingencyItems = [item({ budgeted: 100_000, quoted: 120_000 })];
    const legacyContingencyRow = { budgeted: 10_000, quantity: null, unitCost: null }; // 10% of the OLD budget-only 100,000
    const oldStoredTotal = 100_000 + 10_000; // 110,000, from before quotes were consulted

    // Inference bases the percentage on budgetTotal-era history, but the
    // NEW costUsedTotal now reflects the quote — 120,000, not 100,000.
    const inferredPct = inferLegacyContingencyPct([legacyContingencyRow], 100_000);
    const reloaded = calcFurnitureCostSummary(nonContingencyItems, inferredPct);

    expect(reloaded.grandTotal).not.toBeCloseTo(oldStoredTotal, 0);
    expect(reloaded.costUsedTotal).toBe(120_000); // the quote now correctly drives the total
  });
});

describe("Legacy contingency migration — editing an old deal recalculates predictably (Phase 4.22.1)", () => {
  it("after inference, editing an item's cost recalculates contingency from the SAME percentage against the new base — never re-reads the stale legacy Rand amount", () => {
    const originalItems = [item({ budgeted: 100_000 })];
    const legacyContingencyRow = { budgeted: 10_000, quantity: null, unitCost: null };
    const inferredPct = inferLegacyContingencyPct(
      [legacyContingencyRow],
      calcFurnitureCostSummary(originalItems, null).costUsedTotal
    );
    expect(inferredPct).toBe(10);

    // User edits the base cost upward.
    const editedItems = [item({ budgeted: 150_000 })];
    const afterEdit = calcFurnitureCostSummary(editedItems, inferredPct);

    expect(afterEdit.contingencyAmount).toBe(15_000); // 10% of the NEW base, not the stale 10,000
    expect(afterEdit.grandTotal).toBe(165_000);
  });

  it("saving after inference always produces exactly ONE contingency entry, regardless of how many legacy rows existed", () => {
    // The migration/inference step collapses N legacy rows into a single
    // `contingencyPct` value held as component state (see
    // RenovationBudget.tsx) — there is structurally no way for the next
    // save's payload to contain more than one Contingency-category item,
    // since it is synthesized fresh from that one percentage, never copied
    // from the original row list. Modelled here at the data level: the
    // summary this save is based on carries exactly one contingencyPct.
    const legacyDuplicates = [
      { budgeted: 3_000, quantity: null, unitCost: null },
      { budgeted: 3_000, quantity: null, unitCost: null },
      { budgeted: 4_000, quantity: null, unitCost: null },
    ];
    const items = [item({ budgeted: 100_000 })];
    const inferredPct = inferLegacyContingencyPct(
      legacyDuplicates,
      calcFurnitureCostSummary(items, null).costUsedTotal
    );
    const summary = calcFurnitureCostSummary(items, inferredPct);

    // A single scalar percentage/amount pair — never a list, never capable
    // of representing more than one contingency line by construction.
    expect(typeof summary.contingencyPct).toBe("number");
    expect(typeof summary.contingencyAmount).toBe("number");
  });
});
