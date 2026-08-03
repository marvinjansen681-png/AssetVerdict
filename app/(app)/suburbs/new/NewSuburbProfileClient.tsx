"use client";

import { useRouter } from "next/navigation";
import ReportImportButton, { type ExtractedReport } from "@/components/forms/ReportImportButton";
import SuburbProfileForm from "@/components/forms/SuburbProfileForm";
import { useToast } from "@/components/ui/Toast";

export default function NewSuburbProfileClient() {
  const router = useRouter();
  const { showToast } = useToast();

  async function handleExtracted(extracted: ExtractedReport) {
    if (extracted.reportType === "valuation") {
      showToast(
        "error",
        "That looks like a property valuation report — import it from the Acquisition tab on a deal instead."
      );
      return;
    }

    if (!extracted.suburbName) {
      showToast("error", "Could not identify a suburb name in that report — please enter it manually.");
      return;
    }

    const { reportType, ...rest } = extracted;
    const res = await fetch("/api/suburbs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...rest, reportType }),
    });

    if (!res.ok) {
      showToast("error", "Extraction succeeded but saving the profile failed.");
      return;
    }

    const saved = await res.json();
    router.push(`/suburbs/${saved.id}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border border-dashed border-av-light-grey p-5 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-body text-sm font-semibold text-av-navy mb-1">
            Import from a TPN report
          </h3>
          <p className="text-xs font-body text-av-slate">
            Upload a Suburb, Multiple Suburbs, or Province Investor Report PDF to auto-fill this form.
          </p>
        </div>
        <ReportImportButton onExtracted={handleExtracted} />
      </div>
      <SuburbProfileForm />
    </div>
  );
}
