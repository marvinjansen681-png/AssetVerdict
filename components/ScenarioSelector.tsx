"use client";

import clsx from "clsx";

export type ScenarioKey = "bear" | "base" | "bull";

interface ScenarioSelectorProps {
  currentScenario: ScenarioKey;
  onSelect: (scenario: ScenarioKey) => void;
}

const OPTIONS: { key: ScenarioKey; label: string; emoji: string }[] = [
  { key: "bear", label: "Bear", emoji: "🐻" },
  { key: "base", label: "Base", emoji: "⚖️" },
  { key: "bull", label: "Bull", emoji: "🐂" },
];

const ACTIVE_CLASSES: Record<ScenarioKey, string> = {
  bear: "bg-av-red text-white border-av-red",
  base: "bg-av-gold text-av-navy border-av-gold",
  bull: "bg-av-green text-white border-av-green",
};

const INACTIVE_CLASSES: Record<ScenarioKey, string> = {
  bear: "text-av-red border-av-red hover:bg-av-red/10",
  base: "text-av-navy border-av-gold hover:bg-av-gold/10",
  bull: "text-av-green border-av-green hover:bg-av-green/10",
};

export default function ScenarioSelector({
  currentScenario,
  onSelect,
}: ScenarioSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      {OPTIONS.map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => onSelect(opt.key)}
          className={clsx(
            "px-4 py-2 min-h-[44px] rounded-full border text-sm font-body font-semibold transition-colors",
            currentScenario === opt.key
              ? ACTIVE_CLASSES[opt.key]
              : `bg-white ${INACTIVE_CLASSES[opt.key]}`
          )}
        >
          {opt.emoji} {opt.label.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
