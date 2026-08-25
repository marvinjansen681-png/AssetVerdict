import { calcMonthlyRepayment } from "./amortisation";
import { annualiseReturnOverMonths } from "./returnMath";
// Deliberate late-bound circular import: fixFlip.ts imports several pure
// primitives FROM this module (calcMonthlyRepayment, calcFinancingTotalsOverMonths,
// remainingLoanBalanceAfterMonths, solvePeriodicIRR, isFiniteNumber) — all
// used only inside function bodies there, never at module-evaluation time —
// and this module only needs fixFlip's export inside calcAllMetrics's own
// function body below, likewise never at module-evaluation time. ES module
// circular imports are safe under that condition; see index.test.ts's own
// "fixFlipAnalysis is attached" regression coverage.
import { calcFixFlipAnalysis, type FixFlipAnalysis } from "./fixFlip";

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

/**
 * Phase 4.11: only loanAmount/interestRate/termYears are treated as finance
 * inputs — monthly repayment is a derived fact, always recomputed from these
 * three via calcMonthlyRepayment(), never accepted as a field on this type.
 * This makes it structurally impossible for a stale or client-submitted
 * repayment figure to reach the calculation engine.
 */
export interface FinanceSourceInput {
  loanAmount: number;
  interestRate: number; // %
  termYears: number;
}

/**
 * Full set of inputs required to compute deal metrics. Annual unless noted.
 */
