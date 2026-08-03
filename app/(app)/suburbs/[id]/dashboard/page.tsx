import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getSuburbProfile } from "@/lib/db/area";
import BackButton from "@/components/ui/BackButton";
import Button from "@/components/ui/Button";
import { scoreAllStrategies } from "@/lib/suburb-scoring";
import { getStrategy } from "@/lib/strategies";
import type { SuburbProfile } from "@/types";

export const metadata = {
  title: "Suburb Dashboard | AssetVerdict",
};

function fmtPct(v: number | null | undefined) {
  return v !== null && v !== undefined ? `${v}%` : "--";
}
function fmtCurrency(v: number | null | undefined) {
  return v !== null && v !== undefined ? `R ${v.toLocaleString("en-US")}` : "--";
}

const LABEL_STYLES: Record<string, string> = {
  "Strong Fit": "bg-av-green/10 text-av-green border-av-green",
  "Moderate Fit": "bg-av-orange/10 text-av-orange border-av-orange",
  "Weak Fit": "bg-av-red/10 text-av-red border-av-red",
  "Insufficient Data": "bg-av-light-grey text-av-slate border-av-light-grey",
};

export default async function SuburbDashboardPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();
  const profile = (await getSuburbProfile(params.id, session!.user.id)) as unknown as SuburbProfile | null;
  if (!profile) notFound();

  const fits = scoreAllStrategies(profile);
  const sortedFits = [...fits].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

  return (
    <div className="px-4 md:px-8 py-8 max-w-5xl mx-auto flex flex-col gap-8">
      <BackButton href="/suburbs" label="Suburb Profiles" className="mb-1" />
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl text-av-navy">{profile.suburbName}</h1>
          <p className="font-body text-sm text-av-slate mt-1">
            {[profile.city, profile.province].filter(Boolean).join(", ") || "No location set"}
            {profile.reportYear ? ` · ${profile.reportYear} report` : ""}
          </p>
        </div>
        <Link href={`/suburbs/${profile.id}`}>
          <Button variant="secondary">Edit Data</Button>
        </Link>
      </div>

      <section>
        <h2 className="font-display text-xl text-av-navy mb-4">Strategy Suitability Matrix</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sortedFits.map((fit) => {
            const strategy = getStrategy(fit.strategyId);
            return (
              <div key={fit.strategyId} className="rounded-lg border border-av-light-grey p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-body text-sm font-semibold text-av-navy">
                    {strategy.icon} {strategy.label}
                  </span>
                  <span className={`text-xs font-body px-2 py-1 rounded-full border ${LABEL_STYLES[fit.label]}`}>
                    {fit.label}
                    {fit.score !== null ? ` (${fit.score})` : ""}
                  </span>
                </div>
                <ul className="text-xs font-body text-av-slate list-disc list-inside space-y-0.5">
                  {fit.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl text-av-navy mb-4">Rental Payment Index</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-body text-sm">
          <Metric label="Paid On Time" value={fmtPct(profile.paidOnTimePct)} />
          <Metric label="Grace Period" value={fmtPct(profile.gracePeriodPct)} />
          <Metric label="Paid Late" value={fmtPct(profile.paidLatePct)} />
          <Metric label="Did Not Pay" value={fmtPct(profile.didNotPayPct)} />
          <Metric label="Good Standing (Suburb)" value={fmtPct(profile.goodStandingPct)} />
          <Metric label="Good Standing (Province)" value={fmtPct(profile.provinceGoodStandingPct)} />
          <Metric label="Good Standing (National)" value={fmtPct(profile.nationalGoodStandingPct)} />
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl text-av-navy mb-4">Residential Yield</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-body text-sm">
          <Metric label="ST Gross Yield" value={fmtPct(profile.stGrossYield)} />
          <Metric label="ST Effective Yield" value={fmtPct(profile.stEffectiveYield)} />
          <Metric label="FH Gross Yield" value={fmtPct(profile.fhGrossYield)} />
          <Metric label="FH Effective Yield" value={fmtPct(profile.fhEffectiveYield)} />
          <Metric label="National Gross Yield" value={fmtPct(profile.nationalGrossYield)} />
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl text-av-navy mb-4">Rental Price Bands</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-lg border border-av-light-grey p-4">
            <h3 className="font-body text-sm font-semibold text-av-navy mb-3">Sectional Title</h3>
            <BandRow label="<2Bed" low={profile.stSmallBedLow} avg={profile.stSmallBedAvg} high={profile.stSmallBedHigh} />
            <BandRow label="2Bed" low={profile.st2BedLow} avg={profile.st2BedAvg} high={profile.st2BedHigh} />
            <BandRow label=">2Bed" low={profile.stLargeBedLow} avg={profile.stLargeBedAvg} high={profile.stLargeBedHigh} />
            <p className="text-xs font-body text-av-slate mt-2">Trend: {profile.stRentalTrend ?? "Unspecified"}</p>
          </div>
          <div className="rounded-lg border border-av-light-grey p-4">
            <h3 className="font-body text-sm font-semibold text-av-navy mb-3">Freehold</h3>
            <BandRow label="<3Bed" low={profile.fhSmallBedLow} avg={profile.fhSmallBedAvg} high={profile.fhSmallBedHigh} />
            <BandRow label="3Bed" low={profile.fh3BedLow} avg={profile.fh3BedAvg} high={profile.fh3BedHigh} />
            <BandRow label=">3Bed" low={profile.fhLargeBedLow} avg={profile.fhLargeBedAvg} high={profile.fhLargeBedHigh} />
            <p className="text-xs font-body text-av-slate mt-2">Trend: {profile.fhRentalTrend ?? "Unspecified"}</p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl text-av-navy mb-4">Demographics</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-body text-sm">
          <Metric label="Formal Sector" value={fmtPct(profile.formalSectorPct)} />
          <Metric label="Unemployed" value={fmtPct(profile.unemployedPct)} />
          <Metric label="Income R76k-R307k" value={fmtPct(profile.incomeMiddleBandPct)} />
          <Metric label="Income R307k+" value={fmtPct(profile.incomeHighBandPct)} />
          <Metric label="Age 17-25" value={fmtPct(profile.age17to25Pct)} />
          <Metric label="Age 26-40" value={fmtPct(profile.age26to40Pct)} />
          <Metric label="Age 41-60" value={fmtPct(profile.age41to60Pct)} />
          <Metric label="Large Households (6+)" value={fmtPct(profile.largeHouseholdPct)} />
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl text-av-navy mb-4">Province / National Benchmarks</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 font-body text-sm">
          <Metric label="Province ST Gross Yield" value={fmtPct(profile.provinceSTGrossYield)} />
          <Metric label="Province FH Gross Yield" value={fmtPct(profile.provinceFHGrossYield)} />
          <Metric label="Province ST 2Bed Avg Rent" value={fmtCurrency(profile.provinceST2BedAvgRent)} />
          <Metric label="Province FH 3Bed Avg Rent" value={fmtCurrency(profile.provinceFH3BedAvgRent)} />
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-av-light-grey/50 p-3">
      <div className="text-xs text-av-slate mb-1">{label}</div>
      <div className="font-mono text-base text-av-navy">{value}</div>
    </div>
  );
}

function BandRow({
  label,
  low,
  avg,
  high,
}: {
  label: string;
  low: number | null | undefined;
  avg: number | null | undefined;
  high: number | null | undefined;
}) {
  return (
    <div className="flex justify-between text-xs font-body text-av-slate py-1 border-b border-av-light-grey last:border-0">
      <span>{label}</span>
      <span className="font-mono text-av-navy">
        {low ?? "--"} / {avg ?? "--"} / {high ?? "--"}
      </span>
    </div>
  );
}
