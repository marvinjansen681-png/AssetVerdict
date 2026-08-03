import { redirect } from "next/navigation";

export default function EditDealIndex({ params }: { params: { id: string } }) {
  redirect(`/deals/${params.id}/edit/introduction`);
}
