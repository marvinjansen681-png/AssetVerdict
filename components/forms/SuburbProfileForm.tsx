"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import Input from "@/components/ui/Input";
import FormField from "@/components/ui/FormField";
import PercentInput from "@/components/ui/PercentInput";
import CurrencyInput from "@/components/ui/CurrencyInput";
import Button from "@/components/ui/Button";
import AccordionSection from "@/components/ui/AccordionSection";
import { useToast } from "@/components/ui/Toast";
import type { SuburbProfile } from "@/types";

const REPORT_TYPES = [
  { value: "suburb", label: "Suburb Investor Report" },
  { value: "multiple_suburbs", label: "Multiple Suburbs Investor Report" },
  { value: "province", label: "Province Investor Report" },
];

const TREND_OPTIONS = [">10%Up", "Up", "None", "Down", ">10%Down"];

interface SuburbProfileFormValues {
  suburbName: string;
  city: string;
  province: string;
  reportType: string;
  reportDate: string;
  reportYear: number | "";
  notes: string;

  paidOnTimePct: number | "";
  gracePeriodPct: number | "";
  paidLatePct: number | "";
  partialPaymentPct: number | "";
  didNotPayPct: number | "";
  goodStandingPct: number | "";
  provinceGoodStandingPct: number | "";
  nationalGoodStandingPct: number | "";

  stGrossYield: number | "";
  stEffectiveYield: number | "";
  fhGrossYield: number | "";
  fhEffectiveYield: number | "";
  nationalGrossYield: number | "";

  stSmallBedLow: number | "";
  stSmallBedAvg: number | "";
  stSmallBedHigh: number | "";
  st2BedLow: number | "";
  st2BedAvg: number | "";
  st2BedHigh: number | "";
  stLargeBedLow: number | "";
  stLargeBedAvg: number | "";
  stLargeBedHigh: number | "";
  stRentalTrend: string;

  fhSmallBedLow: number | "";
  fhSmallBedAvg: number | "";
  fhSmallBedHigh: number | "";
  fh3BedLow: number | "";
  fh3BedAvg: number | "";
  fh3BedHigh: number | "";
  fhLargeBedLow: number | "";
  fhLargeBedAvg: number | "";
  fhLargeBedHigh: number | "";
  fhRentalTrend: string;

  stAvgPurchasePrice: number | "";
  fhAvgPurchasePrice: number | "";
  stTransactionVolume: number | "";
  fhTransactionVolume: number | "";
  investmentPropertyPct: number | "";

  formalSectorPct: number | "";
  unemployedPct: number | "";
  incomeMiddleBandPct: number | "";
  incomeHighBandPct: number | "";
  age17to25Pct: number | "";
  age26to40Pct: number | "";
  age41to60Pct: number | "";
  largeHouseholdPct: number | "";
  singlePersonHouseholdPct: number | "";

  provinceSTGrossYield: number | "";
  provinceFHGrossYield: number | "";
  provinceST2BedAvgRent: number | "";
  provinceFH3BedAvgRent: number | "";
  provinceSTLargeBedAvg: number | "";
  provinceFHLargeBedAvg: number | "";
}

