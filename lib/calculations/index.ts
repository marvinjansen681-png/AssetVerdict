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
  // The investor's required annual return on their own cash in the deal (an
  // equity hurdle rate) — the minimum return AssetVerdict discounts the
  // Equity NPV cashflow stream at. Not WACC, not a property-level discount
  // rate: it's specifically "what I need this cash to earn me."
  discountRate: number; // %
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

/**
 * Present-value decomposition of Equity NPV — the same equity cashflow
 * stream buildEquityCashflows() produces, just returned in named pieces
 * instead of summed into one number, so the education layer can show
 * "Initial Equity + PV of future cashflows + PV of eventual sale" without
 * re-implementing NPV's discounting math itself. presentValueOfOperatingCashflows
 * + presentValueOfTerminalValue - initialEquityInvestment reconciles to npv
 * (and to calcNPV()'s own return value) up to floating-point rounding.
 */
export interface NPVBreakdown {
  initialEquityInvestment: number;
  presentValueOfOperatingCashflows: number;
  presentValueOfTerminalValue: number;
  discountRate: number;
  npv: number;
}

/**
 * The un-discounted pieces behind Equity IRR, for education display without
 * exposing the Newton-Raphson solver: how much cash you put in, how much
 * operating cashflow the projection expects over 20 years, and the projected
 * equity proceeds at sale — the same three ingredients buildEquityCashflows()
 * feeds into the IRR solve.
 */
export interface IRRSummary {
  initialEquityInvestment: number;
  totalProjectedCashflow: number;
  terminalValueYear20: number;
  irr: number;
}

