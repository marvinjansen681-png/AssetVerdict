"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { mutate as globalMutate } from "swr";
import { useDeal } from "@/lib/DealContext";
import { useToast } from "@/components/ui/Toast";
import SaveBar from "@/components/forms/SaveBar";
import FormField from "@/components/ui/FormField";
import Input from "@/components/ui/Input";

const PROPERTY_TYPES = [
  "Commercial",
  "Residential",
  "Industrial",
  "Mixed Use",
  "Retail",
  "Office",
];

const CURRENCIES = ["ZAR", "USD", "EUR", "GBP", "AUD"];

const introSchema = z.object({
  name: z.string().min(1, "Deal name is required"),
  propertyType: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  notes: z.string().optional(),
  currency: z.string(),
});

type IntroForm = z.infer<typeof introSchema>;

export default function IntroductionTab() {
  const { deal, refreshDeal } = useDeal();
  const { showToast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { isDirty, isSubmitting },
    reset,
  } = useForm<IntroForm>({
    resolver: zodResolver(introSchema),
    defaultValues: {
      name: deal.name,
      propertyType: deal.propertyType ?? "Commercial",
      address: deal.address ?? "",
      city: "",
      notes: deal.notes ?? "",
      currency: deal.currency,
    },
  });

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
      className="px-4 md:px-8 py-8 max-w-3xl mx-auto"
    >
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

      <SaveBar
        dirty={isDirty}
        saving={isSubmitting}
        onSave={handleSubmit(onSubmit)}
      />
    </form>
  );
}
