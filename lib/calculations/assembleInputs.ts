import type { DealInputs } from "./index";
import type { DealWithRelations } from "@/types";

/** Fields required to produce even a minimal metrics output. */
export const REQUIRED_FIELDS: { key: string; label: string; tab: string }[] = [
  { key: "purchasePrice", label: "Purchase Price", tab: "acquisition" },
  { key: "monthlyRent", label: "Monthly Rent", tab: "cashflow" },
];

export const RECOMMENDED_FIELDS: { key: string; label: string; tab: string }[] = [
  { key: "financeSources", label: "At least one Finance Source", tab: "finance" },
  { key: "occupancyRate", label: "Occupancy Rate", tab: "cashflow" },
  { key: "marketValue", label: "Market Value", tab: "acquisition" },
];

export function getMissingFields(deal: DealWithRelations): typeof REQUIRED_FIELDS {
  const missing: typeof REQUIRED_FIELDS = [];
  if (!deal.purchasePrice) missing.push(REQUIRED_FIELDS[0]);
  if (!deal.cashflowInputs?.monthlyRent) missing.push(REQUIRED_FIELDS[1]);
  return missing;
}

/** Converts a raw Prisma deal (with relations) into a DealInputs object, filling nulls with sensible defaults. */
export function assembleInputs(deal: DealWithRelations): DealInputs {
  const cf = deal.cashflowInputs;

  return {
    purchasePrice: deal.purchasePrice ?? 0,
    marketValue: deal.marketValue ?? deal.purchasePrice ?? 0,
    askingPrice: deal.askingPrice ?? 0,
    transferBondCost: deal.transferBondCost ?? 0,
    renovationCost: deal.renovationCost ?? 0,
    sourcingFee: deal.sourcingFee ?? 0,
    agentCommission: deal.agentCommission ?? 0,

    financeSources: deal.financeSources.map((f) => ({
      loanAmount: f.loanAmount ?? 0,
      interestRate: f.interestRate ?? 0,
      termYears: f.termYears ?? 15,
      repaymentAmount: f.repaymentAmount ?? 0,
    })),

    monthlyRent: cf?.monthlyRent ?? 0,
    occupancyRate: cf?.occupancyRate ?? 88,
    additionalIncome: cf?.additionalIncome ?? 0,
    recoveries: cf?.recoveries ?? 0,
    managementFeeValue: cf?.managementFeeValue ?? 15,
    managementFeeMode: (cf?.managementFeeMode as "percent" | "amount") ?? "percent",
    maintenanceCostValue: cf?.maintenanceCostValue ?? 5,
    maintenanceCostMode: (cf?.maintenanceCostMode as "percent" | "amount") ?? "percent",
    levies: cf?.levies ?? 0,
    ratesAndTaxes: cf?.ratesAndTaxes ?? 0,
    insurance: cf?.insurance ?? 0,
    waterSewerage: cf?.waterSewerage ?? 0,
    securityCleaning: cf?.securityCleaning ?? 0,
    electricity: cf?.electricity ?? 0,
    badDebtsPct: cf?.badDebtsPct ?? 5,

    incomeTaxRate: deal.incomeTaxRate ?? 27,
    capitalGainsTaxRate: deal.capitalGainsTaxRate ?? 22,
    capitalGrowthRate: deal.capitalGrowthRate ?? 3,
    rentalGrowthRate: deal.rentalGrowthRate ?? 8,
    costInflation: deal.costInflation ?? 5,
    discountRate: deal.discountRate ?? 10,
    marketCapRate: deal.marketCapRate ?? 10,
  };
}
