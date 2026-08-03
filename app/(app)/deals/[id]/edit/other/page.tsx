"use client";

import { useForm } from "react-hook-form";
import { mutate as globalMutate } from "swr";
import { useDeal } from "@/lib/DealContext";
import { useToast } from "@/components/ui/Toast";
import SaveBar from "@/components/forms/SaveBar";
import FormField from "@/components/ui/FormField";
import PercentInput from "@/components/ui/PercentInput";

interface OtherInputsForm {
  incomeTaxRate: number;
  capitalGainsTaxRate: number;
  capitalGrowthRate: number;
  rentalGrowthRate: number;
  costInflation: number;
  sustainableGrowthRate: number;
  discountRate: number;
  marketCapRate: number;
  realGrowthFactor: number;
  occupationFactor: number;
}

export default function OtherInputsTab() {
  const { deal, refreshDeal } = useDeal();
  const { showToast } = useToast();

  const { register, watch, handleSubmit, formState, reset } =
    useForm<OtherInputsForm>({
      defaultValues: {
        incomeTaxRate: deal.incomeTaxRate ?? 27,
        capitalGainsTaxRate: deal.capitalGainsTaxRate ?? 22,
        capitalGrowthRate: deal.capitalGrowthRate ?? 3,
        rentalGrowthRate: deal.rentalGrowthRate ?? 8,
        costInflation: deal.costInflation ?? 5,
        sustainableGrowthRate: deal.sustainableGrowthRate ?? 5,
        discountRate: deal.discountRate ?? 10,
        marketCapRate: deal.marketCapRate ?? 10,
        realGrowthFactor: deal.realGrowthFactor ?? 10,
        occupationFactor: deal.occupationFactor ?? 10,
      },
    });

  const v = watch();
  const rgf = Number(v.realGrowthFactor) || 0;
  const of = Number(v.occupationFactor) || 0;
  const rentalGrowth = Number(v.rentalGrowthRate) || 0;
  const capitalGrowth = Number(v.capitalGrowthRate) || 0;
  const baseOccupancy = deal.cashflowInputs?.occupancyRate ?? 88;

  const totalCosts =
    (deal.purchasePrice ?? 0) +
    (deal.transferBondCost ?? 0) +
    (deal.renovationCost ?? 0) +
    (deal.sourcingFee ?? 0);

  const scenarioRows = [
    {
      label: "Rental Growth",
      bear: `${(rentalGrowth - rgf).toFixed(1)}%`,
      base: `${rentalGrowth.toFixed(1)}%`,
      bull: `${(rentalGrowth + rgf).toFixed(1)}%`,
    },
    {
      label: "Occupancy",
      bear: `${(baseOccupancy - of).toFixed(1)}%`,
      base: `${baseOccupancy.toFixed(1)}%`,
      bull: `${(baseOccupancy + of).toFixed(1)}%`,
    },
    {
      label: "Capital Growth",
      bear: `${(capitalGrowth - rgf).toFixed(1)}%`,
      base: `${capitalGrowth.toFixed(1)}%`,
      bull: `${(capitalGrowth + rgf).toFixed(1)}%`,
    },
  ];

  async function onSubmit(data: OtherInputsForm) {
    const res = await fetch(`/api/deals/${deal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      showToast("error", "Could not save other inputs.");
      return;
    }

    const updated = await res.json();
    refreshDeal(updated);
    globalMutate(`/api/deals/${deal.id}/calculate`);
    reset(data);
    showToast("success", "Deal updated");
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="px-4 md:px-8 py-8 max-w-3xl mx-auto flex flex-col gap-10"
    >
      <section>
        <h2 className="font-display text-xl text-av-navy mb-4">
          Enterprise Details
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField label="Effective Income Tax">
            <PercentInput {...register("incomeTaxRate")} />
          </FormField>
          <FormField label="Effective Capital Gains Tax">
            <PercentInput {...register("capitalGainsTaxRate")} />
          </FormField>
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl text-av-navy mb-4">Escalations</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            label="Capital Growth Rate"
            helperText="Annual property value growth — drives exit valuation and NPV terminal value."
          >
            <PercentInput {...register("capitalGrowthRate")} />
          </FormField>
          <FormField
            label="Rental Growth Rate"
            helperText="Annual rent increase — compounds gross revenue over the 20-year projection."
          >
            <PercentInput {...register("rentalGrowthRate")} />
          </FormField>
          <FormField
            label="Cost Inflation"
            helperText="Annual expense growth — compounds operating costs over the projection."
          >
            <PercentInput {...register("costInflation")} />
          </FormField>
          <FormField
            label="Sustainable Growth Rate"
            helperText="Long-run growth ceiling used for terminal value sanity checks."
          >
            <PercentInput {...register("sustainableGrowthRate")} />
          </FormField>
          <FormField
            label="Discount Rate"
            helperText="Used to discount future cashflows for NPV."
          >
            <PercentInput {...register("discountRate")} />
          </FormField>
          <FormField
            label="Market Cap Rate"
            helperText="Benchmark cap rate for your market — used for Cap Rate Spread."
          >
            <PercentInput {...register("marketCapRate")} />
          </FormField>
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl text-av-navy mb-4">
          Sensitivity Levels
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            label="Real Growth Factor"
            helperText="Upside/downside variance applied to growth rates in Bear/Bull scenarios."
          >
            <PercentInput {...register("realGrowthFactor")} />
          </FormField>
          <FormField
            label="Occupation Factor"
            helperText="Occupancy variance applied in Bear/Bull scenarios."
          >
            <PercentInput {...register("occupationFactor")} />
          </FormField>
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl text-av-navy mb-4">Scenarios</h2>
        <div className="overflow-x-auto rounded-lg border border-av-light-grey">
          <table className="w-full text-sm font-body">
            <thead>
              <tr className="bg-av-navy text-white">
                <th className="text-left px-4 py-3 font-semibold">Category</th>
                <th className="text-left px-4 py-3 font-semibold border-l-4 border-av-red">
                  Bear
                </th>
                <th className="text-left px-4 py-3 font-semibold border-l-4 border-av-gold">
                  Base
                </th>
                <th className="text-left px-4 py-3 font-semibold border-l-4 border-av-green">
                  Bull
                </th>
              </tr>
            </thead>
            <tbody>
              {scenarioRows.map((row, i) => (
                <tr
                  key={row.label}
                  className={i % 2 === 0 ? "bg-white" : "bg-av-light-grey"}
                >
                  <td className="px-4 py-3 text-av-navy font-medium">
                    {row.label}
                  </td>
                  <td className="px-4 py-3 font-mono text-av-red">{row.bear}</td>
                  <td className="px-4 py-3 font-mono text-av-navy">{row.base}</td>
                  <td className="px-4 py-3 font-mono text-av-green">{row.bull}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="rounded-lg bg-av-navy text-white p-6 flex items-center justify-between">
        <span className="font-body text-sm">Total Costs</span>
        <span className="font-mono text-2xl font-bold">
          R{" "}
          {totalCosts.toLocaleString("en-US", { maximumFractionDigits: 0 })}
        </span>
      </div>

      <SaveBar
        dirty={formState.isDirty}
        saving={formState.isSubmitting}
        onSave={handleSubmit(onSubmit)}
      />
    </form>
  );
}
