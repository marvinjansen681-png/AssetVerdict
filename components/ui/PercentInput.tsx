import { InputHTMLAttributes, forwardRef } from "react";
import clsx from "clsx";

const PercentInput = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, "type">
>(({ className, readOnly, ...props }, ref) => {
  return (
    <div className="relative">
      <input
        ref={ref}
        type="number"
        step="0.01"
        readOnly={readOnly}
        className={clsx(
          "w-full rounded-md border border-av-light-grey px-3 pr-7 py-2.5 min-h-[44px] font-mono text-sm text-right text-av-navy focus:outline-none focus:border-av-gold focus:ring-1 focus:ring-av-gold transition-colors",
          readOnly ? "bg-av-light-grey/60 cursor-not-allowed" : "bg-white",
          className
        )}
        {...props}
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-mono text-av-slate pointer-events-none">
        %
      </span>
    </div>
  );
});
PercentInput.displayName = "PercentInput";

export default PercentInput;
