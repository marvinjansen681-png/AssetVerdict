"use client";

import { useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import CurrencyInput from "@/components/ui/CurrencyInput";
import type { CapexItem } from "@/types";

const COLORS = [
  "#E74C3C",
  "#3498DB",
  "#27AE60",
  "#E67E22",
  "#9B59B6",
  "#F1C40F",
  "#1ABC9C",
  "#E91E63",
];

interface CapexPieChartProps {
  dealId: string;
  capexItems: CapexItem[];
  onItemAdded: (item: CapexItem) => void;
}

export default function CapexPieChart({
  dealId,
  capexItems,
  onItemAdded,
}: CapexPieChartProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);

  const total = capexItems.reduce((sum, item) => sum + item.amount, 0);

  const data = capexItems.map((item, index) => ({
    name: item.label,
    value: item.amount,
    color: item.color ?? COLORS[index % COLORS.length],
  }));

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(`/api/deals/${dealId}/capex`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, amount: Number(amount) }),
    });
    setSaving(false);
    if (res.ok) {
      const item = await res.json();
      onItemAdded(item);
      setLabel("");
      setAmount("");
      setModalOpen(false);
    }
  }

  return (
    <div>
      <h2 className="font-display text-xl text-av-navy mb-4">Capex Spend</h2>

      {capexItems.length === 0 ? (
        <div className="border border-dashed border-av-light-grey rounded-lg p-10 text-center font-body text-sm text-av-slate">
          No Capex items added yet
        </div>
      ) : (
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="w-full md:w-1/2 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={(entry) =>
                    `${((entry.value / total) * 100).toFixed(0)}%`
                  }
                >
                  {data.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => {
                    const num = Number(value) || 0;
                    return [
                      `R ${num.toLocaleString("en-US")} (${((num / total) * 100).toFixed(1)}%)`,
                      String(name),
                    ];
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="w-full md:w-1/2 flex flex-col gap-2">
            {data.map((entry) => (
              <div
                key={entry.name}
                className="flex items-center justify-between font-body text-sm"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-av-navy">{entry.name}</span>
                </div>
                <span className="font-mono text-av-slate">
                  R {entry.value.toLocaleString("en-US")} (
                  {((entry.value / total) * 100).toFixed(1)}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4">
        {modalOpen ? (
          <form
            onSubmit={handleAdd}
            className="flex flex-col md:flex-row gap-3 items-end border border-av-light-grey rounded-lg p-4"
          >
            <div className="flex-1 w-full">
              <label className="block text-xs font-body text-av-slate mb-1">
                Label
              </label>
              <Input
                required
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Roof repairs"
              />
            </div>
            <div className="flex-1 w-full">
              <label className="block text-xs font-body text-av-slate mb-1">
                Amount
              </label>
              <CurrencyInput
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Adding..." : "Add"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <Button variant="secondary" onClick={() => setModalOpen(true)}>
            + Add Capex Item
          </Button>
        )}
      </div>
    </div>
  );
}
