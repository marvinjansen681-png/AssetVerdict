import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getSuburbProfile } from "@/lib/db/area";
import BackButton from "@/components/ui/BackButton";
import Button from "@/components/ui/Button";
import SuburbProfileForm from "@/components/forms/SuburbProfileForm";
import type { SuburbProfile } from "@/types";

export const metadata = {
  title: "Edit Suburb Profile | AssetVerdict",
};

export default async function EditSuburbProfilePage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();
  const profile = await getSuburbProfile(params.id, session!.user.id);
  if (!profile) notFound();

  return (
    <div className="px-4 md:px-8 py-8 max-w-3xl mx-auto">
      <BackButton href="/suburbs" label="Suburb Profiles" className="mb-3" />
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display text-3xl text-av-navy">{profile.suburbName}</h1>
        <Link href={`/suburbs/${profile.id}/dashboard`}>
          <Button variant="secondary">View Dashboard</Button>
        </Link>
      </div>
      <SuburbProfileForm profile={profile as unknown as SuburbProfile} />
    </div>
  );
}
