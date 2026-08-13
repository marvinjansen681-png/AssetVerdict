import { calcMonthlyRepayment } from "./amortisation";

/**
 * Type guard for "a real, usable number". Prefer this over the bare
 * `isFinite()` global everywhere a value may have round-tripped through
 * JSON: `Infinity` (e.g. an infinite payback period) serializes to `null`
 * over the wire, and `isFinite(null)` is `true` (null coerces to 0), so a
 * bare `isFinite()` check silently passes through a null as if it were a
 * valid number — this guard catches that case.
 */
export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && isFinite(value);
}

export interface FinanceSourceInput {
  loanAmount: number;
  interestRate: number; // %
  termYears: number;
  repaymentAmount: number; // monthly
}

/**
 * Full set of inputs required to compute deal metrics. Annual unless noted.
 */
export interface DealInputs {
  // Acquisition
  purchasePrice: number;
  marketValue: number;
  askingPrice: number;
  transferBondCost: number;
  renovationCost: number;
  sourcingFee: number;
  agentCommission: number; // %

  financeSources: FinanceSourceInput[];

  // Cashflow (monthly inputs)
  monthlyRent: number;
  occupancyRate: number; // %
  additionalIncome: number;
  recoveries: number;
  managementFeeValue: number; // % or R
  managementFeeMode: "percent" | "amount";
  maintenanceCostValue: number;
  maintenanceCostMode: "percent" | "amount";
  levies: number;
  ratesAndTaxes: number;
  insurance: number;
  waterSewerage: number;
  securityCleaning: number;
  electricity: number;
  badDebtsPct: number; // % of gross revenue

  // Other inputs
  incomeTaxRate: number; // %
  capitalGainsTaxRate: number; // %
  capitalGrowthRate: number; // % per year
  rentalGrowthRate: number; // % per year
  costInflation: number; // % per year
  discountRate: number; // % for NPV
  marketCapRate: number; // % for Cap Rate Spread

  // Strategy
  strategy: string;
  numUnits: number;

  // STR
  nightlyRate: number;
  avgOccupiedNights: number;
  platformFeesPct: number;

  // Multi-Let (per-room)
  billsIncluded: boolean;
  academicYearWeeks: number;
  pricePerRoom: number;

  // Student Accommodation — room mix (NSFAS-aware)
  singleRoomCount: number;
  singleRoomRent: number;
  singleRoomNsfasBeds: number;
  sharingRoomCount: number;
  sharingBedsPerRoom: number;
  sharingRoomRent: number;
  sharingRoomNsfasBeds: number;
  nsfasCycleMonths: number;
  privateCycleMonths: number;

  // Student Accommodation — additional monthly expenses
  houseParentCost: number;
  internetCost: number;
  netflixCost: number;
  gasRefillCost: number;
  wasteRemovalCost: number;

  // Fix & Flip
  holdingPeriodMonths: number;
  expectedSalePrice: number;
  holdingCostPerMonth: number;

  // Instalment Sale Agreement
  instalmentAmount: number;
  instalmentTerm: number;
  instalmentRate: number;
}

export interface OperatingCosts {
  finance: number;
  utilities: number;
  ratesInsuranceOther: number;
  total: number;
}

export interface Provisions {
  management: number;
  maintenance: number;
  badDebts: number;
  total: number;
}

export interface YearlyProjection {
  year: number;
  grossRevenue: number;
  operatingCosts: number;
  financeCost: number;
  provisions: number;
  noi: number;
  taxAmount: number;
  cashflowForPeriod: number;
  cumulativeCashflow: number;
  propertyValue: number;
  yearlyROI: number;
  remainingDebt: number;
}

export interface RevenueBreakdown {
  rentalIncome: number;
  additionalIncome: number;
  recoveries: number;
  total: number;
}

export interface FlipMetrics {
  totalCost: number;
  purchasePrice: number;
  renovationCost: number;
  holdingCosts: number;
  agentFee: number;
  expectedSalePrice: number;
  grossProfit: number;
  cgt: number;
  netProfit: number;
  roi: number;
  annualisedROI: number;
  profitMargin: number;
}

