"use client";

import { useRef, useState } from "react";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export type ExtractedReport = Record<string, unknown> & {
  reportType: "valuation" | "suburb" | "multiple_suburbs" | "province";
};

interface ReportImportButtonProps {
  label?: string;
  onExtracted: (extracted: ExtractedReport) => Promise<void> | void;
}

export default function ReportImportButton({
  label = "Import from PDF",
  onExtracted,
}: ReportImportButtonProps) {
  const { showToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      showToast("error", "Please upload a PDF report.");
      return;
    }

    setLoading(true);
    try {
      const fileBase64 = await fileToBase64(file);
      const res = await fetch("/api/area/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileBase64 }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        showToast("error", body.error ?? "Could not extract report data.");
        return;
      }

      const { extracted } = await res.json();
      await onExtracted(extracted as ExtractedReport);
      showToast("success", "Report data extracted and applied.");
    } catch {
      showToast("error", "Something went wrong reading that PDF.");
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleFile}
      />
      <Button
        type="button"
        variant="secondary"
        disabled={loading}
        onClick={() => inputRef.current?.click()}
      >
        {loading ? "Extracting..." : label}
      </Button>
    </>
  );
}
