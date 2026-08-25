/**
 * Deal field write policy (Phase 4.22.1 — Financial Input Boundary
 * Hardening).
 *
 * Every field a request to `PATCH /api/deals/[id]` could conceivably
 * contain falls into exactly one of three buckets:
 *
 *   1. USER INPUT — a raw fact the investor types in (purchase price,
 *      property details, tax/growth assumptions, description fields).
 *      Safe to write directly; enumerated in DEAL_PATCH_ALLOWED_FIELDS.
 *
 *   2. DERIVED/CALCULATED — never a real input at all. Total Investment,
 *      Initial Equity Investment, NOI, tax, monthly/annual cashflow, DSCR,
 *      IRR, NPV, Cash-on-Cash Return, Payback Period, terminal value,
 *      selling costs, Fix & Flip profit/ROI, verdict, and negotiation
 *      outputs are ALL produced fresh on every request by
 *      lib/calculations/*  — none of them has ever had, or will ever have,
 *      a database column of its own. See DERIVED_FINANCIAL_FIELD_NAMES
 *      below and its own regression test
 *      (dealFieldPolicy.test.ts) proving none of these names can ever
 *      slip into the allowlist.
 *
 *   3. SYSTEM/PROTECTED — a REAL Deal column, but owned by a different,
 *      dedicated workflow with its own server-side authoritative
 *      recomputation. `renovationCost` is the one example today (Phase
 *      4.22 — owned exclusively by /api/deals/[id]/renovation via
 *      calcFurnitureCostSummary). See DEAL_PATCH_PROTECTED_FIELDS.
 *
 * `PATCH /api/deals/[id]` PICKS only DEAL_PATCH_ALLOWED_FIELDS out of the
 * request body — bucket 2 and bucket 3 fields are silently dropped no
 * matter what a request contains, rather than merely deleted one at a time
 * (Phase 4.22's earlier `delete coerced.renovationCost` approach, which
 * only closed that one specific field).
 */

/** Non-numeric (string/boolean) fields the Introduction/Acquisition tabs legitimately submit. */
const DEAL_PATCH_TEXT_AND_FLAG_FIELDS = [
  "name",
  "propertyType",
  "investmentStrategy",
  "address",
  "city",
  "notes",
  "currency",
  "erfNumber",
  "titleDeedNumber",
  "propertyZoning",
  "ratesAccountNumber",
  "isSectionalTitle",
  "unitNumber",
  "schemeName",
  "wantToSell",
] as const;

/** Numeric fields the Acquisition/Introduction/Other tabs legitimately submit — coerced string->number at the API boundary (see lib/coerceNumeric.ts). */
export const DEAL_PATCH_NUMERIC_FIELDS = [
  // Acquisition
  "askingPrice",
  "purchasePrice",
  "marketValue",
  "transferBondCost",
  "sourcingFee",
  "agentCommission",
  "saleYear",
  // Property details
  "erfSize",
  "floorSize",
  "bedrooms",
  "bathrooms",
  "garages",
  "numUnits",
  "yearBuilt",
  "schemeLevy",
  // Other inputs / assumptions
  "incomeTaxRate",
  "capitalGainsTaxRate",
  "capitalGrowthRate",
  "rentalGrowthRate",
  "costInflation",
  "sustainableGrowthRate",
  "discountRate",
  "realGrowthFactor",
  "occupationFactor",
  "marketCapRate",
] as const;

/** The complete, explicit allowlist — the ONLY field names PATCH /api/deals/[id] will ever write, regardless of what a request body contains. */
export const DEAL_PATCH_ALLOWED_FIELDS = [
  ...DEAL_PATCH_TEXT_AND_FLAG_FIELDS,
  ...DEAL_PATCH_NUMERIC_FIELDS,
] as const;

/**
 * Real Prisma `Deal` columns that are nonetheless NOT writable through this
 * endpoint because a dedicated, authoritative workflow owns them. Exists
 * for documentation and for the regression test that proves each of these
 * is absent from DEAL_PATCH_ALLOWED_FIELDS.
 */
export const DEAL_PATCH_PROTECTED_FIELDS = [
  "renovationCost", // owned by /api/deals/[id]/renovation (Phase 4.22)
] as const;

/**
 * Field names that describe a calculated financial OUTPUT rather than an
 * input — none of these has a database column anywhere in the schema
 * (Deal, CashflowInputs, FinanceSource, or RenovationItem). Listed here
 * purely so a regression test can assert none of them ever appears in
 * DEAL_PATCH_ALLOWED_FIELDS, today or in any future edit to this file.
 */
export const DERIVED_FINANCIAL_FIELD_NAMES = [
  "totalInvestment",
  "initialEquityInvestment",
  "noi",
  "noiAnnual",
  "tax",
  "taxMonthly",
  "monthlyCashflow",
  "cashflowMonthly",
  "annualCashflow",
  "cashflowAnnualPreTax",
  "dscr",
  "irr",
  "npv",
  "netYieldPreTax",
  "netYieldPostTax",
  "cashOnCash",
  "cashOnCashReturn",
  "paybackPeriod",
  "terminalValue",
  "terminalEquityValue",
  "sellingCosts",
  "sellingCostsAtExit",
  "flipProfit",
  "flipMetrics",
  "fixFlipAnalysis",
  "roi",
  "verdict",
  "negotiation",
  "negotiationOutputs",
] as const;

/**
 * Picks ONLY the keys present in both `body` and DEAL_PATCH_ALLOWED_FIELDS.
 * Every other key — a derived financial field, a protected field, a typo,
 * or anything else — is silently dropped, never rejected with an error:
 * a client sending one legitimate field alongside an illegitimate one
 * still gets the legitimate field applied (Phase 4.22.1 — "unknown or
 * protected fields must be rejected or ignored deliberately"; ignored is
 * the chosen behaviour here so a single unexpected key can never block an
 * otherwise-valid save).
 */
export function pickAllowedDealFields(body: Record<string, unknown>): Record<string, unknown> {
  const picked: Record<string, unknown> = {};
  for (const key of DEAL_PATCH_ALLOWED_FIELDS) {
    if (key in body) picked[key] = body[key];
  }
  return picked;
}

/**
 * Phase 4.24 (Tasks 21/22) — value-level guards for the two fields
 * `calcPurchaseLTV`/`calcCapRatePP`/`calcTransferDuty` etc. divide by or
 * otherwise treat as load-bearing. Server-side because the Acquisition
 * form's client-side validation (react-hook-form `validate`) is only a UX
 * convenience — it never protects an endpoint reachable directly. Only
 * checks a field when the (already-coerced, allowlisted) payload actually
 * contains it, so a PATCH that doesn't touch these fields is unaffected.
 * Returns the first violation message, or null if the payload is clean.
 */
export function validateDealFieldValues(coerced: Record<string, unknown>): string | null {
  if ("purchasePrice" in coerced) {
    const v = coerced.purchasePrice;
    if (typeof v !== "number" || !(v > 0)) {
      return "Purchase Price must be greater than R0";
    }
  }
  if ("marketValue" in coerced) {
    const v = coerced.marketValue;
    // null (cleared/blank) remains allowed — only a negative number is rejected.
    if (v !== null && typeof v === "number" && v < 0) {
      return "Estimated Current Market Value cannot be negative";
    }
  }
  return null;
}
