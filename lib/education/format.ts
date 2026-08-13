/**
 * Centralised value formatting for the education layer. This is presentation
 * only — no financial logic lives here, just turning an already-calculated
 * number into a display string consistently across MetricLearningCard,
 * metricBreakdowns.ts, and interpretMetric.ts.
 */
import { isFiniteNumber } from "../calculations";

export type BreakdownFormat = "currency" | "percent" | "multiple" | "years" | "number";

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function formatMetricValue(
  value: number | null | undefined,
  format: BreakdownFormat,
  currency = "R"
): string {
  if (!isFiniteNumber(value)) return "N/A";

  switch (format) {
    case "currency": {
      const sign = value < 0 ? "-" : "";
      return `${sign}${currency} ${Math.abs(value).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
    }
    case "percent":
      return `${round(value, 1)}%`;
    case "multiple":
      return `${round(value, 2)}x`;
    case "years":
      return `${round(value, 1)} Yrs`;
    case "number":
      return `${round(value, 2)}`;
  }
}

export { round };
