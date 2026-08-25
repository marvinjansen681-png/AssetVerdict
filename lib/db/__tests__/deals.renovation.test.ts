import { describe, it, expect, vi, beforeEach } from "vitest";

// Fake Prisma transaction/table surface — mirrors exactly the calls
// upsertRenovationItems makes (deleteMany/createMany/findMany/deal.update),
// mirroring the mocking pattern already used by
// app/api/deals/[id]/coach/__tests__/route.test.ts.
let store: Array<Record<string, unknown>> = [];
const dealUpdateCalls: Array<Record<string, unknown>> = [];
const createManyCalls: Array<Array<Record<string, unknown>>> = [];

const tx = {
  renovationItem: {
    deleteMany: vi.fn(async () => {
      store = [];
    }),
    createMany: vi.fn(async ({ data }: { data: Array<Record<string, unknown>> }) => {
      createManyCalls.push(data);
      store = data.map((d, i) => ({ id: `id-${i}`, ...d }));
    }),
    findMany: vi.fn(async () => [...store].sort((a, b) => (a.order as number) - (b.order as number))),
  },
  deal: {
    update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      dealUpdateCalls.push(data);
      return { id: "deal-1", ...data };
    }),
  },
};

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(tx)),
  },
}));

import { upsertRenovationItems } from "../deals";

function baseItem(overrides: Record<string, unknown> = {}) {
  return {
    category: "Bedroom Furniture",
    description: "Bed & Mattress",
    budgeted: 0,
    quoted: null,
    status: "Not Started",
    quantity: null,
    unitCost: null,
    ...overrides,
  };
}

beforeEach(() => {
  store = [];
  dealUpdateCalls.length = 0;
  createManyCalls.length = 0;
  vi.clearAllMocks();
});

describe("upsertRenovationItems — server-authoritative recomputation (Phase 4.22, requirement 13/20)", () => {
  it("recomputes budgetCost from Quantity x Unit Cost, ignoring a conflicting client-sent Budget", async () => {
    // Client sends Qty=10, Unit=R2,500, Budget=R99,000 (bogus/manipulated).
    await upsertRenovationItems("deal-1", [
      baseItem({ quantity: 10, unitCost: 2_500, budgeted: 99_000 }),
    ]);

    expect(createManyCalls[0][0].budgeted).toBe(25_000);
    expect(createManyCalls[0][0].budgeted).not.toBe(99_000);
  });

  it("Deal.renovationCost is Cost Used Total (quote-or-budget per item), never a naive sum of budgeted alone", async () => {
    await upsertRenovationItems("deal-1", [
      baseItem({ description: "Beds", budgeted: 30_000, quoted: 35_000 }),
      baseItem({ description: "Desks", budgeted: 20_000, quoted: null }),
    ]);

    // Old (defective) naive sum of budgeted would be 30,000 + 20,000 = 50,000.
    // Correct Cost Used Total: quote (35,000) + budget (20,000) = 55,000.
    expect(dealUpdateCalls[0].renovationCost).toBe(55_000);
    expect(dealUpdateCalls[0].renovationCost).not.toBe(50_000);
  });

  it("no double counting: a single item with both Budget and Quote contributes its Quote once, never Budget + Quote", async () => {
    await upsertRenovationItems("deal-1", [baseItem({ budgeted: 25_000, quoted: 32_000 })]);
    expect(dealUpdateCalls[0].renovationCost).toBe(32_000);
    expect(dealUpdateCalls[0].renovationCost).not.toBe(57_000);
  });

  it("dynamic contingency: a Contingency row's unitCost (percentage) is applied to the Cost Used total of the other items, and its own budgeted is server-computed, not trusted from the client", async () => {
    await upsertRenovationItems("deal-1", [
      baseItem({ description: "Beds", budgeted: 100_000, quoted: null }),
      // Client sends a Contingency row with a bogus stale budgeted amount —
      // the server must recompute it from the percentage x the actual base.
      baseItem({ category: "Contingency", description: "Contingency (10%)", unitCost: 10, budgeted: 999 }),
    ]);

    expect(dealUpdateCalls[0].renovationCost).toBe(110_000); // 100,000 + 10%
    const contingencyRow = createManyCalls[0].find((i) => i.category === "Contingency")!;
    expect(contingencyRow.budgeted).toBe(10_000);
    expect(contingencyRow.budgeted).not.toBe(999);
  });

  it("rejects more than one Contingency item rather than silently summing or overwriting them", async () => {
    await expect(
      upsertRenovationItems("deal-1", [
        baseItem({ category: "Contingency", unitCost: 5 }),
        baseItem({ category: "Contingency", unitCost: 10 }),
      ])
    ).rejects.toThrow(/only one contingency/i);
  });

  it("stale inputs cannot survive: an item with Quantity cleared (unitCost still set) persists budgeted = 0, not a stale prior amount", async () => {
    // Simulates the SECOND save after a first save where quantity=10 (any
    // stale client-side state must never reach the server as a lingering
    // non-zero budgeted for an incomplete unit-priced row).
    await upsertRenovationItems("deal-1", [baseItem({ quantity: null, unitCost: 3_000, budgeted: 36_000 })]);
    expect(createManyCalls[0][0].budgeted).toBe(0);
  });
});
