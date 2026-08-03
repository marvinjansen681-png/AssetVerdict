"use client";

import clsx from "clsx";
import { INVESTMENT_STRATEGIES, type StrategyId } from "@/lib/strategies";

interface StrategySelectorProps {
  value: StrategyId | string;
  onChange: (id: StrategyId) => void;
}

export default function StrategySelector({ value, onChange }: StrategySelectorProps) {
  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {INVESTMENT_STRATEGIES.map((s) => {
          const selected = s.id === value;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onChange(s.id)}
              className={clsx(
                "flex flex-col items-center text-center gap-2 rounded-lg border-2 p-4 min-h-[44px] transition-colors",
                selected
                  ? "border-av-navy bg-white"
                  : "border-av-light-grey bg-white hover:border-av-slate/40"
              )}
            >
              <span className={clsx("text-3xl", !selected && "grayscale opacity-60")}>
                {s.icon}
              </span>
              <span className="font-body text-sm font-semibold text-av-navy">
                {s.label}
              </span>
              <span className="font-body text-xs text-av-slate leading-snug">
                {s.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
