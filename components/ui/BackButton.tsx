"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

interface BackButtonProps {
  /** If provided, navigates to this path. Ignored if onClick is provided. */
  href?: string;
  /** Custom handler (e.g. going back a step within a multi-step form). Takes precedence over href. */
  onClick?: () => void;
  label?: string;
  className?: string;
  /** Use "dark" on navy/dark backgrounds (e.g. auth pages). */
  variant?: "light" | "dark";
}

export default function BackButton({
  href,
  onClick,
  label = "Back",
  className = "",
  variant = "light",
}: BackButtonProps) {
  const router = useRouter();

  const variantClasses =
    variant === "dark"
      ? "text-white/70 hover:text-av-gold"
      : "text-av-slate hover:text-av-navy";

  const baseClasses = `inline-flex items-center gap-1 min-h-[44px] px-2 -ml-2 text-sm font-body transition-colors ${variantClasses} ${className}`;

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={baseClasses}>
        <ChevronLeft size={18} />
        {label}
      </button>
    );
  }

  if (href) {
    return (
      <Link href={href} className={baseClasses}>
        <ChevronLeft size={18} />
        {label}
      </Link>
    );
  }

  return (
    <button type="button" onClick={() => router.back()} className={baseClasses}>
      <ChevronLeft size={18} />
      {label}
    </button>
  );
}
