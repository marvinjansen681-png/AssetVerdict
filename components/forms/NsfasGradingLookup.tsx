"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { NSFAS_GRADES, getNsfasRate, type NsfasGradeRates } from "@/lib/nsfas";

interface NsfasGradingLookupProps {
  onApply: (roomType: "single" | "sharing", rate: number) => void;
}

export default function NsfasGradingLookup({ onApply }: NsfasGradingLookupProps) {
  const [grade, setGrade] = useState<NsfasGradeRates["grade"]>("B");
  const [area, setArea] = useState<"metro" | "nonMetro">("metro");

  const singleRate = getNsfasRate(grade, "single", area);
  const sharingRate = getNsfasRate(grade, "sharing", area);

  return (
    <div className="rounded-lg border border-dashed border-av-light-grey p-4">
      <h3 className="font-body text-sm font-semibold text-av-navy mb-1">
        NSFAS Grading Lookup
      </h3>
      <p className="text-xs font-body text-av-slate mb-3">
        Annexure B V1.1, as at 21 February 2025 — monthly rent payable per bed over the
        10-month NSFAS cycle.
      </p>
      <div className="flex flex-wrap items-end gap-3 mb-3">
        <div>
          <label className="block text-xs font-body text-av-slate mb-1">Grade</label>
          <select
            value={grade}
            onChange={(e) => setGrade(e.target.value as NsfasGradeRates["grade"])}
            className="rounded-md border border-av-light-grey bg-white px-3 py-2.5 min-h-[44px] font-body text-sm text-av-navy focus:outline-none focus:border-av-gold focus:ring-1 focus:ring-av-gold"
          >
            {NSFAS_GRADES.map((g) => (
              <option key={g.grade} value={g.grade}>
                Grade {g.grade}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-body text-av-slate mb-1">Area</label>
          <select
            value={area}
            onChange={(e) => setArea(e.target.value as "metro" | "nonMetro")}
            className="rounded-md border border-av-light-grey bg-white px-3 py-2.5 min-h-[44px] font-body text-sm text-av-navy focus:outline-none focus:border-av-gold focus:ring-1 focus:ring-av-gold"
          >
            <option value="metro">Metro</option>
            <option value="nonMetro">Non-Metro</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="flex items-center justify-between rounded-md bg-av-light-grey/50 px-3 py-2">
          <span className="text-sm font-body text-av-navy">
            Single: R {singleRate?.toLocaleString("en-US", { minimumFractionDigits: 2 }) ?? "--"}
          </span>
          <Button
            type="button"
            variant="secondary"
            onClick={() => singleRate !== null && onApply("single", singleRate)}
          >
            Apply
          </Button>
        </div>
        <div className="flex items-center justify-between rounded-md bg-av-light-grey/50 px-3 py-2">
          <span className="text-sm font-body text-av-navy">
            Sharing: R {sharingRate?.toLocaleString("en-US", { minimumFractionDigits: 2 }) ?? "--"}
          </span>
          <Button
            type="button"
            variant="secondary"
            onClick={() => sharingRate !== null && onApply("sharing", sharingRate)}
          >
            Apply
          </Button>
        </div>
      </div>
    </div>
  );
}
