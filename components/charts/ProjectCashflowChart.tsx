"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { ZoomIn, Move, Download } from "lucide-react";
import type { YearlyProjection } from "@/lib/calculations";

interface ProjectCashflowChartProps {
  projection: YearlyProjection[];
}

function formatRand(value: number) {
  if (Math.abs(value) >= 1_000_000) {
    return `R ${(value / 1_000_000).toFixed(1)}M`;
  }
  return `R ${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

interface TooltipPayloadItem {
  color: string;
  name: string;
  value: number;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-white border border-av-light-grey rounded-md shadow-lg p-3 font-body text-xs">
      <p className="font-semibold text-av-navy mb-1">Year {label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}:{" "}
          {entry.name === "Yearly ROI"
            ? `${entry.value.toFixed(2)}%`
            : `R ${entry.value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`}
        </p>
      ))}
    </div>
  );
}

export default function ProjectCashflowChart({
  projection,
}: ProjectCashflowChartProps) {
  if (projection.length === 0) {
    return (
      <div className="border border-dashed border-av-light-grey rounded-lg p-10 text-center font-body text-sm text-av-slate">
        Enter your deal inputs to see projections
      </div>
    );
  }

  const chartData = projection.map((p) => ({
    year: p.year,
    "Total Cash Flow for Period": p.cashflowForPeriod,
    "Cumulative Cash Flow": p.cumulativeCashflow,
    "Yearly ROI": p.yearlyROI,
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl text-av-navy">
          Project Cashflow (20 Years)
        </h2>
        <div className="flex items-center gap-3 text-av-slate">
          <ZoomIn size={16} />
          <Move size={16} />
          <Download size={16} />
        </div>
      </div>

      <div className="w-full h-[300px] md:h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ left: 8, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EDF2F7" />
            <XAxis
              dataKey="year"
              tickFormatter={(y) => `Year ${y}`}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              yAxisId="left"
              tickFormatter={formatRand}
              tick={{ fontSize: 11 }}
              label={{ value: "Rands", angle: -90, position: "insideLeft", fontSize: 11 }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[0, 35]}
              tick={{ fontSize: 11 }}
              label={{ value: "Yearly ROI %", angle: 90, position: "insideRight", fontSize: 11 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <ReferenceLine yAxisId="left" y={0} stroke="#4A5568" strokeDasharray="4 4" />
            <Bar
              yAxisId="left"
              dataKey="Total Cash Flow for Period"
              fill="#3498DB"
            />
            <Bar
              yAxisId="left"
              dataKey="Cumulative Cash Flow"
              fill="#27AE60"
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="Yearly ROI"
              stroke="#E67E22"
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
