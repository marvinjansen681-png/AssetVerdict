import type {
  FlipExitValueAnalysis,
  FlipExitValueScenarioCase,
  FlipExitValueConservativeCase,
  FlipSalePriceScenarioSummary,
  FlipExitValueRangePosition,
} from "@/lib/calculations/fixFlipExitValue";
import clsx from "clsx";

interface FlipExitValueCardProps {
  analysis?: FlipExitValueAnalysis;
  discountRate: number;
  currency?: string;
}

function fmt(n: number, currency = "R") {
  const sign = n < 0 ? "-" : "";
  return `${sign}${currency} ${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function fmtPct(n: number | null, decimals = 1) {
  return n === null ? "N/A" : `${n.toFixed(decimals)}%`;
}

function fmtDate(d: Date | string | null) {
  if (!d) return null;
  const date = new Date(d);
  return isNaN(date.getTime()) ? null : date.toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });
}

function rangePositionLabel(position: FlipExitValueRangePosition) {
  if (position === "below_range") return "Below recorded range";
  if (position === "above_range") return "Above recorded range";
  return "Within recorded range";
}

function Row({ label, value, note, bold, border }: { label: string; value: string; note?: string; bold?: boolean; border?: boolean }) {
  return (
    <div className={clsx("flex justify-between items-start py-1.5 gap-4", border && "border-b border-av-light-grey pb-3", bold && "font-semibold")}>
      <span className={clsx("text-sm", !bold && "text-av-slate")}>
        {label}
        {note && <span className="block text-xs text-av-slate/70">{note}</span>}
      </span>
      <span className="font-mono text-sm text-right whitespace-nowrap">{value}</span>
    </div>
  );
}

function targetLabel(state: FlipSalePriceScenarioSummary["targetState"]) {
  if (state === "met") return "Met";
  if (state === "missed") return "Missed";
  return "Unknown";
}

function ScenarioBox({
  title,
  description,
  scenarioCase,
  currency,
  discountRate,
  extra,
}: {
  title: string;
  description: string;
  scenarioCase: FlipExitValueScenarioCase;
  currency: string;
  discountRate: number;
  extra?: React.ReactNode;
}) {
  const s = scenarioCase.summary;
  return (
    <div className="rounded-lg border border-av-light-grey p-6 font-body text-sm max-w-md">
      <h3 className="font-display text-base text-av-navy mb-1">{title}</h3>
      <p className="text-xs text-av-slate mb-3">{description}</p>
      <Row label="Sale Price" value={fmt(scenarioCase.salePrice, currency)} bold />
      {scenarioCase.sameAsBase && (
        <p className="text-xs text-av-slate italic mb-2">Same as your Base case — your own assumption is already at or below this evidence value.</p>
      )}
      <Row label="Estimated Profit Before Tax" value={fmt(s.estimatedProfitBeforeTax, currency)} />
      <Row label="Pre-Tax Project ROI" value={fmtPct(s.preTaxProjectROI)} />
      <Row label="Equity IRR" value={fmtPct(s.equityIRR)} />
      <Row
        label="Sale-Price Buffer"
        value={s.salePriceBufferPercent === null ? "N/A" : `${fmt(s.salePriceBufferRand!, currency)} (${fmtPct(s.salePriceBufferPercent)})`}
      />
      <Row label="Required Return" value={fmtPct(discountRate)} />
      <Row label="Target" value={targetLabel(s.targetState)} border />
      {extra}
    </div>
  );
}

export default function FlipExitValueCard({ analysis, discountRate, currency = "R" }: FlipExitValueCardProps) {
  if (!analysis || analysis.status !== "available") return null;
  const ev = analysis.evidence;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="font-display text-lg text-av-navy mb-3">Exit-Value Evidence</h3>
        <div className="rounded-lg border border-av-light-grey p-6 font-body text-sm max-w-md">
          <Row label="Expected Sale Price" value={fmt(analysis.expectedSalePrice, currency)} note="Your Base-case assumption" bold border />

          {ev.status === "no_numeric_valuation" && (
            <p className="text-sm text-av-slate py-2">
              No numeric property valuation is recorded for comparison. Expected Sale Price remains your own assumption.
              {ev.comparableCount > 0 && ` (${ev.comparableCount} comparable sale${ev.comparableCount === 1 ? "" : "s"} recorded, but with no estimated value or confidence range to compare against.)`}
            </p>
          )}

          {ev.status === "invalid_valuation" && (
            <p className="text-sm text-av-slate py-2">
              The recorded valuation figures are internally inconsistent, so AssetVerdict cannot use them for scenario analysis. The figures are
              shown below exactly as recorded — nothing has been reordered or corrected.
            </p>
          )}

          {ev.estimatedValue !== undefined && (
            <Row
              label="Recorded Valuation Estimate"
              value={fmt(ev.estimatedValue, currency)}
              note={ev.reportSource ?? "Recorded valuation"}
            />
          )}
          {ev.valueConfidenceLow !== undefined && ev.valueConfidenceHigh !== undefined && (
            <Row label="Recorded Range" value={`${fmt(ev.valueConfidenceLow, currency)} – ${fmt(ev.valueConfidenceHigh, currency)}`} />
          )}
          {ev.valueConfidenceLow !== undefined && ev.valueConfidenceHigh === undefined && (
            <Row label="Recorded Lower Valuation Bound" value={fmt(ev.valueConfidenceLow, currency)} />
          )}
          {ev.rangePosition && <Row label="Expected Sale Price Position" value={rangePositionLabel(ev.rangePosition)} />}
          {ev.expectedVsEstimateRand !== undefined && (
            <Row
              label="vs. Recorded Estimate"
              value={`${ev.expectedVsEstimateRand >= 0 ? "+" : ""}${fmt(ev.expectedVsEstimateRand, currency)}${
                ev.expectedVsEstimatePercent !== undefined ? ` (${ev.expectedVsEstimatePercent >= 0 ? "+" : ""}${ev.expectedVsEstimatePercent.toFixed(1)}%)` : ""
              }`}
            />
          )}
          {ev.valuationConfidence && <Row label="Recorded Confidence Label" value={ev.valuationConfidence} />}
          {(ev.reportSource || fmtDate(ev.reportDate)) && (
            <p className="text-xs text-av-slate/70 pt-2">
              {ev.reportSource ?? "Recorded valuation"}
              {fmtDate(ev.reportDate) ? ` — as of ${fmtDate(ev.reportDate)}` : ""}
              {ev.valuationAgeDays !== undefined ? ` (${ev.valuationAgeDays} day${ev.valuationAgeDays === 1 ? "" : "s"} ago)` : ""}
            </p>
          )}
          {(ev.estimatedValue !== undefined || ev.valueConfidenceLow !== undefined) && ev.valuationBasis === "unknown" && (
            <p className="text-xs text-av-slate/70 pt-2 border-t border-av-light-grey mt-2">
              Valuation basis not recorded. This valuation does not currently state whether it reflects the property&apos;s current condition or
              post-renovation condition — AssetVerdict treats it as supporting evidence only, not proof of the eventual post-renovation sale value.
            </p>
          )}
        </div>
      </div>

      {analysis.valuationPointCase && (
        <ScenarioBox
          title="Valuation Point Case"
          description="Flip economics re-run at the recorded valuation estimate — never above your own Expected Sale Price."
          scenarioCase={analysis.valuationPointCase}
          currency={currency}
          discountRate={discountRate}
        />
      )}

      {analysis.conservativeCase && (
        <ScenarioBox
          title="Conservative Valuation Case"
          description="Flip economics re-run at the recorded lower valuation bound — never above your own Expected Sale Price. A property-specific figure, not a generic percentage discount."
          scenarioCase={analysis.conservativeCase}
          currency={currency}
          discountRate={discountRate}
          extra={
            <div className="pt-2 flex flex-col gap-1">
              <Row
                label="Remains profitable at this price"
                value={(analysis.conservativeCase as FlipExitValueConservativeCase).survivesConservativeCase ? "Yes" : "No"}
              />
              <Row
                label="Still meets Required Return"
                value={
                  (analysis.conservativeCase as FlipExitValueConservativeCase).meetsRequiredReturnInConservativeCase === null
                    ? "N/A"
                    : (analysis.conservativeCase as FlipExitValueConservativeCase).meetsRequiredReturnInConservativeCase
                    ? "Yes"
                    : "No"
                }
              />
            </div>
          }
        />
      )}

      {ev.status === "point_estimate_only" && !analysis.conservativeCase && (
        <p className="text-sm text-av-slate max-w-md">
          Recorded valuation does not include a lower confidence bound, so AssetVerdict cannot produce a property-specific Conservative Valuation
          Case.
        </p>
      )}

      <p className="text-xs text-av-slate/70 max-w-md">
        This compares your assumption with recorded evidence and re-runs the same deterministic Fix &amp; Flip model at evidence-backed prices — it
        does not predict what the property will actually sell for, and it is not a Fix &amp; Flip verdict.
      </p>
    </div>
  );
}
