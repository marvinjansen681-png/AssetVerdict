"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { mutate as globalMutate } from "swr";
import { useDeal } from "@/lib/DealContext";
import { useToast } from "@/components/ui/Toast";
import SaveBar from "@/components/forms/SaveBar";
import StrategyHint from "@/components/forms/StrategyHint";
import MarketIntelligencePanel from "@/components/forms/MarketIntelligencePanel";
import FormField from "@/components/ui/FormField";
import CurrencyInput from "@/components/ui/CurrencyInput";
import PercentInput from "@/components/ui/PercentInput";
import ToggleInput from "@/components/ui/ToggleInput";
import Input from "@/components/ui/Input";
import NsfasGradingLookup from "@/components/forms/NsfasGradingLookup";
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
  // STR
  nightlyRate: number;
  avgOccupiedNights: number;
  platformFeesPct: number;
  // Multi-Let
  billsIncluded: boolean;
  pricePerRoom: number;
  billsIncludedAmount: number | null;
  // Commercial
  leaseTermMonths: number | null;
  // Student Accommodation (NSFAS-aware)
  singleRoomCount: number;
  singleRoomRent: number;
  singleRoomNsfasBeds: number;
  sharingRoomCount: number;
  sharingBedsPerRoom: number;
  sharingRoomRent: number;
  sharingRoomNsfasBeds: number;
  nsfasCycleMonths: number;
  privateCycleMonths: number;
  // Student Accommodation — additional monthly expenses
  houseParentCost: number;
  internetCost: number;
  netflixCost: number;
  gasRefillCost: number;
  wasteRemovalCost: number;
  // Fix & Flip
  holdingPeriodMonths: number;
  expectedSalePrice: number;
  holdingCostPerMonth: number;
  // Instalment Sale
  instalmentAmount: number;
  instalmentTerm: number;
  instalmentRate: number;
}

