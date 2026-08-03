import { redirect } from "next/navigation";

export default function EditSummaryRedirect({
  params,
}: {
  params: { id: string };
}) {
  redirect(`/deals/${params.id}/summary`);
}
