"use client";

import { useState } from "react";
import clsx from "clsx";
import type { DealMetrics } from "@/lib/calculations";

interface CashflowTableProps {
  metrics: DealMetrics;
  rentalGrowthRate: number;
  costInflation: number;
}

function fmt(n: number) {
  const sign = n < 0 ? "-" : "";
  return `${sign}R ${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function Arrow({ growing }: { growing: boolean }) {
  return growing ? (
    <span className="text-av-green ml-1" aria-label="growing">
      ▲
    </span>
  ) : null;
}

export default function CashflowTable({
  metrics,
  rentalGrowthRate,
  costInflation,
}: CashflowTableProps) {
  const [view, setView] = useState<"monthly" | "annual">("annual");
  const mult = view === "annual" ? 12 : 1;

  const revenueGrowing = rentalGrowthRate > 0;
  const costsGrowing = costInflation > 0;

  const revenue = metrics.revenueMonthly;
  const operatingCosts = metrics.operatingCostsMonthly;
  const provisions = metrics.provisionsMonthly;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl text-av-navy">Cashflow</h2>
        <div className="inline-flex rounded-md border border-av-light-grey overflow-hidden">
          {(["annual", "monthly"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={clsx(
                "px-4 py-2 text-xs font-body font-semibold capitalize min-h-[44px]",
                view === v
                  ? "bg-av-navy text-white"
                  : "bg-white text-av-slate hover:bg-av-light-grey"
              )}
            >
              {v} Figures
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="grid grid-cols-3 min-w-[600px] border border-av-light-grey rounded-lg overflow-hidden">
          <div className="border-r border-av-light-grey">
            <div className="p-4 bg-av-light-grey font-body font-semibold text-av-navy flex justify-between">
              <span>Gross Revenue</span>
              <span className="font-mono">{fmt(revenue.total * mult)}</span>
            </div>
            <div className="p-4 flex flex-col gap-2 font-body text-sm text-av-slate">
              <div className="flex justify-between">
                <span>Rental Income</span>
                <span className="font-mono">
                  {fmt(revenue.rentalIncome * mult)}
                  <Arrow growing={revenueGrowing} />
                </span>
              </div>
              <div className="flex justify-between">
                <span>Additional Income</span>
                <span className="font-mono">
                  {fmt(revenue.additionalIncome * mult)}
                  <Arrow growing={revenueGrowing} />
                </span>
              </div>
              <div className="flex justify-between">
                <span>Recoveries</span>
                <span className="font-mono">
                  {fmt(revenue.recoveries * mult)}
                  <Arrow growing={revenueGrowing} />
                </span>
              </div>
            </div>
          </div>

          <div className="border-r border-av-light-grey">
            <div className="p-4 bg-av-light-grey font-body font-semibold text-av-navy flex justify-between">
              <span>Operating Costs</span>
              <span className="font-mono">{fmt(operatingCosts.total * mult)}</span>
            </div>
            <div className="p-4 flex flex-col gap-2 font-body text-sm text-av-slate">
              <div className="flex justify-between">
                <span>Finance</span>
                <span className="font-mono">{fmt(operatingCosts.finance * mult)}</span>
              </div>
              <div className="flex justify-between">
                <span>Utilities</span>
                <span className="font-mono">
                  {fmt(operatingCosts.utilities * mult)}
                  <Arrow growing={costsGrowing} />
                </span>
              </div>
              <div className="flex justify-between">
                <span>Rates, Insurance & Other</span>
                <span className="font-mono">
                  {fmt(operatingCosts.ratesInsuranceOther * mult)}
                  <Arrow growing={costsGrowing} />
                </span>
              </div>
            </div>
          </div>

          <div>
            <div className="p-4 bg-av-light-grey font-body font-semibold text-av-navy flex justify-between">
              <span>Provisions</span>
              <span className="font-mono">{fmt(provisions.total * mult)}</span>
            </div>
            <div className="p-4 flex flex-col gap-2 font-body text-sm text-av-slate">
              <div className="flex justify-between">
                <span>Management</span>
                <span className="font-mono">
                  {fmt(provisions.management * mult)}
                  <Arrow growing={revenueGrowing} />
                </span>
              </div>
              <div className="flex justify-between">
                <span>Maintenance</span>
                <span className="font-mono">
                  {fmt(provisions.maintenance * mult)}
                  <Arrow growing={revenueGrowing} />
                </span>
              </div>
              <div className="flex justify-between">
                <span>Bad Debts</span>
                <span className="font-mono">
                  {fmt(provisions.badDebts * mult)}
                  <Arrow growing={revenueGrowing} />
                </span>
              </div>
            </div>
          </div>

          <div className="col-span-3 grid grid-cols-2 bg-av-light-grey border-t border-av-light-grey">
            <div className="p-4 font-body text-sm">
              <span className="text-av-slate">Tax: </span>
              <span className="font-mono font-semibold text-av-navy">
                {fmt(metrics.taxMonthly * mult)}
              </span>
            </div>
            <div className="p-4 font-body text-sm">
              <span className="text-av-slate">Cashflow: </span>
              <span
                className={clsx(
                  "font-mono font-semibold",
                  metrics.cashflowMonthly >= 0 ? "text-av-green" : "text-av-red"
                )}
              >
                {fmt(metrics.cashflowMonthly * mult)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