export interface DealMetrics {
  totalInvestment: number;
  totalLoanAmount: number;
  depositRequired: number;
  effectiveMonthlyRevenue: number;
  grossRevenueAnnual: number;
  revenueMonthly: RevenueBreakdown;
  operatingCostsMonthly: OperatingCosts;
  provisionsMonthly: Provisions;
  taxMonthly: number;
  cashflowMonthly: number;
  noiAnnual: number;
  capRatePP: number;
  capRateMV: number;
  grossYield: number;
  netYieldPreTax: number;
  netYieldPostTax: number;
  dscr: number;
  ltv: number;
  breakEvenRatio: number;
  operatingExpenseRatio: number;
  utilitiesRatio: number;
  noiMargin: number;
  capRateSpread: number;
  paybackPeriod: number;
  irr: number;
  npv: number;
  flipMetrics?: FlipMetrics;
}

/** Total upfront investment: purchase price + all buying costs. */
export function calcTotalInvestment(inputs: DealInputs): number {
  return (
    inputs.purchasePrice +
    inputs.transferBondCost +
    inputs.renovationCost +
    inputs.sourcingFee
  );
}

/** Sum of all finance source loan amounts. */
export function calcTotalLoanAmount(inputs: DealInputs): number {
  return inputs.financeSources.reduce((sum, f) => sum + f.loanAmount, 0);
}

/** Cash required at close: total investment less total debt raised. */
export function calcDepositRequired(inputs: DealInputs): number {
  return calcTotalInvestment(inputs) - calcTotalLoanAmount(inputs);
}

export { calcMonthlyRepayment };

/**
 * Student accommodation revenue: single and sharing rooms, each split between
 * NSFAS-funded beds (paid over a fixed 10-month cycle at NSFAS grading rates)
 * and private/bursary beds (paid over a 12-month cycle at market rent).
 * NSFAS pays a flat monthly amount for 10 months regardless of the academic
 * calendar's actual week count, so this is annualised by months, not weeks.
 */
export function calcStudentAnnualRevenue(inputs: DealInputs): number {
  const totalSingleBeds = inputs.singleRoomCount;
  const totalSharingBeds = inputs.sharingRoomCount * inputs.sharingBedsPerRoom;

  const nsfasSingleBeds = Math.min(inputs.singleRoomNsfasBeds, totalSingleBeds);
  const nsfasSharingBeds = Math.min(inputs.sharingRoomNsfasBeds, totalSharingBeds);
  const privateSingleBeds = totalSingleBeds - nsfasSingleBeds;
  const privateSharingBeds = totalSharingBeds - nsfasSharingBeds;

  return (
    nsfasSingleBeds * inputs.singleRoomRent * inputs.nsfasCycleMonths +
    privateSingleBeds * inputs.singleRoomRent * inputs.privateCycleMonths +
    nsfasSharingBeds * inputs.sharingRoomRent * inputs.nsfasCycleMonths +
    privateSharingBeds * inputs.sharingRoomRent * inputs.privateCycleMonths
  );
}

/**
 * Base rental/nightly/room revenue before additional income and recoveries,
 * branching on the deal's investment strategy (see /lib/strategies.ts).
 */
function calcBaseMonthlyRevenue(inputs: DealInputs): number {
  switch (inputs.strategy) {
    case "str":
      // Nightly rate x occupied nights/year, averaged to a monthly figure.
      return (inputs.nightlyRate * inputs.avgOccupiedNights) / 12;
    case "student":
      // Blended NSFAS (10mo) / private (12mo) annual revenue across single and
      // sharing rooms, averaged to a monthly figure, then occupancy-adjusted.
      return (calcStudentAnnualRevenue(inputs) / 12) * (inputs.occupancyRate / 100);
    case "multi_let":
      // Per-room monthly rent x rooms x occupancy.
      return inputs.pricePerRoom * inputs.numUnits * (inputs.occupancyRate / 100);
    case "fix_and_flip":
      // No ongoing cashflow — profit is computed separately via calcFlipProfit().
      return 0;
    case "instalment_sale":
      // Fixed monthly instalment from the buyer; occupancy is not applicable.
      return inputs.instalmentAmount;
    default:
      return inputs.monthlyRent * (inputs.occupancyRate / 100);
  }
}

/** Occupancy-adjusted monthly revenue including additional income and recoveries. */
export function calcEffectiveMonthlyRevenue(inputs: DealInputs): number {
  return (
    calcBaseMonthlyRevenue(inputs) + inputs.additionalIncome + inputs.recoveries
  );
}

/** Annualised gross revenue. */
export function calcGrossRevenueAnnual(inputs: DealInputs): number {
  return calcEffectiveMonthlyRevenue(inputs) * 12;
}

