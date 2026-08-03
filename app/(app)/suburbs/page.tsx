import Link from "next/link";
import { auth } from "@/lib/auth";
import { listSuburbProfiles } from "@/lib/db/area";
import BackButton from "@/components/ui/BackButton";
import Button from "@/components/ui/Button";

export const metadata = {
  title: "Suburb Profiles | AssetVerdict",
};

const REPORT_TYPE_LABELS: Record<string, string> = {
  suburb: "Suburb Report",
  multiple_suburbs: "Multiple Suburbs Report",
  province: "Province Report",
};

export default async function SuburbsPage() {
  const session = await auth();
  const profiles = await listSuburbProfiles(session!.user.id);

  return (
    <div className="px-4 md:px-8 py-8 max-w-5xl mx-auto">
      <BackButton href="/deals" label="My Deals" className="mb-3" />
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl text-av-navy">Suburb Profiles</h1>
          <p className="font-body text-sm text-av-slate mt-1">
            Market intelligence data captured from TPN and other credit bureau reports.
          </p>
        </div>
        <Link href="/suburbs/new">
          <Button>+ New Suburb Profile</Button>
        </Link>
      </div>

      {profiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-24 border border-dashed border-av-light-grey rounded-lg">
          <h2 className="font-display text-xl text-av-navy mb-2">No suburb profiles yet</h2>
          <p className="text-sm font-body text-av-slate mb-6 max-w-xs">
            Capture data from a TPN Suburb, Multiple Suburbs, or Province report to power rent
            suggestions and fallback analysis.
          </p>
          <Link href="/suburbs/new">
            <Button>Add your first suburb profile</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {profiles.map((p) => (
            <div key={p.id} className="rounded-lg border border-av-light-grey p-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-display text-lg text-av-navy">{p.suburbName}</h3>
                <span className="text-xs font-body px-2 py-1 rounded-full bg-av-light-grey text-av-navy">
                  {REPORT_TYPE_LABELS[p.reportType] ?? p.reportType}
                </span>
              </div>
              <p className="text-sm font-body text-av-slate">
                {[p.city, p.province].filter(Boolean).join(", ") || "No location set"}
              </p>
              {p.reportYear && (
                <p className="text-xs font-body text-av-slate mt-1">Report Year: {p.reportYear}</p>
              )}
              <div className="flex gap-3 mt-4">
                <Link href={`/suburbs/${p.id}/dashboard`}>
                  <Button variant="secondary">View Dashboard</Button>
                </Link>
                <Link href={`/suburbs/${p.id}`}>
                  <Button variant="secondary">Edit</Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
