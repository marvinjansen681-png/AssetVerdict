import { ReactNode } from "react";
import clsx from "clsx";
import TooltipIcon from "@/components/ui/TooltipIcon";

type Highlight = "green" | "orange" | "red" | null;

interface FormFieldProps {
  label: string;
  children: ReactNode;
  highlight?: Highlight;
  helperText?: string;
  tooltip?: string;
}

const highlightClasses: Record<Exclude<Highlight, null>, string> = {
  green: "ring-1 ring-av-green",
  orange: "ring-1 ring-av-orange",
  red: "ring-1 ring-av-red",
};

export default function FormField({
  label,
  children,
  highlight = null,
  helperText,
  tooltip,
}: FormFieldProps) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-sm font-body text-av-slate mb-1.5">
        {label}
        {tooltip && <TooltipIcon text={tooltip} />}
      </label>
      <div
        className={clsx(
          "rounded-md",
          highlight && highlightClasses[highlight]
        )}
      >
        {children}
      </div>
      {helperText && (
        <p className="text-xs font-body text-av-slate/80 mt-1">
          {helperText}
        </p>
      )}
    </div>
  );
}
