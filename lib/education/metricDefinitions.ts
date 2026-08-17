/**
 * Metric Knowledge Registry — the single source of truth for WHAT each metric
 * means, WHY investors use it, and HOW it relates to other metrics.
 *
 * NON-NEGOTIABLE: this file contains no calculation logic and must never
 * compute a deal-specific number. All numbers shown to a user must come from
 * `lib/calculations` (the deterministic engine). This registry only supplies
 * static, deal-independent education content plus a relationship graph that
 * a future "Understand Your Deal" UI / Deal Coach can render deal-specific
 * explanations around — see calcAllMetrics() in lib/calculations/index.ts for
 * where the actual numbers come from, and classifyMetricForDeal() in
 * lib/calculations/applicability.ts for turning a number into a judgement
 * ("Strong" / "Caution" / "Weak", or "not applicable") without duplicating
 * threshold values or degenerate-input logic here.
 *
 * Keys match the field names on DealMetrics / FlipMetrics
 * (see lib/calculations/index.ts) so a UI can do
 * `getMetricDefinition(key)` right next to `metrics[key]`. Two keys —
 * `equity` and `initialEquityInvestment` — don't map to a DealMetrics field
 * directly (they're derived from projection data / from Total Investment and
 * Total Loan Amount respectively) but are included because the relationship
 * chains in section 16 of the Phase 1.1 brief need them as named concepts.
 *
 * PERSPECTIVE (Phase 1.1, section 20): AssetVerdict must never blur
 * PROPERTY PERFORMANCE, FINANCING, and INVESTOR RETURN into one idea. Every
 * definition below is tagged with which of those three lenses (or "flip") it
 * belongs to, so a future UI can group and contrast them honestly — e.g.
 * Cap Rate (property, unlevered) next to Equity IRR (investor, levered),
 * making it visible that a good cap rate does not automatically mean a good
 * IRR, and vice versa.
 */

export type MetricCategory =
  | "income"
  | "operations"
  | "debt"
  | "returns"
  | "valuation"
  | "equity"
  | "flip";

export type PreferredDirection = "higher" | "lower" | "range" | "contextual";

/**
 * Which of AssetVerdict's three lenses this metric belongs to (section 20):
 * - "property": how the asset itself performs, independent of financing.
 * - "financing": the debt structure itself (how much, how risky).
 * - "investor": what the investor personally earns, after financing.
 * - "flip": Fix & Flip's own, separate metric set.
 */
export type MetricPerspective = "property" | "financing" | "investor" | "flip";

export interface MetricDefinition {
  /** Matches the DealMetrics / FlipMetrics field name (see file header for the two exceptions). */
  key: string;
  name: string;
  shortName?: string;

  category: MetricCategory;
  perspective: MetricPerspective;

  /** One or two plain-English sentences a first-time investor can follow. */
  simpleExplanation: string;

  /** Why property investors track this metric at all. */
  whyItMatters: string;

  /** Short, displayable formula, e.g. "NOI ÷ Annual Debt Payments". */
  formulaLabel: string;

  /** Plain-language walk-through of what the formula does and why, in AssetVerdict's terms. */
  formulaExplanation: string;

  /** Which direction is generally better, all else equal. "range" = a sweet spot, not a monotonic direction. */
  preferredDirection: PreferredDirection;

  /**
   * Other metric keys (or, where the chain starts at a raw deal input, the
   * DealInputs field name) whose changes flow into this metric, per the
   * actual formulas in lib/calculations/index.ts.
   */
  affectedBy: string[];

  /** Metric keys this metric's movement flows into, per the actual formulas. */
  affects: string[];

  /** Metric keys commonly viewed alongside this one, even if not in a direct chain. */
  relatedMetrics: string[];

  /** A misconception worth calling out explicitly. */
  commonMistake?: string;

  /** The question an investor is really asking when they look at this number. */
  investorQuestion?: string;

  /** Concrete, formula-grounded levers an investor can pull to move this metric. */
  strategies: string[];
}

const def = (d: MetricDefinition): MetricDefinition => d;

