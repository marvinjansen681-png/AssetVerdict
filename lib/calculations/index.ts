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

  // Exit assumption — when set, Equity IRR/NPV exit at this year instead of
  // the 20-year default. Optional (rather than required) so the many literal
  // DealInputs fixtures across the test suite that predate this field don't
  // all need updating; calcHoldPeriodYears() treats an absent value the same
  // as wantToSell: false.
  wantToSell?: boolean;
  saleYear?: number | null;

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
  // The user's own estimate of the monthly bills-included amount per
  // room/bed. Null = not separately recorded (legacy deal, or the toggle
  // is off) — never treated as a confirmed zero. See calcBillsIncludedMonthly.
  billsIncludedAmount: number | null;
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
  billsIncludedMonthly: number;
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
  /** Years to exit — see calcHoldPeriodYears(). 20 unless wantToSell + saleYear are set. */
  holdPeriodYears: number;
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
  /** Terminal value at the actual exit year — see calcHoldPeriodYears(). Named "AtExit", not "Year20": the exit year is only 20 by default. */
  terminalValueAtExit: number;
  /** Years to exit — see calcHoldPeriodYears(). 20 unless wantToSell + saleYear are set. */
  holdPeriodYears: number;
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
  /** Undefined for Fix & Flip — see calcExitSummary() doc comment for why. */
  exitSummary?: ExitSummary;
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
 * The deterministic student-property capacity concepts — rooms and beds are
 * NOT interchangeable (a sharing room is one physical room with multiple
 * beds), and neither is the same as numUnits (a generic per-strategy field
 * that means "rooms" for multi_let but has no defined meaning for student,
 * where the real capacity truth is this room/bed structure). This is the ONE
 * place that structure gets read from — both calcStudentAnnualRevenue-derived
 * financial calculations and advisory features (e.g. Area Intelligence) must
 * source capacity from here rather than each reconstructing it independently
 * or falling back to numUnits.
 */
export interface StudentCapacity {
  /** Physical rooms: single rooms + sharing rooms, each counted once regardless of beds inside. */
  roomCount: number;
  /** Total beds: single rooms (1 bed each) + sharing rooms × beds per sharing room. */
  bedCount: number;
}

export function calcStudentCapacity(
  inputs: Pick<DealInputs, "singleRoomCount" | "sharingRoomCount" | "sharingBedsPerRoom">
): StudentCapacity {
  return {
    roomCount: inputs.singleRoomCount + inputs.sharingRoomCount,
    bedCount: inputs.singleRoomCount + inputs.sharingRoomCount * inputs.sharingBedsPerRoom,
  };
}

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

/**
 * Total annual debt service actually payable in a specific projection year,
 * accounting for finance sources that have already matured by then. Mirrors
 * remainingLoanBalance()'s own maturity convention exactly: a source with
 * `termYears <= year` has fully amortised by the end of `year` and stops
 * contributing debt service from that year onward (the final year of
 * payments — `year === termYears` — still contributes its full repayment,
 * since payments continue through the loan's last year). calcAnnualDebtService
 * above is a current/Year-1 snapshot (used by DSCR and Break-Even Ratio,
 * which are deliberately not projected year-by-year); this is the
 * year-aware counterpart used by calc20YearProjection so debt service in the
 * projection table stops exactly when remainingDebt reaches zero.
 */
export function calcAnnualDebtServiceForYear(inputs: DealInputs, year: number): number {
  return inputs.financeSources.reduce(
    (sum, f) => sum + (year <= f.termYears ? f.repaymentAmount * 12 : 0),
    0
  );
}

/**
 * Number of rooms/beds the bills-included amount is charged per, mirroring
 * the same strategy-specific unit count used for base revenue (per_room:
 * numUnits, student: single + sharing beds).
 */
export function calcBillsIncludedUnitCount(inputs: DealInputs): number {
  if (inputs.strategy === "student") {
    return calcStudentCapacity(inputs).bedCount;
  }
  return inputs.numUnits;
}

/**
 * Monthly utilities cost contributed by the user's own bills-included
 * estimate. Zero when the toggle is off or the amount was never recorded —
 * a null/absent amount is never treated as a confirmed zero being "added",
 * it simply contributes nothing extra (see billsIncludedAmount on DealInputs).
 */
export function calcBillsIncludedMonthly(inputs: DealInputs): number {
  if (!inputs.billsIncluded || !isFiniteNumber(inputs.billsIncludedAmount) || inputs.billsIncludedAmount <= 0) {
    return 0;
  }
  return inputs.billsIncludedAmount * calcBillsIncludedUnitCount(inputs);
}