/** Monthly revenue split into rental/base income / additional income / recoveries. */
export function calcRevenueMonthly(inputs: DealInputs): RevenueBreakdown {
  const rentalIncome = calcBaseMonthlyRevenue(inputs);
  const additionalIncome = inputs.additionalIncome;
  const recoveries = inputs.recoveries;
  return {
    rentalIncome,
    additionalIncome,
    recoveries,
    total: rentalIncome + additionalIncome + recoveries,
  };
}

export function calcManagementFeeMonthly(inputs: DealInputs): number {
  // For STR, platform/agent fees (Airbnb, VRBO, etc.) are the direct analogue
  // of a management fee and are always a % of revenue.
  if (inputs.strategy === "str") {
    return calcEffectiveMonthlyRevenue(inputs) * (inputs.platformFeesPct / 100);
  }
  return inputs.managementFeeMode === "percent"
    ? calcEffectiveMonthlyRevenue(inputs) * (inputs.managementFeeValue / 100)
    : inputs.managementFeeValue;
}

export function calcMaintenanceCostMonthly(inputs: DealInputs): number {
  return inputs.maintenanceCostMode === "percent"
    ? calcEffectiveMonthlyRevenue(inputs) * (inputs.maintenanceCostValue / 100)
    : inputs.maintenanceCostValue;
}

export function calcBadDebtsMonthly(inputs: DealInputs): number {
  return (calcGrossRevenueAnnual(inputs) / 12) * (inputs.badDebtsPct / 100);
}

/** Sum of all finance source monthly repayments. */
export function calcTotalFinanceCostMonthly(inputs: DealInputs): number {
  return inputs.financeSources.reduce((sum, f) => sum + f.repaymentAmount, 0);
}

export function calcOperatingCostsMonthly(inputs: DealInputs): OperatingCosts {
  const finance = calcTotalFinanceCostMonthly(inputs);
  const utilities =
    inputs.waterSewerage +
    inputs.electricity +
    inputs.securityCleaning +
    inputs.internetCost +
    inputs.netflixCost +
    inputs.gasRefillCost +
    inputs.wasteRemovalCost;
  const ratesInsuranceOther =
    inputs.ratesAndTaxes + inputs.insurance + inputs.levies + inputs.houseParentCost;
  return {
    finance,
    utilities,
    ratesInsuranceOther,
    total: finance + utilities + ratesInsuranceOther,
  };
}

export function calcProvisionsMonthly(inputs: DealInputs): Provisions {
  const management = calcManagementFeeMonthly(inputs);
  const maintenance = calcMaintenanceCostMonthly(inputs);
  const badDebts = calcBadDebtsMonthly(inputs);
  return { management, maintenance, badDebts, total: management + maintenance + badDebts };
}

/** Net Operating Income, annualised, excluding finance costs and provisions on the expense side. */
export function calcNOIAnnual(inputs: DealInputs): number {
  const grossRevenue = calcGrossRevenueAnnual(inputs);
  const operatingCosts = calcOperatingCostsMonthly(inputs);
  const provisions = calcProvisionsMonthly(inputs);
  return (
    grossRevenue -
    operatingCosts.utilities * 12 -
    operatingCosts.ratesInsuranceOther * 12 -
    provisions.total * 12
  );
}

export function calcCapRatePP(inputs: DealInputs): number {
  if (!inputs.purchasePrice) return 0;
  return (calcNOIAnnual(inputs) / inputs.purchasePrice) * 100;
}

export function calcCapRateMV(inputs: DealInputs): number {
  if (!inputs.marketValue) return 0;
  return (calcNOIAnnual(inputs) / inputs.marketValue) * 100;
}

export function calcGrossYield(inputs: DealInputs): number {
  if (!inputs.purchasePrice) return 0;
  return (calcGrossRevenueAnnual(inputs) / inputs.purchasePrice) * 100;
}

/**
 * Annual net cashflow. Tax is a simplified estimate: (NOI - annual finance cost) x income tax rate,
 * floored at zero (no tax benefit modelled for negative taxable income).
 */
export function calcCashflowAnnual(inputs: DealInputs, beforeTax: boolean): number {
  const grossRevenue = calcGrossRevenueAnnual(inputs);
  const operatingCosts = calcOperatingCostsMonthly(inputs).total * 12;
  const provisions = calcProvisionsMonthly(inputs).total * 12;
  const cashflowBeforeTax = grossRevenue - operatingCosts - provisions;
  if (beforeTax) return cashflowBeforeTax;

  const financeCostAnnual = calcTotalFinanceCostMonthly(inputs) * 12;
  const tax = Math.max(
    0,
    (calcNOIAnnual(inputs) - financeCostAnnual) * (inputs.incomeTaxRate / 100)
  );
  return cashflowBeforeTax - tax;
}