export default function CashflowTab() {
  const { deal, refreshDeal, strategy } = useDeal();
  const { showToast } = useToast();
  const [view, setView] = useState<"monthly" | "annual">("monthly");

  const cf = deal.cashflowInputs;
  const numUnits = deal.numUnits ?? 1;
  // Bills Included was toggled on before billsIncludedAmount existed as its own
  // field — its effect (if any) is already embedded in Electricity from the old
  // behaviour, so this is not a confirmed R0 and shouldn't be presented as one.
  const legacyBillsUnrecorded = Boolean(cf?.billsIncluded) && (cf?.billsIncludedAmount === null || cf?.billsIncludedAmount === undefined);
  const financeCostMonthly = deal.financeSources.reduce(
    (sum, f) => sum + (f.repaymentAmount ?? 0),
    0
  );

  const { register, watch, setValue, handleSubmit, formState, reset } =
    useForm<CashflowForm>({
      defaultValues: {
        monthlyRent: cf?.monthlyRent ?? 0,
        occupancyRate: cf?.occupancyRate ?? strategy.defaultOccupancy,
        additionalIncome: cf?.additionalIncome ?? 0,
        recoveries: cf?.recoveries ?? 0,
        managementFeeMode: (cf?.managementFeeMode as "percent" | "amount") ?? "percent",
        managementFeeValue: cf?.managementFeeValue ?? strategy.defaultManagementFee,
        maintenanceCostMode: (cf?.maintenanceCostMode as "percent" | "amount") ?? "percent",
        maintenanceCostValue: cf?.maintenanceCostValue ?? 5,
        levies: cf?.levies ?? 0,
        ratesAndTaxes: cf?.ratesAndTaxes ?? 0,
        insurance: cf?.insurance ?? 0,
        waterSewerage: cf?.waterSewerage ?? 0,
        securityCleaning: cf?.securityCleaning ?? 0,
        electricity: cf?.electricity ?? 0,
        badDebtsPct: cf?.badDebtsPct ?? strategy.defaultBadDebt,
        nightlyRate: cf?.nightlyRate ?? 0,
        avgOccupiedNights: cf?.avgOccupiedNights ?? 200,
        platformFeesPct: cf?.platformFeesPct ?? 15,
        billsIncluded: cf?.billsIncluded ?? false,
        pricePerRoom: cf?.pricePerRoom ?? 0,
        billsIncludedAmount: cf?.billsIncludedAmount ?? null,
        leaseTermMonths: cf?.leaseTermMonths ?? null,
        singleRoomCount: cf?.singleRoomCount ?? 0,
        singleRoomRent: cf?.singleRoomRent ?? 0,
        singleRoomNsfasBeds: cf?.singleRoomNsfasBeds ?? 0,
        sharingRoomCount: cf?.sharingRoomCount ?? 0,
        sharingBedsPerRoom: cf?.sharingBedsPerRoom ?? 2,
        sharingRoomRent: cf?.sharingRoomRent ?? 0,
        sharingRoomNsfasBeds: cf?.sharingRoomNsfasBeds ?? 0,
        nsfasCycleMonths: cf?.nsfasCycleMonths ?? 10,
        privateCycleMonths: cf?.privateCycleMonths ?? 12,
        houseParentCost: cf?.houseParentCost ?? 0,
        internetCost: cf?.internetCost ?? 0,
        netflixCost: cf?.netflixCost ?? 0,
        gasRefillCost: cf?.gasRefillCost ?? 0,
        wasteRemovalCost: cf?.wasteRemovalCost ?? 0,
        holdingPeriodMonths: cf?.holdingPeriodMonths ?? 6,
        expectedSalePrice: cf?.expectedSalePrice ?? Math.round((deal.purchasePrice ?? 0) * 1.3),
        holdingCostPerMonth: cf?.holdingCostPerMonth ?? 0,
        instalmentAmount: cf?.instalmentAmount ?? 0,
        instalmentTerm: cf?.instalmentTerm ?? 240,
        instalmentRate: cf?.instalmentRate ?? 0,
      },
    });

  const v = watch();
  const mode = strategy.cashflowMode;

  // ---- Student room mix (mirrors lib/calculations/index.ts calcStudentAnnualRevenue) ----
  const totalSingleBeds = Number(v.singleRoomCount) || 0;
  const totalSharingBeds = (Number(v.sharingRoomCount) || 0) * (Number(v.sharingBedsPerRoom) || 0);
  const nsfasSingleBeds = Math.min(Number(v.singleRoomNsfasBeds) || 0, totalSingleBeds);
  const nsfasSharingBeds = Math.min(Number(v.sharingRoomNsfasBeds) || 0, totalSharingBeds);
  const privateSingleBeds = totalSingleBeds - nsfasSingleBeds;
  const privateSharingBeds = totalSharingBeds - nsfasSharingBeds;
  const totalBeds = totalSingleBeds + totalSharingBeds;
  const nsfasMonths = Number(v.nsfasCycleMonths) || 10;
  const privateMonths = Number(v.privateCycleMonths) || 12;
  // What you'd actually collect in a normal paying month — every bed occupied,
  // no NSFAS payment gap factored in. Useful as a sanity-check against the
  // sticker rent, but NOT what flows into annual metrics (see baseMonthlyRevenue).
  const inTermMonthlyRevenue =
    (totalSingleBeds * (Number(v.singleRoomRent) || 0) +
      totalSharingBeds * (Number(v.sharingRoomRent) || 0)) *
    ((Number(v.occupancyRate) || 0) / 100);

  // ---- Base revenue (mirrors lib/calculations/index.ts calcBaseMonthlyRevenue) ----
  let baseMonthlyRevenue = 0;
  if (mode === "nightly") {
    baseMonthlyRevenue = ((Number(v.nightlyRate) || 0) * (Number(v.avgOccupiedNights) || 0)) / 12;
  } else if (mode === "student") {
    const studentAnnualRevenue =
      nsfasSingleBeds * (Number(v.singleRoomRent) || 0) * nsfasMonths +
      privateSingleBeds * (Number(v.singleRoomRent) || 0) * privateMonths +
      nsfasSharingBeds * (Number(v.sharingRoomRent) || 0) * nsfasMonths +
      privateSharingBeds * (Number(v.sharingRoomRent) || 0) * privateMonths;
    baseMonthlyRevenue = (studentAnnualRevenue / 12) * ((Number(v.occupancyRate) || 0) / 100);
  } else if (mode === "per_room") {
    baseMonthlyRevenue =
      (Number(v.pricePerRoom) || 0) * numUnits * ((Number(v.occupancyRate) || 0) / 100);
  } else if (mode === "instalment") {
    baseMonthlyRevenue = Number(v.instalmentAmount) || 0;
  } else if (mode !== "flip") {
    baseMonthlyRevenue = (Number(v.monthlyRent) || 0) * ((Number(v.occupancyRate) || 0) / 100);
  }

  const effectiveMonthlyRevenue =
    baseMonthlyRevenue + (Number(v.additionalIncome) || 0) + (Number(v.recoveries) || 0);

  const managementFeeMonthly =
    mode === "nightly"
      ? effectiveMonthlyRevenue * ((Number(v.platformFeesPct) || 0) / 100)
      : v.managementFeeMode === "percent"
        ? effectiveMonthlyRevenue * ((Number(v.managementFeeValue) || 0) / 100)
        : Number(v.managementFeeValue) || 0;

  const maintenanceCostMonthly =
    v.maintenanceCostMode === "percent"
      ? effectiveMonthlyRevenue * ((Number(v.maintenanceCostValue) || 0) / 100)
      : Number(v.maintenanceCostValue) || 0;

  const grossRevenueMonthly = effectiveMonthlyRevenue;
  const badDebtsMonthly = grossRevenueMonthly * ((Number(v.badDebtsPct) || 0) / 100);

  const billsUnitCount = mode === "student" ? totalBeds : numUnits;
  const billsFromRooms =
    (mode === "per_room" || mode === "student") && v.billsIncluded
      ? (Number(v.billsIncludedAmount) || 0) * billsUnitCount
      : 0;

  const utilitiesMonthly =
    (Number(v.waterSewerage) || 0) +
    (Number(v.electricity) || 0) +
    (Number(v.securityCleaning) || 0) +
    billsFromRooms +
    (mode === "student"
      ? (Number(v.internetCost) || 0) +
        (Number(v.netflixCost) || 0) +
        (Number(v.gasRefillCost) || 0) +
        (Number(v.wasteRemovalCost) || 0)
      : 0);
  const ratesInsuranceOtherMonthly =
    (Number(v.ratesAndTaxes) || 0) +
    (Number(v.insurance) || 0) +
    (Number(v.levies) || 0) +
    (mode === "student" ? Number(v.houseParentCost) || 0 : 0);

  const operatingCostsMonthly = financeCostMonthly + utilitiesMonthly + ratesInsuranceOtherMonthly;
  const provisionsMonthly = managementFeeMonthly + maintenanceCostMonthly + badDebtsMonthly;

  const noiMonthly = grossRevenueMonthly - utilitiesMonthly - ratesInsuranceOtherMonthly - provisionsMonthly;
  const taxMonthly = Math.max(0, (noiMonthly - financeCostMonthly) * ((deal.incomeTaxRate ?? 27) / 100));
  const cashflowMonthly = grossRevenueMonthly - operatingCostsMonthly - provisionsMonthly - taxMonthly;

  const mult = view === "annual" ? 12 : 1;
  const fmt = (n: number) => `R ${(n * mult).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

  // ---- Fix & Flip summary (separate from ongoing cashflow) ----
  const holdingCosts = (Number(v.holdingCostPerMonth) || 0) * (Number(v.holdingPeriodMonths) || 0);
  const agentFee = (Number(v.expectedSalePrice) || 0) * ((deal.agentCommission ?? 0) / 100);
  const flipTotalCost = (deal.purchasePrice ?? 0) + (deal.renovationCost ?? 0) + holdingCosts + agentFee;
  const flipGrossProfit = (Number(v.expectedSalePrice) || 0) - flipTotalCost;
  const flipCgt = Math.max(0, flipGrossProfit * ((deal.capitalGainsTaxRate ?? 22) / 100));
  const flipNetProfit = flipGrossProfit - flipCgt;
  const flipRoi = flipTotalCost ? (flipNetProfit / flipTotalCost) * 100 : 0;

  // ---- Instalment split ----
  const instalmentRateMonthly = (Number(v.instalmentRate) || 0) / 12 / 100;
  const instalmentInterestComponent = (Number(v.instalmentAmount) || 0) > 0
    ? Math.min(Number(v.instalmentAmount) || 0, (deal.purchasePrice ?? 0) * instalmentRateMonthly)
    : 0;
  const instalmentPrincipalComponent = (Number(v.instalmentAmount) || 0) - instalmentInterestComponent;

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

  const tabLabel =
    mode === "flip" ? "Flip Calculator" : mode === "nightly" ? "Rental Income" : mode === "instalment" ? "Instalment Details" : "Cashflow";

  // ================= FIX & FLIP: entirely separate calculator =================
  if (mode === "flip") {
    return (
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="px-4 md:px-8 py-8 max-w-3xl mx-auto flex flex-col gap-8"
      >
        <StrategyHint strategyId={strategy.id} icon={strategy.icon} />
        <p className="font-body text-sm text-av-slate -mt-4">
          This strategy calculates profit at point of sale, not ongoing cashflow.
        </p>

        <section>
          <h2 className="font-display text-xl text-av-navy mb-4">{tabLabel}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField label="Expected Sale Price">
              <CurrencyInput {...register("expectedSalePrice")} />
            </FormField>
            <FormField label="Holding Period (months)">
              <Input type="number" min={1} {...register("holdingPeriodMonths")} />
            </FormField>
            <FormField label="Holding Costs Per Month">
              <CurrencyInput {...register("holdingCostPerMonth")} />
            </FormField>
            <FormField label="Agent Commission on Sale">
              <PercentInput readOnly value={(deal.agentCommission ?? 0).toFixed(2)} />
            </FormField>
            <FormField label="Capital Gains Tax">
              <PercentInput readOnly value={(deal.capitalGainsTaxRate ?? 22).toFixed(2)} />
            </FormField>
          </div>
        </section>

        <section className="rounded-lg border border-av-light-grey p-6 font-body text-sm">
          <div className="flex justify-between py-1">
            <span className="text-av-slate">Purchase Price</span>
            <span className="font-mono">R {(deal.purchasePrice ?? 0).toLocaleString("en-US")}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-av-slate">Total Renovation Cost</span>
            <span className="font-mono">R {(deal.renovationCost ?? 0).toLocaleString("en-US")}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-av-slate">Holding Costs ({v.holdingPeriodMonths} months)</span>
            <span className="font-mono">R {holdingCosts.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-av-light-grey pb-3">
            <span className="text-av-slate">Agent Commission</span>
            <span className="font-mono">R {agentFee.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
          </div>
          <div className="flex justify-between py-2 font-semibold">
            <span>Total Cost</span>
            <span className="font-mono">R {flipTotalCost.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-av-light-grey pb-3">
            <span className="text-av-slate">Expected Sale Price</span>
            <span className="font-mono">R {(Number(v.expectedSalePrice) || 0).toLocaleString("en-US")}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-av-slate">Gross Profit</span>
            <span className="font-mono">R {flipGrossProfit.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-av-light-grey pb-3">
            <span className="text-av-slate">Capital Gains Tax</span>
            <span className="font-mono text-av-red">-R {flipCgt.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
          </div>
          <div className="flex justify-between py-2 text-base font-bold">
            <span>NET PROFIT</span>
            <span className="font-mono text-av-navy">
              R {flipNetProfit.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-av-slate">ROI on Investment</span>
            <span className="font-mono">{flipRoi.toFixed(1)}%</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-av-slate">Annualised ROI</span>
            <span className="font-mono">
              {(Number(v.holdingPeriodMonths) > 0 ? flipRoi / (Number(v.holdingPeriodMonths) / 12) : 0).toFixed(1)}%
            </span>
          </div>
        </section>

        <SaveBar dirty={formState.isDirty} saving={formState.isSubmitting} onSave={handleSubmit(onSubmit)} />
      </form>
    );
  }

  // ================= STANDARD / PER-ROOM / ACADEMIC / NIGHTLY / INSTALMENT =================
  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="px-4 md:px-8 py-8 max-w-3xl mx-auto flex flex-col gap-10"
    >
      <StrategyHint strategyId={strategy.id} icon={strategy.icon} />

      {(mode === "standard" || mode === "per_room") && (
        <MarketIntelligencePanel
          dealId={deal.id}
          strategy={strategy.id}
          isSectionalTitle={deal.isSectionalTitle}
          bedrooms={deal.bedrooms ?? null}
          numUnits={numUnits}
          currentMonthlyRent={mode === "standard" ? Number(v.monthlyRent) || null : (Number(v.pricePerRoom) || 0) * numUnits || null}
          onApplyRent={(rent) => {
            if (mode === "standard") {
              setValue("monthlyRent", Math.round(rent), { shouldDirty: true });
            } else {
              setValue("pricePerRoom", Math.round(rent / Math.max(numUnits, 1)), { shouldDirty: true });
            }
          }}
        />
      )}

      {mode === "student" && (
        <section>
          <h2 className="font-display text-xl text-av-navy mb-4">Room Mix</h2>
          <p className="font-body text-xs text-av-slate -mt-2 mb-4">
            NSFAS pays a flat monthly amount over a {v.nsfasCycleMonths || 10}-month cycle,
            regardless of the academic calendar. Private and bursary students outside NSFAS
            typically pay over a {v.privateCycleMonths || 12}-month cycle. Split each room
            type&apos;s beds between the two below.
          </p>

          <div className="rounded-lg border border-av-light-grey p-5 mb-4">
            <h3 className="font-body text-sm font-semibold text-av-navy mb-3">Single Rooms</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FormField label="Number of Single Rooms">
                <Input type="number" min={0} {...register("singleRoomCount")} />
              </FormField>
              <FormField label="Rent Per Bed (monthly)">
                <CurrencyInput {...register("singleRoomRent")} />
              </FormField>
              <FormField
                label="NSFAS-Funded Beds"
                helperText={`${Math.min(Number(v.singleRoomNsfasBeds) || 0, totalSingleBeds)} of ${totalSingleBeds} beds`}
              >
                <Input type="number" min={0} max={totalSingleBeds} {...register("singleRoomNsfasBeds")} />
              </FormField>
            </div>
          </div>

          <div className="rounded-lg border border-av-light-grey p-5 mb-4">
            <h3 className="font-body text-sm font-semibold text-av-navy mb-3">Sharing Rooms</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <FormField label="Number of Sharing Rooms">
                <Input type="number" min={0} {...register("sharingRoomCount")} />
              </FormField>
              <FormField label="Beds Per Sharing Room">
                <Input type="number" min={2} max={3} {...register("sharingBedsPerRoom")} />
              </FormField>
              <FormField label="Rent Per Bed (monthly)">
                <CurrencyInput {...register("sharingRoomRent")} />
              </FormField>
              <FormField
                label="NSFAS-Funded Beds"
                helperText={`${Math.min(Number(v.sharingRoomNsfasBeds) || 0, totalSharingBeds)} of ${totalSharingBeds} beds`}
              >
                <Input type="number" min={0} max={totalSharingBeds} {...register("sharingRoomNsfasBeds")} />
              </FormField>
            </div>
          </div>

          <NsfasGradingLookup
            onApply={(roomType, rate) => {
              if (roomType === "single") {
                setValue("singleRoomRent", rate, { shouldDirty: true });
              } else {
                setValue("sharingRoomRent", rate, { shouldDirty: true });
              }
            }}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
            <FormField label="NSFAS Cycle (months/year)">
              <Input type="number" min={1} max={12} {...register("nsfasCycleMonths")} />
            </FormField>
            <FormField label="Private / Bursary Cycle (months/year)">
              <Input type="number" min={1} max={12} {...register("privateCycleMonths")} />
            </FormField>
            <FormField label="Occupancy Rate">
              <PercentInput {...register("occupancyRate")} />
            </FormField>
          </div>

          <div className="flex items-center gap-2 mt-4">
            <input
              type="checkbox"
              id="billsIncludedStudent"
              {...register("billsIncluded")}
              className="w-5 h-5 accent-av-gold"
            />
            <label htmlFor="billsIncludedStudent" className="text-sm font-body text-av-slate">
              Bills Included?
            </label>
          </div>
          {v.billsIncluded && (
            <div className="mt-4 max-w-xs">
              <FormField label="Estimated Monthly Bills Per Bed">
                <CurrencyInput
                  {...register("billsIncludedAmount")}
                  placeholder={legacyBillsUnrecorded ? "Not separately recorded" : undefined}
                />
              </FormField>
              {legacyBillsUnrecorded && (
                <p className="text-xs font-body text-av-slate mt-2">
                  This deal had Bills Included switched on before this field existed. Any effect
                  is already reflected in Electricity above — enter an amount here to track it
                  separately going forward.
                </p>
              )}
            </div>
          )}

          <div className="rounded-md bg-av-light-grey p-4 mt-4 font-body text-sm text-av-navy flex flex-col gap-2">
            <div className="flex justify-between">
              <span>Total Beds</span>
              <span className="font-mono font-semibold">
                {totalBeds} ({nsfasSingleBeds + nsfasSharingBeds} NSFAS / {privateSingleBeds + privateSharingBeds} Private)
              </span>
            </div>
            <div className="flex justify-between border-t border-av-light-grey/70 pt-2">
              <span>In-Term Monthly Collection</span>
              <span className="font-mono font-semibold">
                R {inTermMonthlyRevenue.toLocaleString("en-US", { maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Effective Monthly Revenue (Annualised Average)</span>
              <span className="font-mono font-semibold">
                R {baseMonthlyRevenue.toLocaleString("en-US", { maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
          {(nsfasSingleBeds + nsfasSharingBeds > 0) && nsfasMonths < 12 && (
            <p className="text-xs font-body text-av-slate mt-2">
              These differ because NSFAS-funded beds pay for {nsfasMonths} of 12 months a year.
              &quot;In-Term Monthly Collection&quot; is what you&apos;d receive during a paying
              month. &quot;Effective Monthly Revenue&quot; spreads the true annual total evenly
              across all 12 months — this is the figure used everywhere else on this page and in
              your yield, IRR, and cashflow metrics, so those numbers reflect the real annual
              income rather than overstating it by assuming every bed pays year-round.
            </p>
          )}

          <div className="mt-4">
            <MarketIntelligencePanel
              dealId={deal.id}
              strategy={strategy.id}
              isSectionalTitle={deal.isSectionalTitle}
              bedrooms={deal.bedrooms ?? null}
              numUnits={numUnits}
              studentRoomMix={{
                singleRoomCount: totalSingleBeds,
                sharingRoomCount: Number(v.sharingRoomCount) || 0,
                sharingBedsPerRoom: Number(v.sharingBedsPerRoom) || 0,
              }}
              currentMonthlyRent={
                totalBeds > 0
                  ? totalSingleBeds * (Number(v.singleRoomRent) || 0) +
                    totalSharingBeds * (Number(v.sharingRoomRent) || 0)
                  : null
              }
            />
          </div>
        </section>
      )}

      <section>
        <h2 className="font-display text-xl text-av-navy mb-4">{tabLabel} (monthly)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {mode === "standard" && (
            <>
              <FormField label="Monthly Rent">
                <CurrencyInput {...register("monthlyRent")} />
              </FormField>
              <FormField label="Occupancy Rate">
                <PercentInput {...register("occupancyRate")} />
              </FormField>
              {strategy.id === "commercial" && (
                <FormField
                  label="Remaining Lease Term"
                  helperText="How many months remain on the current or expected main commercial lease? Leave blank if unknown."
                >
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    placeholder="months"
                    {...register("leaseTermMonths")}
                  />
                </FormField>
              )}
            </>
          )}

          {mode === "per_room" && (
            <>
              <FormField label="Number of Rooms">
                <Input type="number" readOnly value={numUnits} />
              </FormField>
              <FormField label="Rent Per Room (monthly)">
                <CurrencyInput {...register("pricePerRoom")} />
              </FormField>
              <FormField label="Occupancy Rate">
                <PercentInput {...register("occupancyRate")} />
              </FormField>
              <div className="flex items-center gap-2 pt-7">
                <input
                  type="checkbox"
                  id="billsIncluded"
                  {...register("billsIncluded")}
                  className="w-5 h-5 accent-av-gold"
                />
                <label htmlFor="billsIncluded" className="text-sm font-body text-av-slate">
                  Bills Included?
                </label>
              </div>
              {v.billsIncluded && (
                <div>
                  <FormField label="Estimated Monthly Bills Per Room">
                    <CurrencyInput
                      {...register("billsIncludedAmount")}
                      placeholder={legacyBillsUnrecorded ? "Not separately recorded" : undefined}
                    />
                  </FormField>
                  {legacyBillsUnrecorded && (
                    <p className="text-xs font-body text-av-slate mt-2">
                      This deal had Bills Included switched on before this field existed. Any
                      effect is already reflected in Electricity above — enter an amount here to
                      track it separately going forward.
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {mode === "nightly" && (
            <>
              <FormField label="Nightly Rate">
                <CurrencyInput {...register("nightlyRate")} />
              </FormField>
              <FormField
                label="Average Occupied Nights Per Year"
                helperText={`Effective occupancy: ${(((Number(v.avgOccupiedNights) || 0) / 365) * 100).toFixed(0)}% (${v.avgOccupiedNights} of 365 nights)`}
              >
                <Input type="number" min={0} max={365} {...register("avgOccupiedNights")} />
              </FormField>
              <FormField label="Platform / Management Fees">
                <PercentInput {...register("platformFeesPct")} />
              </FormField>
            </>
          )}

          {mode === "instalment" && (
            <>
              <FormField label="Monthly Instalment Received">
                <CurrencyInput {...register("instalmentAmount")} />
              </FormField>
              <FormField label="Agreement Term (months)">
                <Input type="number" min={1} {...register("instalmentTerm")} />
              </FormField>
              <FormField label="Implicit Interest Rate">
                <PercentInput {...register("instalmentRate")} />
              </FormField>
              <div />
              <FormField label="Interest Component / month">
                <CurrencyInput readOnly value={instalmentInterestComponent.toFixed(2)} />
              </FormField>
              <FormField label="Principal Component / month">
                <CurrencyInput readOnly value={instalmentPrincipalComponent.toFixed(2)} />
              </FormField>
              <p className="md:col-span-2 text-xs font-body text-av-slate">
                In an ISA, you remain the registered owner until the final instalment is paid.
              </p>
            </>
          )}

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
        <h2 className="font-display text-xl text-av-navy mb-4">Expenses (monthly)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {mode === "nightly" ? (
            <FormField label="Cleaning & Laundry">
              <CurrencyInput {...register("securityCleaning")} />
            </FormField>
          ) : (
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
          )}
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
          {mode !== "nightly" && (
            <FormField label="Security and Cleaning">
              <CurrencyInput {...register("securityCleaning")} />
            </FormField>
          )}
          <FormField label="Electricity">
            <CurrencyInput {...register("electricity")} />
          </FormField>
          <FormField label="Finance Cost">
            <CurrencyInput readOnly value={financeCostMonthly.toFixed(2)} />
          </FormField>
          <FormField label="Bad Debts Provision">
            <PercentInput {...register("badDebtsPct")} />
          </FormField>
          {mode === "student" && (
            <>
              <FormField label="House Parent / Caretaker">
                <CurrencyInput {...register("houseParentCost")} />
              </FormField>
              <FormField label="Internet Services">
                <CurrencyInput {...register("internetCost")} />
              </FormField>
              <FormField label="Netflix">
                <CurrencyInput {...register("netflixCost")} />
              </FormField>
              <FormField label="Gas Refill">
                <CurrencyInput {...register("gasRefillCost")} />
              </FormField>
              <FormField label="Private Waste Removal">
                <CurrencyInput {...register("wasteRemovalCost")} />
              </FormField>
            </>
          )}
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
                  view === v2 ? "bg-av-navy text-white" : "bg-white text-av-slate hover:bg-av-light-grey"
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
            <div className="font-mono text-lg text-av-navy mb-2">{fmt(grossRevenueMonthly)}</div>
            <div className="flex justify-between text-av-slate">
              <span>Base Revenue</span>
              <span className="font-mono">{fmt(baseMonthlyRevenue)}</span>
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
            <div className="font-mono text-lg text-av-navy mb-2">{fmt(operatingCostsMonthly)}</div>
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
            <div className="font-mono text-lg text-av-navy mb-2">{fmt(provisionsMonthly)}</div>
            <div className="flex justify-between text-av-slate">
              <span>{mode === "nightly" ? "Platform Fees" : "Management"}</span>
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
            <span className="font-mono font-semibold text-av-navy">{fmt(taxMonthly)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-av-slate">Cashflow</span>
            <span className="font-mono font-semibold text-av-navy">
              {fmt(cashflowMonthly)}
            </span>
          </div>
        </div>
      </section>

      <SaveBar dirty={formState.isDirty} saving={formState.isSubmitting} onSave={handleSubmit(onSubmit)} />
    </form>
  );
}