export function calcOperatingCostsMonthly(inputs: DealInputs): OperatingCosts {
  const finance = calcTotalFinanceCostMonthly(inputs);
  const billsIncludedMonthly = calcBillsIncludedMonthly(inputs);
  const utilities =
    inputs.waterSewerage +
    inputs.electricity +
    inputs.securityCleaning +
    inputs.internetCost +
    inputs.netflixCost +
    inputs.gasRefillCost +
    inputs.wasteRemovalCost +
    billsIncludedMonthly;
  const ratesInsuranceOther =
    inputs.ratesAndTaxes + inputs.insurance + inputs.levies + inputs.houseParentCost;
  return {
    finance,
    utilities,
    ratesInsuranceOther,
    billsIncludedMonthly,
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
 * Finance repayments are held fixed at their monthly amount while a loan is
 * outstanding (loan terms/rates don't change), and stop entirely once a
 * source matures partway through the projection — see
 * calcAnnualDebtServiceForYear(), which stays exactly consistent with the
 * remaining-balance amortisation below so `financeCost` and `remainingDebt`
 * can never disagree about whether a loan is still being paid off.
 */
export function calc20YearProjection(inputs: DealInputs): YearlyProjection[] {
  const totalInvestment = calcTotalInvestment(inputs);
  const baseGrossRevenue = calcGrossRevenueAnnual(inputs);
  const baseOperatingCostsExclFinance =
    (calcOperatingCostsMonthly(inputs).utilities +
      calcOperatingCostsMonthly(inputs).ratesInsuranceOther) *
    12;
  const baseProvisions = calcProvisionsMonthly(inputs).total * 12;

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
    const financeCostAnnual = calcAnnualDebtServiceForYear(inputs, year);

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
 * Years until exit for equity-return purposes: the deal's own planned-sale
 * assumption (wantToSell + saleYear) if set, otherwise the 20-year default.
 * Clamped to the 20-year projection table — calc20YearProjection() never
 * generates rows beyond that, and the Projected Sale Year input itself is
 * capped at 20 in the Acquisition tab UI.
 */
export function calcHoldPeriodYears(inputs: DealInputs): number {
  if (inputs.wantToSell && isFiniteNumber(inputs.saleYear) && inputs.saleYear > 0) {
    return Math.min(Math.round(inputs.saleYear), PROJECTION_YEARS);
  }
  return PROJECTION_YEARS;
}

/**
 * The three components behind terminal (exit) value, decomposed. Both
 * calcTerminalValue (the number IRR/NPV actually discount) and calcExitSummary
 * (the breakdown Exit Analysis and education display) are thin views onto this
 * single computation, so they can never disagree about what "exit" means for
 * a given holdYear.
 */
function calcTerminalValueBreakdown(
  inputs: DealInputs,
  projection: YearlyProjection[],
  holdYear: number
): {
  projectedPropertyValueAtExit: number;
  remainingDebtAtExit: number;
  capitalGainsTaxAtExit: number;
  terminalEquityValue: number;
} {
  const remainingDebtAtExit = calcTotalRemainingLoanBalance(inputs, holdYear);
  const projectedPropertyValueAtExit = projection[holdYear - 1].propertyValue;
  const capitalGainsTaxAtExit = Math.max(
    0,
    (projectedPropertyValueAtExit - inputs.marketValue) * (inputs.capitalGainsTaxRate / 100)
  );
  return {
    projectedPropertyValueAtExit,
    remainingDebtAtExit,
    capitalGainsTaxAtExit,
    terminalEquityValue: projectedPropertyValueAtExit - remainingDebtAtExit - capitalGainsTaxAtExit,
  };
}

/**
 * Terminal (exit) value at `holdYear`: property value less remaining debt and
 * the capital gains tax due on sale. Shared by calcIRR and calcNPV (both via
 * buildEquityCashflows) so both solvers discount the exact same exit-year
 * cashflow — if this diverged between the two, IRR and NPV would disagree
 * about what "break-even" means. `holdYear` is always calcHoldPeriodYears(inputs)
 * in practice; passed explicitly (not re-derived here) so every caller is
 * forced to source it from the one function that decides the exit year.
 */
export function calcTerminalValue(
  inputs: DealInputs,
  projection: YearlyProjection[],
  holdYear: number
): number {
  return calcTerminalValueBreakdown(inputs, projection, holdYear).terminalEquityValue;
}

/**
 * The decomposed exit picture for Exit Analysis / education / Deal Coach —
 * the same three components calcTerminalValue nets together, plus the hold
 * period and whether it comes from a planned sale or the 20-year default
 * (see calcHoldPeriodYears). This is the ONE place any advisory surface
 * should get exit figures from; nothing outside lib/calculations should ever
 * recompute a projected sale price, remaining debt, or CGT itself.
 *
 * Not meaningful for Fix & Flip — that strategy's exit economics (holding
 * period in months, sale price, CGT) are entirely separate and already fully
 * captured by calcFlipProfit()/FlipMetrics; calcAllMetrics omits this field
 * for fix_and_flip deals rather than forcing a 20-year rental read on a
 * short-hold flip.
 */
export interface ExitSummary {
  holdPeriodYears: number;
  /** True when this hold period comes from the deal's own wantToSell/saleYear assumption, false when it's AssetVerdict's 20-year default analysis horizon. */
  isPlannedSale: boolean;
  projectedPropertyValueAtExit: number;
  remainingDebtAtExit: number;
  capitalGainsTaxAtExit: number;
  terminalEquityValue: number;
}

export function calcExitSummary(inputs: DealInputs): ExitSummary {
  const projection = calc20YearProjection(inputs);
  const holdPeriodYears = calcHoldPeriodYears(inputs);
  const isPlannedSale = Boolean(inputs.wantToSell) && isFiniteNumber(inputs.saleYear) && inputs.saleYear > 0;
  const breakdown = calcTerminalValueBreakdown(inputs, projection, holdPeriodYears);
  return {
    holdPeriodYears,
    isPlannedSale,
    ...breakdown,
  };
}

/**
 * The single equity-level cash-flow stream shared by calcIRR and calcNPV —
 * this is what makes them "Equity IRR" and "Equity NPV": both measure the
 * return on the investor's own cash, not on the property's full purchase
 * price.
 *
 * Index 0 (t=0)      = -Initial Equity Investment (the investor's own cash —
 *                    see calcInitialEquityInvestment). NOT total investment:
 *                    that would count debt-financed cost as the investor's
 *                    own outlay while the exit years already treat that same
 *                    debt as a cost to be serviced, double-counting it.
 * Index 1..holdYears = calc20YearProjection's cashflowForPeriod (sliced to the
 *                    hold period — see calcHoldPeriodYears), already after
 *                    debt service and tax (levered).
 * Index holdYears additionally includes the terminal (exit) value: property
 *                    value less remaining debt less capital gains tax at that
 *                    year — also already levered.
 *
 * Building this once and having both calcIRR and calcNPV consume it is what
 * guarantees they can never drift onto different cash-flow conventions, and
 * that both always agree on the same exit year.
 */
export function buildEquityCashflows(inputs: DealInputs): number[] {
  const initialEquity = calcInitialEquityInvestment(inputs);
  const projection = calc20YearProjection(inputs);
  const holdYears = calcHoldPeriodYears(inputs);
  const terminalValue = calcTerminalValue(inputs, projection, holdYears);

  const cashflows = [
    -initialEquity,
    ...projection.slice(0, holdYears).map((p) => p.cashflowForPeriod),
  ];
  cashflows[holdYears] += terminalValue;
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
  const holdYears = calcHoldPeriodYears(inputs);
  const terminalValue = calcTerminalValue(inputs, projection, holdYears);
  const rate = inputs.discountRate / 100;

  let presentValueOfOperatingCashflows = 0;
  projection.slice(0, holdYears).forEach((p, index) => {
    const t = index + 1;
    presentValueOfOperatingCashflows += p.cashflowForPeriod / Math.pow(1 + rate, t);
  });
  const presentValueOfTerminalValue = terminalValue / Math.pow(1 + rate, holdYears);

  return {
    initialEquityInvestment,
    presentValueOfOperatingCashflows,
    presentValueOfTerminalValue,
    discountRate: inputs.discountRate,
    holdPeriodYears: holdYears,
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
  const holdYears = calcHoldPeriodYears(inputs);
  const terminalValueAtExit = calcTerminalValue(inputs, projection, holdYears);
  const totalProjectedCashflow = projection
    .slice(0, holdYears)
    .reduce((sum, p) => sum + p.cashflowForPeriod, 0);

  return {
    initialEquityInvestment,
    totalProjectedCashflow,
    terminalValueAtExit,
    holdPeriodYears: holdYears,
    irr: calcIRR(inputs),
  };
}

/** Computes the full metrics object used to populate the Summary dashboard. */
export function calcAllMetrics(inputs: DealInputs): DealMetrics {
  return {
    flipMetrics:
      inputs.strategy === "fix_and_flip" ? calcFlipProfit(inputs) : undefined,
    exitSummary:
      inputs.strategy === "fix_and_flip" ? undefined : calcExitSummary(inputs),
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
