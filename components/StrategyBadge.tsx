import { getStrategy } from "@/lib/strategies";

export default function StrategyBadge({ strategyId }: { strategyId: string }) {
  const strategy = getStrategy(strategyId);
  return (
    <span className="text-xs font-body font-semibold px-3 py-1 rounded-full bg-av-light-grey text-av-navy whitespace-nowrap">
      {strategy.icon} {strategy.label}
    </span>
  );
}
