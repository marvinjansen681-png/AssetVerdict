export interface User {
  id: string;
  email: string;
  name?: string | null;
  passwordHash: string;
  createdAt: Date;
}

export interface Deal {
  id: string;
  userId: string;
  name: string;
  propertyType?: string | null;
  investmentStrategy?: string | null;
  address?: string | null;
  city?: string | null;
  notes?: string | null;
  currency: string;

  askingPrice?: number | null;
  purchasePrice?: number | null;
  marketValue?: number | null;
  transferBondCost?: number | null;
  renovationCost?: number | null;
  sourcingFee?: number | null;
  agentCommission?: number | null;
  wantToSell: boolean;
  saleYear?: number | null;

  // Property Details
  erfNumber?: string | null;
  erfSize?: number | null;
  propertyZoning?: string | null;
  floorSize?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  garages?: number | null;
  numUnits?: number | null;
  yearBuilt?: number | null;
  ratesAccountNumber?: string | null;
  titleDeedNumber?: string | null;
  isSectionalTitle: boolean;
  unitNumber?: string | null;
  schemeName?: string | null;
  schemeLevy?: number | null;

  incomeTaxRate?: number | null;
  capitalGainsTaxRate?: number | null;
  capitalGrowthRate?: number | null;
  rentalGrowthRate?: number | null;
  costInflation?: number | null;
  sustainableGrowthRate?: number | null;
  discountRate?: number | null;
  realGrowthFactor?: number | null;
  occupationFactor?: number | null;
  marketCapRate?: number | null;

  createdAt: Date;
  updatedAt: Date;
}

export interface FinanceSource {
  id: string;
  dealId: string;
  sourceType: string;
  ltvMode: string;
  ltvValue?: number | null;
  loanAmount?: number | null;
  interestRate?: number | null;
  termYears?: number | null;
  repaymentAmount?: number | null;
  order: number;
}

export interface CashflowInputs {
  id: string;
  dealId: string;
  monthlyRent?: number | null;
  occupancyRate?: number | null;
  additionalIncome?: number | null;
  recoveries?: number | null;
  managementFeeMode: string;
  managementFeeValue?: number | null;
  maintenanceCostMode: string;
  maintenanceCostValue?: number | null;
  levies?: number | null;
  ratesAndTaxes?: number | null;
  insurance?: number | null;
  waterSewerage?: number | null;
  securityCleaning?: number | null;
  electricity?: number | null;
  badDebtsPct?: number | null;

  // STR
  nightlyRate?: number | null;
  avgOccupiedNights?: number | null;
  platformFeesPct?: number | null;

  // Multi-Let (per-room)
  billsIncluded: boolean;
  /** Null = not separately recorded (legacy deal, or never entered) — see lib/calculations/index.ts calcBillsIncludedMonthly. */
  billsIncludedAmount?: number | null;
  /** @deprecated Legacy column, unused by any calculation and unexposed in any form — retained in the DB for historical rows only, not part of the active input contract. */
  academicYearWeeks?: number | null;
  pricePerRoom?: number | null;

  // Student Accommodation — room mix (NSFAS-aware)
  singleRoomCount?: number | null;
  singleRoomRent?: number | null;
  singleRoomNsfasBeds?: number | null;
  sharingRoomCount?: number | null;
  sharingBedsPerRoom?: number | null;
  sharingRoomRent?: number | null;
  sharingRoomNsfasBeds?: number | null;
  nsfasCycleMonths?: number | null;
  privateCycleMonths?: number | null;

  // Student Accommodation — additional monthly expenses
  houseParentCost?: number | null;
  internetCost?: number | null;
  netflixCost?: number | null;
  gasRefillCost?: number | null;
  wasteRemovalCost?: number | null;

  // Fix & Flip
  holdingPeriodMonths?: number | null;
  expectedSalePrice?: number | null;
  holdingCostPerMonth?: number | null;

  // Instalment Sale Agreement
  instalmentAmount?: number | null;
  instalmentTerm?: number | null;
  instalmentRate?: number | null;
}

export interface CapexItem {
  id: string;
  dealId: string;
  label: string;
  amount: number;
  color?: string | null;
}

export interface RenovationItem {
  id: string;
  dealId: string;
  category: string;
  description: string;
  budgeted: number;
  quoted?: number | null;
  status: string;
  order: number;
}

export interface PropertyTransaction {
  id: string;
  propertyValuationId: string;
  transferDate?: string | Date | null;
  purchasePrice?: number | null;
  buyerName?: string | null;
  sellerName?: string | null;
  order: number;
}

