import { describe, it, expect } from "vitest";
import {
  calcFurnitureItemBudgetCost,
  calcFurnitureItemResult,
  calcFurnitureCostSummary,
  inferLegacyContingencyPct,
  isUnitPricingEngaged,
  type FurnitureLineItemInput,
} from "../furnitureCosts";

function item(overrides: Partial<FurnitureLineItemInput> = {}): FurnitureLineItemInput {
  return {
    category: "Bedroom Furniture",
    budgeted: 0,
    quoted: null,
    quantity: null,
    unitCost: null,
    ...overrides,
  };
}

describe("calcFurnitureItemBudgetCost — basic arithmetic (Phase 4.22, requirement 20)", () => {
  it("10 x R2,500 = R25,000", () => {
    expect(calcFurnitureItemBudgetCost(item({ quantity: 10, unitCost: 2_500 }))).toBe(25_000);
  });

  it("a pure lump-sum item (no quantity/unitCost) trusts the directly-typed budgeted value", () => {
    expect(calcFurnitureItemBudgetCost(item({ budgeted: 18_000 }))).toBe(18_000);
  });

  it("quantity of 0 is a valid, complete value (not treated as missing)", () => {
    expect(calcFurnitureItemBudgetCost(item({ quantity: 0, unitCost: 500 }))).toBe(0);
  });
});

describe("Defect: stale budget after clearing a primitive (Phase 4.22, requirement 3/20)", () => {
  it("10 x R2,500 = R25,000, then Quantity cleared -> budgetCost is null, never the stale R25,000", () => {
    const withBoth = item({ quantity: 10, unitCost: 2_500 });
    expect(calcFurnitureItemBudgetCost(withBoth)).toBe(25_000);

    const quantityCleared = { ...withBoth, quantity: null };
    expect(calcFurnitureItemBudgetCost(quantityCleared)).toBeNull();
    expect(calcFurnitureItemBudgetCost(quantityCleared)).not.toBe(25_000);
  });

  it("same rule for clearing Unit Cost instead", () => {
    const withBoth = item({ quantity: 12, unitCost: 3_000 });
    expect(calcFurnitureItemBudgetCost(withBoth)).toBe(36_000);

    const unitCostCleared = { ...withBoth, unitCost: null };
    expect(calcFurnitureItemBudgetCost(unitCostCleared)).toBeNull();
    expect(calcFurnitureItemBudgetCost(unitCostCleared)).not.toBe(36_000);
  });

  it("costUsed falls to 0 (never the stale amount) once the primitive is cleared", () => {
    const cleared = item({ quantity: null, unitCost: 3_000 }); // Quantity was cleared
    const result = calcFurnitureItemResult(cleared);
    expect(result.budgetCost).toBeNull();
    expect(result.costUsed).toBe(0);
  });

  it("isUnitPricingEngaged is true even with only one of the two primitives set (so the item is correctly treated as incomplete, not as a fresh lump sum)", () => {
    expect(isUnitPricingEngaged(item({ quantity: 5, unitCost: null }))).toBe(true);
    expect(isUnitPricingEngaged(item({ quantity: null, unitCost: 500 }))).toBe(true);
    expect(isUnitPricingEngaged(item({ quantity: null, unitCost: null }))).toBe(false);
  });
});

describe("Defect: Quoted cost hierarchy (Phase 4.22, requirement 4/20)", () => {
  it("quote overrides budget: Budget R25,000, Quote R32,000 -> Cost Used = R32,000", () => {
    const result = calcFurnitureItemResult(item({ quantity: 10, unitCost: 2_500, quoted: 32_000 }));
    expect(result.budgetCost).toBe(25_000);
    expect(result.quotedCost).toBe(32_000);
    expect(result.costUsed).toBe(32_000);
  });

  it("no quote: Cost Used = Budget", () => {
    const result = calcFurnitureItemResult(item({ quantity: 10, unitCost: 2_500, quoted: null }));
    expect(result.quotedCost).toBeNull();
    expect(result.costUsed).toBe(25_000);
  });

  it("variance is Quoted - Budget when a quote exists", () => {
    const result = calcFurnitureItemResult(item({ quantity: 10, unitCost: 2_500, quoted: 32_000 }));
    expect(result.variance).toBe(7_000);
  });

  it("variance is N/A (null), never a fake 0, when no quote exists", () => {
    const result = calcFurnitureItemResult(item({ quantity: 10, unitCost: 2_500, quoted: null }));
    expect(result.variance).toBeNull();
  });

  it("no double count: Cost Used must NOT be Budget + Quote", () => {
    const result = calcFurnitureItemResult(item({ budgeted: 25_000, quoted: 32_000 }));
    expect(result.costUsed).toBe(32_000);
    expect(result.costUsed).not.toBe(57_000);
  });
});

