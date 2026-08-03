import { InputHTMLAttributes, forwardRef } from "react";
import clsx from "clsx";

const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={clsx(
          "w-full rounded-md border border-av-light-grey bg-white px-3 py-2.5 min-h-[44px] font-body text-sm text-av-navy placeholder:text-av-slate/50 focus:outline-none focus:border-av-gold focus:ring-1 focus:ring-av-gold transition-colors",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export default Input;
