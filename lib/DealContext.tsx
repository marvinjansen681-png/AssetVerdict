"use client";

import { createContext, useContext, useState, useCallback, useMemo } from "react";
import type { DealWithRelations } from "@/types";
import { getStrategy, type Strategy } from "@/lib/strategies";

interface DealContextValue {
  deal: DealWithRelations;
  refreshDeal: (updated: Partial<DealWithRelations>) => void;
  strategy: Strategy;
}

const DealContext = createContext<DealContextValue | null>(null);

export function DealProvider({
  deal: initialDeal,
  children,
}: {
  deal: DealWithRelations;
  children: React.ReactNode;
}) {
  const [deal, setDeal] = useState(initialDeal);

  const refreshDeal = useCallback((updated: Partial<DealWithRelations>) => {
    setDeal((prev) => ({ ...prev, ...updated }));
  }, []);

  const strategy = useMemo(
    () => getStrategy(deal.investmentStrategy),
    [deal.investmentStrategy]
  );

  return (
    <DealContext.Provider value={{ deal, refreshDeal, strategy }}>
      {children}
    </DealContext.Provider>
  );
}

export function useDeal() {
  const ctx = useContext(DealContext);
  if (!ctx) throw new Error("useDeal must be used within a DealProvider");
  return ctx;
}
