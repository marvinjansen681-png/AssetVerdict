import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

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

export async function upsertRenovationItems(
  dealId: string,
  items: Omit<Prisma.RenovationItemUncheckedCreateInput, "dealId">[]
) {
  return prisma.$transaction(async (tx) => {
    await tx.renovationItem.deleteMany({ where: { dealId } });
    if (items.length > 0) {
      await tx.renovationItem.createMany({
        data: items.map((item, index) => ({ ...item, dealId, order: index })),
      });
    }

    const saved = await tx.renovationItem.findMany({
      where: { dealId },
      orderBy: { order: "asc" },
    });

    const total = saved.reduce((sum, item) => sum + item.budgeted, 0);
    await tx.deal.update({
      where: { id: dealId },
      data: { renovationCost: total },
    });

    return saved;
  });
}