function toDateInput(value?: string | Date | null) {
  if (!value) return "";
  const d = new Date(value);
  return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

function num(value: number | null | undefined): number | "" {
  return value === null || value === undefined ? "" : value;
}

function defaultsFrom(profile: SuburbProfile | null): SuburbProfileFormValues {
  return {
    suburbName: profile?.suburbName ?? "",
    city: profile?.city ?? "",
    province: profile?.province ?? "",
    reportType: profile?.reportType ?? "suburb",
    reportDate: toDateInput(profile?.reportDate),
    reportYear: num(profile?.reportYear),
    notes: profile?.notes ?? "",

    paidOnTimePct: num(profile?.paidOnTimePct),
    gracePeriodPct: num(profile?.gracePeriodPct),
    paidLatePct: num(profile?.paidLatePct),
    partialPaymentPct: num(profile?.partialPaymentPct),
    didNotPayPct: num(profile?.didNotPayPct),
    goodStandingPct: num(profile?.goodStandingPct),
    provinceGoodStandingPct: num(profile?.provinceGoodStandingPct),
    nationalGoodStandingPct: num(profile?.nationalGoodStandingPct),

    stGrossYield: num(profile?.stGrossYield),
    stEffectiveYield: num(profile?.stEffectiveYield),
    fhGrossYield: num(profile?.fhGrossYield),
    fhEffectiveYield: num(profile?.fhEffectiveYield),
    nationalGrossYield: num(profile?.nationalGrossYield),

    stSmallBedLow: num(profile?.stSmallBedLow),
    stSmallBedAvg: num(profile?.stSmallBedAvg),
    stSmallBedHigh: num(profile?.stSmallBedHigh),
    st2BedLow: num(profile?.st2BedLow),
    st2BedAvg: num(profile?.st2BedAvg),
    st2BedHigh: num(profile?.st2BedHigh),
    stLargeBedLow: num(profile?.stLargeBedLow),
    stLargeBedAvg: num(profile?.stLargeBedAvg),
    stLargeBedHigh: num(profile?.stLargeBedHigh),
    stRentalTrend: profile?.stRentalTrend ?? "",

    fhSmallBedLow: num(profile?.fhSmallBedLow),
    fhSmallBedAvg: num(profile?.fhSmallBedAvg),
    fhSmallBedHigh: num(profile?.fhSmallBedHigh),
    fh3BedLow: num(profile?.fh3BedLow),
    fh3BedAvg: num(profile?.fh3BedAvg),
    fh3BedHigh: num(profile?.fh3BedHigh),
    fhLargeBedLow: num(profile?.fhLargeBedLow),
    fhLargeBedAvg: num(profile?.fhLargeBedAvg),
    fhLargeBedHigh: num(profile?.fhLargeBedHigh),
    fhRentalTrend: profile?.fhRentalTrend ?? "",

    stAvgPurchasePrice: num(profile?.stAvgPurchasePrice),
    fhAvgPurchasePrice: num(profile?.fhAvgPurchasePrice),
    stTransactionVolume: num(profile?.stTransactionVolume),
    fhTransactionVolume: num(profile?.fhTransactionVolume),
    investmentPropertyPct: num(profile?.investmentPropertyPct),

    formalSectorPct: num(profile?.formalSectorPct),
    unemployedPct: num(profile?.unemployedPct),
    incomeMiddleBandPct: num(profile?.incomeMiddleBandPct),
    incomeHighBandPct: num(profile?.incomeHighBandPct),
    age17to25Pct: num(profile?.age17to25Pct),
    age26to40Pct: num(profile?.age26to40Pct),
    age41to60Pct: num(profile?.age41to60Pct),
    largeHouseholdPct: num(profile?.largeHouseholdPct),
    singlePersonHouseholdPct: num(profile?.singlePersonHouseholdPct),

    provinceSTGrossYield: num(profile?.provinceSTGrossYield),
    provinceFHGrossYield: num(profile?.provinceFHGrossYield),
    provinceST2BedAvgRent: num(profile?.provinceST2BedAvgRent),
    provinceFH3BedAvgRent: num(profile?.provinceFH3BedAvgRent),
    provinceSTLargeBedAvg: num(profile?.provinceSTLargeBedAvg),
    provinceFHLargeBedAvg: num(profile?.provinceFHLargeBedAvg),
  };
}

const STRING_KEYS = new Set([
  "suburbName",
  "city",
  "province",
  "reportType",
  "reportDate",
  "notes",
  "stRentalTrend",
  "fhRentalTrend",
]);

function toPayload(data: SuburbProfileFormValues) {
  const payload: Record<string, unknown> = { ...data };
  for (const key of Object.keys(payload)) {
    const value = payload[key];
    if (value === "") {
      payload[key] = null;
    } else if (!STRING_KEYS.has(key) && typeof value === "string") {
      payload[key] = Number(value);
    }
  }
  if (!payload.reportDate) delete payload.reportDate;
  if (payload.city === null) delete payload.city;
  return payload;
}

interface SuburbProfileFormProps {
  profile?: SuburbProfile | null;
}

export default function SuburbProfileForm({ profile = null }: SuburbProfileFormProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<SuburbProfileFormValues>({ defaultValues: defaultsFrom(profile) });

  async function onSubmit(data: SuburbProfileFormValues) {
    const payload = toPayload(data);
    const res = await fetch(profile ? `/api/suburbs/${profile.id}` : "/api/suburbs", {
      method: profile ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      showToast("error", "Could not save suburb profile.");
      return;
    }

    const saved = await res.json();
    showToast("success", "Suburb profile saved");
    router.push(`/suburbs/${saved.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <AccordionSection title="Report Identity" subtitle="Suburb, province, and report source" defaultOpen>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField label="Suburb Name">
            <Input {...register("suburbName", { required: true })} placeholder="e.g. Bethelsdorp" />
          </FormField>
          <FormField label="Report Type">
            <select
              {...register("reportType")}
              className="w-full rounded-md border border-av-light-grey bg-white px-3 py-2.5 min-h-[44px] font-body text-sm text-av-navy focus:outline-none focus:border-av-gold focus:ring-1 focus:ring-av-gold"
            >
              {REPORT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="City / Metro">
            <Input {...register("city")} />
          </FormField>
          <FormField label="Province">
            <Input {...register("province")} placeholder="e.g. Eastern Cape" />
          </FormField>
          <FormField label="Report Date">
            <Input type="date" {...register("reportDate")} />
          </FormField>
          <FormField label="Report Year">
            <Input type="number" {...register("reportYear")} />
          </FormField>
          <FormField label="Notes">
            <Input {...register("notes")} placeholder="Optional" />
          </FormField>
        </div>
      </AccordionSection>

      <AccordionSection title="Rental Payment Index" subtitle="Suburb vs. province vs. national good standing">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FormField label="Paid On Time %"><PercentInput {...register("paidOnTimePct")} /></FormField>
          <FormField label="Grace Period %"><PercentInput {...register("gracePeriodPct")} /></FormField>
          <FormField label="Paid Late %"><PercentInput {...register("paidLatePct")} /></FormField>
          <FormField label="Partial Payment %"><PercentInput {...register("partialPaymentPct")} /></FormField>
          <FormField label="Did Not Pay %"><PercentInput {...register("didNotPayPct")} /></FormField>
          <FormField label="Good Standing % (Suburb)"><PercentInput {...register("goodStandingPct")} /></FormField>
          <FormField label="Good Standing % (Province)"><PercentInput {...register("provinceGoodStandingPct")} /></FormField>
          <FormField label="Good Standing % (National)"><PercentInput {...register("nationalGoodStandingPct")} /></FormField>
        </div>
      </AccordionSection>

      <AccordionSection title="Residential Yield" subtitle="Gross and effective yield, ST and FH">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FormField label="ST Gross Yield %"><PercentInput {...register("stGrossYield")} /></FormField>
          <FormField label="ST Effective Yield %"><PercentInput {...register("stEffectiveYield")} /></FormField>
          <FormField label="FH Gross Yield %"><PercentInput {...register("fhGrossYield")} /></FormField>
          <FormField label="FH Effective Yield %"><PercentInput {...register("fhEffectiveYield")} /></FormField>
          <FormField label="National Gross Yield %"><PercentInput {...register("nationalGrossYield")} /></FormField>
        </div>
      </AccordionSection>

      <AccordionSection title="Rental Price Trends — Sectional Title" subtitle="Low / Avg / High rent by bedroom band">
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FormField label="<2Bed Low"><CurrencyInput {...register("stSmallBedLow")} /></FormField>
            <FormField label="<2Bed Avg"><CurrencyInput {...register("stSmallBedAvg")} /></FormField>
            <FormField label="<2Bed High"><CurrencyInput {...register("stSmallBedHigh")} /></FormField>
            <FormField label="2Bed Low"><CurrencyInput {...register("st2BedLow")} /></FormField>
            <FormField label="2Bed Avg"><CurrencyInput {...register("st2BedAvg")} /></FormField>
            <FormField label="2Bed High"><CurrencyInput {...register("st2BedHigh")} /></FormField>
            <FormField label=">2Bed Low"><CurrencyInput {...register("stLargeBedLow")} /></FormField>
            <FormField label=">2Bed Avg"><CurrencyInput {...register("stLargeBedAvg")} /></FormField>
            <FormField label=">2Bed High"><CurrencyInput {...register("stLargeBedHigh")} /></FormField>
          </div>
          <FormField label="ST Rental Price Trend">
            <select
              {...register("stRentalTrend")}
              className="w-full rounded-md border border-av-light-grey bg-white px-3 py-2.5 min-h-[44px] font-body text-sm text-av-navy focus:outline-none focus:border-av-gold focus:ring-1 focus:ring-av-gold md:w-64"
            >
              <option value="">Unspecified</option>
              {TREND_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </FormField>
        </div>
      </AccordionSection>

      <AccordionSection title="Rental Price Trends — Freehold" subtitle="Low / Avg / High rent by bedroom band">
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FormField label="<3Bed Low"><CurrencyInput {...register("fhSmallBedLow")} /></FormField>
            <FormField label="<3Bed Avg"><CurrencyInput {...register("fhSmallBedAvg")} /></FormField>
            <FormField label="<3Bed High"><CurrencyInput {...register("fhSmallBedHigh")} /></FormField>
            <FormField label="3Bed Low"><CurrencyInput {...register("fh3BedLow")} /></FormField>
            <FormField label="3Bed Avg"><CurrencyInput {...register("fh3BedAvg")} /></FormField>
            <FormField label="3Bed High"><CurrencyInput {...register("fh3BedHigh")} /></FormField>
            <FormField label=">3Bed Low"><CurrencyInput {...register("fhLargeBedLow")} /></FormField>
            <FormField label=">3Bed Avg"><CurrencyInput {...register("fhLargeBedAvg")} /></FormField>
            <FormField label=">3Bed High"><CurrencyInput {...register("fhLargeBedHigh")} /></FormField>
          </div>
          <FormField label="FH Rental Price Trend">
            <select
              {...register("fhRentalTrend")}
              className="w-full rounded-md border border-av-light-grey bg-white px-3 py-2.5 min-h-[44px] font-body text-sm text-av-navy focus:outline-none focus:border-av-gold focus:ring-1 focus:ring-av-gold md:w-64"
            >
              <option value="">Unspecified</option>
              {TREND_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </FormField>
        </div>
      </AccordionSection>

      <AccordionSection title="Property Transactions & Investment Activity">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FormField label="ST Avg Purchase Price"><CurrencyInput {...register("stAvgPurchasePrice")} /></FormField>
          <FormField label="FH Avg Purchase Price"><CurrencyInput {...register("fhAvgPurchasePrice")} /></FormField>
          <FormField label="Investment Property %"><PercentInput {...register("investmentPropertyPct")} /></FormField>
          <FormField label="ST Transaction Volume"><Input type="number" {...register("stTransactionVolume")} /></FormField>
          <FormField label="FH Transaction Volume"><Input type="number" {...register("fhTransactionVolume")} /></FormField>
        </div>
      </AccordionSection>

      <AccordionSection title="Demographics" subtitle="Employment, income, age, and household composition">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FormField label="Formal Sector %"><PercentInput {...register("formalSectorPct")} /></FormField>
          <FormField label="Unemployed %"><PercentInput {...register("unemployedPct")} /></FormField>
          <FormField label="Income R76k-R307k %"><PercentInput {...register("incomeMiddleBandPct")} /></FormField>
          <FormField label="Income R307k+ %"><PercentInput {...register("incomeHighBandPct")} /></FormField>
          <FormField label="Age 17-25 %"><PercentInput {...register("age17to25Pct")} /></FormField>
          <FormField label="Age 26-40 %"><PercentInput {...register("age26to40Pct")} /></FormField>
          <FormField label="Age 41-60 %"><PercentInput {...register("age41to60Pct")} /></FormField>
          <FormField label="Large Household (6+) %"><PercentInput {...register("largeHouseholdPct")} /></FormField>
          <FormField label="Single Person Household %"><PercentInput {...register("singlePersonHouseholdPct")} /></FormField>
        </div>
      </AccordionSection>

      <AccordionSection title="Province / National Benchmarks" subtitle="Tier 3 context for fallback comparisons">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FormField label="Province ST Gross Yield %"><PercentInput {...register("provinceSTGrossYield")} /></FormField>
          <FormField label="Province FH Gross Yield %"><PercentInput {...register("provinceFHGrossYield")} /></FormField>
          <FormField label="Province ST 2Bed Avg Rent"><CurrencyInput {...register("provinceST2BedAvgRent")} /></FormField>
          <FormField label="Province FH 3Bed Avg Rent"><CurrencyInput {...register("provinceFH3BedAvgRent")} /></FormField>
          <FormField label="Province ST >2Bed Avg"><CurrencyInput {...register("provinceSTLargeBedAvg")} /></FormField>
          <FormField label="Province FH >3Bed Avg"><CurrencyInput {...register("provinceFHLargeBedAvg")} /></FormField>
        </div>
      </AccordionSection>

      <div className="flex justify-end gap-3 pb-8">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : profile ? "Save Changes" : "Create Suburb Profile"}
        </Button>
      </div>
    </form>
  );
}
