"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { mutate as globalMutate } from "swr";
import { useDeal } from "@/lib/DealContext";
import { useToast } from "@/components/ui/Toast";
import { calcTransferDuty } from "@/lib/calculations/transferDuty";
import SaveBar from "@/components/forms/SaveBar";
import FormField from "@/components/ui/FormField";
import CurrencyInput from "@/components/ui/CurrencyInput";
import PercentInput from "@/components/ui/PercentInput";
import Button from "@/components/ui/Button";
import RenovationBudget, {
  STUDENT_CATEGORIES,
  STUDENT_FURNITURE_PRESETS,
} from "@/components/forms/RenovationBudget";
import PropertyValuationPanel from "@/components/forms/PropertyValuationPanel";

interface AcquisitionForm {
  askingPrice: number;
  purchasePrice: number;
  marketValue: number;
  transferBondCost: number;
  sourcingFee: number;
  agentCommission: number;
  wantToSell: boolean;
  saleYear: number;
}

export default function AcquisitionTab() {
  const { deal, refreshDeal, strategy } = useDeal();
  const { showToast } = useToast();
  const [showTransferDuty, setShowTransferDuty] = useState(false);
  const [renovationCost, setRenovationCost] = useState(deal.renovationCost ?? 0);

  const {
    register,
    handleSubmit,
    watch,
    formState: { isDirty, isSubmitting },
    reset,
  } = useForm<AcquisitionForm>({
    defaultValues: {
      askingPrice: deal.askingPrice ?? 0,
      purchasePrice: deal.purchasePrice ?? 0,
      marketValue: deal.marketValue ?? 0,
      transferBondCost: deal.transferBondCost ?? 0,
      sourcingFee: deal.sourcingFee ?? 0,
      agentCommission: deal.agentCommission ?? 0,
      wantToSell: deal.wantToSell ?? false,
      saleYear: deal.saleYear ?? 10,
    },
  });

  const askingPrice = Number(watch("askingPrice")) || 0;
  const purchasePrice = Number(watch("purchasePrice")) || 0;
  const marketValue = Number(watch("marketValue")) || 0;
  const transferBondCost = Number(watch("transferBondCost")) || 0;
  const sourcingFee = Number(watch("sourcingFee")) || 0;
  const wantToSell = watch("wantToSell");

  const discountToAsking =
    askingPrice > 0 ? ((askingPrice - purchasePrice) / askingPrice) * 100 : 0;
  const discountToMarket =
    marketValue > 0 ? ((marketValue - purchasePrice) / marketValue) * 100 : 0;

  const transferDuty = useMemo(
    () => calcTransferDuty(purchasePrice),
    [purchasePrice]
  );

  const totalInvestmentCost =
    purchasePrice + transferBondCost + renovationCost + sourcingFee;

  const capitalGrowthRate = deal.capitalGrowthRate ?? 3;
  const saleYear = Number(watch("saleYear")) || 10;
  const projectedSalePrice =
    marketValue > 0
      ? marketValue * Math.pow(1 + capitalGrowthRate / 100, saleYear)
      : 0;

  async function onSubmit(data: AcquisitionForm) {
    const res = await fetch(`/api/deals/${deal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      showToast("error", "Could not save acquisition costs.");
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
        <h2 className="font-display text-xl text-av-navy mb-4">Valuation</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField label="Asking Price">
            <CurrencyInput {...register("askingPrice")} />
          </FormField>
          <FormField label="Purchase Price">
            <CurrencyInput {...register("purchasePrice")} />
          </FormField>
          <FormField label="Market Value">
            <CurrencyInput {...register("marketValue")} />
          </FormField>
          <div />
          <FormField label="Discount to Asking Price">
            <PercentInput readOnly value={discountToAsking.toFixed(2)} />
          </FormField>
          <FormField label="Discount to Market Value">
            <PercentInput readOnly value={discountToMarket.toFixed(2)} />
          </FormField>
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl text-av-navy mb-4">
          Buying Costs
        </h2>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setShowTransferDuty((s) => !s)}
          className="mb-4"
        >
          {showTransferDuty ? "Hide" : "Show"} Proposed Transfer Cost
        </Button>

        {showTransferDuty && (
          <div className="rounded-md bg-av-light-grey p-4 mb-4 font-body text-sm text-av-navy">
            <div className="flex justify-between py-1">
              <span>Purchase Price</span>
              <span className="font-mono">
                R {purchasePrice.toLocaleString("en-US")}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span>Applicable Bracket</span>
              <span className="font-mono">{transferDuty.bracketLabel}</span>
            </div>
            <div className="flex justify-between py-1">
              <span>Marginal Rate</span>
              <span className="font-mono">{transferDuty.bracketRate}%</span>
            </div>
            <div className="flex justify-between py-1 border-t border-av-light-grey mt-1 pt-2 font-semibold">
              <span>Estimated Transfer Duty</span>
              <span className="font-mono">
                R{" "}
                {transferDuty.dutyAmount.toLocaleString("en-US", {
                  maximumFractionDigits: 0,
                })}
              </span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField label="Transfer & Bond Cost">
            <CurrencyInput {...register("transferBondCost")} />
          </FormField>
          <FormField label="Sourcing Fee">
            <CurrencyInput {...register("sourcingFee")} />
          </FormField>
        </div>

        <div className="mt-6">
          <RenovationBudget
            dealId={deal.id}
            initialItems={deal.renovationItems}
            onTotalChange={(total) => {
              setRenovationCost(total);
              refreshDeal({ renovationCost: total });
            }}
            {...(strategy.id === "student"
              ? {
                  categories: STUDENT_CATEGORIES,
                  presets: STUDENT_FURNITURE_PRESETS,
                  title: "Furniture, Setup & Renovation Budget",
                  totalLabel: "Total Furniture, Setup & Renovation Cost",
                }
              : {})}
          />
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl text-av-navy mb-4">
          Selling Costs
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField label="Estate Agent Commission">
            <PercentInput {...register("agentCommission")} />
          </FormField>
          <div className="flex items-center gap-2 pt-7">
            <input
              type="checkbox"
              id="wantToSell"
              {...register("wantToSell")}
              className="w-5 h-5 accent-av-gold"
            />
            <label htmlFor="wantToSell" className="text-sm font-body text-av-slate">
              Do you want to sell?
            </label>
          </div>

          {wantToSell && (
            <>
              <FormField label="Projected Sale Year">
                <input
                  type="number"
                  min={1}
                  max={20}
                  {...register("saleYear")}
                  className="w-full rounded-md border border-av-light-grey bg-white px-3 py-2.5 min-h-[44px] font-mono text-sm text-right text-av-navy focus:outline-none focus:border-av-gold focus:ring-1 focus:ring-av-gold"
                />
              </FormField>
              <FormField label="Sale Price at Exit">
                <CurrencyInput
                  readOnly
                  value={projectedSalePrice.toFixed(0)}
                />
              </FormField>
            </>
          )}
        </div>
      </section>

      <PropertyValuationPanel
        dealId={deal.id}
        initial={deal.propertyValuation}
        purchasePrice={purchasePrice}
      />

      <div className="rounded-lg bg-av-navy text-white p-6 flex items-center justify-between">
        <span className="font-body text-sm">Total Investment Cost</span>
        <span className="font-mono text-2xl font-bold">
          R{" "}
          {totalInvestmentCost.toLocaleString("en-US", {
            maximumFractionDigits: 0,
          })}
        </span>
      </div>

      <SaveBar
        dirty={isDirty}
        saving={isSubmitting}
        onSave={handleSubmit(onSubmit)}
      />
    </form>
  );
}
