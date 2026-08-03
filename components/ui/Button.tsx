import { ButtonHTMLAttributes, forwardRef } from "react";
import clsx from "clsx";

type Variant = "primary" | "secondary" | "danger" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-av-gold text-av-navy hover:brightness-95 disabled:opacity-50",
  secondary:
    "bg-white text-av-navy border border-av-light-grey hover:bg-av-light-grey",
  danger: "bg-av-red text-white hover:brightness-95",
  ghost: "bg-transparent text-av-slate hover:bg-av-light-grey",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={clsx(
          "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 min-h-[44px] font-body text-sm font-semibold tracking-wide transition disabled:cursor-not-allowed",
          variantClasses[variant],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export default Button;
