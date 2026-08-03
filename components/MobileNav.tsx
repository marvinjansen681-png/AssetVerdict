"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, Home, Briefcase } from "lucide-react";
import Logo from "./Logo";

export default function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="min-h-[44px] min-w-[44px] flex items-center justify-center text-av-navy"
      >
        <Menu size={22} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <div className="relative w-64 bg-white h-full shadow-xl p-4 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <Logo size={24} />
              <button
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-av-slate"
              >
                <X size={20} />
              </button>
            </div>
            <nav className="flex flex-col gap-1">
              <Link
                href="/"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-3 py-3 min-h-[44px] rounded-md text-av-slate hover:bg-av-light-grey hover:text-av-navy font-body text-sm"
              >
                <Home size={18} />
                Home
              </Link>
              <Link
                href="/deals"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-3 py-3 min-h-[44px] rounded-md text-av-slate hover:bg-av-light-grey hover:text-av-navy font-body text-sm"
              >
                <Briefcase size={18} />
                My Deals
              </Link>
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
