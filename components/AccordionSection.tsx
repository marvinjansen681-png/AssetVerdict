"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import clsx from "clsx";

interface AccordionSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export default function AccordionSection({
  title,
  defaultOpen = true,
  children,
}: AccordionSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="border-t border-av-light-grey pt-6">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full mb-4 min-h-[44px]"
      >
        <h2 className="font-display text-xl text-av-navy">{title}</h2>
        <ChevronDown
          size={20}
          className={clsx(
            "text-av-slate transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {open && <div>{children}</div>}
    </section>
  );
}