export interface BondRecord {
  id: string;
  propertyValuationId: string;
  registrationDate?: string | Date | null;
  bondAmount?: number | null;
  bondHolder?: string | null;
  bondType?: string | null;
  order: number;
}

export interface ComparableSale {
  id: string;
  propertyValuationId: string;
  address?: string | null;
  sgCode?: string | null;
  saleDate?: string | Date | null;
  salePrice?: number | null;
  extentSqm?: number | null;
  buildingSizeSqm?: number | null;
  pricePerSqm?: number | null;
  distanceKm?: number | null;
  order: number;
}

export interface PropertyValuation {
  id: string;
  dealId: string;
  reportDate?: string | Date | null;
  sgCode?: string | null;
  reportSource: string;
  propertyDescription?: string | null;
  extentSqm?: number | null;
  zoning?: string | null;
  buildingSizeSqm?: number | null;
  bedroomsReported?: number | null;
  bathroomsReported?: number | null;
  garagesReported?: number | null;
  yearBuiltReported?: number | null;
  estimatedValue?: number | null;
  valueConfidenceLow?: number | null;
  valueConfidenceHigh?: number | null;
  valuationConfidence?: string | null;
  pricePerSqm?: number | null;
  currentOwnerSince?: string | Date | null;
  ownerAgeBand?: string | null;
  transactions: PropertyTransaction[];
  bonds: BondRecord[];
  comparables: ComparableSale[];
}

export interface SuburbProfile {
  id: string;
  userId: string;
  suburbName: string;
  city?: string | null;
  province?: string | null;
  reportType: string;
  reportDate?: string | Date | null;
  reportYear?: number | null;
  reportSource: string;
  notes?: string | null;

  paidOnTimePct?: number | null;
  gracePeriodPct?: number | null;
  paidLatePct?: number | null;
  partialPaymentPct?: number | null;
  didNotPayPct?: number | null;
  goodStandingPct?: number | null;
  provinceGoodStandingPct?: number | null;
  nationalGoodStandingPct?: number | null;

  stGrossYield?: number | null;
  stEffectiveYield?: number | null;
  fhGrossYield?: number | null;
  fhEffectiveYield?: number | null;
  nationalGrossYield?: number | null;

  stSmallBedLow?: number | null;
  stSmallBedAvg?: number | null;
  stSmallBedHigh?: number | null;
  st2BedLow?: number | null;
  st2BedAvg?: number | null;
  st2BedHigh?: number | null;
  stLargeBedLow?: number | null;
  stLargeBedAvg?: number | null;
  stLargeBedHigh?: number | null;
  stRentalTrend?: string | null;

  fhSmallBedLow?: number | null;
  fhSmallBedAvg?: number | null;
  fhSmallBedHigh?: number | null;
  fh3BedLow?: number | null;
  fh3BedAvg?: number | null;
  fh3BedHigh?: number | null;
  fhLargeBedLow?: number | null;
  fhLargeBedAvg?: number | null;
  fhLargeBedHigh?: number | null;
  fhRentalTrend?: string | null;

  stAvgPurchasePrice?: number | null;
  fhAvgPurchasePrice?: number | null;
  stTransactionVolume?: number | null;
  fhTransactionVolume?: number | null;
  investmentPropertyPct?: number | null;

  formalSectorPct?: number | null;
  unemployedPct?: number | null;
  incomeMiddleBandPct?: number | null;
  incomeHighBandPct?: number | null;
  age17to25Pct?: number | null;
  age26to40Pct?: number | null;
  age41to60Pct?: number | null;
  largeHouseholdPct?: number | null;
  singlePersonHouseholdPct?: number | null;

  provinceSTGrossYield?: number | null;
  provinceFHGrossYield?: number | null;
  provinceST2BedAvgRent?: number | null;
  provinceFH3BedAvgRent?: number | null;
  provinceSTLargeBedAvg?: number | null;
  provinceFHLargeBedAvg?: number | null;

  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface DealSuburb {
  id: string;
  dealId: string;
  suburbProfileId: string;
  isPrimary: boolean;
  createdAt: string | Date;
  suburbProfile: SuburbProfile;
}

export type DealWithRelations = Deal & {
  financeSources: FinanceSource[];
  cashflowInputs: CashflowInputs | null;
  capexItems: CapexItem[];
  renovationItems: RenovationItem[];
  propertyValuation: PropertyValuation | null;
  dealSuburbs: DealSuburb[];
};
