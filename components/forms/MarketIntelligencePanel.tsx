"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { calcRentSuggestion, type RentSuggestion } from "@/lib/area-suggestions";
import type { StrategyId } from "@/lib/strategies";
import type { DealSuburb, SuburbProfile } from "@/types";

const CONFIDENCE_STYLES: Record<string, string> = {
  high: "bg-av-green/10 text-av-green border-av-green",
  medium: "bg-av-orange/10 text-av-orange border-av-orange",
  low: "bg-av-red/10 text-av-red border-av-red",
};

interface MarketIntelligencePanelProps {
  dealId: string;
  strategy: StrategyId;
  isSectionalTitle: boolean;
  bedrooms: number | null;
  numUnits: number | null;
  currentMonthlyRent?: number | null;
  onApplyRent?: (rent: number) => void;
}

export default function MarketIntelligencePanel({
  dealId,
  strategy,
  isSectionalTitle,
  bedrooms,
  numUnits,
  currentMonthlyRent,
  onApplyRent,
}: MarketIntelligencePanelProps) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [links, setLinks] = useState<DealSuburb[]>([]);
  const [allProfiles, setAllProfiles] = useState<SuburbProfile[]>([]);
  const [linking, setLinking] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const [linksRes, profilesRes] = await Promise.all([
        fetch(`/api/deals/${dealId}/suburbs`),
        fetch("/api/suburbs"),
      ]);
      if (cancelled) return;
      if (linksRes.ok) setLinks(await linksRes.json());
      if (profilesRes.ok) setAllProfiles(await profilesRes.json());
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [dealId]);

  const primaryLink = links.find((l) => l.isPrimary) ?? links[0] ?? null;
  const primarySuburb = primaryLink?.suburbProfile ?? null;

  async function linkSuburb() {
    if (!selectedProfileId) return;
    setLinking(true);
    const res = await fetch(`/api/deals/${dealId}/suburbs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suburbProfileId: selectedProfileId, isPrimary: true }),
    });
    setLinking(false);
    if (!res.ok) {
      showToast("error", "Could not link suburb profile.");
      return;
    }
    const linksRes = await fetch(`/api/deals/${dealId}/suburbs`);
    if (linksRes.ok) setLinks(await linksRes.json());
    showToast("success", "Suburb profile linked");
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-av-light-grey p-5 font-body text-sm text-av-slate">
        Loading market intelligence...
      </div>
    );
  }

  if (!primarySuburb) {
    return (
      <div className="rounded-lg border border-dashed border-av-light-grey p-5">
        <h3 className="font-body text-sm font-semibold text-av-navy mb-2">Market Intelligence</h3>
        <p className="text-xs font-body text-av-slate mb-3">
          Link a suburb profile to see a market rent suggestion for this deal.
        </p>
        {allProfiles.length === 0 ? (
          <a href="/suburbs/new" className="text-xs font-body underline text-av-navy">
            + Add a suburb profile
          </a>
        ) : (
          <div className="flex items-center gap-2">
            <select
              value={selectedProfileId}
              onChange={(e) => setSelectedProfileId(e.target.value)}
              className="flex-1 rounded-md border border-av-light-grey bg-white px-3 py-2.5 min-h-[44px] font-body text-sm text-av-navy focus:outline-none focus:border-av-gold focus:ring-1 focus:ring-av-gold"
            >
              <option value="">Select a suburb profile...</option>
              {allProfiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.suburbName} {p.province ? `(${p.province})` : ""}
                </option>
              ))}
            </select>
            <Button type="button" variant="secondary" disabled={!selectedProfileId || linking} onClick={linkSuburb}>
              {linking ? "Linking..." : "Link"}
            </Button>
          </div>
        )}
      </div>
    );
  }

  const suggestion: RentSuggestion = calcRentSuggestion({
    strategy,
    isSectionalTitle,
    bedrooms,
    numUnits,
    suburbProfile: primarySuburb,
    currentMonthlyRent,
  });

  return (
    <div className="rounded-lg border border-av-light-grey p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-body text-sm font-semibold text-av-navy">
          Market Intelligence — {suggestion.suburbName}
        </h3>
        <span
          className={`text-xs font-body px-2 py-1 rounded-full border ${CONFIDENCE_STYLES[suggestion.confidence]}`}
        >
          {suggestion.confidence} confidence
        </span>
      </div>

      {suggestion.band && (
        <p className="text-xs font-body text-av-slate mb-4">
          Matched band: {suggestion.band.label}
          {suggestion.reportAgeMonths !== null && suggestion.reportAgeMonths !== undefined
            ? ` · report is ${suggestion.reportAgeMonths} month(s) old`
            : ""}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-body text-sm">
        <div className="rounded-md bg-av-light-grey/50 p-3">
          <div className="text-xs text-av-slate mb-1">{suggestion.primaryLabel}</div>
          <div className="font-mono text-lg text-av-navy">
            {suggestion.primaryEstimate !== null
              ? `R ${suggestion.primaryEstimate.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
              : "Not available"}
          </div>
          {suggestion.deltaVsCurrentPct !== null && (
            <div className={`text-xs mt-1 ${suggestion.deltaVsCurrentPct >= 0 ? "text-av-green" : "text-av-red"}`}>
              {suggestion.deltaVsCurrentPct >= 0 ? "+" : ""}
              {suggestion.deltaVsCurrentPct.toFixed(1)}% vs. current input
            </div>
          )}
        </div>
        <div className="rounded-md bg-av-light-grey/50 p-3">
          <div className="text-xs text-av-slate mb-1">{suggestion.fallbackLabel}</div>
          <div className="font-mono text-lg text-av-navy">
            {suggestion.fallbackEstimate !== null
              ? `R ${suggestion.fallbackEstimate.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
              : "Not available"}
          </div>
          {suggestion.band && (
            <div className="text-xs text-av-slate mt-1">
              Range: R {suggestion.band.low?.toLocaleString("en-US") ?? "--"} – R{" "}
              {suggestion.band.high?.toLocaleString("en-US") ?? "--"}
            </div>
          )}
        </div>
      </div>

      {onApplyRent && (suggestion.primaryEstimate !== null || suggestion.fallbackEstimate !== null) && (
        <div className="flex justify-end mt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={() => onApplyRent((suggestion.primaryEstimate ?? suggestion.fallbackEstimate) as number)}
          >
            Use this estimate
          </Button>
        </div>
      )}
    </div>
  );
}
