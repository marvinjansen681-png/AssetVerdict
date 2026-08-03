import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDeal } from "@/lib/db/deals";
import TabNav from "@/components/TabNav";
import BackButton from "@/components/ui/BackButton";
import { DealProvider } from "@/lib/DealContext";
import type { DealWithRelations } from "@/types";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();
  const deal = await getDeal(params.id, session!.user.id);
  return { title: deal ? `${deal.name} | AssetVerdict` : "Deal | AssetVerdict" };
}

export default async function DealEditLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const session = await auth();
  const deal = await getDeal(params.id, session!.user.id);

  if (!deal) notFound();

  return (
    <DealProvider deal={deal as unknown as DealWithRelations}>
      <div>
        <div className="px-4 md:px-8 pt-6 pb-2">
          <BackButton href="/deals" label="My Deals" />
          <p className="text-xs font-body text-av-slate mt-1">
            Home / My Deals / {deal.name}
          </p>
        </div>
        <TabNav dealId={deal.id} />
        <div className="pb-24">{children}</div>
      </div>
    </DealProvider>
  );
}