export interface DealInputs {
  // Acquisition
  purchasePrice: number;
  /**
   * Phase 4.23 audit finding: this field silently defaults to purchasePrice
   * when the investor never entered a value (see assembleInputs.ts) —
   * existing consumers (calcCapRateMV, calcProjectedPropertyValue, the
   * 20-year projection's propertyValue) genuinely depend on that fallback
   * and are UNCHANGED by Phase 4.23.1. For Estimated Value LTV specifically,
   * that silent fallback would be misleading (it would imply the investor
   * entered an independent estimate when they didn't) — see
   * `estimatedMarketValue` below, which preserves the raw, un-defaulted
   * value for exactly that purpose.
   */
  marketValue: number;
  /**
   * Phase 4.23.1 — the RAW, never-defaulted "Estimated Current Market
   * Value" the investor explicitly typed (or null if they left it blank).
   * Unlike `marketValue` above, this NEVER falls back to purchasePrice —
   * see assembleInputs.ts. The one and only consumer is
   * calcEstimatedValueLTV(); every other calculation continues reading
   * `marketValue` unchanged.
   *
   * Optional (rather than required), mirroring `wantToSell?`/`saleYear?`
   * above — so the many literal DealInputs fixtures across the test suite
   * that predate this field don't all need updating; calcEstimatedValueLTV
   * treats an absent value the same as an explicit null (isFiniteNumber
   * rejects both identically).
   */
  estimatedMarketValue?: number | null;
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
  /**
   * Phase 4.21 (Defect 5): an INVESTOR/EQUITY-level running total — starts
   * at -calcInitialEquityInvestment(inputs), not -calcTotalInvestment(inputs).
   * cashflowForPeriod is already after debt service and tax (a levered,
   * equity-level figure — see its own field position in buildEquityCashflows),
   * so the cumulative total it feeds must start from the same equity basis,
   * not the full project cost. Mixing an equity-level numerator with a
   * project-cost-level starting balance was exactly the class of bug already
   * fixed for Cash-on-Cash Return, Payback Period, IRR, and NPV (see
   * calcInitialEquityInvestment's own doc comment) — this was the one place
   * it survived.
   */
  cumulativeCashflow: number;
  propertyValue: number;
  /**
   * Phase 4.21 (Defect 5) — renamed in effect from a mixed-basis "ROI" to an
   * "Annual Cash-on-Cash Return": cashflowForPeriod (equity-level) divided by
   * calcInitialEquityInvestment(inputs) (equity-level), the same pairing
   * calcNetYieldPreTax/calcNetYieldPostTax already use for Year 1. `null` —
   * never a fake 0% — when initial equity is zero or negative (fully or
   * over-financed deal), where a cash-on-cash return has no meaningful
   * denominator. See UI/PDF labels: "Annual Cash-on-Cash Return", not "ROI".
   */
  yearlyROI: number | null;
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
  /** Phase 4.17: transferBondCost + sourcingFee — previously omitted from totalCost entirely (a real gap, not a zero-cost strategy choice). */
  acquisitionCosts: number;
  renovationCost: number;
  holdingCosts: number;
  /** Phase 4.17: financing INTEREST paid during the hold — never principal, which is financing cashflow, not a project expense. Previously omitted; a financed Flip showed identical profit to an all-cash Flip. */
  financingInterest: number;
  agentFee: number;
  expectedSalePrice: number;
  grossProfit: number;
  /**
   * Phase 4.10: shown PRE-TAX. SARS treats property bought and sold at short
   * intervals as carrying real risk of being classified as trading activity,
   * with disposal profit taxed in full as revenue rather than as a capital
   * gain (https://www.sars.gov.za/faq/faq-if-a-salaried-employee-owns-a-house-that-he-lives-in-and-owns-a-second-property-that-was-let-out-is-he-liable-for-capital-gains-tax-on-the-second-property-which-he-sold/)
   * — so AssetVerdict can no longer assume every Fix & Flip disposal is a
   * capital gain and automatically deduct capitalGainsTaxRate. The internal
   * field name is retained for compatibility (this type is never persisted,
   * so renaming carries no migration risk, but callers already reference
   * this key); every user-facing label now reads "before tax" — see
   * FlipDashboard.tsx, metricDefinitions.ts, and DealSummaryPDF.tsx. Equal
   * to grossProfit — no tax is deducted here at all.
   */
  netProfit: number;
  roi: number;
  /**
   * Compounding-equivalent annualisation of `roi` (Phase 4.17.1, via the
   * shared annualiseReturnOverMonths helper — the same one
   * FixFlipAnalysis.profitability.annualisedPreTaxROI uses, so the two
   * always agree). Previously a linear approximation (roi / holdingYears)
   * that silently disagreed with the Phase 4.17 model's own figure, and
   * silently returned 0 — rather than null — for an invalid holding
   * period. null means "not calculable" (invalid holding period, or ROI
   * <= -100%): never conflate with a genuine 0% return.
   */
  annualisedROI: number | null;
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
  /**
   * @deprecated Phase 4.23.1 — kept only for backward compatibility.
   * Numerically identical to `purchaseLtv` (same formula, same value) —
   * see calcLTV()'s own doc comment. Never diverges from `purchaseLtv`;
   * new code should read `purchaseLtv` directly. This field's MEANING has
   * not changed (still Total Loan Amount ÷ Purchase Price), only its name
   * is now known to be misleading — see
   * AssetVerdict_Phase4.23_LTV_Leverage_Definition_Audit.md.
   */
  ltv: number;
  /** Phase 4.23.1 — debt relative to the AGREED PURCHASE PRICE. The authoritative, verdict-facing leverage metric (unchanged formula/thresholds from the legacy `ltv` field — see calcPurchaseLTV()). */
  purchaseLtv: number;
  /** Phase 4.23.1 — debt relative to the investor's own explicitly-entered Estimated Current Market Value. Informational ONLY: no verdict/Safety-State/negotiation authority, no calibrated thresholds. null when no estimate was entered — see calcEstimatedValueLTV(). */
  estimatedValueLtv: number | null;
  /** Phase 4.23.1 — debt relative to the full authoritative Total Investment (calcTotalInvestment). Informational ONLY: no verdict authority, no calibrated thresholds — see calcProjectLeverage(). */
  projectLeverage: number | null;
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
  /**
   * Phase 4.17 — the full deterministic Fix & Flip financial model (cost
   * breakdown, financing breakdown, equity cashflow schedule, equity IRR,
   * break-even sale price). Only attached for strategy "fix_and_flip" (see
   * calcAllMetrics) — undefined for every other strategy, exactly mirroring
   * flipMetrics' own convention. See lib/calculations/fixFlip.ts.
   */
  fixFlipAnalysis?: FixFlipAnalysis;
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

/**
 * Sum of all finance source monthly repayments — each one derived fresh from
 * its own loanAmount/interestRate/termYears via the single shared
 * amortisation formula (Phase 4.11). Never trusts a stored/submitted
 * repayment figure.
 */
export function calcTotalFinanceCostMonthly(inputs: DealInputs): number {
  return inputs.financeSources.reduce(
    (sum, f) => sum + calcMonthlyRepayment(f.loanAmount, f.interestRate, f.termYears),
    0
  );
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
    (sum, f) =>
      sum + (year <= f.termYears ? calcMonthlyRepayment(f.loanAmount, f.interestRate, f.termYears) * 12 : 0),
    0
  );
}

