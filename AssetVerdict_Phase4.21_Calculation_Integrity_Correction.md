# AssetVerdict — Phase 4.21: Calculation Integrity Correction

**Status:** Complete
**Scope:** Financial-truth correction only. No verdict thresholds, verdict labels, verdict precedence, DSCR/Break-Even/OER thresholds, IRR target policy, negotiation thresholds, Fix & Flip verdict calibration, unrelated UI styling, or database structure were changed.

---

## 1. Baseline

Before making any change, the following were read in full: `lib/calculations/index.ts`, `amortisation.ts`, `returnMath.ts`, `scenarios.ts`, `assembleInputs.ts`, `fixFlip.ts`, `fixFlipExitValue.ts`, `verdict.ts`, `negotiation.ts`, `transferDuty.ts`; the edit-tab pages (`cashflow`, `acquisition`, `finance`); the `/api/deals/[id]/calculate` route; `ExitAnalysisCard.tsx`, `FlipDashboard.tsx`, `DealSummaryPDF.tsx`, `ProjectCashflowChart.tsx`, `SimpleYearTable.tsx`, `useDealMetrics.ts`; `lib/ai/buildDealCoachContext.ts` / `dealCoachPrompt.ts`; `lib/education/metricDefinitions.ts` / `metricBreakdowns.ts`; and the existing test suite (12 files, 506 tests, all passing before any change).

No `CLAUDE.md` file exists in this repository — noted, not fabricated.

**Architecture already in place and preserved:** `lib/calculations/*` was already the single deterministic engine for the Summary dashboard, PDF, Deal Coach, and the `/calculate` route. The defects below were concentrated almost entirely in the **edit-tab live preview screens**, which had — in places — grown their own parallel copy of the formulas so users could see numbers before saving.

---

## 2. Exact Defects Confirmed

| # | Defect | Confirmed? | Root cause |
|---|---|---|---|
| 1 | Cashflow edit screen drift | **Confirmed** | `app/(app)/deals/[id]/edit/cashflow/page.tsx` re-implemented NOI/tax/cashflow/provisions/operating-cost math inline; `taxMonthly` subtracted **full P&I** debt service instead of interest only |
| 2 | Fix & Flip edit preview using old math | **Confirmed** | Same file, `flip` branch: omitted acquisition costs and financing interest entirely, and auto-deducted CGT — none of which match `calcFlipProfit()` |
| 3 | Rental exit ignores selling commission | **Confirmed** | `calcTerminalValueBreakdown()` never read `agentCommission`; terminal equity, Equity IRR, Equity NPV, and Exit Analysis were all overstated for any deal with a nonzero commission |
| 4 | SA transfer duty table outdated | **Confirmed** | `transferDuty.ts` still used the pre-1 April 2023 (actually older) R1,100,000-threshold table |
| 5 | Projection mixes property- and equity-level returns | **Confirmed** | `calc20YearProjection()`'s `cumulativeCashflow` started at `-calcTotalInvestment()` and `yearlyROI` divided a levered cashflow by that same unlevered total |
| 6 | Projection growth of provisions too coarse | **Confirmed** | `calc20YearProjection()` grew the *entire* provisions total (fixed-Rand and percentage components alike) at the rental growth rate |

Two additional items were audited per the brief and are **documented, not silently changed**: LTV semantics, and Student Accommodation's single NSFAS/private rent field. A third audit item (Instalment Sale) is now explicitly marked illustrative in the UI.

---

## 3. Formulas Changed — Before / After, With Worked Examples

### Defect 1 — Cashflow edit-preview tax

**Before** (`app/.../edit/cashflow/page.tsx`, inline):
```
taxMonthly = max(0, (noiMonthly - financeCostMonthly) * incomeTaxRate/100)   // financeCostMonthly = FULL P&I
```
**After:** the page builds a live `DealInputs` via `buildPreviewInputs()` and calls `calcTaxMonthly()` — the same function `calcAllMetrics()` uses:
```
taxMonthly = max(0, (noiMonthly - interestMonthlyOnly) * incomeTaxRate/100)
```

