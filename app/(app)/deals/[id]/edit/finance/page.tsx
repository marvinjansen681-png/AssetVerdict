"use client";

import { useFieldArray, useForm } from "react-hook-form";
import { mutate as globalMutate } from "swr";
import { useDeal } from "@/lib/DealContext";
import { useToast } from "@/components/ui/Toast";
import { calcMonthlyRepayment } from "@/lib/calculations/amortisation";
import SaveBar from "@/components/forms/SaveBar";
import FinanceBlock from "@/components/forms/FinanceBlock";
import Button from "@/components/ui/Button";

export interface FinanceSourceForm {
  sourceType: string;
  ltvMode: "percent" | "amount";
  ltvValue: number;
  loanAmount: number;
  interestRate: number;
  termYears: number;
}

export interface FinanceFormValues {
  financeSources: FinanceSourceForm[];
}

export default function FinanceTab() {
  const { deal, refreshDeal } = useDeal();
  const { showToast } = useToast();
  const purchasePrice = deal.purchasePrice ?? 0;

  const { register, control, handleSubmit, watch, setValue, reset, formState } =
    useForm<FinanceFormValues>({
      defaultValues: {
        financeSources:
          deal.financeSources.length > 0
            ? deal.financeSources.map((f) => ({
                sourceType: f.sourceType,
                ltvMode: (f.ltvMode as "percent" | "amount") ?? "percent",
                ltvValue: f.ltvValue ?? 0,
                loanAmount: f.loanAmount ?? 0,
                interestRate: f.interestRate ?? 0,
                termYears: f.termYears ?? 15,
              }))
            : [],
      },
    });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "financeSources",
  });

  const watchedSources = watch("financeSources");

  const computed = watchedSources.map((s) => {
    const loanAmount =
      s.ltvMode === "percent"
        ? ((Number(s.ltvValue) || 0) / 100) * purchasePrice
        : Number(s.loanAmount) || 0;
    const repayment = calcMonthlyRepayment(
      loanAmount,
      Number(s.interestRate) || 0,
      Number(s.termYears) || 15
    );
    return { loanAmount, repayment };
  });

  const totalLoanAmount = computed.reduce((sum, c) => sum + c.loanAmount, 0);
  const totalFinanceCost = computed.reduce((sum, c) => sum + c.repayment, 0);
  const buyingCosts =
    (deal.transferBondCost ?? 0) +
    (deal.renovationCost ?? 0) +
    (deal.sourcingFee ?? 0);
  const depositRequired = purchasePrice + buyingCosts - totalLoanAmount;

  async function onSubmit(data: FinanceFormValues) {
    const payload = data.financeSources.map((s, index) => {
      const loanAmount =
        s.ltvMode === "percent"
          ? ((Number(s.ltvValue) || 0) / 100) * purchasePrice
          : Number(s.loanAmount) || 0;
      const repaymentAmount = calcMonthlyRepayment(
        loanAmount,
        Number(s.interestRate) || 0,
        Number(s.termYears) || 15
      );
      return {
        sourceType: s.sourceType,
        ltvMode: s.ltvMode,
        ltvValue: Number(s.ltvValue) || 0,
        loanAmount,
        interestRate: Number(s.interestRate) || 0,
        termYears: Number(s.termYears) || 15,
        repaymentAmount,
        order: index,
      };
    });

    const res = await fetch(`/api/deals/${deal.id}/finance`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ financeSources: payload }),
    });

    if (!res.ok) {
      showToast("error", "Could not save finance sources.");
      return;
    }

    const updated = await res.json();
    refreshDeal({ financeSources: updated });
    globalMutate(`/api/deals/${deal.id}/calculate`);
    reset(data);
    showToast("success", "Finance costs updated");
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="px-4 md:px-8 py-8 max-w-3xl mx-auto flex flex-col gap-6"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl text-av-navy">Finance Sources</h2>
        <Button
          type="button"
          onClick={() =>
            append({
              sourceType: "Bank Finance",
              ltvMode: "percent",
              ltvValue: 70,
              loanAmount: 0,
              interestRate: 15,
              termYears: 15,
            })
          }
        >
          + Add New Finance
        </Button>
      </div>

      {fields.length === 0 && (
        <p className="text-sm font-body text-av-slate">
          No finance sources yet. Add one to model your loan structure.
        </p>
      )}

      <div className="flex flex-col gap-4">
        {fields.map((field, index) => (
          <FinanceBlock
            key={field.id}
            index={index}
            register={register}
            watch={watch}
            setValue={setValue}
            control={control}
            purchasePrice={purchasePrice}
            onRemove={() => remove(index)}
          />
        ))}
      </div>

      <div className="rounded-lg bg-av-light-grey p-6 flex flex-col gap-3 font-body text-sm">
        <div className="flex justify-between">
          <span className="text-av-slate">Total Loan Amount</span>
          <span className="font-mono font-semibold text-av-navy">
            R {totalLoanAmount.toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-av-slate">Finance Cost (total monthly)</span>
          <span className="font-mono font-semibold text-av-navy">
            R {totalFinanceCost.toLocaleString("en-US", { maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="flex justify-between border-t border-white pt-3 text-base">
          <span className="text-av-navy font-semibold">Deposit Required</span>
          <span className="font-mono font-bold text-av-navy">
            R {depositRequired.toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </span>
        </div>
      </div>

      <SaveBar
        dirty={formState.isDirty}
        saving={formState.isSubmitting}
        onSave={handleSubmit(onSubmit)}
      />
    </form>
  );
}
