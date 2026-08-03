"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import type { DealWithRelations } from "@/types";

export interface DealQuickStats {
  irr: number;
  grossYield: number;
  cashflowMonthly: number;
}

interface DealCardProps {
  deal: DealWithRelations;
  quickStats?: DealQuickStats | null;
}

export default function DealCard({ deal, quickStats }: DealCardProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    const res = await fetch(`/api/deals/${deal.id}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) {
      router.refresh();
    }
    setConfirming(false);
  }

  return (
    <Card className="p-5 border-l-4 border-l-transparent hover:border-l-av-gold group relative">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-display text-lg text-av-navy truncate">
            {deal.name}
          </h3>
          {deal.address && (
            <p className="text-sm text-av-slate font-body truncate">
              {deal.address}
            </p>
          )}
        </div>
        {deal.propertyType && (
          <span className="shrink-0 text-xs font-body px-2 py-1 rounded-full bg-av-light-grey text-av-navy">
            {deal.propertyType}
          </span>
        )}
      </div>

      <p className="text-xs text-av-slate font-body mt-2">
        Created {new Date(deal.createdAt).toLocaleDateString("en-US")}
      </p>

      <div className="flex gap-2 mt-4">
        <div className="flex-1 rounded-md bg-av-light-grey px-2 py-2 text-center">
          <div className="text-[10px] font-body text-av-slate uppercase tracking-wide">
            IRR
          </div>
          <div className="text-sm font-mono font-semibold text-av-navy">
            {quickStats ? `${quickStats.irr.toFixed(1)}%` : "--"}
          </div>
        </div>
        <div className="flex-1 rounded-md bg-av-light-grey px-2 py-2 text-center">
          <div className="text-[10px] font-body text-av-slate uppercase tracking-wide">
            Gross Yield
          </div>
          <div className="text-sm font-mono font-semibold text-av-navy">
            {quickStats ? `${quickStats.grossYield.toFixed(1)}%` : "--"}
          </div>
        </div>
        <div className="flex-1 rounded-md bg-av-light-grey px-2 py-2 text-center">
          <div className="text-[10px] font-body text-av-slate uppercase tracking-wide">
            Cashflow
          </div>
          <div className="text-sm font-mono font-semibold text-av-navy">
            {quickStats
              ? `R ${quickStats.cashflowMonthly.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
              : "--"}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-4">
        <Link href={`/deals/${deal.id}/summary`} className="flex-1">
          <Button variant="secondary" className="w-full">
            View
          </Button>
        </Link>
        <Link href={`/deals/${deal.id}/edit`} className="flex-1">
          <Button variant="primary" className="w-full">
            Edit
          </Button>
        </Link>
        <button
          aria-label="Delete deal"
          onClick={() => setConfirming(true)}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md text-av-slate hover:bg-av-red/10 hover:text-av-red transition-colors"
        >
          <Trash2 size={18} />
        </button>
      </div>

      {confirming && (
        <div className="absolute inset-0 bg-white/95 rounded-lg flex flex-col items-center justify-center gap-3 p-4 z-10">
          <p className="text-sm font-body text-av-navy text-center">
            Delete <span className="font-semibold">{deal.name}</span>? This
            can&apos;t be undone.
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