/**
 * Phase 4.10: the one interest/principal decomposition truth, derived
 * entirely from the existing amortisation model — no second debt engine.
 * `principal` for a year is exactly how much the aggregate remaining
 * balance fell during that year (calcTotalRemainingLoanBalance at the
 * start of the year minus at the end); `interest` is whatever's left of
 * debt service once principal is accounted for. This is mathematically
 * exact for a standard amortising loan, aggregates correctly across
 * multiple independently-amortising sources (each source's own
 * interest/principal split sums linearly — see the regression tests), and
 * automatically respects loan maturity: a matured source contributes 0 to
 * every field the year after its remainingBalance reaches 0, consistent
 * with calcAnnualDebtServiceForYear.
 */
export interface DebtServiceBreakdown {
  debtService: number;
  interest: number;
  principal: number;
  remainingBalance: number;
}

export function calcDebtServiceBreakdownForYear(inputs: DealInputs, year: number): DebtServiceBreakdown {
  const debtService = calcAnnualDebtServiceForYear(inputs, year);
  const balanceStart = calcTotalRemainingLoanBalance(inputs, year - 1);
  const balanceEnd = calcTotalRemainingLoanBalance(inputs, year);
  const principal = balanceStart - balanceEnd;
  const interest = debtService - principal;
  return { debtService, interest, principal, remainingBalance: balanceEnd };
}

/**
 * The interest component of the deal's CURRENT (Year 1) annual debt
 * service — the interest counterpart to calcAnnualDebtService(), which is
 * itself a current/Year-1 snapshot (not projected year-by-year; see that
 * function's doc comment). Used by calcCashflowAnnual/calcTaxMonthly for
 * the deal's present-day simplified taxable-income estimate: SARS treats
 * bond interest as a permissible rental expense but principal repayment is
 * a capital/balance-sheet item, not a deduction against rental income
 * (https://www.sars.gov.za/types-of-tax/personal-income-tax/tax-on-rental-income/)
 * — so only this figure, not full debt service, should reduce taxable
 * income. Full debt service still reduces cashflow (see calcCashflowAnnual)
 * because principal is a real cash outflow regardless of its tax treatment.
 */
