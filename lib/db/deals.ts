import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { calcFurnitureItemBudgetCost, calcFurnitureCostSummary, CONTINGENCY_CATEGORY } from "@/lib/calculations/furnitureCosts";

const dealWithRelations = {
  financeSources: { orderBy: { order: "asc" } },
  cashflowInputs: true,
  capexItems: true,
  renovationItems: { orderBy: { order: "asc" } },
  propertyValuation: {
    include: {
      transactions: { orderBy: { order: "asc" } },
      bonds: { orderBy: { order: "asc" } },
      comparables: { orderBy: { order: "asc" } },
    },
  },
  dealSuburbs: { include: { suburbProfile: true }, orderBy: { createdAt: "asc" } },
} satisfies Prisma.DealInclude;

export async function createDeal(
  userId: string,
  data: Pick<Prisma.DealUncheckedCreateInput, "name"> &
    Partial<Prisma.DealUncheckedCreateInput>
) {
  return prisma.deal.create({
    data: { ...data, userId },
  });
}

export async function getDeal(dealId: string, userId: string) {
  const deal = await prisma.deal.findFirst({
    where: { id: dealId, userId },
    include: dealWithRelations,
  });
  return deal;
}

export async function listDeals(userId: string) {
  return prisma.deal.findMany({
    where: { userId },
    include: dealWithRelations,
    orderBy: { createdAt: "desc" },
  });
}

export async function updateDeal(
  dealId: string,
  userId: string,
  data: Prisma.DealUncheckedUpdateInput
) {
  const existing = await prisma.deal.findFirst({
    where: { id: dealId, userId },
    select: { id: true },
  });
  if (!existing) return null;

  return prisma.deal.update({
    where: { id: dealId },
    data,
  });
}

export async function deleteDeal(dealId: string, userId: string) {
  const existing = await prisma.deal.findFirst({
    where: { id: dealId, userId },
    select: { id: true },
  });
  if (!existing) return null;

  return prisma.deal.delete({ where: { id: dealId } });
}

export async function upsertCashflowInputs(
  dealId: string,
  data: Omit<Prisma.CashflowInputsUncheckedCreateInput, "dealId">
) {
  return prisma.cashflowInputs.upsert({
    where: { dealId },
    create: { ...data, dealId },
    update: data,
  });
}

export async function upsertFinanceSources(
  dealId: string,
  sources: Omit<Prisma.FinanceSourceUncheckedCreateInput, "dealId">[]
) {
  return prisma.$transaction(async (tx) => {
    await tx.financeSource.deleteMany({ where: { dealId } });
    if (sources.length === 0) return [];
    await tx.financeSource.createMany({
      data: sources.map((s, index) => ({ ...s, dealId, order: index })),
    });
    return tx.financeSource.findMany({
      where: { dealId },
      orderBy: { order: "asc" },
    });
  });
}

/**
 * Server-authoritative furniture/renovation persistence (Phase 4.22).
 *
 * Two trust-boundary corrections over the pre-4.22 version:
 *   1. Every ordinary item's `budgeted` is RECOMPUTED here from its own
 *      quantity/unitCost via calcFurnitureItemBudgetCost — a client-sent
 *      `budgeted` figure is never trusted when unit pricing is engaged
 *      (requirement 13). A client sending Qty=10, Unit=R2,500,
 *      Budget=R99,000 is persisted as R25,000, not R99,000.
 *   2. `Deal.renovationCost` is set to calcFurnitureCostSummary's own
 *      `grandTotal` — Cost Used (quote-or-budget per item, never both) plus
 *      dynamic contingency — never a naive sum of `budgeted` alone, which
 *      previously ignored `quoted` and any contingency entirely.
 *
 * At most one Contingency-category item is accepted (requirement 9) — the
 * UI's dedicated single percentage control should never send more than one,
 * but this is the actual trust boundary; a manipulated request with two is
 * rejected here rather than silently summed or overwritten.
 *
 * Still a delete-all/insert-all replace, matching upsertFinanceSources'
 * existing convention (Phase 4.22 requirement 12 audit): retained
 * deliberately as the "smallest robust solution" for this phase — it is
 * already fully transactional (an all-or-nothing single DB transaction, no
 * partial state is ever observable), and the client-side serial save queue
 * (lib/saveQueue.ts) now guarantees at most one PUT to this function is ever
 * in flight per browser session, which is the realistic race this phase
 * needed to close. True multi-tab/multi-device concurrent editing with
 * optimistic-concurrency version columns is out of scope — see the Phase
 * 4.22 report's Remaining Limitations.
 */
export async function upsertRenovationItems(
  dealId: string,
  items: Omit<Prisma.RenovationItemUncheckedCreateInput, "dealId">[]
) {
  const contingencyRows = items.filter((i) => i.category === CONTINGENCY_CATEGORY);
  if (contingencyRows.length > 1) {
    throw new Error("Only one Contingency item is allowed per deal.");
  }
  const contingencyInput = contingencyRows[0];

  const recomputedNonContingency = items
    .filter((i) => i.category !== CONTINGENCY_CATEGORY)
    .map((item) => ({
      ...item,
      budgeted: calcFurnitureItemBudgetCost({
        quantity: item.quantity ?? null,
        unitCost: item.unitCost ?? null,
        budgeted: item.budgeted ?? 0,
      }) ?? 0,
    }));

  const summary = calcFurnitureCostSummary(
    recomputedNonContingency.map((i) => ({
      category: i.category,
      budgeted: i.budgeted,
      quoted: i.quoted ?? null,
      quantity: i.quantity ?? null,
      unitCost: i.unitCost ?? null,
    })),
    contingencyInput?.unitCost ?? null
  );

  const finalItems: typeof items = contingencyInput
    ? [
        ...recomputedNonContingency,
        { ...contingencyInput, quantity: null, budgeted: summary.contingencyAmount },
      ]
    : recomputedNonContingency;

  return prisma.$transaction(async (tx) => {
    await tx.renovationItem.deleteMany({ where: { dealId } });
    if (finalItems.length > 0) {
      await tx.renovationItem.createMany({
        data: finalItems.map((item, index) => ({ ...item, dealId, order: index })),
      });
    }

    const saved = await tx.renovationItem.findMany({
      where: { dealId },
      orderBy: { order: "asc" },
    });

    await tx.deal.update({
      where: { id: dealId },
      data: { renovationCost: summary.grandTotal },
    });

    return saved;
  });
}
