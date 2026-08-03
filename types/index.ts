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
}

export interface CapexItem {
  id: string;
  dealId: string;
  label: string;
  amount: number;
  color?: string | null;
}

export type DealWithRelations = Deal & {
  financeSources: FinanceSource[];
  cashflowInputs: CashflowInputs | null;
  capexItems: CapexItem[];
};
