"use client";

import { useForm } from "react-hook-form";
import { mutate as globalMutate } from "swr";
import { useDeal } from "@/lib/DealContext";
import { useToast } from "@/components/ui/Toast";
import SaveBar from "@/components/forms/SaveBar";
import FormField from "@/components/ui/FormField";
import Input from "@/components/ui/Input";
import StrategySelector from "@/components/StrategySelector";
import { getStrategy, type StrategyId } from "@/lib/strategies";

const PROPERTY_TYPES = [
  "Commercial",
  "Residential",
  "Industrial",
  "Mixed Use",
  "Retail",
  "Office",
];

const CURRENCIES = ["ZAR", "USD", "EUR", "GBP", "AUD"];

const PROPERTY_ZONINGS = [
  "Residential 1 (R1)",
  "Residential 2 (R2)",
  "Residential 3 (R3)",
  "Residential 4 (R4)",
  "Business 1 (B1)",
  "Business 2 (B2)",
  "Business 3 (B3)",
  "Business 4 (B4)",
  "Industrial 1 (I1)",
  "Industrial 2 (I2)",
  "Industrial 3 (I3)",
  "Agricultural (AG)",
  "Special (SP)",
  "Public Open Space",
  "Mixed Use",
];

const RESIDENTIAL_STRATEGIES: StrategyId[] = [
  "buy_to_let",
  "multi_let",
  "student",
  "str",
  "fix_and_flip",
];
const UNIT_COUNT_STRATEGIES: StrategyId[] = ["multi_let", "student", "commercial"];

interface IntroForm {
  name: string;
  propertyType: string;
  investmentStrategy: StrategyId;
  address: string;
  city: string;
  notes: string;
  currency: string;
  erfNumber: string;
  titleDeedNumber: string;
  erfSize: number | string;
  floorSize: number | string;
  propertyZoning: string;
  yearBuilt: number | string;
  ratesAccountNumber: string;
  isSectionalTitle: boolean;
  unitNumber: string;
  schemeName: string;
  schemeLevy: number | string;
  bedrooms: number | string;
  bathrooms: number | string;
  garages: number | string;
  numUnits: number | string;
}

