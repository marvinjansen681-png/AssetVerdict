"use client";

import { Control, UseFormRegister, UseFormWatch, UseFormSetValue } from "react-hook-form";
import { Trash2 } from "lucide-react";
import Card from "@/components/ui/Card";
import CurrencyInput from "@/components/ui/CurrencyInput";
import PercentInput from "@/components/ui/PercentInput";
import ToggleInput from "@/components/ui/ToggleInput";
import FormField from "@/components/ui/FormField";
import { calcMonthlyRepayment } from "@/lib/calculations/amortisation";
import type { FinanceFormValues } from "@/app/(app)/deals/[id]/edit/finance/page";

const SOURCE_TYPES = [
  "Bank Finance",
  "Bridging",
  "Commercial",
  "Creative Finance",
  "DCSR",
  "Private",
];

const ACCENT_COLORS: Record<string, string> = {
  "Bank Finance": "border-l-av-navy",
  Bridging: "border-l-av-orange",
  Commercial: "border-l-av-gold",
  "Creative Finance": "border-l-av-green",
  DCSR: "border-l-[#3498DB]",
  Private: "border-l-av-red",
};

interface FinanceBlockProps {
  index: number;
  register: UseFormRegister<FinanceFormValues>;
  watch: UseFormWatch<FinanceFormValues>;
  setValue: UseFormSetValue<FinanceFormValues>;
  control: Control<FinanceFormValues>;
  purchasePrice: number;
  onRemove: () => void;
}

export default function FinanceBlock({
  index,
  register,
  watch,
  setValue,
  purchasePrice,
  onRemove,
}: FinanceBlockProps) {
  const source = watch(`financeSources.${index}`);
  const sourceType = source?.sourceType ?? "Bank Finance";
  const ltvMode = source?.ltvMode ?? "percent";
  const ltvValue = Number(source?.ltvValue) || 0;
  const loanAmount =
    ltvMode === "percent"
      ? (ltvValue / 100) * purchasePrice
      : Number(source?.loanAmount) || 0;
  const interestRate = Number(source?.interestRate) || 0;
  const termYears = Number(source?.termYears) || 15;

  const repayment = calcMonthlyRepayment(loanAmount, interestRate, termYears);

  function handleModeChange(mode: "percent" | "amount") {
    setValue(`financeSources.${index}.ltvMode`, mode, { shouldDirty: true });
  }

  return (
    <Card
      className={`p-5 border-l-4 ${ACCENT_COLORS[sourceType] ?? "border-l-av-navy"}`}
    >
      <div className="flex items-center justify-between mb-4">
        <FormField label="Source of Finance">
          <select
            {...register(`financeSources.${index}.sourceType`)}
            className="w-48 rounded-md border border-av-light-grey bg-white px-3 py-2.5 min-h-[44px] font-body text-sm text-av-navy focus:outline-none focus:border-av-gold focus:ring-1 focus:ring-av-gold"
          >
            {SOURCE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </FormField>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove finance source"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md text-av-slate hover:bg-av-red/10 hover:text-av-red transition-colors"
        >
          <Trash2 size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FormField label="LTV / Amount">
          <div className="flex items-center gap-2">
            <ToggleInput mode={ltvMode} onChange={handleModeChange} />
            {ltvMode === "percent" ? (
              <PercentInput {...register(`financeSources.${index}.ltvValue`)} />
            ) : (
              <CurrencyInput
                {...register(`financeSources.${index}.loanAmount`)}
              />
            )}
          </div>
        </FormField>

        <FormField label="Loan Amount">
          <CurrencyInput readOnly value={loanAmount.toFixed(0)} />
        </FormField>

        <FormField label="Interest Rate">
          <PercentInput {...register(`financeSources.${index}.interestRate`)} />
        </FormField>

        <FormField label="Term (Years)">
          <div className="relative">
            <input
              type="number"
              {...register(`financeSources.${index}.termYears`)}
              className="w-full rounded-md border border-av-light-grey bg-white px-3 pr-9 py-2.5 min-h-[44px] font-mono text-sm text-right text-av-navy focus:outline-none focus:border-av-gold focus:ring-1 focus:ring-av-gold"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-mono text-av-slate pointer-events-none">
              Y
            </span>
          </div>
        </FormField>

        <div className="md:col-span-2">
          <FormField label="Repayment Amount (monthly)">
            <CurrencyInput readOnly value={repayment.toFixed(2)} />
          </FormField>
        </div>
      </div>

      {sourceType !== "Bank Finance" && (
        <p className="text-xs font-body text-av-orange mt-3">
          &quot;{sourceType}&quot; is a descriptive label only. This repayment is still calculated
          using AssetVerdict&apos;s standard fully amortising loan model, not real{" "}
          {sourceType.toLowerCase()} economics.
        </p>
      )}
    </Card>
  );
}
