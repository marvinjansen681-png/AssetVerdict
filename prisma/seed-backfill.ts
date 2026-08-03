/**
 * V2 backfill: ensures pre-V2 deals have sane values for the new
 * investmentStrategy / numUnits columns. In practice Postgres already
 * backfills existing rows when a column is added with a DEFAULT, so this
 * is a safety net for any rows that somehow ended up NULL.
 *
 * Run with: npx tsx prisma/seed-backfill.ts
 */
import { prisma } from "@/lib/db";

async function main() {
  const strategyResult = await prisma.deal.updateMany({
    where: { investmentStrategy: null },
    data: { investmentStrategy: "commercial" },
  });
  console.log(`Backfilled investmentStrategy on ${strategyResult.count} deal(s).`);

  const unitsResult = await prisma.deal.updateMany({
    where: { numUnits: null },
    data: { numUnits: 1 },
  });
  console.log(`Backfilled numUnits on ${unitsResult.count} deal(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
