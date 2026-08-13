"use client";

import { useEffect, useRef, useState } from "react";
import { mutate as globalMutate } from "swr";
import { Trash2 } from "lucide-react";
import Button from "@/components/ui/Button";
import CurrencyInput from "@/components/ui/CurrencyInput";
import Input from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import type { RenovationItem } from "@/types";

const DEFAULT_CATEGORIES = [
  "Structural",
  "Electrical",
  "Plumbing",
  "Kitchen",
  "Bathrooms",
  "Flooring",
  "Painting & Finishing",
  "Windows & Doors",
  "Landscaping",
  "HVAC / Solar / Geysers",
  "Compliance & Certs",
  "Professional Fees",
  "Contingency",
  "Other",
];

/**
 * Student accommodation furniture/setup categories, derived from a real
 * operator's cost model (bed & mattress, cupboards, desk & chair per bed;
 * kitchen and common-area appliances; NSFAS accreditation and security).
 */
export const STUDENT_FURNITURE_CATEGORIES = [
  "Bedroom Furniture",
  "Kitchen Equipment",
  "Lounge & Common Area",
  "Appliances",
  "Security & Access Control",
  "NSFAS Compliance & Accreditation",
  "Contingency",
  "Other",
];

const STATUS_OPTIONS = ["Not Started", "In Progress", "Quoted", "Complete"];

interface LocalItem {
  id: string;
  category: string;
  description: string;
  budgeted: number;
  quoted: number | null;
  status: string;
}

function toLocal(item: RenovationItem): LocalItem {
  return {
    id: item.id,
    category: item.category,
    description: item.description,
    budgeted: item.budgeted,
    quoted: item.quoted ?? null,
    status: item.status,
  };
}

interface RenovationBudgetProps {
  dealId: string;
  initialItems: RenovationItem[];
  onTotalChange: (total: number) => void;
  categories?: string[];
  title?: string;
  totalLabel?: string;
}

export default function RenovationBudget({
  dealId,
  initialItems,
  onTotalChange,
  categories = DEFAULT_CATEGORIES,
  title = "Renovation Budget",
  totalLabel = "Total Renovation",
}: RenovationBudgetProps) {
  const { showToast } = useToast();
  const [items, setItems] = useState<LocalItem[]>(initialItems.map(toLocal));
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  const subtotal = items
    .filter((i) => i.category !== "Contingency")
    .reduce((sum, i) => sum + (Number(i.budgeted) || 0), 0);
  const total = items.reduce((sum, i) => sum + (Number(i.budgeted) || 0), 0);
  const completeCount = items.filter((i) => i.status === "Complete").length;
  const progressPct = items.length > 0 ? (completeCount / items.length) * 100 : 0;

  useEffect(() => {
    onTotalChange(total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSaving(true);
      const res = await fetch(`/api/deals/${dealId}/renovation`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({
            category: i.category,
            description: i.description,
            budgeted: Number(i.budgeted) || 0,
            quoted: i.quoted === null ? null : Number(i.quoted) || 0,
            status: i.status,
          })),
        }),
      });
      setSaving(false);
      if (!res.ok) {
        showToast("error", "Could not save renovation budget.");
        return;
      }
      globalMutate(`/api/deals/${dealId}/calculate`);
    }, 800);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  function addItem(category: string) {
    const defaultBudgeted =
      category === "Contingency" ? Math.round(subtotal * 0.1) : 0;
    setItems((prev) => [
      ...prev,
      {
        id: `local-${Date.now()}-${Math.random()}`,
        category,
        description:
          category === "Contingency" ? "Contingency (10% of subtotal)" : "",
        budgeted: defaultBudgeted,
        quoted: null,
        status: "Not Started",
      },
    ]);
  }

  function updateItem(id: string, patch: Partial<LocalItem>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-body text-sm font-semibold text-av-navy">
          {title}
        </h3>
        <span className="text-xs font-body text-av-slate">
          {saving ? "Saving..." : ""}
        </span>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => addItem(cat)}
            className="text-xs font-body px-3 py-1.5 min-h-[32px] rounded-full border border-av-gold text-av-navy hover:bg-av-gold/10 transition-colors"
          >
            + {cat}
          </button>
        ))}
      </div>

      {items.length > 0 && (
        <>
          <div className="mb-3">
            <div className="flex justify-between text-xs font-body text-av-slate mb-1">
              <span>
                {completeCount} of {items.length} items Complete
              </span>
              <span>{progressPct.toFixed(0)}%</span>
            </div>
            <div className="h-2 rounded-full bg-av-light-grey overflow-hidden">
              <div
                className="h-full bg-av-green transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm font-body min-w-[700px]">
              <thead>
                <tr className="text-left text-xs text-av-slate border-b border-av-light-grey">
                  <th className="py-2 pr-2">Category</th>
                  <th className="py-2 pr-2">Description</th>
                  <th className="py-2 pr-2">Budgeted</th>
                  <th className="py-2 pr-2">Quoted</th>
                  <th className="py-2 pr-2">Status</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-av-light-grey">
                    <td className="py-2 pr-2">
                      <span className="text-xs px-2 py-1 rounded-full bg-av-light-grey text-av-navy whitespace-nowrap">
                        {item.category}
                      </span>
                    </td>
                    <td className="py-2 pr-2 min-w-[160px]">
                      <Input
                        value={item.description}
                        onChange={(e) =>
                          updateItem(item.id, { description: e.target.value })
                        }
                        placeholder="Description"
                      />
                    </td>
                    <td className="py-2 pr-2 min-w-[130px]">
                      <CurrencyInput
                        value={item.budgeted}
                        onChange={(e) =>
                          updateItem(item.id, {
                            budgeted: Number(e.target.value) || 0,
                          })
                        }
                      />
                    </td>
                    <td className="py-2 pr-2 min-w-[130px]">
                      <CurrencyInput
                        value={item.quoted ?? ""}
                        onChange={(e) =>
                          updateItem(item.id, {
                            quoted:
                              e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                      />
                    </td>
                    <td className="py-2 pr-2 min-w-[130px]">
                      <select
                        value={item.status}
                        onChange={(e) =>
                          updateItem(item.id, { status: e.target.value })
                        }
                        className="w-full rounded-md border border-av-light-grey bg-white px-2 py-2 min-h-[44px] font-body text-xs text-av-navy focus:outline-none focus:border-av-gold focus:ring-1 focus:ring-av-gold"
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2">
                      <button
                        type="button"
                        aria-label="Remove item"
                        onClick={() => removeItem(item.id)}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center text-av-slate hover:text-av-red transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="rounded-lg bg-av-light-grey p-4 mt-4 flex items-center justify-between">
        <span className="font-body text-sm text-av-navy font-semibold">
          {totalLabel}
        </span>
        <span className="font-mono text-xl font-bold text-av-navy">
          R {total.toLocaleString("en-US", { maximumFractionDigits: 0 })}
        </span>
      </div>
    </div>
  );
}
