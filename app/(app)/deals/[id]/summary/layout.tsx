import { auth } from "@/lib/auth";
import { getDeal } from "@/lib/db/deals";
import BackButton from "@/components/ui/BackButton";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();
  const deal = await getDeal(params.id, session!.user.id);
  return { title: deal ? `${deal.name} | AssetVerdict` : "Deal | AssetVerdict" };
}

export default function SummaryLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  return (
    <div>
      <div className="px-4 md:px-8 pt-6">
        <BackButton href={`/deals/${params.id}/edit`} label="Edit Deal" />
      </div>
      {children}
    </div>
  );
}
