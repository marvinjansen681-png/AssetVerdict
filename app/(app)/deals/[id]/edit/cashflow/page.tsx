"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { mutate as globalMutate } from "swr";
import { useDeal } from "@/lib/DealContext";
import { useToast } from "@/components/ui/Toast";
import SaveBar from "@/components/forms/SaveBar";
import FormField from "@/components/ui/FormField";
import CurrencyInput from "@/components/ui/CurrencyInput";
import PercentInput from "@/components/ui/PercentInput";
import ToggleInput from "@/components/ui/ToggleInput";
import clsx from "clsx";

interface CashflowForm {
  monthlyRent: number;
  occupancyRate: number;
  additionalIncome: number;
  recoveries: number;
  managementFeeMode: "percent" | "amount";
  managementFeeValue: number;
  maintenanceCostMode: "percent" | "amount";
  maintenanceCostValue: number;
  levies: number;
  ratesAndTaxes: number;
  insurance: number;
  waterSewerage: number;
  securityCleaning: number;
  electricity: number;
  badDebtsPct: number;
}

export default function CashflowTab() {
  const { deal, refreshDeal } = useDeal();
  const { showToast } = useToast();
  const [view, setView] = useState<"monthly" | "annual">("monthly");

  const cf = deal.cashflowInputs;
  const financeCostMonthly = deal.financeSources.reduce(
    (sum, f) => sum + (f.repaymentAmount ?? 0),
    0
  );

  const { register, watch, setValue, handleSubmit, formState, reset } =
    useForm<CashflowForm>({
      defaultValues: {
        monthlyRent: cf?.monthlyRent ?? 0,
        occupancyRate: cf?.occupancyRate ?? 88,
        additionalIncome: cf?.additionalIncome ?? 0,
        recoveries: cf?.recoveries ?? 0,
        managementFeeMode: (cf?.managementFeeMode as "percent" | "amount") ?? "percent",
        managementFeeValue: cf?.managementFeeValue ?? 15,
        maintenanceCostMode: (cf?.maintenanceCostMode as "percent" | "amount") ?? "percent",
        maintenanceCostValue: cf?.maintenanceCostValue ?? 5,
        levies: cf?.levies ?? 0,
        ratesAndTaxes: cf?.ratesAndTaxes ?? 0,
        insurance: cf?.insurance ?? 0,
        waterSewerage: cf?.waterSewerage ?? 0,
        securityCleaning: cf?.securityCleaning ?? 0,
        electricity: cf?.electricity ?? 0,
        badDebtsPct: cf?.badDebtsPct ?? 5,
      },
    });

  const v = watch();
  const effectiveMonthlyRevenue =
    (Number(v.monthlyRent) || 0) * ((Number(v.occupancyRate) || 0) / 100) +
    (Number(v.additionalIncome) || 0) +
    (Number(v.recoveries) || 0);

  const managementFeeMonthly =
    v.managementFeeMode === "percent"
      ? effectiveMonthlyRevenue * ((Number(v.managementFeeValue) || 0) / 100)
      : Number(v.managementFeeValue) || 0;

  const maintenanceCostMonthly =
    v.maintenanceCostMode === "percent"
      ? effectiveMonthlyRevenue * ((Number(v.maintenanceCostValue) || 0) / 100)
      : Number(v.maintenanceCostValue) || 0;

  const grossRevenueMonthly = effectiveMonthlyRevenue;
  const badDebtsMonthly = grossRevenueMonthly * ((Number(v.badDebtsPct) || 0) / 100);

  const utilitiesMonthly =
    (Number(v.waterSewerage) || 0) +
    (Number(v.electricity) || 0) +
    (Number(v.securityCleaning) || 0);
  const ratesInsuranceOtherMonthly =
    (Number(v.ratesAndTaxes) || 0) + (Number(v.insurance) || 0) + (Number(v.levies) || 0);

  const operatingCostsMonthly =
    financeCostMonthly + utilitiesMonthly + ratesInsuranceOtherMonthly;
  const provisionsMonthly =
    managementFeeMonthly + maintenanceCostMonthly + badDebtsMonthly;

  const noiMonthly =
    grossRevenueMonthly -
    utilitiesMonthly -
    ratesInsuranceOtherMonthly -
    provisionsMonthly;

  const taxMonthly = Math.max(
    0,
    (noiMonthly - financeCostMonthly) * ((deal.incomeTaxRate ?? 27) / 100)
  );
  const cashflowMonthly =
    grossRevenueMonthly - operatingCostsMonthly - provisionsMonthly - taxMonthly;

  const mult = view === "annual" ? 12 : 1;
  const fmt = (n: number) =>
    `R ${(n * mult).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

  async function onSubmit(data: CashflowForm) {
    const res = await fetch(`/api/deals/${deal.id}/cashflow`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      showToast("error", "Could not save cashflow inputs.");
      return;
    }

    const updated = await res.json();
    refreshDeal({ cashflowInputs: updated });
    globalMutate(`/api/deals/${deal.id}/calculate`);
    reset(data);
    showToast("success", "Cashflow updated");
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="px-4 md:px-8 py-8 max-w-3xl mx-auto flex flex-col gap-10"
    >
      <section>
        <h2 className="font-display text-xl text-av-navy mb-4">
          Revenue (monthly)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField label="Monthly Rent">
            <CurrencyInput {...register("monthlyRent")} />
          </FormField>
          <FormField label="Occupancy Rate">
            <PercentInput {...register("occupancyRate")} />
          </FormField>
          <FormField label="Additional Income">
            <CurrencyInput {...register("additionalIncome")} />
          </FormField>
          <FormField label="Recoveries">
            <CurrencyInput {...register("recoveries")} />
          </FormField>
          <div className="md:col-span-2">
            <FormField label="Effective Monthly Revenue">
              <CurrencyInput readOnly value={effectiveMonthlyRevenue.toFixed(2)} />
            </FormField>
          </div>
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl text-av-navy mb-4">
          Expenses (monthly)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField label="Management Fees">
            <div className="flex items-center gap-2">
              <ToggleInput
                mode={v.managementFeeMode}
                onChange={(m) => setValue("managementFeeMode", m, { shouldDirty: true })}
              />
              {v.managementFeeMode === "percent" ? (
                <PercentInput {...register("managementFeeValue")} />
              ) : (
                <CurrencyInput {...register("managementFeeValue")} />
              )}
            </div>
          </FormField>
          <FormField label="Maintenance Cost">
            <div className="flex items-center gap-2">
              <ToggleInput
                mode={v.maintenanceCostMode}
                onChange={(m) => setValue("maintenanceCostMode", m, { shouldDirty: true })}
              />
              {v.maintenanceCostMode === "percent" ? (
                <PercentInput {...register("maintenanceCostValue")} />
              ) : (
                <CurrencyInput {...register("maintenanceCostValue")} />
              )}
            </div>
          </FormField>
          <FormField label="Levies">
            <CurrencyInput {...register("levies")} />
          </FormField>
          <FormField label="Rates and Taxes">
            <CurrencyInput {...register("ratesAndTaxes")} />
          </FormField>
          <FormField label="Insurance">
            <CurrencyInput {...register("insurance")} />
          </FormField>
          <FormField label="Water, Refuse & Sewerage">
            <CurrencyInput {...register("waterSewerage")} />
          </FormField>
          <FormField label="Security and Cleaning">
            <CurrencyInput {...register("securityCleaning")} />
          </FormField>
          <FormField label="Electricity">
            <CurrencyInput {...register("electricity")} />
          </FormField>
          <FormField label="Finance Cost">
            <CurrencyInput readOnly value={financeCostMonthly.toFixed(2)} />
          </FormField>
          <FormField label="Bad Debts Provision">
            <PercentInput {...register("badDebtsPct")} />
          </FormField>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl text-av-navy">Live Summary</h2>
          <div className="inline-flex rounded-md border border-av-light-grey overflow-hidden">
            {(["monthly", "annual"] as const).map((v2) => (
              <button
                key={v2}
                type="button"
                onClick={() => setView(v2)}
                className={clsx(
                  "px-4 py-2 text-xs font-body font-semibold capitalize min-h-[44px]",
                  view === v2
                    ? "bg-av-navy text-white"
                    : "bg-white text-av-slate hover:bg-av-light-grey"
                )}
              >
                {v2} Figures
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-body text-sm">
          <div className="rounded-lg border border-av-light-grey p-4">
            <div className="font-semibold text-av-navy mb-2">Gross Revenue</div>
            <div className="font-mono text-lg text-av-navy mb-2">
              {fmt(grossRevenueMonthly)}
            </div>
            <div className="flex justify-between text-av-slate">
              <span>Rental Income</span>
              <span className="font-mono">
                {fmt((Number(v.monthlyRent) || 0) * ((Number(v.occupancyRate) || 0) / 100))}
              </span>
            </div>
            <div className="flex justify-between text-av-slate">
              <span>Additional Income</span>
              <span className="font-mono">{fmt(Number(v.additionalIncome) || 0)}</span>
            </div>
            <div className="flex justify-between text-av-slate">
              <span>Recoveries</span>
              <span className="font-mono">{fmt(Number(v.recoveries) || 0)}</span>
            </div>
          </div>

          <div className="rounded-lg border border-av-light-grey p-4">
            <div className="font-semibold text-av-navy mb-2">Operating Costs</div>
            <div className="font-mono text-lg text-av-navy mb-2">
              {fmt(operatingCostsMonthly)}
            </div>
            <div className="flex justify-between text-av-slate">
              <span>Finance</span>
              <span className="font-mono">{fmt(financeCostMonthly)}</span>
            </div>
            <div className="flex justify-between text-av-slate">
              <span>Utilities</span>
              <span className="font-mono">{fmt(utilitiesMonthly)}</span>
            </div>
            <div className="flex justify-between text-av-slate">
              <span>Rates, Insurance & Other</span>
              <span className="font-mono">{fmt(ratesInsuranceOtherMonthly)}</span>
            </div>
          </div>

          <div className="rounded-lg border border-av-light-grey p-4">
            <div className="font-semibold text-av-navy mb-2">Provisions</div>
            <div className="font-mono text-lg text-av-navy mb-2">
              {fmt(provisionsMonthly)}
            </div>
            <div className="flex justify-between text-av-slate">
              <span>Management</span>
              <span className="font-mono">{fmt(managementFeeMonthly)}</span>
            </div>
            <div className="flex justify-between text-av-slate">
              <span>Maintenance</span>
              <span className="font-mono">{fmt(maintenanceCostMonthly)}</span>
            </div>
            <div className="flex justify-between text-av-slate">
              <span>Bad Debts</span>
              <span className="font-mono">{fmt(badDebtsMonthly)}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4 rounded-lg bg-av-light-grey p-4 font-body text-sm">
          <div className="flex justify-between">
            <span className="text-av-slate">Tax</span>
            <span className="font-mono font-semibold text-av-navy">
              {fmt(taxMonthly)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-av-slate">Cashflow</span>
            <span
              className={clsx(
                "font-mono font-semibold",
                cashflowMonthly >= 0 ? "text-av-green" : "text-av-red"
              )}
            >
              {fmt(cashflowMonthly)}
            </span>
          </div>
        </div>
      </section>

      <SaveBar
        dirty={formState.isDirty}
        saving={formState.isSubmitting}
        onSave={handleSubmit(onSubmit)}
      />
    </form>
  );
}
