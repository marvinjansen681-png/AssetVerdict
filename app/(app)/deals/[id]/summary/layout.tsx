import { auth } from "@/lib/auth";
import { getDeal } from "@/lib/db/deals";

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
}: {
  children: React.ReactNode;
}) {
  return children;
}
