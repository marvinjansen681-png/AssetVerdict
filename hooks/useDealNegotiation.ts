"use client";

import useSWR from "swr";
import type { NegotiationAnalysis, NegotiationOpportunity } from "@/lib/calculations/negotiation";

export interface NegotiationApiResponse {
  negotiation: NegotiationAnalysis;
  opportunity: NegotiationOpportunity;
  currency: string;
}

const fetcher = async (url: string): Promise<NegotiationApiResponse> => {
  const res = await fetch(url);
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.error ?? "Failed to load negotiation analysis");
  }
  return body as NegotiationApiResponse;
};

/** Mirrors useDealMetrics.ts — a thin SWR wrapper over GET /api/deals/[id]/negotiation. */
export function useDealNegotiation(dealId: string) {
  const { data, error, isLoading } = useSWR<NegotiationApiResponse>(
    dealId ? `/api/deals/${dealId}/negotiation` : null,
    fetcher
  );

  return {
    negotiation: data?.negotiation,
    opportunity: data?.opportunity,
    currency: data?.currency,
    isLoading,
    error,
  };
}