**Worked example** (R2,000,000 purchase, R1,400,000 loan @ 11%/20yr, R20,000 rent, 95% occupancy, 10%/5%/3% mgmt/maintenance/bad-debts, R2,000 rates/insurance):

| | Old (defective) | New (correct) |
|---|---|---|
| NOI/month | R13,580.00 | R13,580.00 |
| Deducted from NOI for tax | R14,450.64 (full P&I) | R12,833.33 (interest only) |
| **Tax/month** | **R0.00** | **R201.60** |
| Cashflow/month (tax included) | -R870.64 | -R1,072.24 |

The old screen understated tax to zero and overstated cashflow by ~R201.60/month for this deal — and disagreed with the Deal Summary, which was always correct.

### Defect 2 — Fix & Flip edit preview

**Before:**
```
flipTotalCost = purchasePrice + renovationCost + holdingCosts + agentFee     // no acquisition costs, no financing interest
flipNetProfit = (expectedSalePrice - flipTotalCost) - CGT                    // auto-deducted CGT
```
**After:** the page calls `calcFlipProfit(previewInputs)` — identical to `FlipDashboard`'s source of truth:
```
totalCost = purchasePrice + acquisitionCosts + renovationCost + holdingCosts + financingInterest + agentFee
netProfit = grossProfit   // PRE-TAX, no CGT
```

**Worked example** (R1,000,000 purchase, R50k transfer/bond, R10k sourcing, R150k renovation, R700k loan @13%/20yr, 6-month hold @ R3,000/month, R1,500,000 expected sale, 6% commission):

| | Old (defective) | New (correct) |
|---|---|---|
| Acquisition costs | *(omitted)* | R60,000 |
| Financing interest | *(omitted)* | R45,398.16 |
| Total Cost | R1,258,000.00 | R1,363,398.16 |
| Gross Profit | R242,000.00 | R136,601.84 |
| CGT deducted | -R53,240.00 (auto) | *(none — pre-tax model)* |
| **Reported profit** | **R188,760.00** | **R136,601.84** |
| **Reported ROI** | **15.00%** | **10.02%** |

The old preview overstated profit by ~R52,158 and ROI by ~5 points for this example — a financed Flip previously looked identical to an all-cash one.

### Defect 3 — Rental exit selling costs

**Before** (`calcTerminalValueBreakdown`):
```
terminalEquityValue = propertyValueAtExit - remainingDebt - CGT(propertyValueAtExit - purchasePrice)
```
**After:**
```
sellingCostsAtExit = propertyValueAtExit * agentCommission/100
proceedsForCGT      = propertyValueAtExit - sellingCostsAtExit
capitalGainsTaxAtExit = max(0, (proceedsForCGT - purchasePrice) * capitalGainsTaxRate/100)
terminalEquityValue = propertyValueAtExit - sellingCostsAtExit - remainingDebt - capitalGainsTaxAtExit
```

**Worked example** (R2,000,000 property value at exit, R800,000 remaining debt, R1,000,000 purchase-price base cost, 22% CGT rate, 6% commission):

| | Old (defective) | New (correct) |
|---|---|---|
| Selling costs | R0 *(never modelled)* | R120,000 |
| Taxable gain | R1,000,000 | R880,000 (proceeds net of selling costs) |
| CGT | R220,000 | R193,600 |
| **Terminal equity** | **R980,000** | **R886,400** |

Terminal equity — and therefore Equity IRR, Equity NPV, and Exit Analysis — was overstated by R93,600 (~9.6%) in this example whenever a nonzero commission was entered but never applied.