describe("calcFurnitureCostSummary — totals and partial quotes (Phase 4.22, requirement 6/20)", () => {
  it("partial quotes: Item A (Budget R25,000, Quote R30,000) + Item B (Budget R20,000, no quote) -> Cost Used Total = R50,000", () => {
    const items = [
      item({ budgeted: 25_000, quoted: 30_000 }),
      item({ budgeted: 20_000, quoted: null }),
    ];
    const summary = calcFurnitureCostSummary(items, null);
    expect(summary.costUsedTotal).toBe(50_000);
    expect(summary.budgetTotal).toBe(45_000);
    expect(summary.quotedTotal).toBe(30_000); // only the item that actually has a quote
  });

  it("worked example from the brief: Beds (Budget R30,000, Quote R35,000) + Desks (Budget R20,000, no quote) -> Total Cost Used = R55,000, not R35,000", () => {
    const items = [
      item({ budgeted: 30_000, quoted: 35_000 }), // Beds
      item({ budgeted: 20_000, quoted: null }), // Desks
    ];
    const summary = calcFurnitureCostSummary(items, null);
    expect(summary.costUsedTotal).toBe(55_000);
    expect(summary.costUsedTotal).not.toBe(35_000);
  });

  it("quotedTotal never silently represents the full package total", () => {
    const items = [item({ budgeted: 25_000, quoted: 32_000 }), item({ budgeted: 20_000, quoted: null })];
    const summary = calcFurnitureCostSummary(items, null);
    // quotedTotal (only the quoted item) must differ from costUsedTotal
    // (which correctly blends quote-or-budget across every item).
    expect(summary.quotedTotal).toBe(32_000);
    expect(summary.costUsedTotal).toBe(52_000);
  });
});

describe("Dynamic contingency (Phase 4.22, requirement 7/8/20)", () => {
  it("base R100,000, 10% -> R10,000", () => {
    const items = [item({ budgeted: 100_000 })];
    const summary = calcFurnitureCostSummary(items, 10);
    expect(summary.contingencyBase).toBe(100_000);
    expect(summary.contingencyAmount).toBe(10_000);
  });

  it("base later becomes R150,000 -> 10% recalculates to R15,000, never staying at R10,000", () => {
    const before = calcFurnitureCostSummary([item({ budgeted: 100_000 })], 10);
    expect(before.contingencyAmount).toBe(10_000);

    const after = calcFurnitureCostSummary([item({ budgeted: 150_000 })], 10);
    expect(after.contingencyAmount).toBe(15_000);
    expect(after.contingencyAmount).not.toBe(10_000);
  });

  it("contingency base uses Cost Used (quote-aware), not Budget-only — a quote replacing a budget changes contingency too", () => {
    const budgetOnly = calcFurnitureCostSummary([item({ budgeted: 100_000, quoted: null })], 10);
    expect(budgetOnly.contingencyAmount).toBe(10_000);

    const withHigherQuote = calcFurnitureCostSummary([item({ budgeted: 100_000, quoted: 120_000 })], 10);
    expect(withHigherQuote.contingencyBase).toBe(120_000);
    expect(withHigherQuote.contingencyAmount).toBe(12_000);
  });

  it("contingency is never applied twice: grandTotal = costUsedTotal + contingencyAmount, exactly once", () => {
    const summary = calcFurnitureCostSummary([item({ budgeted: 100_000 })], 10);
    expect(summary.grandTotal).toBe(110_000);
  });

  it("a null/zero contingency percentage contributes exactly 0, not undefined behaviour", () => {
    const summary = calcFurnitureCostSummary([item({ budgeted: 100_000 })], null);
    expect(summary.contingencyPct).toBeNull();
    expect(summary.contingencyAmount).toBe(0);
    expect(summary.grandTotal).toBe(100_000);

    const zeroPct = calcFurnitureCostSummary([item({ budgeted: 100_000 })], 0);
    expect(zeroPct.contingencyAmount).toBe(0);
  });
});

describe("Client-manipulation resistance (Phase 4.22, requirement 13/20)", () => {
  it("a conflicting client-sent Budget is irrelevant to the authoritative Budget Cost once Quantity/Unit Cost are present", () => {
    // Client sends Qty=10, Unit=R2,500, but also a bogus Budget=R99,000 —
    // the authoritative function only ever reads quantity/unitCost/budgeted
    // through the same rule; the caller (server route) must pass the raw
    // client fields straight through so this recompute always wins.
    const clientPayload = item({ quantity: 10, unitCost: 2_500, budgeted: 99_000 });
    expect(calcFurnitureItemBudgetCost(clientPayload)).toBe(25_000);
    expect(calcFurnitureItemBudgetCost(clientPayload)).not.toBe(99_000);
  });
});

describe("inferLegacyContingencyPct — pre-4.22 data hydration", () => {
  it("reads a new-format row's unitCost directly as the percentage", () => {
    const pct = inferLegacyContingencyPct([{ budgeted: 5_000, quantity: null, unitCost: 8 }], 100_000);
    expect(pct).toBe(8);
  });

  it("infers a percentage from a legacy Rand amount relative to the current cost-used total", () => {
    // Old row stored a flat R10,000 when the subtotal was some earlier
    // value; current subtotal is R100,000 -> infer 10%.
    const pct = inferLegacyContingencyPct([{ budgeted: 10_000, quantity: null, unitCost: null }], 100_000);
    expect(pct).toBe(10);
  });

  it("sums multiple legacy duplicate contingency rows (old UI allowed duplicates) before inferring", () => {
    const pct = inferLegacyContingencyPct(
      [
        { budgeted: 6_000, quantity: null, unitCost: null },
        { budgeted: 4_000, quantity: null, unitCost: null },
      ],
      100_000
    );
    expect(pct).toBe(10);
  });

  it("returns null when there is nothing to infer from (no legacy rows, or zero base)", () => {
    expect(inferLegacyContingencyPct([], 100_000)).toBeNull();
    expect(inferLegacyContingencyPct([{ budgeted: 5_000, quantity: null, unitCost: null }], 0)).toBeNull();
  });
});