export function calcNetYieldPreTax(inputs: DealInputs): number {
  const totalInvestment = calcTotalInvestment(inputs);
  if (!totalInvestment) return 0;
  return (calcCashflowAnnual(inputs, true) / totalInvestment) * 100;
}

export function calcNetYieldPostTax(inputs: DealInputs): number {
  const totalInvestment = calcTotalInvestment(inputs);
  if (!totalInvestment) return 0;
  return (calcCashflowAnnual(inputs, false) / totalInvestment) * 100;
}

export function calcDSCR(inputs: DealInputs): number {
  const annualDebtService = calcTotalFinanceCostMonthly(inputs) * 12;
  if (!annualDebtService) return 0;
  return calcNOIAnnual(inputs) / annualDebtService;
}

export function calcLTV(inputs: DealInputs): number {
  if (!inputs.purchasePrice) return 0;
  return (calcTotalLoanAmount(inputs) / inputs.purchasePrice) * 100;
}

export function calcBreakEvenRatio(inputs: DealInputs): number {
  const grossRevenue = calcGrossRevenueAnnual(inputs);
  if (!grossRevenue) return 0;
  const operatingCosts = calcOperatingCostsMonthly(inputs);
  const opExExclProvisions =
    (operatingCosts.utilities + operatingCosts.ratesInsuranceOther) * 12;
  const financeCostAnnual = operatingCosts.finance * 12;
  return ((opExExclProvisions + financeCostAnnual) / grossRevenue) * 100;
}

export function calcOperatingExpenseRatio(inputs: DealInputs): number {
  const grossRevenue = calcGrossRevenueAnnual(inputs);
  if (!grossRevenue) return 0;
  const operatingCosts = calcOperatingCostsMonthly(inputs).total * 12;
  const provisions = calcProvisionsMonthly(inputs).total * 12;
  return ((operatingCosts + provisions) / grossRevenue) * 100;
}

export function calcUtilitiesRatio(inputs: DealInputs): number {
  const grossRevenue = calcGrossRevenueAnnual(inputs);
  if (!grossRevenue) return 0;
  const utilities = calcOperatingCostsMonthly(inputs).utilities * 12;
  return (utilities / grossRevenue) * 100;
}

export function calcNOIMargin(inputs: DealInputs): number {
  const grossRevenue = calcGrossRevenueAnnual(inputs);
  if (!grossRevenue) return 0;
  return (calcNOIAnnual(inputs) / grossRevenue) * 100;
}

export function calcCapRateSpread(inputs: DealInputs): number {
  return calcCapRateMV(inputs) - inputs.marketCapRate;
}

/** Monthly tax estimate: (NOI - monthly finance cost) x income tax rate, floored at zero. */
export function calcTaxMonthly(inputs: DealInputs): number {
  const noiMonthly = calcNOIAnnual(inputs) / 12;
  const financeCostMonthly = calcTotalFinanceCostMonthly(inputs);
  return Math.max(0, (noiMonthly - financeCostMonthly) * (inputs.incomeTaxRate / 100));
}

/** Monthly net cashflow after operating costs, provisions, and tax. */
export function calcCashflowMonthly(inputs: DealInputs): number {
  return calcCashflowAnnual(inputs, false) / 12;
}

/**
 * Fix & Flip profit at point of sale — a single lump event rather than an
 * ongoing cashflow. Only meaningful when inputs.strategy === 'fix_and_flip'.
 */
export function calcFlipProfit(inputs: DealInputs): FlipMetrics {
  const holdingCosts = inputs.holdingCostPerMonth * inputs.holdingPeriodMonths;
  const agentFee = inputs.expectedSalePrice * (inputs.agentCommission / 100);
  const totalCost =
    inputs.purchasePrice + inputs.renovationCost + holdingCosts + agentFee;

  const grossProfit = inputs.expectedSalePrice - totalCost;
  const cgt = Math.max(0, grossProfit * (inputs.capitalGainsTaxRate / 100));
  const netProfit = grossProfit - cgt;

  const roi = totalCost ? (netProfit / totalCost) * 100 : 0;
  const holdingYears = inputs.holdingPeriodMonths / 12;
  const annualisedROI = holdingYears > 0 ? roi / holdingYears : 0;
  const profitMargin = inputs.expectedSalePrice
    ? (netProfit / inputs.expectedSalePrice) * 100
    : 0;

  return {
    totalCost,
    purchasePrice: inputs.purchasePrice,
    renovationCost: inputs.renovationCost,
    holdingCosts,
    agentFee,
    expectedSalePrice: inputs.expectedSalePrice,
    grossProfit,
    cgt,
    netProfit,
    roi,
    annualisedROI,
    profitMargin,
  };
}

