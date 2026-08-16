"use client";

import useSWR from "swr";
import type { DealMetrics, YearlyProjection } from "@/lib/calculations";
import type { Scenarios } from "@/lib/calculations/scenarios";
import type { CapexItem, RenovationItem, PropertyValuation, SuburbProfile } from "@/types";

export interface DealSummaryInputs {
  askingPrice: number | null;
  purchasePrice: number | null;
  marketValue: number | null;
  transferBondCost: number | null;
  renovationCost: number | null;
  sourcingFee: number | null;
  financeSources: {
    sourceType: string;
    loanAmount: number | null;
    interestRate: number | null;
    termYears: number | null;
    repaymentAmount: number | null;
  }[];
  monthlyRent: number | null;
  occupancyRate: number | null;
  singleRoomCount: number | null;
  sharingRoomCount: number | null;
  sharingBedsPerRoom: number | null;
  erfNumber: string | null;
  erfSize: number | null;
  floorSize: number | null;
  yearBuilt: number | null;
  propertyZoning: string | null;
  titleDeedNumber: string | null;
  ratesAccountNumber: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  garages: number | null;
  numUnits: number | null;
  isSectionalTitle: boolean;
  unitNumber: string | null;
  schemeName: string | null;
  schemeLevy: number | null;
  capitalGrowthRate: number | null;
  saleYear: number | null;
  wantToSell: boolean;
}

export interface CalculateResponse {
  metrics: DealMetrics;
  projection: YearlyProjection[];
  scenarios: Scenarios;
  dealName: string;
  address: string | null;
  currency: string;
  investmentStrategy: string;
  rentalGrowthRate: number;
  costInflation: number;
  discountRate: number;
  capexItems: CapexItem[];
  renovationItems: RenovationItem[];
  dealSummary: DealSummaryInputs;
  propertyValuation: PropertyValuation | null;
  suburbProfile: SuburbProfile | null;
}

export interface CalculateErrorBody {
  error: string;
  missingFields?: { key: string; label: string; tab: string }[];
}

class CalculateError extends Error {
  missingFields?: CalculateErrorBody["missingFields"];
  constructor(body: CalculateErrorBody) {
    super(body.error);
    this.missingFields = body.missingFields;
  }
}

const fetcher = async (url: string): Promise<CalculateResponse> => {
  const res = await fetch(url);
  const body = await res.json();
  if (!res.ok) {
    throw new CalculateError(body as CalculateErrorBody);
  }
  return body as CalculateResponse;
};

export function useDealMetrics(dealId: string) {
  const { data, error, isLoading, mutate } = useSWR<CalculateResponse>(
    dealId ? `/api/deals/${dealId}/calculate` : null,
    fetcher
  );

  return {
    metrics: data?.metrics,
    projection: data?.projection,
    scenarios: data?.scenarios,
    dealName: data?.dealName,
    address: data?.address,
    currency: data?.currency,
    investmentStrategy: data?.investmentStrategy,
    rentalGrowthRate: data?.rentalGrowthRate,
    costInflation: data?.costInflation,
    discountRate: data?.discountRate,
    capexItems: data?.capexItems,
    renovationItems: data?.renovationItems,
    dealSummary: data?.dealSummary,
    propertyValuation: data?.propertyValuation,
    suburbProfile: data?.suburbProfile,
    isLoading,
    error: error as CalculateError | undefined,
    refresh: mutate,
  };
}
