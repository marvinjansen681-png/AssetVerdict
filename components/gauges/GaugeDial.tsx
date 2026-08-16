"use client";

import Card from "@/components/ui/Card";
import TooltipIcon from "@/components/ui/TooltipIcon";
import { getGaugeColorForStrategy, getMetricBenchmark, type GaugeColor, type GaugeVisualColor } from "@/lib/calculations/thresholds";
import clsx from "clsx";

export interface GaugeThresholds {
  green: [number, number];
  orange: [number, number];
  red: [number, number];
}

export interface GaugeDialProps {
  value: number | null;
  unit: "%" | "Yrs" | "x" | "";
  label: string;
  tooltipText: string;
  metricKey: string;
  strategyId?: string;
  min?: number;
  max?: number;
  /**
   * The investor's required return (DealInputs.discountRate) — needed only
   * for target-relative metrics (Equity IRR, Cash-on-Cash). Omit for every
   * other gauge; it's a no-op for fixed-bands metrics.
   */
  discountRate?: number;
  size?: "sm" | "md" | "lg";
}

const COLOR_HEX: Record<GaugeColor | "grey", string> = {
  green: "#27AE60",
  orange: "#E67E22",
  red: "#E74C3C",
  grey: "#CBD5E0",
};

const SIZE_CONFIG = {
  sm: { width: 130, height: 74, radius: 52, strokeWidth: 11 },
  md: { width: 160, height: 90, radius: 65, strokeWidth: 14 },
  lg: { width: 200, height: 112, radius: 82, strokeWidth: 17 },
};

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = (angleDeg * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy - r * Math.sin(angleRad),
  };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const largeArcFlag = startAngle - endAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}

/** Maps a value within [min, max] to an angle between 180deg (start) and 0deg (end). */
function valueToAngle(value: number, min: number, max: number) {
  const clamped = Math.max(min, Math.min(max, value));
  const ratio = (clamped - min) / (max - min);
  return 180 - ratio * 180;
}

function formatValue(value: number | null, unit: GaugeDialProps["unit"]) {
  if (value === null || !isFinite(value)) return "--";
  const rounded = Math.round(value * 100) / 100;
  if (unit === "%") return `${rounded}%`;
  if (unit === "Yrs") return `${Math.round(value)}Yrs`;
  if (unit === "x") return `${rounded}x`;
  return `${rounded}`;
}

export default function GaugeDial({
  value,
  unit,
  label,
  tooltipText,
  metricKey,
  strategyId = "commercial",
  min = 0,
  max = 30,
  discountRate,
  size = "md",
}: GaugeDialProps) {
  const { width, height, radius, strokeWidth } = SIZE_CONFIG[size];
  const cx = width / 2;
  const cy = height - 5;

  // "neutral" means AssetVerdict has no active judgement for this metric on
  // this strategy — a UI treatment, not a financial judgement, so it
  // renders identically to "no data" (grey) rather than any red/amber/green
  // shade (Phase 3.1: a missing threshold must never look like a judgement).
  const visualColor: GaugeVisualColor | null =
    value === null ? null : getGaugeColorForStrategy(metricKey, value, strategyId, { discountRate });
  const color: GaugeColor | "grey" = visualColor === null || visualColor === "neutral" ? "grey" : visualColor;

  // Derived from the SAME definition driving the colour above (Decision 7)
  // — never a separately hardcoded number, so the marker can't drift out of
  // sync with the rule it's supposed to represent. Metrics with no single
  // meaningful marker (e.g. Cap Rate PP's two-sided sweet spot) correctly
  // get none, rather than an invented one.
  const benchmarkValue = getMetricBenchmark({ metricKey, strategyId, discountRate });

  const valueAngle = value === null ? 180 : valueToAngle(value, min, max);
  const backgroundPath = describeArc(cx, cy, radius, 180, 0);

  // Filled arc reuses the full background path geometry and animates via
  // stroke-dasharray/transition instead of recomputing `d` — SVG path `d`
  // isn't reliably CSS-animatable, but dasharray is, so scenario switches
  // sweep smoothly rather than snapping.
  const arcLength = Math.PI * radius;
  const filledRatio = value === null ? 0 : (180 - valueAngle) / 180;
  const filledLength = arcLength * filledRatio;

  const pointerPos = polarToCartesian(cx, cy, radius, valueAngle);

  const benchmarkAngle =
    benchmarkValue !== undefined ? valueToAngle(benchmarkValue, min, max) : null;
  const benchmarkPos =
    benchmarkAngle !== null ? polarToCartesian(cx, cy, radius, benchmarkAngle) : null;

  return (
    <Card className="p-4 flex flex-col items-center">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[13px] font-body text-av-slate">{label}</span>
        <TooltipIcon text={tooltipText} />
      </div>

      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <path
          d={backgroundPath}
          fill="none"
          stroke="#EDF2F7"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {value !== null && (
          <path
            d={backgroundPath}
            fill="none"
            stroke={COLOR_HEX[color]}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${filledLength} ${arcLength}`}
            style={{ transition: "stroke-dasharray 0.4s ease, stroke 0.4s ease" }}
          />
        )}

        {benchmarkPos && (
          <polygon
            points={`${benchmarkPos.x},${benchmarkPos.y - 7} ${benchmarkPos.x - 5},${benchmarkPos.y + 4} ${benchmarkPos.x + 5},${benchmarkPos.y + 4}`}
            fill="white"
            stroke="#718096"
            strokeWidth={1}
          />
        )}

        {value !== null && (
          <polygon
            points={`${pointerPos.x},${pointerPos.y - 8} ${pointerPos.x - 6},${pointerPos.y + 5} ${pointerPos.x + 6},${pointerPos.y + 5}`}
            fill={COLOR_HEX[color]}
          />
        )}
      </svg>

      <div
        className={clsx(
          "font-mono font-bold text-lg -mt-1",
          value === null || color === "grey"
            ? "text-av-slate/50"
            : color === "green"
              ? "text-av-green"
              : color === "orange"
                ? "text-av-orange"
                : "text-av-red"
        )}
      >
        {formatValue(value, unit)}
      </div>
    </Card>
  );
}
