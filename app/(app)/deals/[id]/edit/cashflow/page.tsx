"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { mutate as globalMutate } from "swr";
import { useDeal } from "@/lib/DealContext";
import { useToast } from "@/components/ui/Toast";
import {
  calcRevenueMonthly,
  calcEffectiveMonthlyRevenue,
  calcProvisionsMonthly,
  calcOperatingCostsMonthly,
  calcTaxMonthly,
  calcCashflowMonthly,
  calcFlipProfit,
} from "@/lib/calculations";
import { buildPreviewInputs } from "@/lib/calculations/previewInputs";
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

  // ---- Authoritative preview (Phase 4.21) ----
  // Build a temporary DealInputs from the live, unsaved form values and run
  // it through the SAME calculation engine every other surface uses — this
  // component must never re-derive NOI, tax, cashflow, or Fix & Flip profit
  // itself. See lib/calculations/previewInputs.ts. Every value rendered
  // below is read straight off calcAllMetrics()'s own building blocks, so it
  // is structurally guaranteed to reconcile with the Deal Summary/PDF/Deal
  // Coach once this form is saved — see
  // lib/calculations/__tests__/previewInputs.test.ts's parity tests.
  const previewInputs = buildPreviewInputs(deal, {
    monthlyRent: Number(v.monthlyRent) || 0,
    occupancyRate: Number(v.occupancyRate) || 0,
    additionalIncome: Number(v.additionalIncome) || 0,
    recoveries: Number(v.recoveries) || 0,
    managementFeeMode: v.managementFeeMode,
    managementFeeValue: Number(v.managementFeeValue) || 0,
    maintenanceCostMode: v.maintenanceCostMode,
    maintenanceCostValue: Number(v.maintenanceCostValue) || 0,
    levies: Number(v.levies) || 0,
    ratesAndTaxes: Number(v.ratesAndTaxes) || 0,
    insurance: Number(v.insurance) || 0,
    waterSewerage: Number(v.waterSewerage) || 0,
    securityCleaning: Number(v.securityCleaning) || 0,
    electricity: Number(v.electricity) || 0,
    badDebtsPct: Number(v.badDebtsPct) || 0,
    nightlyRate: Number(v.nightlyRate) || 0,
    avgOccupiedNights: Number(v.avgOccupiedNights) || 0,
    platformFeesPct: Number(v.platformFeesPct) || 0,
    billsIncluded: Boolean(v.billsIncluded),
    billsIncludedAmount:
      v.billsIncludedAmount === null || v.billsIncludedAmount === undefined
        ? null
        : Number(v.billsIncludedAmount) || 0,
    pricePerRoom: Number(v.pricePerRoom) || 0,
    singleRoomCount: Number(v.singleRoomCount) || 0,
    singleRoomRent: Number(v.singleRoomRent) || 0,
    singleRoomNsfasBeds: Number(v.singleRoomNsfasBeds) || 0,
    sharingRoomCount: Number(v.sharingRoomCount) || 0,
    sharingBedsPerRoom: Number(v.sharingBedsPerRoom) || 0,
    sharingRoomRent: Number(v.sharingRoomRent) || 0,
    sharingRoomNsfasBeds: Number(v.sharingRoomNsfasBeds) || 0,
    nsfasCycleMonths: Number(v.nsfasCycleMonths) || 10,
    privateCycleMonths: Number(v.privateCycleMonths) || 12,
    houseParentCost: Number(v.houseParentCost) || 0,
    internetCost: Number(v.internetCost) || 0,
    netflixCost: Number(v.netflixCost) || 0,
    gasRefillCost: Number(v.gasRefillCost) || 0,
    wasteRemovalCost: Number(v.wasteRemovalCost) || 0,
    holdingPeriodMonths: Number(v.holdingPeriodMonths) || 0,
    expectedSalePrice: Number(v.expectedSalePrice) || 0,
    holdingCostPerMonth: Number(v.holdingCostPerMonth) || 0,
    instalmentAmount: Number(v.instalmentAmount) || 0,
    instalmentTerm: Number(v.instalmentTerm) || 0,
    instalmentRate: Number(v.instalmentRate) || 0,
  });

  const revenueMonthly = calcRevenueMonthly(previewInputs);
  const effectiveMonthlyRevenue = calcEffectiveMonthlyRevenue(previewInputs);
  const provisions = calcProvisionsMonthly(previewInputs);
  const operatingCosts = calcOperatingCostsMonthly(previewInputs);
  const taxMonthly = calcTaxMonthly(previewInputs);
  const cashflowMonthly = calcCashflowMonthly(previewInputs);

  const baseMonthlyRevenue = revenueMonthly.rentalIncome;
  const grossRevenueMonthly = effectiveMonthlyRevenue;
  const managementFeeMonthly = provisions.management;
  const maintenanceCostMonthly = provisions.maintenance;
  const badDebtsMonthly = provisions.badDebts;
  const utilitiesMonthly = operatingCosts.utilities;
  const ratesInsuranceOtherMonthly = operatingCosts.ratesInsuranceOther;
  const financeCostMonthly = operatingCosts.finance;
  const operatingCostsMonthly = operatingCosts.total;
  const provisionsMonthly = provisions.total;

  const mult = view === "annual" ? 12 : 1;
  const fmt = (n: number) => `R ${(n * mult).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

  // ---- Fix & Flip summary (Phase 4.21 — delegated entirely to calcFlipProfit,
  // the one authoritative Fix & Flip engine; see the "flip" JSX branch below
  // for the pre-tax, no-CGT presentation this now produces). ----
  const flip = calcFlipProfit(previewInputs);

  // ---- Instalment split ----
  // Illustrative estimate only (Phase 4.21 audit) — instalmentRate and
  // instalmentTerm are captured but NOT consumed anywhere in
  // lib/calculations' authoritative model (calcBaseMonthlyRevenue treats an
  // Instalment Sale as a flat monthly instalmentAmount only). This
  // principal/interest split is a simplistic, presentation-only estimate,
  // never an authoritative Instalment Sale amortisation — it is explicitly
  // labelled as such below, and the deal's verdict remains unavailable for
  // this strategy (see VERDICT_ENABLED_STRATEGIES in lib/calculations/verdict.ts)
  // until a genuine seller-finance model is built.
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
          </div>
        </section>

        {/* Phase 4.21 — sourced entirely from calcFlipProfit(previewInputs),
            the same authoritative Fix & Flip engine the Deal Summary/PDF
            read. No formula is re-derived here. Pre-tax, no CGT deducted —
            see FixFlipAnalysis.modelAssumptions.taxAssumption / FlipMetrics
            netProfit's own doc comment (lib/calculations/index.ts) for why. */}
        <section className="rounded-lg border border-av-light-grey p-6 font-body text-sm">
          <div className="flex justify-between py-1">
            <span className="text-av-slate">Purchase Price</span>
            <span className="font-mono">R {flip.purchasePrice.toLocaleString("en-US")}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-av-slate">Acquisition Costs (Transfer, Bond &amp; Sourcing)</span>
            <span className="font-mono">R {flip.acquisitionCosts.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-av-slate">Total Renovation Cost</span>
            <span className="font-mono">R {flip.renovationCost.toLocaleString("en-US")}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-av-slate">Holding Costs ({v.holdingPeriodMonths} months)</span>
            <span className="font-mono">R {flip.holdingCosts.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-av-slate">Financing Interest During Hold</span>
            <span className="font-mono">R {flip.financingInterest.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-av-light-grey pb-3">
            <span className="text-av-slate">Agent Commission</span>
            <span className="font-mono">R {flip.agentFee.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
          </div>
          <div className="flex justify-between py-2 font-semibold">
            <span>Total Cost</span>
            <span className="font-mono">R {flip.totalCost.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-av-light-grey pb-3">
            <span className="text-av-slate">Expected Sale Price</span>
            <span className="font-mono">R {flip.expectedSalePrice.toLocaleString("en-US")}</span>
          </div>
          <div className="flex justify-between py-2 text-base font-bold">
            <span>ESTIMATED PROFIT BEFORE TAX</span>
            <span className="font-mono text-av-navy">
              R {flip.netProfit.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-av-slate">Pre-Tax ROI</span>
            <span className="font-mono">{flip.roi.toFixed(1)}%</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-av-slate">Annualised Pre-Tax ROI</span>
            <span className="font-mono">
              {flip.annualisedROI === null ? "N/A" : `${flip.annualisedROI.toFixed(1)}%`}
            </span>
          </div>
          <p className="text-xs font-body text-av-slate/80 pt-3">
            AssetVerdict currently reports Fix &amp; Flip returns before tax. Loan principal is
            never treated as a project expense — see Financing on the Deal Summary for the full
            debt breakdown. The tax character of a property disposal (capital gain vs. revenue)
            depends on the transaction&apos;s own facts and is not determined by this model.
          </p>
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
          {(nsfasSingleBeds + nsfasSharingBeds > 0) && (privateSingleBeds + privateSharingBeds > 0) && (
            <p className="text-xs font-body text-av-orange mt-2">
              Known limitation: AssetVerdict currently uses ONE rent per room type (Single / Sharing)
              for both NSFAS and private/bursary beds. If your private-market rent actually differs
              from your NSFAS rate, this mix will not capture that difference — revenue may be over-
              or understated for whichever funding type the entered rent doesn&apos;t match. Separate
              NSFAS/private rates per room type are not yet supported.
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
              <FormField label="Interest Component / month (illustrative)">
                <CurrencyInput readOnly value={instalmentInterestComponent.toFixed(2)} />
              </FormField>
              <FormField label="Principal Component / month (illustrative)">
                <CurrencyInput readOnly value={instalmentPrincipalComponent.toFixed(2)} />
              </FormField>
              <p className="md:col-span-2 text-xs font-body text-av-slate">
                This principal/interest split is an illustrative estimate only, not sourced from
                AssetVerdict&apos;s authoritative calculation engine — Instalment Sale does not
                yet have a full seller-finance model, so an Overall Verdict is not available for
                this strategy.
              </p>
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
