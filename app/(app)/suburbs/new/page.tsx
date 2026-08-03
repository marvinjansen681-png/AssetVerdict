import BackButton from "@/components/ui/BackButton";
import NewSuburbProfileClient from "./NewSuburbProfileClient";

export const metadata = {
  title: "New Suburb Profile | AssetVerdict",
};

export default function NewSuburbProfilePage() {
  return (
    <div className="px-4 md:px-8 py-8 max-w-3xl mx-auto">
      <BackButton href="/suburbs" label="Suburb Profiles" className="mb-3" />
      <h1 className="font-display text-3xl text-av-navy mb-8">New Suburb Profile</h1>
      <NewSuburbProfileClient />
    </div>
  );
}