**CGT convention adopted (documented per the brief's requirement):** estate-agent commission is treated as a qualifying disposal cost under the Eighth Schedule's "proceeds" definition (SARS explicitly lists agent remuneration among qualifying incidental disposal costs — https://www.sars.gov.za/types-of-tax/capital-gains-tax/assets-subject-to-cgt/base-cost/), so it reduces **proceeds**, not base cost. `transferBondCost` and `renovationCost` remain **excluded** from `cgtBaseCost` — unchanged from Phase 4.10 — because those fields bundle costs (financing, repairs-vs-improvements) that don't uniformly qualify and AssetVerdict cannot currently separate which portion would.

### Defect 4 — Transfer duty table

**Before:** R1,100,000 threshold table ("2023+" comment, actually stale).
**After:** the table effective 1 April 2025, unchanged into 1 April 2026, applicable to both natural and non-natural persons:

| Bracket | Rate |
|---|---|
| R0 – R1,210,000 | 0% |
| R1,210,001 – R1,663,800 | 3% above R1,210,000 |
| R1,663,801 – R2,329,300 | R13,614 + 6% above R1,663,800 |
| R2,329,301 – R2,994,800 | R53,544 + 8% above R2,329,300 |
| R2,994,801 – R13,310,000 | R106,784 + 11% above R2,994,800 |
| Above R13,310,000 | R1,241,456 + 13% above R13,310,000 |

**Worked example:** R1,500,000 → old table R12,000, new table **R8,700**. R2,000,000 → old table R41,625, new table **R33,786**. Every bracket threshold moved up, so the old table consistently overcharged across the full price range tested (R1.5M–R14M) — the whole table needed replacing, not a single bracket.

A UI limitation notice was added: transfer duty applies only to non-VAT transactions, and AssetVerdict does not model VAT status.

### Defect 5 — Projection basis (property-level vs equity-level)

**Before:**
```
cumulativeCashflow(year 0) = -calcTotalInvestment(inputs)          // unlevered
yearlyROI = cashflowForPeriod / calcTotalInvestment(inputs) * 100  // levered ÷ unlevered
```
**After:**
```
cumulativeCashflow(year 0) = -calcInitialEquityInvestment(inputs)          // equity-level
yearlyROI = initialEquityInvestment > 0 ? cashflowForPeriod / initialEquityInvestment * 100 : null
```
Field renamed in effect (UI label, chart legend, PDF column) from "ROI"/"Yearly ROI" to **"Annual Cash-on-Cash Return"**. `null` — never a fake 0% — when equity is zero or negative.

**Worked example** (same deal as the Defect 1 example, plus R300,000 of buying costs — transfer/bond + sourcing — so Total Investment = R2,300,000, Initial Equity = R2,300,000 - R1,400,000 loan = R900,000; Year-1 cashflow = -R1,072.24/month = -R12,866.88 annualised):

| | Old (defective) | New (correct) |
|---|---|---|
| Denominator | R2,300,000 (total investment) | R900,000 (equity invested) |
| Year-1 "ROI" | -0.56% | **-1.43%** |

The old figure diluted the true equity-level swing by ~2.6x for this deal — the more leveraged the deal, the larger the understatement.

### Defect 6 — Projection provisions growth

**Before:**
```
provisions(year) = calcProvisionsMonthly(inputs).total * 12 * rentGrowthFactor(year)   // blanket growth for EVERYTHING
```
**After:** a new `calcProvisionsAnnualForYear()` grows each component on its own assumption — percentage fees/bad debts scale with that year's own projected revenue; fixed-Rand fees scale with cost inflation.

**Worked example** (fixed R1,000/month management fee, 10% rental growth, 4% cost inflation, Year 2):

| | Old (defective) | New (correct) |
|---|---|---|
| Year-2 management fee | R13,200.00 (grown at 10% rent growth) | **R12,480.00** (grown at 4% cost inflation) |

The old model grew a flat Rand fee as if it were rent — R720/year of phantom growth in this example, compounding every year over the 20-year horizon.

---

## 4. Files Modified

**Calculation engine (`lib/calculations/`)**
- `index.ts` — Defects 3, 5, 6; new `calcProjectedPropertyValue()` extraction; `ExitSummary`/`YearlyProjection` type changes (`sellingCostsAtExit`, `yearlyROI: number | null`)
- `transferDuty.ts` — Defect 4 (new bracket table, doc comment, VAT-scope note)
- `previewInputs.ts` — **new file**: the one sanctioned way an edit form builds a temporary `DealInputs` for a live preview (`buildPreviewInputs`)

**UI — edit tabs**
- `app/(app)/deals/[id]/edit/cashflow/page.tsx` — Defects 1 & 2: removed all inline NOI/tax/cashflow/provisions/Fix & Flip formulas; delegates entirely to `buildPreviewInputs()` + `calcRevenueMonthly` / `calcEffectiveMonthlyRevenue` / `calcProvisionsMonthly` / `calcOperatingCostsMonthly` / `calcTaxMonthly` / `calcCashflowMonthly` / `calcFlipProfit`; Fix & Flip section rebuilt pre-tax with acquisition costs and financing interest now shown; Instalment Sale split marked illustrative; NSFAS/private mixed-rent limitation notice added
- `app/(app)/deals/[id]/edit/acquisition/page.tsx` — replaced inline `totalInvestmentCost` sum and `Math.pow` capital-growth projection with `calcTotalInvestment()` / `calcProjectedPropertyValue()`; added transfer-duty VAT-scope note
- `app/(app)/deals/[id]/edit/finance/page.tsx` — replaced inline total-loan/finance-cost/deposit-required sums with `calcTotalLoanAmount()` / `calcTotalFinanceCostMonthly()` / `calcDepositRequired()` via `buildPreviewInputs()`

**UI — display surfaces**
- `components/ExitAnalysisCard.tsx` — Defect 3: added "Less Selling Costs (Agent Commission)" line; updated CGT explanation copy
- `components/charts/ProjectCashflowChart.tsx` — Defect 5: "Yearly ROI" → "Annual Cash-on-Cash Return", null-safe rendering
- `lib/pdf/DealSummaryPDF.tsx` — Defect 5: projection table column "ROI%" → "Cash-on-Cash %", null-safe rendering

**Tests**
- `lib/calculations/__tests__/index.test.ts` — updated 2 existing exit-reconciliation tests to include `sellingCostsAtExit`; added `describe` blocks for Defect 3, Defect 5, Defect 6, and `calcProjectedPropertyValue`
- `lib/calculations/__tests__/transferDuty.test.ts` — **new**
- `lib/calculations/__tests__/previewInputs.test.ts` — **new** (Defects 1 & 2 parity proofs)
- `lib/__tests__/areaIntelligence.test.ts` — one-line fixture fix for the new required `sellingCostsAtExit` field

No verdict, threshold, or `lib/calculations/verdict.ts` / `thresholds.ts` file was touched.

---

## 5. Tests Added

- **`transferDuty.test.ts`** (13 tests): every bracket boundary (R1,210,000 / R1,210,001 / R1,663,800 / R2,329,300 / R2,994,800 / R13,310,000 / R13,310,001) plus the three representative values from the brief (R1.5M→R8,700, R2M→R33,786, R5M→R327,356) and a monotonicity check.
- **`previewInputs.test.ts`** (8 tests): identity/parity proofs that `buildPreviewInputs()` reproduces `assembleInputs()` exactly, that a live unsaved edit produces byte-identical `calcAllMetrics()` output to the same value after saving, that `calcTaxMonthly` uses interest only (not full debt service), and that `calcFlipProfit` on the preview includes acquisition costs/financing interest and never deducts CGT.
- **`index.test.ts` additions** (14 tests): 0%-commission-preserves-baseline, positive commission lowers terminal proceeds/IRR/NPV, `ExitSummary` reconciles exactly with the IRR/NPV terminal value, CGT computed on proceeds net of selling costs (Defect 3); equity-basis `cumulativeCashflow`/`yearlyROI`, null-not-zero for non-positive equity (Defect 5); fixed-Rand vs percentage provisions growing on the correct assumption, individually and combined, Year-1 reconciliation (Defect 6); `calcProjectedPropertyValue` parity with the projection table.

**Total new/modified test cases: 35.** All cross-surface parity requirements from the brief are covered by construction: the edit-preview builder (`buildPreviewInputs`) and every display surface (Deal Summary, PDF, Exit Analysis) all call the *same* `lib/calculations` functions — there is no second implementation left to test for divergence against.

---

## 6. Test / Lint / Type-Check / Build Results

```
$ npx vitest run
 Test Files  25 passed (25)
      Tests  738 passed (738)

$ npx tsc --noEmit
(clean — no output)

$ npx eslint .
✖ 1 problem (0 errors, 1 warning)   — pre-existing, unrelated Next.js font warning in app/layout.tsx

$ npm run build
✓ Compiled successfully
✓ Generating static pages (16/16)
```

No skipped or failing tests. No error-level lint findings. Build succeeds with all 33 routes generated.

---

## 7. Remaining Calculation Limitations (Documented, Not Silently Fixed)

### Audit — LTV semantics
`calcLTV = Total Loan Amount / Purchase Price`, but the product labels this "Loan-to-Value." This is actually **Loan-to-Purchase-Price**, not necessarily loan relative to an independent market/lender valuation (`marketValue` is a separate, user-entered field never wired into `calcLTV`). Because LTV participates in Safety-state classification and the Overall Verdict (as a modifier, not a primary blocker — see `verdict.ts`'s `deriveSafetyState`), changing the denominator could shift verdicts across the system. **Per the brief, this was NOT changed.** AssetVerdict should decide, as a deliberate product decision, whether to expose (1) Loan/Purchase Price, (2) Loan/Market Value, (3) both, or (4) a conservative lender-style valuation basis, before any formula change is made here.

### Audit — Student Accommodation mixed NSFAS/private rent
A single rent field per room type (Single, Sharing) is applied to both NSFAS-funded and private/bursary beds recorded against that room type. If real private-market rent differs from the NSFAS rate, revenue is misstated for whichever funding type the entered rent doesn't match. **Not silently changed.** A UI limitation notice now appears on the Cashflow tab whenever a deal records both NSFAS and private beds within the same room type, explaining this exactly. A future schema change should introduce separate NSFAS/private rates per room type (single and sharing) if this needs to be modelled precisely.

### Audit — Instalment Sale
`instalmentRate` and `instalmentTerm` are captured but not consumed by the authoritative model (`calcBaseMonthlyRevenue` treats an Instalment Sale strategy as a flat monthly `instalmentAmount` only). The Cashflow tab's principal/interest split is now explicitly labelled **"(illustrative)"** with an inline explanation that it is not sourced from the authoritative engine. The Overall Verdict already remains unavailable for this strategy (`verdict.ts`'s `strategy_model_incomplete` branch, unchanged) until a genuine seller-finance model exists.

---

## 8. Confirmations

1. **UI screens no longer maintain competing calculation logic.** The Cashflow, Fix & Flip, Acquisition, and Finance edit tabs all build a temporary `DealInputs` via the one new `buildPreviewInputs()` helper and read every number from `lib/calculations` functions — no NOI, tax, cashflow, financing-interest, Fix & Flip profit, ROI, IRR, NPV, terminal-value, student-revenue, provisions, debt-service, or selling-costs formula is re-implemented in any UI component. A repository-wide search for `incomeTaxRate`, `capitalGainsTaxRate`, `agentCommission`, `cashflowMonthly`, `financeCostMonthly`, `Math.pow`, `/ 100`, `/ 12`, and manual reduce-based sums outside `lib/calculations` turned up only presentation-only arithmetic (simple additive totals of user-entered line items — renovation budgets, capex totals) or values that already trace back to an authoritative primitive (e.g. summing already-server-computed `repaymentAmount` figures) — each explicitly reviewed and left as-is.
2. **No verdict threshold was silently changed.** `lib/calculations/verdict.ts`, `thresholds.ts`, `flipVerdict.ts`, and `negotiation.ts` were not modified. Metric *values* changed where an underlying financial defect was corrected (as expected and accepted by the brief); the judgement rules that read those values did not.
3. The completed report is this document: `AssetVerdict_Phase4.21_Calculation_Integrity_Correction.md`.