export function calcPaybackPeriod(inputs: DealInputs): number {
  const cashflow = calcCashflowAnnual(inputs, false);
  if (cashflow <= 0) return Infinity;
  return calcTotalInvestment(inputs) / cashflow;
}

const PROJECTION_YEARS = 20;

/**
 * 20-year cashflow projection with rent/cost/capital growth escalations.
 * Finance repayments are held fixed (loan terms don't change), and remaining
 * loan balance is amortised down year by year for terminal-value purposes.
 */
export function calc20YearProjection(inputs: DealInputs): YearlyProjection[] {
  const totalInvestment = calcTotalInvestment(inputs);
  const baseGrossRevenue = calcGrossRevenueAnnual(inputs);
  const baseOperatingCostsExclFinance =
    (calcOperatingCostsMonthly(inputs).utilities +
      calcOperatingCostsMonthly(inputs).ratesInsuranceOther) *
    12;
  const baseProvisions = calcProvisionsMonthly(inputs).total * 12;
  const financeCostAnnual = calcTotalFinanceCostMonthly(inputs) * 12;

  const projections: YearlyProjection[] = [];
  let cumulativeCashflow = -totalInvestment;

  for (let year = 1; year <= PROJECTION_YEARS; year++) {
    const rentGrowthFactor = Math.pow(1 + inputs.rentalGrowthRate / 100, year - 1);
    const costGrowthFactor = Math.pow(1 + inputs.costInflation / 100, year - 1);
    const capitalGrowthFactor = Math.pow(1 + inputs.capitalGrowthRate / 100, year);

    const grossRevenue = baseGrossRevenue * rentGrowthFactor;
    const operatingCostsExclFinance = baseOperatingCostsExclFinance * costGrowthFactor;
    const provisions = baseProvisions * rentGrowthFactor;
    const noi = grossRevenue - operatingCostsExclFinance - provisions;

    const taxAmount = Math.max(
      0,
      (noi - financeCostAnnual) * (inputs.incomeTaxRate / 100)
    );

    const cashflowForPeriod =
      grossRevenue - operatingCostsExclFinance - provisions - financeCostAnnual - taxAmount;

    cumulativeCashflow += cashflowForPeriod;

    const propertyValue = inputs.marketValue * capitalGrowthFactor;
    const yearlyROI = totalInvestment
      ? (cashflowForPeriod / totalInvestment) * 100
      : 0;
    const remainingDebt = calcTotalRemainingLoanBalance(inputs, year);

    projections.push({
      year,
      grossRevenue,
      operatingCosts: operatingCostsExclFinance,
      financeCost: financeCostAnnual,
      provisions,
      noi,
      taxAmount,
      cashflowForPeriod,
      cumulativeCashflow,
      propertyValue,
      yearlyROI,
      remainingDebt,
    });
  }

  return projections;
}

/** Remaining balance on a fully-amortising loan after `yearsElapsed` years. */
function remainingLoanBalance(
  loanAmount: number,
  interestRatePct: number,
  termYears: number,
  yearsElapsed: number
): number {
  if (!loanAmount || yearsElapsed >= termYears) return 0;
  const r = interestRatePct / 12 / 100;
  const n = termYears * 12;
  const p = Math.min(yearsElapsed * 12, n);
  if (r === 0) return loanAmount * (1 - p / n);
  const factor = Math.pow(1 + r, n);
  const factorP = Math.pow(1 + r, p);
  return loanAmount * ((factor - factorP) / (factor - 1));
}

export function calcTotalRemainingLoanBalance(inputs: DealInputs, yearsElapsed: number): number {
  return inputs.financeSources.reduce(
    (sum, f) =>
      sum + remainingLoanBalance(f.loanAmount, f.interestRate, f.termYears, yearsElapsed),
    0
  );
}

/**
 * Internal Rate of Return over 20 years using Newton-Raphson, including terminal
 * value (property value less remaining debt) added to the final year's cashflow.
 */