export const METRIC_DEFINITIONS: Record<string, MetricDefinition> = {
  // ---------------------------------------------------------------------
  // Equity / acquisition
  // ---------------------------------------------------------------------
  totalInvestment: def({
    key: "totalInvestment",
    name: "Total Investment",
    category: "equity",
    perspective: "property",
    simpleExplanation:
      "The full cost of getting this deal done — the purchase price plus every upfront cost to buy and prepare the property.",
    whyItMatters:
      "It's the property's own cost basis, before financing is applied — Cap Rate and Gross Yield are measured against it. It's also the starting point for working out how much of that cost is yours vs the bank's.",
    formulaLabel: "Purchase Price + Transfer/Bond Costs + Renovation Cost + Sourcing Fee",
    formulaExplanation:
      "AssetVerdict adds every upfront, one-off cost to the purchase price: transfer duty and bond registration, any renovation budget, and any sourcing/finder's fee.",
    preferredDirection: "lower",
    affectedBy: ["purchasePrice", "transferBondCost", "renovationCost", "sourcingFee"],
    affects: ["capRatePP", "grossYield", "initialEquityInvestment"],
    relatedMetrics: ["totalLoanAmount", "depositRequired", "initialEquityInvestment"],
    investorQuestion: "How much does this deal cost in total, before I think about financing it?",
    strategies: [
      "Negotiate the purchase price down",
      "Shop around on transfer and bond costs",
      "Right-size the renovation budget to what's needed to let the unit, not a full luxury refit",
    ],
  }),

  totalLoanAmount: def({
    key: "totalLoanAmount",
    name: "Total Loan Amount",
    category: "debt",
    perspective: "financing",
    simpleExplanation: "The combined amount you're borrowing across every finance source on this deal.",
    whyItMatters:
      "It's the lever that turns Total Investment into your actual cash outlay (Initial Equity Investment) and drives LTV and your monthly debt repayments — the things that determine how exposed you are if the deal underperforms.",
    formulaLabel: "Sum of all finance source loan amounts",
    formulaExplanation: "AssetVerdict adds up the loan amount on every finance source you've added to the deal (e.g. a bank bond plus a top-up facility).",
    preferredDirection: "contextual",
    affectedBy: [],
    affects: ["depositRequired", "initialEquityInvestment", "ltv", "dscr", "breakEvenRatio"],
    relatedMetrics: ["ltv", "dscr", "depositRequired"],
    investorQuestion: "How much of this deal is the bank's money versus mine?",
    strategies: [
      "Borrow less to reduce risk, or more to preserve cash for other deals — the right level depends on your DSCR and LTV comfort zone",
    ],
  }),

  depositRequired: def({
    key: "depositRequired",
    name: "Deposit Required",
    category: "equity",
    perspective: "financing",
    simpleExplanation: "The cash you personally need to bring to the table to close this deal.",
    whyItMatters: "This is the actual cheque you write. It's the number that determines whether you can afford this deal at all — and it's numerically the same figure as Initial Equity Investment, the base every equity-level return is measured against.",
    formulaLabel: "Total Investment − Total Loan Amount",
    formulaExplanation: "AssetVerdict takes everything the deal costs upfront and subtracts everything the bank (or other lenders) is putting in, leaving what you need to fund yourself.",
    preferredDirection: "lower",
    affectedBy: ["totalInvestment", "totalLoanAmount"],
    affects: [],
    relatedMetrics: ["totalInvestment", "totalLoanAmount", "ltv", "initialEquityInvestment"],
    investorQuestion: "Can I actually afford to do this deal?",
    strategies: [
      "Increase the loan amount (raises LTV and lowers DSCR — check both before doing this)",
      "Reduce upfront costs like renovation scope or sourcing fees",
    ],
  }),

  initialEquityInvestment: def({
    key: "initialEquityInvestment",
    name: "Initial Equity Investment",
    category: "equity",
    perspective: "investor",
    simpleExplanation: "The cash you personally invest at the start — the base every investor-return metric (Cash-on-Cash Return, Payback Period, IRR, NPV) is measured against.",
    whyItMatters:
      "It's what makes a return metric a genuinely INVESTOR-level number rather than a property-level one. A property-level metric like Cap Rate divides income by the full purchase price; an investor-level metric divides your after-debt-service cashflow by only the cash YOU put in — using the wrong one of these two bases is what makes a return look right for the wrong reason.",
    formulaLabel: "Total Investment − Total Loan Amount",
    formulaExplanation:
      "The same sources-and-uses arithmetic as Deposit Required — Uses (Total Investment) minus Sources from debt (Total Loan Amount) leaves what you funded yourself. It's a separately-named concept from Deposit Required only because one describes cash needed at closing and the other describes the base for a return calculation; the number is identical.",
    preferredDirection: "contextual",
    affectedBy: ["totalInvestment", "totalLoanAmount"],
    affects: ["netYieldPreTax", "netYieldPostTax", "paybackPeriod", "irr", "npv"],
    relatedMetrics: ["depositRequired", "irr", "netYieldPreTax"],
    commonMistake:
      "With no equity invested (a fully or over-financed deal), Cash-on-Cash Return/Payback/IRR/NPV are not applicable — there's no 'return on nothing' to compute. AssetVerdict shows these as N/A rather than a misleading 0% or 0 years.",
    investorQuestion: "How much of my own cash is actually at risk in this deal?",
    strategies: [
      "Increase leverage (more debt, less of your own cash — but check DSCR and LTV before doing this)",
      "Reduce total investment through lower acquisition or renovation costs",
    ],
  }),

  equity: def({
    key: "equity",
    name: "Equity",
    category: "equity",
    perspective: "investor",
    simpleExplanation: "How much of the property you actually own outright at a given point in time — its value less what you still owe on it.",
    whyItMatters: "Equity is what you'd walk away with if you sold and settled the debt today. It grows both as the property appreciates and as you pay down the loan.",
    formulaLabel: "Property Value − Remaining Debt",
    formulaExplanation:
      "For each year of the 20-year projection, AssetVerdict grows the property's value at your capital growth rate and amortises the loan balance down using each finance source's own rate and term, then takes the difference.",
    preferredDirection: "higher",
    affectedBy: ["capitalGrowthRate", "totalLoanAmount"],
    affects: ["npv", "irr"],
    relatedMetrics: ["ltv", "npv", "initialEquityInvestment"],
    commonMistake: "Treating equity as spendable cash — realising it requires selling or refinancing, both of which have their own costs and tax implications.",
    investorQuestion: "How much wealth has this property actually built for me so far?",
    strategies: [
      "Pay down principal faster than the minimum",
      "Hold in a market with genuine capital growth",
      "Avoid over-refinancing equity back out, which resets LTV higher",
    ],
  }),

  // ---------------------------------------------------------------------
  // Income
  // ---------------------------------------------------------------------
  grossRevenueAnnual: def({
    key: "grossRevenueAnnual",
    name: "Gross Revenue",
    shortName: "Gross Revenue",
    category: "income",
    perspective: "property",
    simpleExplanation: "All the money this property brings in over a year, before any costs are taken out.",
    whyItMatters: "It's the top line every other income metric is built from — NOI, yields, and expense ratios all start here. It's a property-level number: financing doesn't change how much rent a property collects.",
    formulaLabel: "(Rent × Occupancy) + Additional Income + Recoveries, × 12",
    formulaExplanation:
      "AssetVerdict takes your strategy's base income (rent × occupancy for a standard let, nightly rate × occupied nights for STR, room mix for student/multi-let), adds any additional income and recoveries, and annualises it.",
    preferredDirection: "higher",
    affectedBy: ["monthlyRent", "occupancyRate", "additionalIncome", "recoveries"],
    affects: ["noiAnnual", "grossYield", "operatingExpenseRatio", "utilitiesRatio", "noiMargin", "breakEvenRatio"],
    relatedMetrics: ["noiAnnual", "grossYield"],
    commonMistake: "Modelling revenue at 100% occupancy — every strategy in AssetVerdict factors occupancy in for a reason.",
    investorQuestion: "How much income can this property realistically generate?",
    strategies: [
      "Raise rent to market",
      "Reduce vacancy through better marketing or tenant retention",
      "Add recoverable income (utilities recoveries, parking, storage)",
    ],
  }),

  // ---------------------------------------------------------------------
  // Operations
  // ---------------------------------------------------------------------
  noiAnnual: def({
    key: "noiAnnual",
    name: "Net Operating Income",
    shortName: "NOI",
    category: "operations",
    perspective: "property",
    simpleExplanation:
      "What's left of your revenue after running costs — before you've paid the bank or the tax man.",
    whyItMatters:
      "NOI is the number the property itself produces, independent of how you financed it. It's what cap rates, DSCR, and NOI margin are all measured against.",
    formulaLabel: "Gross Revenue − Operating Expenses (utilities, rates/insurance/other, provisions)",
    formulaExplanation:
      "AssetVerdict subtracts utilities, rates/insurance/other costs, and provisions (management fee, maintenance, bad debts) from gross revenue. Debt repayments are deliberately excluded — they're a financing decision, not an operating cost.",
    preferredDirection: "higher",
    affectedBy: ["grossRevenueAnnual", "operatingExpenseRatio"],
    affects: ["capRatePP", "capRateMV", "dscr", "noiMargin", "breakEvenRatio"],
    relatedMetrics: ["operatingExpenseRatio", "noiMargin", "capRatePP"],
    commonMistake: "Confusing NOI with cashflow — NOI is before debt repayments and tax, cashflow is after.",
    investorQuestion: "What does this property actually earn from operations alone?",
    strategies: [
      "Increase gross revenue",
      "Reduce operating expenses without harming the tenant experience",
      "Renegotiate management fees or maintenance contracts",
    ],
  }),

  operatingExpenseRatio: def({
    key: "operatingExpenseRatio",
    name: "Operating Expense Ratio",
    category: "operations",
    perspective: "property",
    simpleExplanation: "The slice of your revenue that's eaten up by running the property — not including debt repayments.",
    whyItMatters: "It shows how efficiently the property is being operated, independent of how it's financed, so you can compare deals with different levels of debt on a like-for-like basis.",
    formulaLabel: "Operating Expenses ÷ Gross Revenue",
    formulaExplanation:
      "AssetVerdict adds up utilities, rates/insurance/other costs, and provisions (management, maintenance, bad debts), then divides by gross revenue. Debt service is intentionally excluded — see Break-Even Ratio for the version that includes it.",
    preferredDirection: "lower",
    affectedBy: ["grossRevenueAnnual", "utilitiesRatio"],
    affects: ["noiMargin", "noiAnnual"],
    relatedMetrics: ["noiMargin", "breakEvenRatio", "utilitiesRatio"],
    commonMistake:
      "Assuming this ratio includes your bond repayment — it doesn't. A property can have a low Operating Expense Ratio and still be unaffordable once debt is added; check Break-Even Ratio and DSCR for that.",
    investorQuestion: "How much of every rand of income goes to just keeping the lights on?",
    strategies: [
      "Shop around on insurance, security, and maintenance contracts",
      "Reduce vacancy-driven bad debt provisions",
      "Negotiate the management fee percentage",
    ],
  }),

  utilitiesRatio: def({
    key: "utilitiesRatio",
    name: "Utilities Ratio",
    category: "operations",
    perspective: "property",
    simpleExplanation: "The share of your revenue spent on water, electricity, and security/cleaning.",
    whyItMatters: "Utilities are one of the few operating costs that can run away from you if a property isn't sub-metered or if usage isn't monitored.",
    formulaLabel: "Utilities ÷ Gross Revenue",
    formulaExplanation: "AssetVerdict divides water/sewerage, electricity, and security/cleaning costs by gross revenue.",
    preferredDirection: "lower",
    affectedBy: ["grossRevenueAnnual"],
    affects: ["operatingExpenseRatio"],
    relatedMetrics: ["operatingExpenseRatio"],
    investorQuestion: "Are utility costs under control relative to income?",
    strategies: [
      "Sub-meter units and recover utility costs from tenants",
      "Install water- and energy-efficient fittings",
    ],
  }),

  noiMargin: def({
    key: "noiMargin",
    name: "NOI Margin",
    category: "operations",
    perspective: "property",
    simpleExplanation: "What percentage of every rand of revenue turns into operating profit.",
    whyItMatters: "It's a quick read on operational efficiency — how much of the top line survives down to NOI.",
    formulaLabel: "NOI ÷ Gross Revenue",
    formulaExplanation:
      "Because NOI is Gross Revenue minus Operating Expenses, NOI Margin and Operating Expense Ratio always add up to 100% — they're two views of the same split.",
    preferredDirection: "higher",
    affectedBy: ["noiAnnual", "grossRevenueAnnual"],
    affects: [],
    relatedMetrics: ["operatingExpenseRatio", "noiAnnual"],
    investorQuestion: "How operationally efficient is this property?",
    strategies: ["Same levers as Operating Expense Ratio — the two move in exact opposite directions"],
  }),

  breakEvenRatio: def({
    key: "breakEvenRatio",
    name: "Break-Even Ratio",
    shortName: "Break-Even Ratio",
    category: "operations",
    perspective: "financing",
    simpleExplanation:
      "The percentage of gross income needed to cover operating costs and debt payments.",
    whyItMatters:
      "It's the closest single number to 'how much can income fall before this deal stops covering itself.' Unlike Operating Expense Ratio, it deliberately includes your debt repayments — it's a financing-risk metric, not a pure property metric.",
    formulaLabel: "(Operating Expenses + Annual Debt Service) ÷ Gross Revenue",
    formulaExplanation:
      "AssetVerdict adds your full operating expenses (utilities, rates/insurance/other, provisions) to your annual debt repayments, then divides by gross revenue.",
    preferredDirection: "lower",
    affectedBy: ["operatingExpenseRatio", "totalLoanAmount"],
    affects: [],
    relatedMetrics: ["operatingExpenseRatio", "dscr"],
    commonMistake:
      "Calling this an occupancy percentage — it's an income-coverage ratio, not a literal occupancy figure, and assumes expenses stay fixed as income falls, which is only roughly true in practice. A true occupancy-based break-even would be a distinct metric (Break-Even Occupancy), which AssetVerdict doesn't currently calculate.",
    investorQuestion: "How much room do I have before this deal stops paying for itself?",
    strategies: [
      "Reduce debt service through a lower rate, longer term, or smaller loan",
      "Reduce operating expenses",
      "Increase gross revenue",
    ],
  }),

  // ---------------------------------------------------------------------
  // Debt / financing
  // ---------------------------------------------------------------------
  dscr: def({
    key: "dscr",
    name: "Debt Service Coverage Ratio",
    shortName: "DSCR",
    category: "debt",
    perspective: "financing",
    simpleExplanation: "Tells you whether the property produces enough operating income to comfortably pay its debt.",
    whyItMatters: "It shows how much breathing room exists between the property's income and its debt repayments — the metric lenders care about most.",
    formulaLabel: "NOI ÷ Annual Debt Payments",
    formulaExplanation:
      "AssetVerdict divides your annual NOI by the total annual debt repayments across every finance source. With no debt at all, DSCR doesn't apply (there's nothing to cover) rather than being scored as a failure — AssetVerdict shows N/A, never a red 0.00x, for an all-cash deal.",
    preferredDirection: "higher",
    affectedBy: ["noiAnnual", "totalLoanAmount"],
    affects: ["breakEvenRatio"],
    relatedMetrics: ["breakEvenRatio", "ltv"],
    commonMistake: "Reading a DSCR just above 1.0x as 'safe' — it means income exactly covers debt with zero margin for a bad month.",
    investorQuestion: "Does this property earn enough to comfortably cover the bond?",
    strategies: [
      "Increase NOI (revenue up or operating costs down)",
      "Reduce the loan amount or negotiate a lower rate",
      "Extend the loan term to lower the monthly repayment",
    ],
  }),

  ltv: def({
    key: "ltv",
    name: "Loan-to-Value",
    shortName: "LTV",
    category: "debt",
    perspective: "financing",
    simpleExplanation: "How much of the property's purchase price is funded by debt versus your own cash.",
    whyItMatters: "Higher LTV means more leverage — bigger potential swings in your equity return (up or down), and bigger exposure if the deal or the market turns.",
    formulaLabel: "Total Loan Amount ÷ Purchase Price",
    formulaExplanation: "AssetVerdict divides your total borrowed amount by the purchase price.",
    preferredDirection: "lower",
    affectedBy: ["totalLoanAmount"],
    affects: ["depositRequired", "initialEquityInvestment", "dscr", "breakEvenRatio"],
    relatedMetrics: ["dscr", "depositRequired"],
    investorQuestion: "How leveraged is this deal?",
    strategies: [
      "Put down a larger deposit to reduce the loan amount",
      "Refinance once the property has built equity",
    ],
  }),

  // ---------------------------------------------------------------------
  // Valuation (property-level, unlevered)
  // ---------------------------------------------------------------------
  capRatePP: def({
    key: "capRatePP",
    name: "Cap Rate on Purchase Price",
    shortName: "Cap Rate (PP)",
    category: "valuation",
    perspective: "property",
    simpleExplanation: "The property's operating income as a percentage of what you're actually paying for it — AssetVerdict's primary acquisition cap-rate metric.",
    whyItMatters: "It's the standard way investors compare a property's own, unleveraged return — ignoring how each one is financed. Contrast this with Equity IRR, which DOES depend on financing: a good cap rate does not automatically mean a good IRR, and a highly-financed deal can post a strong IRR on a middling cap rate. Unlike Cap Rate on Market Value, this is measured against purchase price — a verified, contracted number — which is why AssetVerdict treats it as the primary acquisition cap-rate signal (Phase 4.1).",
    formulaLabel: "NOI ÷ Purchase Price",
    formulaExplanation: "AssetVerdict divides annual NOI by purchase price. Because NOI excludes debt service, this number is unaffected by how you finance the deal.",
    preferredDirection: "range",
    affectedBy: ["noiAnnual"],
    affects: [],
    relatedMetrics: ["capRateMV", "capRateSpread", "grossYield", "irr"],
    commonMistake: "Chasing the highest possible cap rate — an unusually high cap rate often signals higher risk (bad area, unstable tenants) rather than a better deal.",
    investorQuestion: "Am I paying a fair price for the income this property produces, before I even think about financing?",
    strategies: [
      "Negotiate purchase price down",
      "Increase NOI through revenue growth or expense control",
    ],
  }),

  capRateMV: def({
    key: "capRateMV",
    name: "Cap Rate on Market Value",
    shortName: "Cap Rate (MV)",
    category: "valuation",
    perspective: "property",
    simpleExplanation: "The property's operating income as a percentage of its assumed market value, rather than what you're paying. This result depends on your assumed market value — AssetVerdict currently has no way to verify it, so this metric is contextual rather than independently classified.",
    whyItMatters: "Comparing this to Cap Rate on Purchase Price shows whether you're buying below, at, or above your assumed market value. Cap Rate on Purchase Price remains AssetVerdict's primary acquisition cap-rate metric because purchase price is a contracted fact, not an assumption (Phase 4.1).",
    formulaLabel: "NOI ÷ Market Value",
    formulaExplanation: "AssetVerdict divides annual NOI by the property's assessed market value.",
    preferredDirection: "higher",
    affectedBy: ["noiAnnual"],
    affects: ["capRateSpread"],
    relatedMetrics: ["capRatePP", "capRateSpread"],
    investorQuestion: "How does this property's income stack up against its true market value?",
    strategies: ["Same levers as Cap Rate (PP) — increase NOI"],
  }),

  capRateSpread: def({
    key: "capRateSpread",
    name: "Cap Rate Spread",
    category: "valuation",
    perspective: "property",
    simpleExplanation: "How much better (or worse) your deal's cap rate is compared to your assumed market cap rate for similar property.",
    whyItMatters: "A positive spread is a signal you're buying below what you've assumed the market normally pays for this kind of income stream. The market cap rate is a figure you entered, not verified market data — treat this as \"based on your assumed market cap rate,\" not as confirmed fact.",
    formulaLabel: "Cap Rate (MV) − Assumed Market Cap Rate",
    formulaExplanation: "AssetVerdict subtracts the market cap rate you've entered (an assumption, not verified data) from this deal's Cap Rate on Market Value.",
    preferredDirection: "higher",
    affectedBy: ["capRateMV"],
    affects: [],
    relatedMetrics: ["capRatePP", "capRateMV"],
    investorQuestion: "Am I buying above or below what the market normally pays for this income?",
    strategies: ["Same levers as Cap Rate (MV) — increase NOI or negotiate a lower price relative to market value"],
  }),

  grossYield: def({
    key: "grossYield",
    name: "Gross Yield",
    category: "returns",
    perspective: "property",
    simpleExplanation: "Your annual rental income as a percentage of what you paid for the property, before any costs.",
    whyItMatters: "It's the simplest, fastest sanity check on a deal — a rough top-line comparison before you dig into expenses and financing. It's property-level and unlevered, like Cap Rate.",
    formulaLabel: "Gross Revenue ÷ Purchase Price",
    formulaExplanation: "AssetVerdict divides annual gross revenue by purchase price. No costs are subtracted, so this overstates what you'll actually keep.",
    preferredDirection: "higher",
    affectedBy: ["grossRevenueAnnual"],
    affects: [],
    relatedMetrics: ["netYieldPreTax", "capRatePP"],
    commonMistake: "Using Gross Yield alone to judge a deal — it ignores expenses and debt entirely. Always check Cash-on-Cash Return and DSCR too, since those are the numbers that reflect financing.",
    investorQuestion: "At a glance, is this income level in the right ballpark for the price?",
    strategies: ["Raise rent to market", "Reduce vacancy"],
  }),

  // ---------------------------------------------------------------------
  // Returns — investor/equity-level (levered)
  // ---------------------------------------------------------------------
  netYieldPreTax: def({
    key: "netYieldPreTax",
    name: "Cash-on-Cash Return (Pre-Tax)",
    shortName: "Cash-on-Cash Return (Pre-Tax)",
    category: "returns",
    perspective: "investor",
    simpleExplanation:
      "Your first year's cashflow AFTER debt repayments, before tax, as a percentage of the cash YOU personally put into the deal.",
    whyItMatters: "It answers the question every investor actually cares about first: what cash return am I really getting on the money I put in this year? Because the numerator already has debt service subtracted, the denominator has to be your own equity, not the full purchase price — dividing a levered cashflow by an unlevered basis would understate or overstate the real return.",
    formulaLabel: "Annual Cashflow After Debt Service (before tax) ÷ Initial Equity Investment",
    formulaExplanation: "AssetVerdict takes gross revenue, subtracts operating costs (including debt service) and provisions, and divides the result by Initial Equity Investment (Total Investment less Total Loan Amount) — the cash you personally contributed.",
    preferredDirection: "higher",
    affectedBy: ["grossRevenueAnnual", "totalLoanAmount", "initialEquityInvestment"],
    affects: [],
    relatedMetrics: ["netYieldPostTax", "grossYield", "cashflowMonthly", "initialEquityInvestment"],
    commonMistake: "Confusing this with Gross Yield or Cap Rate — those divide by the full purchase price and ignore debt. Cash-on-Cash Return here is a levered, investor-level number: with no (or negative) equity invested, it's not applicable, not a real 0%.",
    investorQuestion: "What cash return am I earning on the money I personally put in, this year?",
    strategies: [
      "Increase NOI",
      "Reduce debt service",
      "Reduce total investment (and therefore equity required) through lower acquisition or renovation costs",
    ],
  }),

  netYieldPostTax: def({
    key: "netYieldPostTax",
    name: "Cash-on-Cash Return (Post-Tax)",
    shortName: "Cash-on-Cash Return (Post-Tax)",
    category: "returns",
    perspective: "investor",
    simpleExplanation: "The same Cash-on-Cash Return as the pre-tax version, but after estimated income tax on the deal's taxable profit.",
    whyItMatters: "It's the closest single-year figure to what actually lands in your pocket, on the cash you actually invested.",
    formulaLabel: "Annual Cashflow After Debt Service (after tax) ÷ Initial Equity Investment",
    formulaExplanation: "AssetVerdict estimates tax as (NOI − annual debt service) × your income tax rate, floored at zero, subtracts it from pre-tax cashflow, then divides by Initial Equity Investment.",
    preferredDirection: "higher",
    affectedBy: ["netYieldPreTax"],
    affects: [],
    relatedMetrics: ["netYieldPreTax"],
    commonMistake: "This is a simplified estimate — it doesn't model depreciation, wear-and-tear allowances, or other tax structuring.",
    investorQuestion: "After tax, what am I really keeping on the cash I put in?",
    strategies: ["Same levers as Cash-on-Cash Return (Pre-Tax) — this figure moves with it"],
  }),

  cashflowMonthly: def({
    key: "cashflowMonthly",
    name: "Cash Flow",
    shortName: "Monthly Cashflow",
    category: "returns",
    perspective: "investor",
    simpleExplanation: "The actual cash left in your pocket each month after every cost, including debt repayments and estimated tax.",
    whyItMatters: "This is the number that determines whether the property is self-funding or whether you need to top it up from your own pocket every month.",
    formulaLabel: "(Gross Revenue − Operating Costs − Provisions − Tax) ÷ 12",
    formulaExplanation: "AssetVerdict takes annual gross revenue, subtracts all operating costs (including debt service), provisions, and estimated tax, then divides by 12.",
    preferredDirection: "higher",
    affectedBy: ["grossRevenueAnnual", "noiAnnual", "totalLoanAmount"],
    affects: ["paybackPeriod"],
    relatedMetrics: ["netYieldPostTax", "paybackPeriod"],
    investorQuestion: "Is this property going to cost me money every month, or pay me?",
    strategies: ["Increase NOI", "Reduce debt service", "Reduce vacancy and bad debt"],
  }),

  paybackPeriod: def({
    key: "paybackPeriod",
    name: "Payback Period",
    category: "returns",
    perspective: "investor",
    simpleExplanation: "How many years of after-debt-service cashflow it takes to get the cash YOU invested back.",
    whyItMatters: "It's an intuitive risk gauge — shorter payback means you recover your own capital faster and are exposed for less time.",
    formulaLabel: "Initial Equity Investment ÷ Annual Net Cashflow",
    formulaExplanation:
      "AssetVerdict divides Initial Equity Investment (the cash you personally put in) by annual after-tax cashflow. If annual cashflow is zero or negative, payback is treated as never happening (shown as no data). If there's no (or negative) equity invested — a fully or over-financed deal — the deal has, in effect, already 'paid back,' and payback shows as N/A rather than a divide-by-zero.",
    preferredDirection: "lower",
    affectedBy: ["initialEquityInvestment", "cashflowMonthly"],
    affects: [],
    relatedMetrics: ["irr", "netYieldPostTax", "initialEquityInvestment"],
    commonMistake: "Payback Period ignores what happens after payback — a fast-payback deal with a weak long-term outlook can still be worse than a slower one that compounds well. Check IRR and NPV too.",
    investorQuestion: "How many years until I've got my own cash back out of this deal?",
    strategies: ["Increase annual cashflow", "Reduce the cash you need to invest (lower total cost, or more/less leverage)"],
  }),

  irr: def({
    key: "irr",
    name: "Equity IRR",
    shortName: "IRR",
    category: "returns",
    perspective: "investor",
    simpleExplanation: "The single annualised return this deal is projected to deliver on YOUR OWN CASH over its modelled hold period (20 years by default, or your assumed sale year if set), after financing and tax, once you include the eventual sale.",
    whyItMatters: "It's the standard way to compare this deal's full-cycle investor return against other investments — property or otherwise. AssetVerdict's dashboard simply labels this 'IRR', but it is always the equity/levered return, never an unlevered property-only return (that's what Cap Rate is for).",
    formulaLabel: "The rate at which your equity cashflow stream discounts back to your Initial Equity Investment",
    formulaExplanation:
      "AssetVerdict builds one cash-flow stream: -Initial Equity Investment at year 0, then years of after-debt-service, after-tax cashflow (with rent, cost, and capital growth escalations) up to your hold period — 20 years by default, or your assumed sale year if set — with the after-tax, after-debt-payoff sale proceeds added to that final year. It solves for the discount rate that makes that stream's present value zero. Financing changes this number twice over — once through the smaller initial outlay (equity, not the full purchase price), and once through debt service reducing every year's cashflow — so leverage can push Equity IRR up OR down depending on whether the property's own return beats the cost of the debt.",
    preferredDirection: "higher",
    affectedBy: ["cashflowMonthly", "initialEquityInvestment", "capitalGrowthRate", "rentalGrowthRate", "totalLoanAmount"],
    affects: [],
    relatedMetrics: ["npv", "netYieldPostTax", "capRatePP", "initialEquityInvestment"],
    commonMistake: "Assuming more leverage always means a higher IRR — it amplifies whatever the underlying spread is between the property's return and the cost of debt, in either direction. Also: IRR assumes you hold for the full modelled period and reinvest at the same rate, so real outcomes depend heavily on the growth assumptions you fed in and the sale year you assumed. Not applicable with no (or negative) equity invested.",
    investorQuestion: "What annualised return does this deal deliver on MY money over its full life?",
    strategies: [
      "Increase cashflow",
      "Increase capital/rental growth assumptions only if genuinely realistic for the area",
      "Reduce the equity required (lower total cost, or a different financing mix — but check DSCR)",
    ],
  }),

  npv: def({
    key: "npv",
    name: "Equity NPV",
    shortName: "NPV",
    category: "returns",
    perspective: "investor",
    simpleExplanation: "The total value this deal creates for YOU, in today's money, above and beyond the cash you invested.",
    whyItMatters: "A positive NPV means the deal is projected to create more value, on your own cash, than that cash would earn at your required equity return (the discount rate). A negative NPV means it's projected to destroy value relative to that benchmark.",
    formulaLabel: "Present Value of Your Equity Cashflow Stream − Initial Equity Investment",
    formulaExplanation:
      "AssetVerdict discounts the exact same equity cashflow stream used for Equity IRR (after debt service and tax, plus the after-tax, after-debt-payoff sale) back to today at your discount rate, then subtracts your Initial Equity Investment. IRR and NPV always use this same stream, so discounting at the deal's own IRR brings NPV to ~0.",
    preferredDirection: "higher",
    affectedBy: ["cashflowMonthly", "initialEquityInvestment", "capitalGrowthRate", "rentalGrowthRate"],
    affects: [],
    relatedMetrics: ["irr", "initialEquityInvestment"],
    commonMistake: "NPV is only as good as the discount rate you choose — a low required-return rate flatters almost any deal. Not applicable with no (or negative) equity invested.",
    investorQuestion: "In today's money, does this deal create more value for me than my next-best alternative?",
    strategies: ["Same levers as Equity IRR — increase cashflow, reduce equity required, or use realistic growth assumptions"],
  }),

  // ---------------------------------------------------------------------
  // Fix & Flip
  // ---------------------------------------------------------------------
  totalCost: def({
    key: "totalCost",
    name: "Total Cost",
    category: "flip",
    perspective: "flip",
    simpleExplanation: "Everything this flip costs you, from purchase to the day you sell.",
    whyItMatters: "It's the base every flip return metric is measured against.",
    formulaLabel: "Purchase Price + Renovation Cost + Holding Costs + Agent Commission",
    formulaExplanation: "AssetVerdict adds the purchase price, your renovation budget, holding costs accrued over the hold period, and the agent commission due on sale.",
    preferredDirection: "lower",
    affectedBy: ["purchasePrice", "renovationCost", "holdingCosts"],
    affects: ["grossProfit", "roi", "profitMargin"],
    relatedMetrics: ["grossProfit", "netProfit"],
    investorQuestion: "What's my true all-in cost on this flip?",
    strategies: ["Negotiate purchase price", "Control renovation scope and cost overruns", "Shorten the holding period"],
  }),

  holdingCosts: def({
    key: "holdingCosts",
    name: "Holding Costs",
    category: "flip",
    perspective: "flip",
    simpleExplanation: "The cost of simply owning the property while it's being renovated and marketed — bond interest, rates, insurance, utilities.",
    whyItMatters: "Every extra month on the market erodes your profit — this is the metric that makes speed matter on a flip.",
    formulaLabel: "Holding Cost per Month × Holding Period (months)",
    formulaExplanation: "AssetVerdict multiplies your estimated monthly holding cost by how many months you expect to hold the property.",
    preferredDirection: "lower",
    affectedBy: [],
    affects: ["totalCost"],
    relatedMetrics: ["totalCost", "annualisedROI"],
    investorQuestion: "What is time actually costing me on this deal?",
    strategies: ["Shorten the renovation and marketing timeline", "Reduce carrying costs (e.g. bridging finance rate)"],
  }),

  grossProfit: def({
    key: "grossProfit",
    name: "Gross Profit",
    category: "flip",
    perspective: "flip",
    simpleExplanation: "Sale price less every cost of the flip, before any tax.",
    whyItMatters: "It's the headline profit figure this flip's economics are built from.",
    formulaLabel: "Expected Sale Price − Total Cost",
    formulaExplanation: "AssetVerdict subtracts total cost (purchase + renovation + holding + agent commission) from your expected sale price.",
    preferredDirection: "higher",
    affectedBy: ["totalCost"],
    affects: ["netProfit"],
    relatedMetrics: ["netProfit", "totalCost"],
    investorQuestion: "Before tax, how much profit does this flip make?",
    strategies: ["Increase sale price through better renovation ROI", "Reduce total cost"],
  }),

  netProfit: def({
    key: "netProfit",
    name: "Estimated Profit Before Tax",
    category: "flip",
    perspective: "flip",
    simpleExplanation: "What this flip is projected to make, before any tax. AssetVerdict does not deduct tax here — see Why It Matters.",
    whyItMatters: "The tax character of a property disposal (capital gain vs. revenue income) depends on the nature and circumstances of the transaction — SARS treats a taxpayer who buys and sells properties at short intervals as running a real risk of being classified as a property trader, whose profits are taxed in full as revenue, not as a capital gain. AssetVerdict cannot determine which applies to your flip, so it no longer assumes one and shows this figure before any tax.",
    formulaLabel: "= Gross Profit (no tax deducted)",
    formulaExplanation: "AssetVerdict does not automatically deduct tax from Fix & Flip profit. This figure equals Gross Profit exactly.",
    preferredDirection: "higher",
    affectedBy: ["grossProfit"],
    affects: ["roi", "annualisedROI", "profitMargin"],
    relatedMetrics: ["grossProfit", "roi"],
    investorQuestion: "Before tax, what does this flip actually put in my pocket?",
    strategies: ["Same levers as Gross Profit — increase sale price or reduce total cost"],
  }),

  roi: def({
    key: "roi",
    name: "Pre-Tax ROI",
    shortName: "Pre-Tax ROI",
    category: "flip",
    perspective: "flip",
    simpleExplanation: "Your estimated pre-tax profit as a percentage of everything you spent to make it.",
    whyItMatters: "It lets you compare this flip's return against other flips or investments, independent of deal size — before any tax, since AssetVerdict doesn't determine the tax character of a Flip disposal (see Estimated Profit Before Tax).",
    formulaLabel: "Estimated Profit Before Tax ÷ Total Cost",
    formulaExplanation: "AssetVerdict divides pre-tax profit by total cost.",
    preferredDirection: "higher",
    affectedBy: ["netProfit", "totalCost"],
    affects: ["annualisedROI"],
    relatedMetrics: ["annualisedROI", "profitMargin"],
    commonMistake: "Comparing ROI across flips with very different holding periods without also checking Annualised ROI. This is also a pre-tax figure — your actual return will depend on how the disposal is ultimately taxed.",
    investorQuestion: "What percentage pre-tax return did my capital earn on this flip?",
    strategies: ["Increase pre-tax profit", "Reduce total cost"],
  }),

  annualisedROI: def({
    key: "annualisedROI",
    name: "Annualised Pre-Tax ROI",
    category: "flip",
    perspective: "flip",
    simpleExplanation: "Pre-Tax ROI adjusted for how long the flip took, so deals of different lengths can be compared fairly.",
    whyItMatters: "A 20% pre-tax ROI over 3 months is a much better use of capital than the same 20% over 18 months — this metric makes that visible.",
    formulaLabel: "Pre-Tax ROI ÷ Holding Period (years)",
    formulaExplanation: "AssetVerdict divides Pre-Tax ROI by the holding period expressed in years.",
    preferredDirection: "higher",
    affectedBy: ["roi", "holdingCosts"],
    affects: [],
    relatedMetrics: ["roi", "holdingCosts"],
    investorQuestion: "On a like-for-like annual basis, how good is this flip's pre-tax return?",
    strategies: ["Increase Pre-Tax ROI", "Shorten the holding period"],
  }),

  profitMargin: def({
    key: "profitMargin",
    name: "Pre-Tax Profit Margin",
    category: "flip",
    perspective: "flip",
    simpleExplanation: "Your estimated pre-tax profit as a percentage of the sale price, not the cost.",
    whyItMatters: "It shows how much cushion you have if the sale price comes in lower than expected.",
    formulaLabel: "Estimated Profit Before Tax ÷ Expected Sale Price",
    formulaExplanation: "AssetVerdict divides pre-tax profit by the expected sale price.",
    preferredDirection: "higher",
    affectedBy: ["netProfit"],
    affects: [],
    relatedMetrics: ["roi", "netProfit"],
    investorQuestion: "If the sale price slips, how much margin for error do I have?",
    strategies: ["Increase pre-tax profit", "Avoid over-improving relative to the achievable sale price"],
  }),
};