export function calcAnnualInterest(inputs: DealInputs): number {
  return calcDebtServiceBreakdownForYear(inputs, 1).interest;
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
 * Annual net cashflow. Cashflow itself still subtracts FULL debt service
 * (principal is a real cash outflow regardless of its tax treatment — see
 * calcOperatingCostsMonthly, which bakes finance cost into `operatingCosts`
 * below). Tax is a simplified estimate: (NOI - annual INTEREST only) x
 * income tax rate, floored at zero (no tax benefit modelled for negative
 * taxable income) — see calcAnnualInterest's doc comment for why principal
 * is excluded from the tax base (Phase 4.10, SARS-verified).
 */
export function calcCashflowAnnual(inputs: DealInputs, beforeTax: boolean): number {
  const grossRevenue = calcGrossRevenueAnnual(inputs);
  const operatingCosts = calcOperatingCostsMonthly(inputs).total * 12;
  const provisions = calcProvisionsMonthly(inputs).total * 12;
  const cashflowBeforeTax = grossRevenue - operatingCosts - provisions;
  if (beforeTax) return cashflowBeforeTax;

  const interestAnnual = calcAnnualInterest(inputs);
  const tax = Math.max(
    0,
    (calcNOIAnnual(inputs) - interestAnnual) * (inputs.incomeTaxRate / 100)
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

/**
 * Purchase LTV (Phase 4.23.1) — debt relative to the AGREED PURCHASE
 * PRICE. This is the authoritative, verdict-facing leverage metric:
 * Safety State (lib/calculations/verdict.ts) and the negotiation engine's
 * "fixed original LTV" policy have only ever been exercised against this
 * exact denominator, and thresholds.ts's 60/75 bands were never validated
 * against any other one — see
 * AssetVerdict_Phase4.23_LTV_Leverage_Definition_Audit.md. This phase's
 * acceptance rule is that verdict behaviour must not change, so the
 * formula below is BYTE-IDENTICAL to the pre-4.23.1 calcLTV() for every
 * purchasePrice > 0.
 *
 * The one substantive change is the guard now also catching a NEGATIVE
 * purchasePrice (previously only `!inputs.purchasePrice` — falsy, so 0/
 * null/NaN — was caught; a negative price fell through to a nonsensical
 * negative percentage, a defect Phase 4.23 documented but did not fix).
 * This is safe: applicability.ts's `requiresPositive(purchasePrice > 0)`
 * already excludes ANY non-positive purchase price (negative included) as
 * not_applicable independently of this function's return value, so no
 * user-visible verdict/UI outcome changes for any deal — this only hardens
 * the low-level function itself against ever handing a caller a garbage
 * negative number.
 */
export function calcPurchaseLTV(inputs: DealInputs): number {
  if (!inputs.purchasePrice || inputs.purchasePrice < 0) return 0;
  return (calcTotalLoanAmount(inputs) / inputs.purchasePrice) * 100;
}

/**
 * @deprecated Phase 4.23.1 — renamed to calcPurchaseLTV() because "LTV"
 * without qualification misleadingly implied an independent property
 * valuation when the denominator has always been the purchase price. This
 * alias delegates directly — never a second formula — and exists only so
 * pre-4.23.1 call sites keep compiling while they're migrated. New code
 * must call calcPurchaseLTV() directly.
 */
export function calcLTV(inputs: DealInputs): number {
  return calcPurchaseLTV(inputs);
}

/**
 * Estimated Value LTV (Phase 4.23.1) — debt relative to the investor's OWN
 * explicitly-entered Estimated Current Market Value. INFORMATIONAL ONLY:
 * no verdict, Safety State, or negotiation authority, and deliberately NO
 * calibrated threshold bands exist for it in thresholds.ts (reusing
 * Purchase LTV's 60/75 bands here would be unjustified — a different
 * denominator changes what those numbers would even mean; see the audit
 * report §13).
 *
 * Reads `inputs.estimatedMarketValue` — the RAW, never-defaulted field —
 * never `inputs.marketValue` (which silently falls back to purchasePrice
 * when blank; see DealInputs's own doc comment). Returns `null`, never a
 * fabricated percentage, whenever the investor hasn't entered a positive
 * estimate: a blank Estimated Current Market Value must never silently
 * read as if the investor had confirmed an independent value.
 */
export function calcEstimatedValueLTV(inputs: DealInputs): number | null {
  const value = inputs.estimatedMarketValue;
  if (!isFiniteNumber(value) || value <= 0) return null;
  return (calcTotalLoanAmount(inputs) / value) * 100;
}

/**
 * Project Leverage (Phase 4.23.1) — debt relative to the full authoritative
 * Total Investment (calcTotalInvestment — purchase price + transfer/bond
 * costs + sourcing fee + Furniture/Setup/Renovation Cost Used, unchanged
 * from Phase 4.21/4.22). INFORMATIONAL ONLY: no verdict authority, no
 * calibrated thresholds — same rationale as calcEstimatedValueLTV above.
 * Returns `null`, never a fabricated percentage, when Total Investment
 * isn't positive.
 */
export function calcProjectLeverage(inputs: DealInputs): number | null {
  const totalInvestment = calcTotalInvestment(inputs);
  if (!(totalInvestment > 0)) return null;
  return (calcTotalLoanAmount(inputs) / totalInvestment) * 100;
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

/** Monthly tax estimate: (NOI - monthly interest only) x income tax rate, floored at zero. See calcAnnualInterest's doc comment. */
export function calcTaxMonthly(inputs: DealInputs): number {
  const noiMonthly = calcNOIAnnual(inputs) / 12;
  const interestMonthly = calcAnnualInterest(inputs) / 12;
  return Math.max(0, (noiMonthly - interestMonthly) * (inputs.incomeTaxRate / 100));
}

/** Monthly net cashflow after operating costs, provisions, and tax. */
export function calcCashflowMonthly(inputs: DealInputs): number {
  return calcCashflowAnnual(inputs, false) / 12;
}

/**
 * Fix & Flip profit at point of sale — a single lump event rather than an
 * ongoing cashflow. Only meaningful when inputs.strategy === 'fix_and_flip'.
 *
 * Phase 4.10: reports PRE-TAX. capitalGainsTaxRate is deliberately NOT
 * applied here — see FlipMetrics.netProfit's doc comment. `netProfit`
 * equals `grossProfit` exactly; no tax of any kind is deducted.
 *
 * Phase 4.17 correction: `totalCost` previously omitted two real costs —
 * acquisition/transfer costs (transferBondCost + sourcingFee) and financing
 * interest during the hold. A financed Flip therefore showed IDENTICAL
 * profit to an all-cash Flip with the same purchase price, which is wrong —
 * borrowing doesn't make the property cheaper, but the INTEREST paid to
 * borrow is a real project cost. Both are now included. Loan PRINCIPAL is
 * deliberately still excluded — repaying principal is not an expense, it is
 * financing cashflow (see lib/calculations/fixFlip.ts's module doc comment
 * for the full project-economics-vs-financing-cashflow architecture and the
 * richer FixFlipAnalysis breakdown/equity-cashflow/IRR/break-even that now
 * accompanies this simpler summary figure).
 */
export function calcFlipProfit(inputs: DealInputs): FlipMetrics {
  const acquisitionCosts = inputs.transferBondCost + inputs.sourcingFee;
  const holdingCosts = inputs.holdingCostPerMonth * Math.max(0, inputs.holdingPeriodMonths);
  const agentFee = inputs.expectedSalePrice * (inputs.agentCommission / 100);
  const financingInterest = calcFinancingTotalsOverMonths(inputs, inputs.holdingPeriodMonths).totalInterestPaid;
  const totalCost =
    inputs.purchasePrice + acquisitionCosts + inputs.renovationCost + holdingCosts + agentFee + financingInterest;

  const grossProfit = inputs.expectedSalePrice - totalCost;
  const netProfit = grossProfit;

  const roi = totalCost ? (netProfit / totalCost) * 100 : 0;
  // Phase 4.17.1: shared with FixFlipAnalysis.profitability.annualisedPreTaxROI
  // — one compounding-equivalent implementation, not two independent ones.
  const annualisedROI = annualiseReturnOverMonths(roi, inputs.holdingPeriodMonths);
  const profitMargin = inputs.expectedSalePrice
    ? (netProfit / inputs.expectedSalePrice) * 100
    : 0;

  return {
    totalCost,
    purchasePrice: inputs.purchasePrice,
    acquisitionCosts,
    renovationCost: inputs.renovationCost,
    holdingCosts,
    financingInterest,
    agentFee,
    expectedSalePrice: inputs.expectedSalePrice,
    grossProfit,
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
 * Year-specific provisions for the 20-year projection (Phase 4.21 — Defect
 * 6). Previously the projection took the CURRENT total provisions (management
 * + maintenance + bad debts, whatever mix of % and fixed-Rand fields produced
 * it) and applied a single blended rentGrowthFactor to the whole total — this
 * silently grew fixed-Rand provisions (e.g. a flat management fee amount) at
 * the rental growth rate, which has no economic basis; a flat Rand fee has
 * nothing to do with rent.
 *
 * Each component now grows on the assumption that actually applies to it:
 *   - Revenue-linked components (a percentage management fee, the STR
 *     platform fee, percentage maintenance, and bad debts — which is always
 *     a % of gross revenue, with no fixed-Rand mode) scale with THAT YEAR'S
 *     own projected gross revenue (`grossRevenueAnnualForYear`, already
 *     reflecting rental growth) — recomputed fresh each year, not derived by
 *     multiplying a Year-1 Rand figure by a growth factor.
 *   - Fixed-Rand components (a flat management fee amount, a flat
 *     maintenance amount) grow with cost inflation (`costGrowthFactor`)
 *     instead, exactly like the projection's other fixed operating costs
 *     (utilities, rates/insurance/other).
 *
 * At year 1 (rentGrowthFactor === costGrowthFactor === 1), this reproduces
 * calcProvisionsMonthly(inputs).total * 12 exactly — see
 * index.test.ts's own reconciliation test.
 */
function calcProvisionsAnnualForYear(
  inputs: DealInputs,
  grossRevenueAnnualForYear: number,
  costGrowthFactor: number
): Provisions {
  const management =
    inputs.strategy === "str"
      ? grossRevenueAnnualForYear * (inputs.platformFeesPct / 100)
      : inputs.managementFeeMode === "percent"
        ? grossRevenueAnnualForYear * (inputs.managementFeeValue / 100)
        : inputs.managementFeeValue * 12 * costGrowthFactor;

  const maintenance =
    inputs.maintenanceCostMode === "percent"
      ? grossRevenueAnnualForYear * (inputs.maintenanceCostValue / 100)
      : inputs.maintenanceCostValue * 12 * costGrowthFactor;

  // Bad debts has no fixed-Rand mode (DealInputs.badDebtsPct is always a %
  // of gross revenue — see calcBadDebtsMonthly) — always revenue-linked.
  const badDebts = grossRevenueAnnualForYear * (inputs.badDebtsPct / 100);

  return { management, maintenance, badDebts, total: management + maintenance + badDebts };
}

/**
 * Projected property value after `year` years of capital growth from
 * `marketValue` — the exact compounding formula calc20YearProjection uses
 * for its own `propertyValue` field, extracted (Phase 4.21) so a caller that
 * only needs this one figure (e.g. the Acquisition tab's "Sale Price at
 * Exit" live preview) can reuse it directly instead of re-deriving the
 * Math.pow compounding itself or running the full 20-year loop.
 */
export function calcProjectedPropertyValue(marketValue: number, capitalGrowthRatePct: number, year: number): number {
  return marketValue * Math.pow(1 + capitalGrowthRatePct / 100, year);
}

/**
 * 20-year cashflow projection with rent/cost/capital growth escalations.
 * Finance repayments are held fixed at their monthly amount while a loan is
 * outstanding (loan terms/rates don't change), and stop entirely once a
 * source matures partway through the projection — see
 * calcAnnualDebtServiceForYear(), which stays exactly consistent with the
 * remaining-balance amortisation below so `financeCost` and `remainingDebt`
 * can never disagree about whether a loan is still being paid off.
 *
 * Phase 4.21 (Defect 5): `cashflowForPeriod` is already an INVESTOR/EQUITY-
 * level cashflow — it has debt service and tax already subtracted, exactly
 * like buildEquityCashflows' own per-year entries (this function's rows ARE
 * that stream's source, sliced to the hold period — see buildEquityCashflows).
 * `cumulativeCashflow` and `yearlyROI` must therefore be read on that SAME
 * equity basis, not against calcTotalInvestment (the full, unlevered project
 * cost) — mixing a levered numerator with an unlevered denominator was
 * exactly the class of bug already fixed for Cash-on-Cash Return, Payback
 * Period, IRR, and NPV (see calcInitialEquityInvestment's doc comment); this
 * was the one place in the engine it had survived. `yearlyROI` is `null`,
 * never a fake 0%, when initial equity is zero or negative.
 */
export function calc20YearProjection(inputs: DealInputs): YearlyProjection[] {
  const initialEquityInvestment = calcInitialEquityInvestment(inputs);
  const baseGrossRevenue = calcGrossRevenueAnnual(inputs);
  const baseOperatingCostsExclFinance =
    (calcOperatingCostsMonthly(inputs).utilities +
      calcOperatingCostsMonthly(inputs).ratesInsuranceOther) *
    12;

  const projections: YearlyProjection[] = [];
  let cumulativeCashflow = -initialEquityInvestment;

  for (let year = 1; year <= PROJECTION_YEARS; year++) {
    const rentGrowthFactor = Math.pow(1 + inputs.rentalGrowthRate / 100, year - 1);
    const costGrowthFactor = Math.pow(1 + inputs.costInflation / 100, year - 1);
    const capitalGrowthFactor = Math.pow(1 + inputs.capitalGrowthRate / 100, year);

    const grossRevenue = baseGrossRevenue * rentGrowthFactor;
    const operatingCostsExclFinance = baseOperatingCostsExclFinance * costGrowthFactor;
    const provisions = calcProvisionsAnnualForYear(inputs, grossRevenue, costGrowthFactor).total;
    const noi = grossRevenue - operatingCostsExclFinance - provisions;
    const debtBreakdown = calcDebtServiceBreakdownForYear(inputs, year);
    const financeCostAnnual = debtBreakdown.debtService;

    // Cashflow still subtracts full debt service (principal is a real cash
    // outflow); tax subtracts interest only (Phase 4.10 — see
    // calcAnnualInterest's doc comment).
    const taxAmount = Math.max(
      0,
      (noi - debtBreakdown.interest) * (inputs.incomeTaxRate / 100)
    );

    const cashflowForPeriod =
      grossRevenue - operatingCostsExclFinance - provisions - financeCostAnnual - taxAmount;

    cumulativeCashflow += cashflowForPeriod;

    const propertyValue = inputs.marketValue * capitalGrowthFactor;
    const yearlyROI = initialEquityInvestment > 0 ? (cashflowForPeriod / initialEquityInvestment) * 100 : null;
    const remainingDebt = debtBreakdown.remainingBalance;

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

/**
 * Remaining balance on a fully-amortising loan after `monthsElapsed` whole
 * months — the single authoritative amortisation-balance primitive (Phase
 * 4.17): takes months directly (integer payment count) rather than requiring
 * a yearsElapsed-to-months conversion at every call site, so short-duration
 * callers (Fix & Flip, holding period in months) get exact month-by-month
 * precision without a fractional-year round trip. calcTotalRemainingLoanBalance
 * (the pre-existing rental caller, years-based) is a thin wrapper over this —
 * same formula, same numbers, nothing about rental behaviour changes.
 */
export function remainingLoanBalanceAfterMonths(
  loanAmount: number,
  interestRatePct: number,
  termYears: number,
  monthsElapsed: number
): number {
  const n = termYears * 12;
  if (!loanAmount || monthsElapsed >= n) return 0;
  const r = interestRatePct / 12 / 100;
  const p = Math.min(monthsElapsed, n);
  if (r === 0) return loanAmount * (1 - p / n);
  const factor = Math.pow(1 + r, n);
  const factorP = Math.pow(1 + r, p);
  return loanAmount * ((factor - factorP) / (factor - 1));
}

export function calcTotalRemainingLoanBalance(inputs: DealInputs, yearsElapsed: number): number {
  const monthsElapsed = Math.round(yearsElapsed * 12);
  return inputs.financeSources.reduce(
    (sum, f) => sum + remainingLoanBalanceAfterMonths(f.loanAmount, f.interestRate, f.termYears, monthsElapsed),
    0
  );
}

/** Aggregate financing totals across every finance source over a fixed span of whole months from project start (Phase 4.17 — Fix & Flip's financing primitive). */
export interface FinancingTotalsOverMonths {
  totalInterestPaid: number;
  totalPrincipalPaid: number;
  /** Always exactly totalInterestPaid + totalPrincipalPaid — interest is derived as payment-minus-principal, never independently computed, so this identity holds by construction (Phase 4.17 section 47). */
  totalDebtService: number;
  remainingLoanBalance: number;
}

/**
 * Sums interest/principal/debt-service/remaining-balance across ALL finance
 * sources over months 1..months from project start — each source amortises
 * fully independently (its own rate, its own term; never averaged or
 * blended, per section 18/51). A source that has already matured
 * (termYears*12 < month) contributes zero to every figure for that month,
 * exactly mirroring calcAnnualDebtServiceForYear's rental maturity handling
 * (section 17/55) — reuses remainingLoanBalanceAfterMonths and
 * calcMonthlyRepayment, the SAME amortisation primitives rental deals use;
 * no second loan-math implementation exists for Fix & Flip.
 */
export function calcFinancingTotalsOverMonths(inputs: DealInputs, months: number): FinancingTotalsOverMonths {
  let totalInterestPaid = 0;
  let totalPrincipalPaid = 0;
  let totalDebtService = 0;
  const wholeMonths = Math.max(0, Math.floor(months));

  for (const f of inputs.financeSources) {
    const termMonths = f.termYears * 12;
    const monthlyPayment = calcMonthlyRepayment(f.loanAmount, f.interestRate, f.termYears);
    for (let m = 1; m <= wholeMonths; m++) {
      if (m > termMonths) continue; // matured — debt service stops (section 17, 55)
      const balanceBefore = remainingLoanBalanceAfterMonths(f.loanAmount, f.interestRate, f.termYears, m - 1);
      const balanceAfter = remainingLoanBalanceAfterMonths(f.loanAmount, f.interestRate, f.termYears, m);
      const principal = balanceBefore - balanceAfter;
      const interest = monthlyPayment - principal;
      totalPrincipalPaid += principal;
      totalInterestPaid += interest;
      totalDebtService += monthlyPayment;
    }
  }

  const remainingLoanBalance = calcTotalRemainingLoanBalance(inputs, wholeMonths / 12);

  return { totalInterestPaid, totalPrincipalPaid, totalDebtService, remainingLoanBalance };
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
  /**
   * Phase 4.21 (Defect 3): estate-agent commission due on the eventual sale
   * (the same `agentCommission` % entered on the Acquisition tab under
   * Selling Costs, applied to the projected exit-year property value) — a
   * real disposal cash cost that was previously omitted entirely from
   * rental terminal value, overstating terminal equity, Equity IRR, Equity
   * NPV, and Exit Analysis. Fix & Flip already deducts this exact cost (see
   * calcFlipProfit's `agentFee` / fixFlip.ts's `sellingCosts`) — this closes
   * the equivalent gap on the rental side.
   */
  sellingCostsAtExit: number;
  remainingDebtAtExit: number;
  cgtBaseCost: number;
  capitalGainsTaxAtExit: number;
  terminalEquityValue: number;
} {
  const remainingDebtAtExit = calcTotalRemainingLoanBalance(inputs, holdYear);
  const projectedPropertyValueAtExit = projection[holdYear - 1].propertyValue;
  const sellingCostsAtExit = projectedPropertyValueAtExit * (inputs.agentCommission / 100);

  // Phase 4.10: CGT base cost is the deal's own purchase price — SARS base
  // cost for an ordinary arm's-length acquisition is the acquisition cost
  // (https://www.sars.gov.za/types-of-tax/capital-gains-tax/assets-subject-to-cgt/base-cost/),
  // never the assumed market value. marketValue remains a separate,
  // legitimate concept (Cap Rate MV, valuation context) but was never a
  // defensible CGT base cost — see the doc comment on `marketValue` in
  // DealInputs's own semantics, unchanged by this fix. This is deliberately
  // the SIMPLEST defensible base cost: purchasePrice alone, not also
  // transferBondCost/renovationCost, since those fields bundle economic
  // concepts (financing costs, repairs vs. improvements) that don't all
  // qualify as CGT base cost, and AssetVerdict cannot currently tell which
  // portion would.
  //
  // Phase 4.21 (Defect 3): the taxable CAPITAL GAIN itself is now computed
  // on PROCEEDS net of selling costs, not on the gross property value.
  // Under the Eighth Schedule to the Income Tax Act, "proceeds" on disposal
  // are the amount received LESS expenditure directly related to the
  // disposal that would itself qualify as base-cost expenditure — and SARS
  // explicitly includes "remuneration for the services of a surveyor,
  // valuer, auctioneer, agent, accountant, broker, agent, consultant or
  // legal advisor for the services in the disposal" in that base-cost
  // category (https://www.sars.gov.za/types-of-tax/capital-gains-tax/assets-subject-to-cgt/base-cost/).
  // Estate agent commission on the sale is exactly this kind of qualifying
  // disposal cost — so it reduces the taxable gain, not just the cash the
  // seller nets. This is the exact, deliberately simplified convention
  // AssetVerdict adopts: proceedsForCGT = projectedPropertyValueAtExit -
  // sellingCostsAtExit; gain = proceedsForCGT - cgtBaseCost. transferBondCost
  // and renovationCost remain OUT of cgtBaseCost (unchanged from Phase
  // 4.10) — those fields bundle costs (financing, repairs vs. improvements)
  // that don't uniformly qualify, and AssetVerdict cannot currently tell
  // which portion would.
  const cgtBaseCost = inputs.purchasePrice;
  const proceedsForCGT = projectedPropertyValueAtExit - sellingCostsAtExit;
  const capitalGainsTaxAtExit = Math.max(
    0,
    (proceedsForCGT - cgtBaseCost) * (inputs.capitalGainsTaxRate / 100)
  );
  return {
    projectedPropertyValueAtExit,
    sellingCostsAtExit,
    remainingDebtAtExit,
    cgtBaseCost,
    capitalGainsTaxAtExit,
    terminalEquityValue:
      projectedPropertyValueAtExit - sellingCostsAtExit - remainingDebtAtExit - capitalGainsTaxAtExit,
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
  /** Phase 4.21 (Defect 3) — estate-agent commission on the eventual sale (projectedPropertyValueAtExit x agentCommission%). See calcTerminalValueBreakdown's own doc comment. */
  sellingCostsAtExit: number;
  remainingDebtAtExit: number;
  /** The simplified CGT base cost actually used — the deal's own purchase price (Phase 4.10). Exposed so UI/education/Deal Coach can reference the exact number rather than re-deriving or guessing it. */
  cgtBaseCost: number;
  /** Phase 4.21 (Defect 3): now computed on proceeds net of sellingCostsAtExit — see calcTerminalValueBreakdown's own doc comment for the SARS base-cost/proceeds rationale. */
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
 * Newton-Raphson solve for the PERIODIC internal rate of return of an
 * arbitrary cashflow series — cashflows[0] at period 0, cashflows[1] at
 * period 1, etc. Deliberately period-agnostic (Phase 4.17): the Newton-
 * Raphson iteration itself doesn't know or care whether a "period" is a
 * year or a month, so this is the ONE IRR solver both calcIRR (annual,
 * rental) and Fix & Flip's monthly equity IRR (lib/calculations/fixFlip.ts)
 * call — no second, duplicated root-finder exists anywhere in the app.
 * Returns the raw, un-clamped periodic rate (a fraction, not a percentage);
 * callers decide their own sane clamping band, since "wide but sane" means
 * something different for an annual vs. a monthly rate.
 */
export function solvePeriodicIRR(cashflows: number[]): number {
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
  return rate;
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
  const rate = solvePeriodicIRR(cashflows);

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
    fixFlipAnalysis:
      inputs.strategy === "fix_and_flip" ? calcFixFlipAnalysis(inputs) : undefined,
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
    ltv: calcLTV(inputs), // deprecated alias — always equals purchaseLtv, see calcLTV's doc comment
    purchaseLtv: calcPurchaseLTV(inputs),
    estimatedValueLtv: calcEstimatedValueLTV(inputs),
    projectLeverage: calcProjectLeverage(inputs),
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
