import { z } from "zod";

const NUMERIC_FIELDS = [
  "paidOnTimePct", "gracePeriodPct", "paidLatePct", "partialPaymentPct", "didNotPayPct",
  "goodStandingPct", "provinceGoodStandingPct", "nationalGoodStandingPct",
  "stGrossYield", "stEffectiveYield", "fhGrossYield", "fhEffectiveYield", "nationalGrossYield",
  "stSmallBedLow", "stSmallBedAvg", "stSmallBedHigh", "st2BedLow", "st2BedAvg", "st2BedHigh",
  "stLargeBedLow", "stLargeBedAvg", "stLargeBedHigh",
  "fhSmallBedLow", "fhSmallBedAvg", "fhSmallBedHigh", "fh3BedLow", "fh3BedAvg", "fh3BedHigh",
  "fhLargeBedLow", "fhLargeBedAvg", "fhLargeBedHigh",
  "stAvgPurchasePrice", "fhAvgPurchasePrice", "investmentPropertyPct",
  "formalSectorPct", "unemployedPct", "incomeMiddleBandPct", "incomeHighBandPct",
  "age17to25Pct", "age26to40Pct", "age41to60Pct", "largeHouseholdPct", "singlePersonHouseholdPct",
  "provinceSTGrossYield", "provinceFHGrossYield", "provinceST2BedAvgRent", "provinceFH3BedAvgRent",
  "provinceSTLargeBedAvg", "provinceFHLargeBedAvg",
] as const;

const INT_FIELDS = ["reportYear", "stTransactionVolume", "fhTransactionVolume"] as const;

const STRING_FIELDS = ["city", "province", "reportSource", "notes", "stRentalTrend", "fhRentalTrend"] as const;

const numericShape = Object.fromEntries(
  NUMERIC_FIELDS.map((f) => [f, z.number().nullable().optional()])
);
const intShape = Object.fromEntries(
  INT_FIELDS.map((f) => [f, z.number().int().nullable().optional()])
);
const stringShape = Object.fromEntries(
  STRING_FIELDS.map((f) => [f, z.string().nullable().optional()])
);

export const suburbProfileSchema = z.object({
  suburbName: z.string().min(1),
  reportType: z.enum(["suburb", "multiple_suburbs", "province"]),
  reportDate: z.string().nullable().optional(),
  ...numericShape,
  ...intShape,
  ...stringShape,
});
