import Card from "@/components/ui/Card";
import TooltipIcon from "@/components/ui/TooltipIcon";
import clsx from "clsx";

interface MetricCardProps {
  label: string;
  value: string;
  tooltipText: string;
  trend?: "positive" | "negative" | "neutral";
}

export default function MetricCard({
  label,
  value,
  tooltipText,
  trend = "neutral",
}: MetricCardProps) {
  return (
    <Card className="p-4 flex flex-col items-center justify-center min-h-[164px]">
      <div className="flex items-center gap-1.5 mb-3">
        <span className="text-[13px] font-body text-av-slate">{label}</span>
        <TooltipIcon text={tooltipText} />
      </div>
      <div
        className={clsx(
          "font-mono font-bold text-xl text-center",
          trend === "positive" && "text-av-green",
          trend === "negative" && "text-av-red",
          trend === "neutral" && "text-av-navy"
        )}
      >
        {value}
      </div>
    </Card>
  );
}
