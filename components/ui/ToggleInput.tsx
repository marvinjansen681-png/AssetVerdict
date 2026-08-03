"use client";

import clsx from "clsx";

interface ToggleInputProps {
  mode: "percent" | "amount";
  onChange: (mode: "percent" | "amount") => void;
  percentLabel?: string;
  amountLabel?: string;
}

export default function ToggleInput({
  mode,
  onChange,
  percentLabel = "%",
  amountLabel = "R",
}: ToggleInputProps) {
  return (
    <div className="inline-flex rounded-md border border-av-light-grey overflow-hidden shrink-0">
      <button
        type="button"
        onClick={() => onChange("percent")}
        className={clsx(
          "px-3 min-h-[44px] text-xs font-mono font-semibold transition-colors",
          mode === "percent"
            ? "bg-av-navy text-white"
            : "bg-white text-av-slate hover:bg-av-light-grey"
        )}
      >
        {percentLabel}
      </button>
      <button
        type="button"
        onClick={() => onChange("amount")}
        className={clsx(
          "px-3 min-h-[44px] text-xs font-mono font-semibold transition-colors border-l border-av-light-grey",
          mode === "amount"
            ? "bg-av-navy text-white"
            : "bg-white text-av-slate hover:bg-av-light-grey"
        )}
      >
        {amountLabel}
      </button>
    </div>
  );
}
