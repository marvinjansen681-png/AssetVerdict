import Link from "next/link";
import { auth } from "@/lib/auth";
import { listDeals } from "@/lib/db/deals";
import DealCard, { type DealQuickStats } from "@/components/DealCard";
import Button from "@/components/ui/Button";
import BackButton from "@/components/ui/BackButton";
import { calcAllMetrics } from "@/lib/calculations";
import { assembleInputs, getMissingFields } from "@/lib/calculations/assembleInputs";
import type { DealWithRelations } from "@/types";

export const metadata = {
  title: "My Deals | AssetVerdict",
};

function quickStatsFor(deal: DealWithRelations): DealQuickStats | null {
  if (getMissingFields(deal).length > 0) return null;
  const inputs = assembleInputs(deal);
  const metrics = calcAllMetrics(inputs);
  return {
    irr: metrics.irr,
    grossYield: metrics.grossYield,
    cashflowMonthly: metrics.cashflowMonthly,
    netProfit: metrics.flipMetrics?.netProfit,
    roi: metrics.flipMetrics?.roi,
  };
}

export default async function DealsPage() {
  const session = await auth();
  const deals = await listDeals(session!.user.id);

  return (
    <div className="px-4 md:px-8 py-8 max-w-7xl mx-auto">
      <BackButton href="/" label="Home" className="mb-3" />
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display text-3xl text-av-navy">My Deals</h1>
        <Link href="/deals/new">
          <Button>+ New Deal</Button>
        </Link>
      </div>

      {deals.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-24 border border-dashed border-av-light-grey rounded-lg">
          <svg
            width={48}
            height={48}
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="mb-4"
          >
            <path
              d="M16 2 L28 7 V15 C28 22.5 22.8 27.8 16 30 C9.2 27.8 4 22.5 4 15 V7 L16 2 Z"
              fill="#EDF2F7"
              stroke="#C9A84C"
              strokeWidth="1.5"
            />
            <path
              d="M10.5 15.5 L14 19 L21.5 11"
              stroke="#C9A84C"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
          <h2 className="font-display text-xl text-av-navy mb-2">
            No deals yet
          </h2>
          <p className="text-sm font-body text-av-slate mb-6 max-w-xs">
            Start modelling your first commercial property deal to see your
            verdict.
          </p>
          <Link href="/deals/new">
            <Button>Analyse your first deal</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {deals.map((deal) => (
            <DealCard
              key={deal.id}
              deal={deal as unknown as DealWithRelations}
              quickStats={quickStatsFor(deal as unknown as DealWithRelations)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
