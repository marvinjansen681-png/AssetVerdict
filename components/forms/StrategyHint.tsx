import type { StrategyId } from "@/lib/strategies";

const HINTS: Partial<Record<StrategyId, string>> = {
  multi_let:
    "Multi-Let: Enter per-room rent. Management fees are typically higher (15–20%) due to tenant turnover and room management.",
  student:
    "Student Accommodation: NSFAS-funded beds pay a flat monthly rate over a 10-month cycle; private and bursary beds outside NSFAS typically pay over 12 months. Bills-included models are common — factor these into your expense side.",
  str: "Short-Term Rental: Revenue is driven by nightly rate × occupancy. Platform fees (Airbnb, etc.) typically run 15–20% of revenue.",
  fix_and_flip:
    "Fix & Flip: This tab calculates your profit at point of sale. Renovation quality and timeline are your biggest risk variables.",
  instalment_sale:
    "Instalment Sale: You receive monthly instalments. You remain the registered owner and still carry rates, insurance, and other holding costs.",
};

interface StrategyHintProps {
  strategyId: StrategyId | string;
  icon: string;
}

export default function StrategyHint({ strategyId, icon }: StrategyHintProps) {
  const text = HINTS[strategyId as StrategyId];
  if (!text) return null;

  return (
    <div className="rounded-md bg-av-gold/10 border border-av-gold/30 px-4 py-3 mb-6">
      <p className="font-body text-sm text-av-navy">
        {icon} {text}
      </p>
    </div>
  );
}
