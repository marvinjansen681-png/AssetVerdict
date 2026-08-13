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
  if (!deal.purchasePrice) {
    missing.push({ key: "purchasePrice", label: "Purchase Price", tab: "acquisition" });
  }

  const cf = deal.cashflowInputs;
  switch (deal.investmentStrategy) {
    case "fix_and_flip":
      if (!cf?.expectedSalePrice) {
        missing.push({
          key: "expectedSalePrice",
          label: "Expected Sale Price",
          tab: "cashflow",
        });
      }
      if (!deal.renovationCost) {
        missing.push({
          key: "renovationCost",
          label: "Renovation Budget",
          tab: "acquisition",
        });
      }
      break;
    case "str":
      if (!cf?.nightlyRate) {
        missing.push({ key: "nightlyRate", label: "Nightly Rate", tab: "cashflow" });
      }
      if (!cf?.avgOccupiedNights) {
        missing.push({
          key: "avgOccupiedNights",
          label: "Average Occupied Nights",
          tab: "cashflow",
        });
      }
      break;
    case "instalment_sale":
      if (!cf?.instalmentAmount) {
        missing.push({
          key: "instalmentAmount",
          label: "Monthly Instalment",
          tab: "cashflow",
        });
      }
      break;
    case "multi_let":
      if (!cf?.pricePerRoom) {
        missing.push({ key: "pricePerRoom", label: "Rent Per Room", tab: "cashflow" });
      }
      break;
    case "student":
      if (!cf?.singleRoomCount && !cf?.sharingRoomCount) {
        missing.push({
          key: "roomMix",
          label: "Single or Sharing Room Count",
          tab: "cashflow",
        });
      }
      if (!cf?.singleRoomRent && !cf?.sharingRoomRent) {
        missing.push({ key: "roomRent", label: "Room Rent", tab: "cashflow" });
      }
      break;
    default:
      if (!cf?.monthlyRent) {
        missing.push({ key: "monthlyRent", label: "Monthly Rent", tab: "cashflow" });
      }
  }

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

    strategy: deal.investmentStrategy ?? "commercial",
    numUnits: deal.numUnits ?? 1,

    nightlyRate: cf?.nightlyRate ?? 0,
    avgOccupiedNights: cf?.avgOccupiedNights ?? 200,
    platformFeesPct: cf?.platformFeesPct ?? 15,

    billsIncluded: cf?.billsIncluded ?? false,
    academicYearWeeks: cf?.academicYearWeeks ?? 42,
    pricePerRoom: cf?.pricePerRoom ?? 0,

    singleRoomCount: cf?.singleRoomCount ?? 0,
    singleRoomRent: cf?.singleRoomRent ?? 0,
    singleRoomNsfasBeds: cf?.singleRoomNsfasBeds ?? 0,
    sharingRoomCount: cf?.sharingRoomCount ?? 0,
    sharingBedsPerRoom: cf?.sharingBedsPerRoom ?? 2,
    sharingRoomRent: cf?.sharingRoomRent ?? 0,
    sharingRoomNsfasBeds: cf?.sharingRoomNsfasBeds ?? 0,
    nsfasCycleMonths: cf?.nsfasCycleMonths ?? 10,
    privateCycleMonths: cf?.privateCycleMonths ?? 12,

    holdingPeriodMonths: cf?.holdingPeriodMonths ?? 6,
    expectedSalePrice: cf?.expectedSalePrice ?? 0,
    holdingCostPerMonth: cf?.holdingCostPerMonth ?? 0,

    instalmentAmount: cf?.instalmentAmount ?? 0,
    instalmentTerm: cf?.instalmentTerm ?? 240,
    instalmentRate: cf?.instalmentRate ?? 0,
  };
}