export default function IntroductionTab() {
  const { deal, refreshDeal } = useDeal();
  const { showToast } = useToast();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { isDirty, isSubmitting },
    reset,
  } = useForm<IntroForm>({
    defaultValues: {
      name: deal.name,
      propertyType: deal.propertyType ?? "Commercial",
      investmentStrategy: (deal.investmentStrategy as StrategyId) ?? "commercial",
      address: deal.address ?? "",
      city: deal.city ?? "",
      notes: deal.notes ?? "",
      currency: deal.currency,
      erfNumber: deal.erfNumber ?? "",
      titleDeedNumber: deal.titleDeedNumber ?? "",
      erfSize: deal.erfSize ?? "",
      floorSize: deal.floorSize ?? "",
      propertyZoning: deal.propertyZoning ?? "",
      yearBuilt: deal.yearBuilt ?? "",
      ratesAccountNumber: deal.ratesAccountNumber ?? "",
      isSectionalTitle: deal.isSectionalTitle ?? false,
      unitNumber: deal.unitNumber ?? "",
      schemeName: deal.schemeName ?? "",
      schemeLevy: deal.schemeLevy ?? "",
      bedrooms: deal.bedrooms ?? "",
      bathrooms: deal.bathrooms ?? "",
      garages: deal.garages ?? "",
      numUnits: deal.numUnits ?? 1,
    },
  });

  const strategyId = watch("investmentStrategy");
  const strategy = getStrategy(strategyId);
  const isSectionalTitle = watch("isSectionalTitle");
  const showBedroomsBathrooms = RESIDENTIAL_STRATEGIES.includes(strategyId);
  const showUnitCount = UNIT_COUNT_STRATEGIES.includes(strategyId);

  async function onSubmit(data: IntroForm) {
    const res = await fetch(`/api/deals/${deal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      showToast("error", "Could not save deal introduction.");
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
          Investment Strategy
        </h2>
        <StrategySelector
          value={strategyId}
          onChange={(id) =>
            setValue("investmentStrategy", id, { shouldDirty: true })
          }
        />
        <div className="mt-4 rounded-md bg-av-gold/10 border border-av-gold/30 px-4 py-3">
          <p className="font-body text-sm text-av-navy">
            💡 {strategy.label} — {strategy.description}
          </p>
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="font-display text-xl text-av-navy">Deal Details</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField label="Deal Name">
            <Input {...register("name")} placeholder="e.g. Rivonia Office Park" />
          </FormField>

          <FormField label="Property Type">
            <select
              {...register("propertyType")}
              className="w-full rounded-md border border-av-light-grey bg-white px-3 py-2.5 min-h-[44px] font-body text-sm text-av-navy focus:outline-none focus:border-av-gold focus:ring-1 focus:ring-av-gold"
            >
              {PROPERTY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Property Address">
            <Input {...register("address")} placeholder="Street address" />
          </FormField>

          <FormField label="City / Town">
            <Input {...register("city")} placeholder="City" />
          </FormField>

          <FormField label="Currency">
            <select
              {...register("currency")}
              className="w-full rounded-md border border-av-light-grey bg-white px-3 py-2.5 min-h-[44px] font-body text-sm text-av-navy focus:outline-none focus:border-av-gold focus:ring-1 focus:ring-av-gold"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </FormField>

          <div className="md:col-span-2">
            <FormField label="Deal Notes">
              <textarea
                {...register("notes")}
                rows={4}
                className="w-full rounded-md border border-av-light-grey bg-white px-3 py-2.5 font-body text-sm text-av-navy focus:outline-none focus:border-av-gold focus:ring-1 focus:ring-av-gold"
              />
            </FormField>
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="font-display text-xl text-av-navy">Property Details</h2>
          <div className="flex-1 h-[2px] bg-av-gold" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField label="Erf Number">
            <Input {...register("erfNumber")} />
          </FormField>
          <FormField label="Title Deed Number">
            <Input {...register("titleDeedNumber")} />
          </FormField>
          <FormField label="Erf Size (m²)">
            <Input type="number" {...register("erfSize")} />
          </FormField>
          <FormField label="Floor Size (m²)">
            <Input type="number" {...register("floorSize")} />
          </FormField>
          <FormField label="Property Zoning">
            <select
              {...register("propertyZoning")}
              className="w-full rounded-md border border-av-light-grey bg-white px-3 py-2.5 min-h-[44px] font-body text-sm text-av-navy focus:outline-none focus:border-av-gold focus:ring-1 focus:ring-av-gold"
            >
              <option value="">—</option>
              {PROPERTY_ZONINGS.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Year Built">
            <Input
              type="number"
              min={1800}
              max={new Date().getFullYear()}
              {...register("yearBuilt")}
            />
          </FormField>
          <FormField label="Rates Account Number">
            <Input {...register("ratesAccountNumber")} />
          </FormField>

          {showBedroomsBathrooms && (
            <>
              <FormField label="Bedrooms">
                <Input type="number" min={0} max={20} {...register("bedrooms")} />
              </FormField>
              <FormField label="Bathrooms">
                <Input type="number" min={0} max={20} {...register("bathrooms")} />
              </FormField>
              <FormField label="Garages / Parking Bays">
                <Input type="number" min={0} {...register("garages")} />
              </FormField>
            </>
          )}
          {showUnitCount && (
            <FormField label="Number of Units / Rooms">
              <Input type="number" min={1} {...register("numUnits")} />
            </FormField>
          )}
        </div>

        <div className="flex items-center gap-2 mt-6">
          <input
            type="checkbox"
            id="isSectionalTitle"
            {...register("isSectionalTitle")}
            className="w-5 h-5 accent-av-gold"
          />
          <label htmlFor="isSectionalTitle" className="text-sm font-body text-av-slate">
            Is this a Sectional Title?
          </label>
        </div>

        {isSectionalTitle && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4 border-l-2 border-av-gold pl-4">
            <FormField label="Unit Number">
              <Input {...register("unitNumber")} />
            </FormField>
            <FormField label="Scheme Name">
              <Input {...register("schemeName")} />
            </FormField>
            <FormField label="Monthly Levy">
              <Input type="number" {...register("schemeLevy")} />
            </FormField>
          </div>
        )}
      </section>

      <SaveBar
        dirty={isDirty}
        saving={isSubmitting}
        onSave={handleSubmit(onSubmit)}
      />
    </form>
  );
}