export interface DealMetrics {
  totalInvestment: number;
  totalLoanAmount: number;
  depositRequired: number;
  effectiveMonthlyRevenue: number;
  grossRevenueAnnual: number;
  revenueMonthly: RevenueBreakdown;
  operatingCostsMonthly: OperatingCosts;
  /** Annual operating expenses excl. finance — see calcOperatingExpensesAnnual(). */
  operatingExpensesAnnual: number;
  /** Total annual debt service across all finance sources — calcTotalFinanceCostMonthly() × 12. */
  annualDebtService: number;
  provisionsMonthly: Provisions;
  taxMonthly: number;
  cashflowMonthly: number;
  /** Annual cashflow after debt service, BEFORE income tax — the numerator behind Cash-on-Cash Return (Pre-Tax). */
  cashflowAnnualPreTax: number;
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
  npvBreakdown: NPVBreakdown;
  irrSummary: IRRSummary;
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

/**
 * Initial equity investment: the investor's own cash contribution, used as the
 * time-zero outflow for Equity IRR / Equity NPV. Numerically identical to
 * calcDepositRequired() — both are Total Investment less Total Loan Amount,
 * i.e. the standard sources-and-uses reconciliation (Uses = Total Investment;
 * Sources = Total Loan Amount + your cash) — under the assumption that every
 * finance source's proceeds are applied against the acquisition costs in
 * calcTotalInvestment() and nothing else (AssetVerdict doesn't model
 * cash-out/refinance proceeds used elsewhere). It's kept as its own,
 * explicitly-named function rather than reusing "depositRequired" directly in
 * return calculations: "deposit required" is a closing-cash concept for the
 * Summary page, "initial equity investment" is a return-calculation concept —
 * conflating the two names would obscure why calcIRR/calcNPV read this value.
 */
export function calcInitialEquityInvestment(inputs: DealInputs): number {
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

/** Total annual debt service across all finance sources — the denominator behind DSCR and a term in Break-Even Ratio. */
export function calcAnnualDebtService(inputs: DealInputs): number {
  return calcTotalFinanceCostMonthly(inputs) * 12;
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

/**
 * Net Operating Income, annualised: gross revenue less operating expenses
 * (utilities, rates/insurance/other, and provisions). Excludes finance/debt
 * service, which is a financing cost, not an operating expense.
 */
export function calcNOIAnnual(inputs: DealInputs): number {
  const grossRevenue = calcGrossRevenueAnnual(inputs);
  return grossRevenue - calcOperatingExpensesAnnual(inputs);
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

/**
 * "Net Yield (Pre-Tax)" is AssetVerdict's name for a Cash-on-Cash Return: the
 * first year's cashflow AFTER debt service (but before income tax) as a % of
 * the investor's own cash in the deal. The numerator (calcCashflowAnnual) has
 * always subtracted debt service, so the denominator must be the investor's
 * equity, not the property's total cost — dividing a levered cashflow by an
 * unlevered basis mixes two different cash-flow perspectives (the same class
 * of bug fixed in calcIRR/calcNPV; see calcInitialEquityInvestment). With no
 * (or negative) equity invested, the ratio is undefined, not a real 0%.
 */
export function calcNetYieldPreTax(inputs: DealInputs): number {
  const equity = calcInitialEquityInvestment(inputs);
  if (!(equity > 0)) return 0;
  return (calcCashflowAnnual(inputs, true) / equity) * 100;
}

/** Post-tax counterpart of calcNetYieldPreTax — see that function's doc comment. */
export function calcNetYieldPostTax(inputs: DealInputs): number {
  const equity = calcInitialEquityInvestment(inputs);
  if (!(equity > 0)) return 0;
  return (calcCashflowAnnual(inputs, false) / equity) * 100;
}

/**
 * Debt Service Coverage Ratio (DSCR): NOI / Annual Debt Service. With no debt
 * (an all-cash purchase) there is nothing to divide by and no debt to fail to
 * cover, so this returns Infinity — the same "not applicable, not a bad score"
 * convention calcPaybackPeriod already uses — rather than 0, which would read
 * as the worst possible score for a deal that in fact carries zero debt risk.
 */
export function calcDSCR(inputs: DealInputs): number {
  const annualDebtService = calcAnnualDebtService(inputs);
  if (!annualDebtService) return Infinity;
  return calcNOIAnnual(inputs) / annualDebtService;
}

export function calcLTV(inputs: DealInputs): number {
  if (!inputs.purchasePrice) return 0;
  return (calcTotalLoanAmount(inputs) / inputs.purchasePrice) * 100;
}

/**
 * Total annual operating expenses used by NOI, the Operating Expense Ratio, and
 * the Break-Even Ratio: utilities + rates/insurance/other + provisions
 * (management, maintenance, bad debts). Deliberately EXCLUDES finance/debt
 * service, which is a financing cost, not an operating expense — this keeps
 * calcNOIAnnual, calcOperatingExpenseRatio and calcNOIMargin internally
 * consistent (NOI Margin + Operating Expense Ratio == 100%).
 */
export function calcOperatingExpensesAnnual(inputs: DealInputs): number {
  const operatingCosts = calcOperatingCostsMonthly(inputs);
  const provisions = calcProvisionsMonthly(inputs);
  return (
    (operatingCosts.utilities + operatingCosts.ratesInsuranceOther + provisions.total) * 12
  );
}

/**
 * Break-Even (Default) Ratio: the share of gross revenue needed to cover ALL
 * operating expenses plus annual debt service. Unlike Operating Expense Ratio,
 * this DOES include debt service, since the point of the metric is to show the
 * occupancy/income level at which the property stops covering its debt.
 */
export function calcBreakEvenRatio(inputs: DealInputs): number {
  const grossRevenue = calcGrossRevenueAnnual(inputs);
  if (!grossRevenue) return 0;
  const operatingExpenses = calcOperatingExpensesAnnual(inputs);
  const financeCostAnnual = calcAnnualDebtService(inputs);
  return ((operatingExpenses + financeCostAnnual) / grossRevenue) * 100;
}

/**
 * Operating Expense Ratio: operating expenses (excl. finance/debt service) as a
 * % of gross revenue. Debt service is a financing cost, not an operating
 * expense, so it is intentionally excluded here — see Break-Even Ratio for the
 * version of this calculation that includes debt service.
 */
export function calcOperatingExpenseRatio(inputs: DealInputs): number {
  const grossRevenue = calcGrossRevenueAnnual(inputs);
  if (!grossRevenue) return 0;
  return (calcOperatingExpensesAnnual(inputs) / grossRevenue) * 100;
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

/**
 * Equity Payback Period: years of after-debt-service, after-tax cashflow to
 * recover the investor's own cash. Same fix as Net Yield / IRR / NPV — the
 * numerator is already levered, so the denominator must be equity invested,
 * not total investment. A deal with zero or negative cash actually put in
 * (fully or over-financed) has already "paid back" by construction — 0 years,
 * not a divide-by-zero.
 */
export function calcPaybackPeriod(inputs: DealInputs): number {
  const cashflow = calcCashflowAnnual(inputs, false);
  if (cashflow <= 0) return Infinity;
  const equity = calcInitialEquityInvestment(inputs);
  if (equity <= 0) return 0;
  return equity / cashflow;
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
 * Terminal (exit) value at the end of year 20: property value less remaining
 * debt and the capital gains tax due on sale. Shared by calcIRR and calcNPV so
 * both solvers discount the exact same year-20 cashflow — if this diverged
 * between the two, IRR and NPV would disagree about what "break-even" means.
 */
export function calcTerminalValue(inputs: DealInputs, projection: YearlyProjection[]): number {
  const remainingDebtYear20 = calcTotalRemainingLoanBalance(inputs, PROJECTION_YEARS);
  const terminalPropertyValue = projection[PROJECTION_YEARS - 1].propertyValue;
  const capitalGainsTax = Math.max(
    0,
    (terminalPropertyValue - inputs.marketValue) * (inputs.capitalGainsTaxRate / 100)
  );
  return terminalPropertyValue - remainingDebtYear20 - capitalGainsTax;
}

/**
 * The single equity-level cash-flow stream shared by calcIRR and calcNPV —
 * this is what makes them "Equity IRR" and "Equity NPV": both measure the
 * return on the investor's own cash, not on the property's full purchase
 * price.
 *
 * Index 0 (t=0)   = -Initial Equity Investment (the investor's own cash — see
 *                    calcInitialEquityInvestment). NOT total investment: that
 *                    would count debt-financed cost as the investor's own
 *                    outlay while years 1-20 already treat that same debt as
 *                    a cost to be serviced, double-counting it.
 * Index 1-20 (t=1..20) = calc20YearProjection's cashflowForPeriod, which is
 *                    already after debt service and tax (levered) — sourced
 *                    from calcCashflowAnnual/calc20YearProjection.
 * Index 20 (t=20) additionally includes the terminal (exit) value: property
 *                    value less remaining debt less capital gains tax — also
 *                    already levered (net of what's owed to the lender).
 *
 * Building this once and having both calcIRR and calcNPV consume it is what
 * guarantees they can never drift onto different cash-flow conventions.
 */
export function buildEquityCashflows(inputs: DealInputs): number[] {
  const initialEquity = calcInitialEquityInvestment(inputs);
  const projection = calc20YearProjection(inputs);
  const terminalValue = calcTerminalValue(inputs, projection);

  const cashflows = [-initialEquity, ...projection.map((p) => p.cashflowForPeriod)];
  cashflows[PROJECTION_YEARS] += terminalValue;
  return cashflows;
}

/**
 * Equity IRR over 20 years using Newton-Raphson on buildEquityCashflows(): the
 * annualised return on the investor's OWN cash, after debt service and the
 * eventual (after-tax, after-debt-payoff) sale. AssetVerdict's dashboard and
 * DealMetrics field are simply named "IRR", but this is always the equity/
 * levered return, never an unlevered property-only return — see
 * lib/education/metricDefinitions.ts for the education-facing explanation of
 * that distinction.
 */
export function calcIRR(inputs: DealInputs): number {
  const cashflows = buildEquityCashflows(inputs);

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

/**
 * Equity NPV: present value of buildEquityCashflows() — the exact same
 * equity-level cash-flow stream calcIRR solves against — discounted at
 * discountRate (the investor's required equity return; see the DealInputs
 * doc comment on discountRate). Because both functions consume the same
 * builder, discounting calcNPV's cashflows at the rate calcIRR found for the
 * same inputs is guaranteed to land NPV at ~0 — they can no longer drift onto
 * different cash-flow conventions.
 */
export function calcNPV(inputs: DealInputs): number {
  const cashflows = buildEquityCashflows(inputs);
  const rate = inputs.discountRate / 100;
  return cashflows.reduce((sum, cf, t) => sum + cf / Math.pow(1 + rate, t), 0);
}

/**
 * Equity NPV, decomposed into its named pieces for education display (Phase 2,
 * section 8): "Initial Equity Invested + PV of future cashflows + PV of
 * eventual sale proceeds". Reuses the exact same primitives as calcNPV
 * (calc20YearProjection, calcTerminalValue, calcInitialEquityInvestment) —
 * this is a restructuring of calcNPV's own math, not a second implementation
 * of it, and reconciles to calcNPV(inputs) up to floating-point rounding.
 */
export function calcNPVBreakdown(inputs: DealInputs): NPVBreakdown {
  const initialEquityInvestment = calcInitialEquityInvestment(inputs);
  const projection = calc20YearProjection(inputs);
  const terminalValue = calcTerminalValue(inputs, projection);
  const rate = inputs.discountRate / 100;

  let presentValueOfOperatingCashflows = 0;
  projection.forEach((p, index) => {
    const t = index + 1;
    presentValueOfOperatingCashflows += p.cashflowForPeriod / Math.pow(1 + rate, t);
  });
  const presentValueOfTerminalValue = terminalValue / Math.pow(1 + rate, PROJECTION_YEARS);

  return {
    initialEquityInvestment,
    presentValueOfOperatingCashflows,
    presentValueOfTerminalValue,
    discountRate: inputs.discountRate,
    npv: presentValueOfOperatingCashflows + presentValueOfTerminalValue - initialEquityInvestment,
  };
}

/**
 * Equity IRR, decomposed into its named (un-discounted) pieces for education
 * display (Phase 2, section 8) without exposing the Newton-Raphson solver:
 * how much cash went in, how much operating cashflow the 20-year projection
 * expects, and the projected equity proceeds at sale.
 */
export function calcIRRSummary(inputs: DealInputs): IRRSummary {
  const initialEquityInvestment = calcInitialEquityInvestment(inputs);
  const projection = calc20YearProjection(inputs);
  const terminalValueYear20 = calcTerminalValue(inputs, projection);
  const totalProjectedCashflow = projection.reduce((sum, p) => sum + p.cashflowForPeriod, 0);

  return {
    initialEquityInvestment,
    totalProjectedCashflow,
    terminalValueYear20,
    irr: calcIRR(inputs),
  };
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
    operatingExpensesAnnual: calcOperatingExpensesAnnual(inputs),
    annualDebtService: calcAnnualDebtService(inputs),
    provisionsMonthly: calcProvisionsMonthly(inputs),
    taxMonthly: calcTaxMonthly(inputs),
    cashflowMonthly: calcCashflowMonthly(inputs),
    cashflowAnnualPreTax: calcCashflowAnnual(inputs, true),
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
    npvBreakdown: calcNPVBreakdown(inputs),
    irrSummary: calcIRRSummary(inputs),
  };
}