export function calcIRR(inputs: DealInputs): number {
  const totalInvestment = calcTotalInvestment(inputs);
  const projection = calc20YearProjection(inputs);

  const remainingDebtYear20 = calcTotalRemainingLoanBalance(inputs, PROJECTION_YEARS);
  const terminalValue =
    projection[PROJECTION_YEARS - 1].propertyValue - remainingDebtYear20;

  const cashflows = [-totalInvestment, ...projection.map((p) => p.cashflowForPeriod)];
  cashflows[PROJECTION_YEARS] += terminalValue;

  const npvAt = (rate: number) =>
    cashflows.reduce((sum, cf, t) => sum + cf / Math.pow(1 + rate, t), 0);

  let rate = 0.15;
  for (let i = 0; i < 100; i++) {
    const npv = npvAt(rate);
    const delta = 1e-6;
    const derivative = (npvAt(rate + delta) - npv) / delta;
    if (Math.abs(derivative) < 1e-9) break;
    const nextRate = rate - npv / derivative;
    if (!isFinite(nextRate)) break;
    if (Math.abs(nextRate - rate) < 1e-7) {
      rate = nextRate;
      break;
    }
    rate = nextRate;
  }

  // Newton-Raphson can diverge to a spurious, numerically "converged" root far
  // from any economically meaningful rate (e.g. deals with cashflow negative
  // every single year, where no real break-even rate exists). Clamp to a wide
  // but sane band so the UI shows "very bad"/"very good" rather than garbage
  // like hundreds of millions of percent.
  const clampedRate = Math.max(-0.99, Math.min(rate, 10));
  return clampedRate * 100;
}

/** Net Present Value of 20-year cashflows plus terminal value, discounted at discountRate. */
export function calcNPV(inputs: DealInputs): number {
  const projection = calc20YearProjection(inputs);
  const remainingDebtYear20 = calcTotalRemainingLoanBalance(inputs, PROJECTION_YEARS);
  const terminalPropertyValue = projection[PROJECTION_YEARS - 1].propertyValue;
  const capitalGainsTax = Math.max(
    0,
    (terminalPropertyValue - inputs.marketValue) * (inputs.capitalGainsTaxRate / 100)
  );
  const terminalValue = terminalPropertyValue - remainingDebtYear20 - capitalGainsTax;

  const rate = inputs.discountRate / 100;
  let npv = 0;
  projection.forEach((p, index) => {
    const t = index + 1;
    let cashflow = p.cashflowForPeriod;
    if (t === PROJECTION_YEARS) cashflow += terminalValue;
    npv += cashflow / Math.pow(1 + rate, t);
  });

  return npv;
}

/** Computes the full metrics object used to populate the Summary dashboard. */
export function calcAllMetrics(inputs: DealInputs): DealMetrics {
  return {
    flipMetrics:
      inputs.strategy === "fix_and_flip" ? calcFlipProfit(inputs) : undefined,
    totalInvestment: calcTotalInvestment(inputs),
    totalLoanAmount: calcTotalLoanAmount(inputs),
    depositRequired: calcDepositRequired(inputs),
    effectiveMonthlyRevenue: calcEffectiveMonthlyRevenue(inputs),
    grossRevenueAnnual: calcGrossRevenueAnnual(inputs),
    revenueMonthly: calcRevenueMonthly(inputs),
    operatingCostsMonthly: calcOperatingCostsMonthly(inputs),
    provisionsMonthly: calcProvisionsMonthly(inputs),
    taxMonthly: calcTaxMonthly(inputs),
    cashflowMonthly: calcCashflowMonthly(inputs),
    noiAnnual: calcNOIAnnual(inputs),
    capRatePP: calcCapRatePP(inputs),
    capRateMV: calcCapRateMV(inputs),
    grossYield: calcGrossYield(inputs),
    netYieldPreTax: calcNetYieldPreTax(inputs),
    netYieldPostTax: calcNetYieldPostTax(inputs),
    dscr: calcDSCR(inputs),
    ltv: calcLTV(inputs),
    breakEvenRatio: calcBreakEvenRatio(inputs),
    operatingExpenseRatio: calcOperatingExpenseRatio(inputs),
    utilitiesRatio: calcUtilitiesRatio(inputs),
    noiMargin: calcNOIMargin(inputs),
    capRateSpread: calcCapRateSpread(inputs),
    paybackPeriod: calcPaybackPeriod(inputs),
    irr: calcIRR(inputs),
    npv: calcNPV(inputs),
  };
}
