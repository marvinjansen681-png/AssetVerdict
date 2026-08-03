"use client";

import { ReactNode, useState } from "react";
import { ChevronDown } from "lucide-react";
import clsx from "clsx";

interface AccordionSectionProps {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export default function AccordionSection({
  title,
  subtitle,
  defaultOpen = false,
  children,
}: AccordionSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-lg border border-av-light-grey overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 min-h-[52px] bg-av-light-grey/40 hover:bg-av-light-grey/70 transition-colors text-left"
      >
        <div>
          <h3 className="font-display text-base text-av-navy">{title}</h3>
          {subtitle && (
            <p className="text-xs font-body text-av-slate mt-0.5">{subtitle}</p>
          )}
        </div>
        <ChevronDown
          size={18}
          className={clsx(
            "text-av-slate transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {open && <div className="px-5 py-6">{children}</div>}
    </div>
  );
}
