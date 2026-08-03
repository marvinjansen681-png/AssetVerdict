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

  // Student / Multi-Let
  billsIncluded: boolean;
  academicYearWeeks?: number | null;
  pricePerRoom?: number | null;

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

export type DealWithRelations = Deal & {
  financeSources: FinanceSource[];
  cashflowInputs: CashflowInputs | null;
  capexItems: CapexItem[];
  renovationItems: RenovationItem[];
};
