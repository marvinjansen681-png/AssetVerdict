import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

const valuationWithRelations = {
  transactions: { orderBy: { order: "asc" } },
  bonds: { orderBy: { order: "asc" } },
  comparables: { orderBy: { order: "asc" } },
} satisfies Prisma.PropertyValuationInclude;

export async function getPropertyValuation(dealId: string) {
  return prisma.propertyValuation.findUnique({
    where: { dealId },
    include: valuationWithRelations,
  });
}

export async function upsertPropertyValuation(
  dealId: string,
  data: Omit<Prisma.PropertyValuationUncheckedCreateInput, "dealId">,
  transactions: Omit<Prisma.PropertyTransactionUncheckedCreateInput, "propertyValuationId">[] = [],
  bonds: Omit<Prisma.BondRecordUncheckedCreateInput, "propertyValuationId">[] = [],
  comparables: Omit<Prisma.ComparableSaleUncheckedCreateInput, "propertyValuationId">[] = []
) {
  return prisma.$transaction(async (tx) => {
    const valuation = await tx.propertyValuation.upsert({
      where: { dealId },
      create: { ...data, dealId },
      update: data,
    });

    await tx.propertyTransaction.deleteMany({ where: { propertyValuationId: valuation.id } });
    if (transactions.length > 0) {
      await tx.propertyTransaction.createMany({
        data: transactions.map((t, index) => ({ ...t, propertyValuationId: valuation.id, order: index })),
      });
    }

    await tx.bondRecord.deleteMany({ where: { propertyValuationId: valuation.id } });
    if (bonds.length > 0) {
      await tx.bondRecord.createMany({
        data: bonds.map((b, index) => ({ ...b, propertyValuationId: valuation.id, order: index })),
      });
    }

    await tx.comparableSale.deleteMany({ where: { propertyValuationId: valuation.id } });
    if (comparables.length > 0) {
      await tx.comparableSale.createMany({
        data: comparables.map((c, index) => ({ ...c, propertyValuationId: valuation.id, order: index })),
      });
    }

    return tx.propertyValuation.findUnique({
      where: { id: valuation.id },
      include: valuationWithRelations,
    });
  });
}

export async function deletePropertyValuation(dealId: string) {
  return prisma.propertyValuation.delete({ where: { dealId } }).catch(() => null);
}

export async function listSuburbProfiles(userId: string) {
  return prisma.suburbProfile.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getSuburbProfile(id: string, userId: string) {
  return prisma.suburbProfile.findFirst({ where: { id, userId } });
}

export async function createSuburbProfile(
  userId: string,
  data: Pick<Prisma.SuburbProfileUncheckedCreateInput, "suburbName" | "reportType"> &
    Partial<Prisma.SuburbProfileUncheckedCreateInput>
) {
  return prisma.suburbProfile.create({ data: { ...data, userId } });
}

export async function updateSuburbProfile(
  id: string,
  userId: string,
  data: Prisma.SuburbProfileUncheckedUpdateInput
) {
  const existing = await prisma.suburbProfile.findFirst({ where: { id, userId }, select: { id: true } });
  if (!existing) return null;
  return prisma.suburbProfile.update({ where: { id }, data });
}

export async function deleteSuburbProfile(id: string, userId: string) {
  const existing = await prisma.suburbProfile.findFirst({ where: { id, userId }, select: { id: true } });
  if (!existing) return null;
  return prisma.suburbProfile.delete({ where: { id } });
}

export async function linkSuburbToDeal(dealId: string, suburbProfileId: string, isPrimary = true) {
  if (isPrimary) {
    await prisma.dealSuburb.updateMany({
      where: { dealId },
      data: { isPrimary: false },
    });
  }
  return prisma.dealSuburb.upsert({
    where: { dealId_suburbProfileId: { dealId, suburbProfileId } },
    create: { dealId, suburbProfileId, isPrimary },
    update: { isPrimary },
  });
}

export async function unlinkSuburbFromDeal(dealId: string, suburbProfileId: string) {
  return prisma.dealSuburb
    .delete({ where: { dealId_suburbProfileId: { dealId, suburbProfileId } } })
    .catch(() => null);
}

export async function getDealSuburbs(dealId: string) {
  return prisma.dealSuburb.findMany({
    where: { dealId },
    include: { suburbProfile: true },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
  });
}

export async function getPrimarySuburbProfile(dealId: string) {
  const link = await prisma.dealSuburb.findFirst({
    where: { dealId, isPrimary: true },
    include: { suburbProfile: true },
  });
  return link?.suburbProfile ?? null;
}
