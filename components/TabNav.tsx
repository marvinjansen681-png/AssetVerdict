"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import type { StrategyId } from "@/lib/strategies";

const CASHFLOW_LABELS: Partial<Record<StrategyId, string>> = {
  fix_and_flip: "Flip Calculator",
  str: "Rental Income",
  instalment_sale: "Instalment Details",
};

interface TabNavProps {
  dealId: string;
  strategy?: StrategyId | string;
}

export default function TabNav({ dealId, strategy }: TabNavProps) {
  const pathname = usePathname();

  const tabs = [
    { slug: "introduction", label: "Deal Introduction" },
    { slug: "acquisition", label: "Acquisition Costs" },
    { slug: "finance", label: "Finance Costs" },
    {
      slug: "cashflow",
      label: (strategy && CASHFLOW_LABELS[strategy as StrategyId]) ?? "Cashflow",
    },
    { slug: "other", label: "Other Inputs" },
    { slug: "summary", label: "Summary" },
  ];

  return (
    <nav className="border-b border-av-light-grey bg-white sticky top-16 z-[5]">
      <div className="flex overflow-x-auto no-scrollbar px-4 md:px-8">
        {tabs.map((tab) => {
          const href =
            tab.slug === "summary"
              ? `/deals/${dealId}/summary`
              : `/deals/${dealId}/edit/${tab.slug}`;
          const active = pathname?.includes(`/edit/${tab.slug}`);

          return (
            <Link
              key={tab.slug}
              href={href}
              className={clsx(
                "whitespace-nowrap px-4 py-3 text-sm font-body border-b-2 transition-colors shrink-0",
                active
                  ? "border-av-gold text-av-navy font-semibold"
                  : "border-transparent text-av-slate hover:text-av-navy"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
