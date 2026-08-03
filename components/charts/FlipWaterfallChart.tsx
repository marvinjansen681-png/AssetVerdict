"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { FlipMetrics } from "@/lib/calculations";

interface FlipWaterfallChartProps {
  flipMetrics: FlipMetrics;
}

const COLORS = {
  purchase: "#0F1F3D",
  renovation: "#E67E22",
  holding: "#4A5568",
  agent: "#E74C3C",
  sale: "#27AE60",
};

export default function FlipWaterfallChart({ flipMetrics }: FlipWaterfallChartProps) {
  const data = [
    { name: "Purchase Price", value: flipMetrics.purchasePrice, color: COLORS.purchase },
    { name: "Renovation", value: flipMetrics.renovationCost, color: COLORS.renovation },
    { name: "Holding Costs", value: flipMetrics.holdingCosts, color: COLORS.holding },
    { name: "Agent Fee", value: flipMetrics.agentFee, color: COLORS.agent },
    { name: "Sale Price", value: flipMetrics.expectedSalePrice, color: COLORS.sale },
  ];

  return (
    <div className="w-full h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 24, right: 24 }}>
          <XAxis
            type="number"
            tickFormatter={(v) => `R ${(v / 1_000_000).toFixed(1)}M`}
            tick={{ fontSize: 11 }}
          />
          <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12 }} />
          <Tooltip
            formatter={(value) =>
              `R ${(Number(value) || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`
            }
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