export function getMetricDefinition(key: string): MetricDefinition | undefined {
  return METRIC_DEFINITIONS[key];
}

export function getMetricsByCategory(category: MetricCategory): MetricDefinition[] {
  return Object.values(METRIC_DEFINITIONS).filter((m) => m.category === category);
}

export function getMetricsByPerspective(perspective: MetricPerspective): MetricDefinition[] {
  return Object.values(METRIC_DEFINITIONS).filter((m) => m.perspective === perspective);
}

// ---------------------------------------------------------------------------
// Strategy-aware grouping (section 8 of the Phase 1 brief): a fix-and-flip
// deal should never be taught DSCR/occupancy/yield as though they're its
// primary metrics, and a rental deal should never be shown ROI/Annualised ROI.
// ---------------------------------------------------------------------------

export interface MetricGroup {
  label: string;
  category: MetricCategory;
  metricKeys: string[];
}

const RENTAL_GROUPS: MetricGroup[] = [
  { label: "Income", category: "income", metricKeys: getMetricsByCategory("income").map((m) => m.key) },
  { label: "Operations", category: "operations", metricKeys: getMetricsByCategory("operations").map((m) => m.key) },
  { label: "Debt & Safety", category: "debt", metricKeys: getMetricsByCategory("debt").map((m) => m.key) },
  { label: "Returns", category: "returns", metricKeys: getMetricsByCategory("returns").map((m) => m.key) },
  { label: "Valuation", category: "valuation", metricKeys: getMetricsByCategory("valuation").map((m) => m.key) },
  { label: "Equity", category: "equity", metricKeys: getMetricsByCategory("equity").map((m) => m.key) },
];

const FLIP_GROUPS: MetricGroup[] = [
  { label: "Fix & Flip", category: "flip", metricKeys: getMetricsByCategory("flip").map((m) => m.key) },
];

/**
 * The metric groups relevant to a given AssetVerdict investment strategy
 * (see lib/strategies.ts for the strategy list). Fix & Flip gets its own,
 * completely separate set of groups — every other strategy shares the
 * standard rental groups.
 */
export function getMetricGroupsForStrategy(strategyId: string): MetricGroup[] {
  return strategyId === "fix_and_flip" ? FLIP_GROUPS : RENTAL_GROUPS;
}
