"use client";

import { useState } from "react";
import { Info } from "lucide-react";

export default function TooltipIcon({ text }: { text: string }) {
  const [open, setOpen] = useState(false);

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label="More information"
        onClick={() => setOpen((o) => !o)}
        className="text-av-slate/60 hover:text-av-navy min-h-[24px] min-w-[24px] flex items-center justify-center"
      >
        <Info size={13} />
      </button>
      {open && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 rounded-md bg-av-navy text-white text-xs font-body px-3 py-2 shadow-lg z-30 leading-relaxed">
          {text}
        </span>
      )}
    </span>
  );
}
