# AssetVerdict — Phase 4.23: LTV & Leverage Metric Definition Audit

**Status:** Audit complete. **No formula, threshold, verdict logic, or user-facing label was changed in this phase.** Two safe, purely additive changes were made: characterization tests (pinning current behaviour) and this report. Everything else below is a recommendation pending explicit approval.

---

## 1. Exact Current LTV Formula

`lib/calculations/index.ts`:
```ts
export function calcLTV(inputs: DealInputs): number {
  if (!inputs.purchasePrice) return 0;
  return (calcTotalLoanAmount(inputs) / inputs.purchasePrice) * 100;
}
```
Where `calcTotalLoanAmount(inputs) = sum of every financeSources[].loanAmount`.

**The current metric is, precisely: Total Loan Amount ÷ Purchase Price × 100.** It never reads `marketValue`, `totalInvestment`, or any valuation field. This is confirmed identical for every strategy — `calcAllMetrics()` calls `calcLTV(inputs)` unconditionally, with no strategy branch (see §11 for the one exception in *usage*, not *computation*).

---

## 2. Every Place LTV Is Used

Traced exhaustively via `calcLTV|"ltv"|Loan-to-Value` across the repo:

| Layer | File | What it does |
|---|---|---|
| Engine | `lib/calculations/index.ts` | Computes `metrics.ltv` unconditionally for every strategy |
| Threshold definition | `lib/calculations/thresholds.ts` | `cutoff("financial_safety", "lower", 60, 75, { evidenceLevel: "internal", rationale: "...undocumented externally" })` — one definition, shared by every rental strategy (no per-strategy override); **absent entirely** from `FIX_AND_FLIP_DEFINITIONS` |
| Applicability | `lib/calculations/applicability.ts` | `ltv: (ctx) => requiresPositive(ctx.purchasePrice, "No purchase price set")` — excluded (not_applicable) only when purchase price is missing/zero; **not** gated on whether any debt exists at all (an all-cash deal legitimately gets 0%, unlike DSCR which requires debt to be applicable) |
| Verdict | `lib/calculations/verdict.ts` `deriveSafetyState()` | **Modifier only.** Only a classified-**red** (>75%) LTV sets `ltvWarning = true`, demoting Safety from "strong" to "acceptable" — see the exact consequence table in §13. Orange (60–75%) has **zero** effect. LTV never contributes to the "unknown" safety state and never independently triggers High Risk. |
| Verdict (Fix & Flip) | `lib/calculations/flipVerdict.ts` | **Not referenced at all** — zero mentions of `ltv`. Fix & Flip's verdict is entirely structural-viability/exit-evidence based. |
| Negotiation | `lib/calculations/negotiation.ts` | Never calls `classifyMetricForDeal("ltv", ...)` directly, but every negotiation objective re-runs `deriveDealVerdict()` at each candidate price, which recomputes LTV classification internally. Under the module's own **"fixed original LTV" financing policy**, loan amount scales proportionally with negotiated price — so **the LTV % is deliberately held constant** at every candidate price (module doc comment: *"LTV% itself does NOT improve when price is negotiated down under this policy — only the absolute Rand amounts...do"*). |
| Education | `lib/education/metricDefinitions.ts` | `name: "Loan-to-Value"`, `shortName: "LTV"`, but `formulaLabel: "Total Loan Amount ÷ Purchase Price"` and `simpleExplanation: "...funded by debt versus your own cash"` (of the *purchase price*) — **the name and the formula description already disagree with each other.** |
| Deal Coach | `lib/ai/dealCoachTypes.ts`, `dealCoachPrompt.ts`, `buildDealCoachContext.ts` | `ltv` is one of `HEADLINE_METRICS_RENTAL`; `FIXED_LTV_ASSUMPTION_EXPLAINER` literally says *"your original **loan-to-price ratio (LTV)**"* — again conflating the two terms in the very sentence meant to clarify the policy. Excluded entirely from Fix & Flip context (`buildDealCoachContext.test.ts` explicitly asserts `"Fix & Flip context contains ONLY flip metrics — no DSCR, LTV, IRR, NPV, Cash-on-Cash"`). |
| Summary UI | `app/(app)/deals/[id]/summary/page.tsx` | `label="LTV"`, `tooltipText="Loan-to-Value ratio — your total debt as a % of **purchase price**..."` — same name/description contradiction as the education layer. |
| PDF | `lib/pdf/DealSummaryPDF.tsx` | Gauge-coloured via the same shared `getGaugeColorForStrategy("ltv", ...)` path as every other threshold metric — no LTV-specific logic. |
| Negotiation copy | `lib/education/negotiationCopy.ts` | `FIXED_LTV_ASSUMPTION_EXPLAINER` (quoted above). |

---

## 3. Is the Current Label Financially Accurate?

**No — by the codebase's own internal admission.** Every piece of copy that *explains* the ratio (formula labels, tooltips, the Deal Coach explainer) correctly says "purchase price." Every piece of copy that *names* the ratio says "Loan-to-Value"/"LTV." This is not a subtle inference — it is a direct, repeated self-contradiction already present in the shipped product. Per the central acceptance rule this phase was given: **a ratio must not be called Loan-to-Value unless the denominator genuinely represents property value** — `purchasePrice` is an agreed transaction price, not an independent valuation, so the current label is inaccurate as currently computed.

---

## 4. Definition — Loan-to-Purchase Price (LTPP)

```
Loan-to-Purchase Price = Total Loan Amount ÷ Purchase Price × 100
```
**Meaning:** what percentage of the *agreed transaction price* is being financed with debt. Directly answers "how much cash deposit do I need against what I agreed to pay?" This is **exactly what `calcLTV()` already computes today** — only the name is wrong.

## 5. Definition — True Loan-to-Value

```
Loan-to-Value = Total Loan Amount ÷ Property Value × 100
```
**Meaning:** debt relative to an independent assessment of what the property is actually worth, not what the buyer agreed to pay for it. AssetVerdict does not currently compute this at all — `marketValue` exists as a field, but no `Loan / marketValue` ratio exists anywhere in `lib/calculations`. See §7 for why `marketValue` cannot be used for this unqualified.

## 6. Definition — Debt-to-Total-Investment ("Project Leverage")

```
Debt-to-Total-Investment = Total Loan Amount ÷ Total Investment × 100
```
where `Total Investment = calcTotalInvestment(inputs) = purchasePrice + transferBondCost + renovationCost (Cost Used, Phase 4.22) + sourcingFee` — the exact, unchanged, existing function. **Meaning:** what fraction of the *entire project* (not just the purchase itself) is debt-funded. AssetVerdict does not currently compute this either.

### Worked example (audit report §6, pinned in `index.test.ts`)

| | Value |
|---|---|
| Purchase Price | R1,000,000 |
| Market Value | R1,400,000 |
| Transfer/Bond Cost | R50,000 |
| Furniture/Setup/Renovation (Cost Used) | R200,000 |
| **Total Investment** | **R1,250,000** |
| Loan | R800,000 |

```
Loan / Purchase Price     = 80.0%   <- what calcLTV() returns TODAY, mislabelled "LTV"
Loan / Market Value       = 57.1%   <- true LTV — not currently computed anywhere
Loan / Total Investment   = 64.0%   <- Debt-to-Total-Investment — not currently computed anywhere
```
In plain investor language:
- **80%** — how much of what you *agreed to pay* is financed by debt.
- **57.1%** — how much debt exists relative to the property's *assumed worth*.
- **64%** — how much of the *entire project* (purchase + costs + furniture/setup/renovation) is debt-funded.

These three numbers answer three different questions and **must never be merged into one metric.** All three figures above are proven exactly in `lib/calculations/__tests__/index.test.ts`'s new "Phase 4.23 characterization baseline" describe block.

---

## 7. Current Meaning and Reliability of `marketValue`

- **Where entered:** Acquisition tab, a single free-typed `CurrencyInput` labelled plainly **"Market Value"** — no help text, no tooltip, no guidance on what date/condition/basis it should reflect (`app/(app)/deals/[id]/edit/acquisition/page.tsx`).
- **Optional?** Yes — nullable in the schema (`marketValue Float?`), and if left blank, `assembleInputs.ts` explicitly defaults it: `marketValue: deal.marketValue ?? deal.purchasePrice ?? 0`. **A blank Market Value silently becomes the Purchase Price.** Any future market-value-based ratio would collapse to the current purchase-price-based one for every deal that never filled this field in — the new characterization test documents this explicitly.
- **What does it represent?** Nothing specific is enforced or instructed — purely an unverified investor estimate, entered once, with no source, date, or confidence attached.
- **Independently verified?** No.
- **Does Fix & Flip use it instead of ARV?** No — Fix & Flip uses its own `expectedSalePrice` (the investor's own after-repair sale assumption, entered on the Cashflow tab) for all Flip economics; `marketValue` is not read anywhere in `calcFlipProfit`/`calcFixFlipAnalysis`.
- **Does Area Intelligence/AI influence it?** **No — and this is a significant, separate finding.** AssetVerdict already has a *second*, much richer valuation concept: the `PropertyValuation` model (`prisma/schema.prisma`), populated via `PropertyValuationPanel.tsx` and `ReportImportButton` — with `estimatedValue`, `valueConfidenceLow/High`, `valuationConfidence`, `valuationBasis` ("unknown" / "current_condition" / "post_renovation"), `reportSource`, `reportDate`, and comparable sales. This is currently used **only** for Fix & Flip exit-value evidence (`lib/calculations/fixFlipExitValue.ts`, Phase 4.19). It is **never connected to `Deal.marketValue`, `calcLTV`, or `calcCapRateMV`** — these two valuation concepts exist in parallel, entirely disconnected. This is directly relevant to the "Estimated Market Value vs. Formal/Bank Valuation" distinction this audit was asked to investigate: **the infrastructure for that distinction already exists in the codebase**, it just isn't wired to leverage metrics at all.
- **Consequence:** if a true Loan-to-Value metric is ever introduced from `marketValue` as it stands today, it must be labelled **"Estimated LTV"** (or similar) — never presented as bank-confirmed, per the brief's own instruction, and its reliability is currently no better than an unguided guess.

---

## 8. South African Lending Evidence Reviewed

- **Private Property** (privateproperty.co.za), *"Why the loan-to-value ratio is important when buying property"*: *"The LTV is basically the requested loan amount expressed as a percentage of the purchase price – or as a percentage of the appraised value of the property, if this is different from the purchase price."* Worked example given: a R2m purchase valued by the bank at only R1.9m turns a 90% LTV (against price) into a 95% LTV (against valuation) — the **lower** figure is what the bank actually uses.
- **Property24** (property24.com), *"How to handle a low bank valuation and keep the sale alive"*: *"If the bank's valuation is lower than your agreed purchase price, the bank will only lend against the lower figure."* Worked example: agreed sale R2m, bank valuation R1.8m, buyer approved for a 90% bond → *"the bank will lend 90 percent of R1.8 million, not R2 million"* — creating a cash shortfall the buyer must cover.
- **Arcadia Finance / general SA home-loan guidance**: confirms LTV = loan ÷ (purchase price, or appraised value if different), and that 80% LTV or less typically secures the best rates; first-time buyers can access up to 100% LTV in the current market (zero-deposit bonds); foreign nationals are typically capped near 50%.
- **BetterBond** (betterbond.co.za), *"Higher deposit, lower LTV, better home loan"*: reinforces that a lower LTV (larger deposit) improves rate/approval odds.
- **General buy-to-let / investment property guidance (2026 sources)**: investment/buy-to-let properties consistently require **larger deposits than owner-occupied residential** — banks treat rental-income-dependent repayment ability as higher risk, applying stricter affordability tests. Commercial property finance was not found to share a single simple LTV convention with residential lending in these sources; it typically carries its own, often lower, LTV ceilings and a more involved underwriting process.

**Conclusion:** South African lenders overwhelmingly lend against **the lower of purchase price and their own valuation** — never the higher. This directly supports the audit brief's §4 hypothesis (`min(Purchase Price, Recognised Valuation)`) as the financially defensible convention for a *conservative, lender-style* LTV, **if and when AssetVerdict introduces one** — but this is evidence for a future recommendation, not something activated in this phase, and AssetVerdict does not currently capture a "recognised valuation" distinct from the unguided `marketValue` estimate (see §7).

Sources: [Why the loan-to-value ratio is important when buying property (Private Property)](https://www.privateproperty.co.za/advice/property/articles/why-the-loan-to-value-ratio-is-important-when-buying-property/6256) · [How to handle a low bank valuation and keep the sale alive (Property24)](https://www.property24.com/articles/how-to-handle-a-low-bank-valuation-and-keep-the-sale-alive/33168) · [What is Loan-to-Value (LTV) for Home Loans? (Arcadia Finance)](https://www.arcadiafinance.co.za/home-loans/loan-to-value-for-home-loans/) · [Higher deposit, lower LTV, better home loan (BetterBond)](https://www.betterbond.co.za/learn/higher-deposit-lower-ltv-better-home-loan/)

---

## 9. How Multiple Finance Sources Affect Leverage

`calcTotalLoanAmount()` sums every `FinanceSource.loanAmount` regardless of `sourceType`. The current source-type list (`components/forms/FinanceBlock.tsx`): **Bank Finance, Bridging, Commercial, Creative Finance, DCSR, Private** — all six are genuine debt instruments; there is currently **no** "cash contribution," "equity," or "grant" option in the list, so `calcTotalLoanAmount` cannot presently be polluted with non-debt capital. `sourceType` is explicitly documented elsewhere as *"a descriptive label only"* that does not change the repayment mathematics (every source is modelled identically as a standard amortising loan) — a separate, already-known limitation (not introduced or worsened by this audit). **No defect found here**; documented as a positive finding with the caveat that if a genuine equity/grant source type is ever added, `calcTotalLoanAmount` would need an explicit debt-vs-equity filter at that time.

---

## 10. How Fix & Flip Differs

- Fix & Flip's verdict engine (`flipVerdict.ts`) **does not use LTV in any form.** It is structured entirely around structural viability (does the flip show a profit) and post-renovation exit-price evidence quality (`fixFlipExitValue.ts`) — a fundamentally different risk question from rental leverage safety.
- `metrics.ltv` (purchase-price-based) is still *computed* for a Fix & Flip deal (no strategy gate in `calcAllMetrics`), but is **never displayed** (`FlipDashboard.tsx` has no LTV gauge) and **never consulted** by the Flip verdict or Deal Coach context (`buildDealCoachContext.test.ts` explicitly asserts LTV is absent from Fix & Flip context).
- Applying rental LTV thresholds (60/75, calibrated — per its own `rationale` field — with **no external evidence at all**) to a short-hold, often-renovation-heavy Flip project would be financially indefensible without dedicated calibration: a Flip's debt commonly funds renovation and holding costs on top of the purchase, so "Loan / Purchase Price" alone would systematically overstate risk relative to "Loan / Total Project Cost." An After-Repair-Value-based ratio (`Loan / expectedSalePrice`) is conceptually available (Fix & Flip already records `expectedSalePrice`) but was **not found anywhere in the codebase** today, and mixing a *current* debt figure against a *future* sale-price assumption would itself need the exact "current vs. future value" separation this audit was asked to protect (see §11) — not something to introduce casually.
- **No change to Fix & Flip verdict calibration is proposed or made in this phase**, consistent with the brief.

---

## 11. Debt vs. Purchase Price, and Current vs. Future Value

- **Debt exceeding purchase price:** confirmed NOT an error condition. `calcLTV` has no upper clamp; a deal with `loanAmount > purchasePrice` (financing that also covers renovation/fees/capitalised costs) correctly returns >100% and is tested (`can exceed 100% under very high leverage without throwing`, plus a new Phase 4.23 test pinning the exact R1,000,000/R1,100,000 → 110% case). Whether this is *displayed* with enough explanation that ">100%" isn't read as "impossible" or "broken" is a UI/education gap worth closing when the metric set is finalised — not a code defect today.
- **Current vs. future value mixing:** audited specifically for accidental contamination. `calcLTV` reads only `purchasePrice` (a present-tense, at-acquisition figure) — never `expectedSalePrice` (Fix & Flip's future assumption), never a projected Year-N `propertyValue` from `calc20YearProjection`, never `marketCapRate`. **No mixing found.** The one adjacent risk already exists independently of LTV: `marketValue` itself does not distinguish "today's value" from "post-renovation value" — the field carries no `valuationBasis`-style qualifier (unlike `PropertyValuation.valuationBasis`, which already models exactly this distinction for Fix & Flip exit evidence, per §7). This is a real limitation to note for any future "true LTV," but it does not currently corrupt the existing purchase-price-based ratio.

---

## 12. Deposit Required Remains Correctly Separate

`calcDepositRequired(inputs) = calcTotalInvestment(inputs) - calcTotalLoanAmount(inputs)` — a distinct function, distinct UI card (Finance tab), never conflated with `calcLTV` anywhere in the traced code or copy. `calcInitialEquityInvestment` is numerically identical to `calcDepositRequired` but kept as its own named function specifically so return-calculation call sites (IRR/NPV/Cash-on-Cash) don't read as "deposit" — this separation-of-concepts principle is already applied consistently. **No defect found; positive finding, no change needed.**

---

## 13. Current Verdict Impact — Consequence Table

| Current LTV range (`Loan ÷ Purchase Price`) | Classification | Consequence |
|---|---|---|
| 0% (no debt, purchase price > 0) | Green (favourable) | None — genuinely 0% leverage; correctly treated as favourable, not "not applicable" (unlike DSCR, which requires debt to be applicable at all) |
| 0% – 60% | Green | None beyond "favourable" — no blocking, no reason emitted |
| 60% – 75% (Orange / Caution) | Orange | **No effect whatsoever.** `deriveSafetyState()` only checks `ltv.color === "red"` — orange is explicitly "not given that authority in this first release" (code comment, Phase 4.14 §13). This is a deliberately weaker treatment than DSCR/Break-Even, where orange *does* demote Strong. |
| >75% (Red / Weak) | Red | Sets `ltvWarning = true` → Safety State cannot reach "strong" (falls to "acceptable"), pushing the overall verdict toward "Promising" instead of "Strong" (assuming target is otherwise met). Contributes one **moderate**-severity, non-blocking `high_ltv` reason. **Never** independently causes "High Risk" (that requires the separate, raw DSCR<1.0 or Break-Even>100% structural check). Never contributes to "unknown" safety state. |
| purchasePrice ≤ 0 | not_applicable | Excluded from required evidence entirely — no penalty (same convention as DSCR on an all-cash deal) |

**Were these thresholds (60/75) designed around Loan/Purchase Price or true Loan/Value?** **Unclear, and the codebase says so itself.** The threshold's own `rationale` field states: *"Band values are AssetVerdict's own reference, undocumented externally"* with `evidenceLevel: "internal"` — the lowest evidence tier the system defines. There is no comment, commit history reference, or design doc found anywhere tying 60/75 to either denominator specifically, or to any named lender's real underwriting bands. **Per the brief's own rule, this evidence gap must be stated plainly rather than guessed at:** these numbers cannot be assumed calibrated for a true LTV denominator just because 75–80% happens to resemble common SA bank ceilings (§8) — that resemblance may be coincidental, since the thresholds were built and have only ever been exercised against `purchasePrice`.

## Can These Thresholds Safely Carry Over to a Different Denominator? — **No, not without recalibration.**

`marketValue ≥ purchasePrice` in the overwhelming majority of real deals (an investor buying below assessed value is the entire premise of a "good deal" in this product's own worked examples — see §6, where Market Value R1.4m > Purchase Price R1.0m). Because Loan/MarketValue is mathematically **always ≤** Loan/PurchasePrice whenever `marketValue ≥ purchasePrice` (same numerator, larger-or-equal denominator), silently repointing `calcLTV`'s denominator to `marketValue` while keeping the 60/75 bands would **systematically make every existing deal's leverage reading look safer than before** — a material, silent shift in the risk engine, exactly the outcome the brief's closing rule forbids. This is precisely why this phase does not touch the formula.

---

## 14. Recommended Product Model — **Option C**

Evidence supports exposing three separately-named, separately-computed metrics, each answering one precise question:

```
Loan-to-Purchase Price (LTPP)   = Total Loan Amount ÷ Purchase Price        <- rename of the existing calcLTV(), no formula change
Estimated Loan-to-Value (Est. LTV) = Total Loan Amount ÷ Estimated Market Value   <- NEW, not yet implemented
Debt-to-Total-Investment        = Total Loan Amount ÷ Total Investment      <- NEW, not yet implemented
```

**Recommended risk/verdict metric:** *Continue using Loan-to-Purchase Price (the current computation) for Safety State*, simply **renamed** to stop misdescribing it — its thresholds were exercised and (informally) tuned against this exact denominator, so this is the only zero-risk path that changes nothing about verdict behaviour. **Do not switch the verdict-facing metric to Estimated LTV or Debt-to-Total-Investment without a dedicated recalibration phase** (new thresholds, evidence review, regression-tested against real/representative deals) — per §13's finding that the existing 60/75 bands cannot be assumed to transfer.

This recommendation is **not activated** — see §22.

---

## 15. Recommended Education Copy

### Loan-to-Purchase Price (LTPP)
**What is it?** How much of the property's agreed purchase price is being funded by debt.
**Why does it matter?** It shows how much cash you are contributing toward buying the property, and how exposed you are to swings in your own equity return.
**Example:** Purchase Price R1,000,000, Loan R800,000 → 80% of the purchase price is financed.

### Estimated Loan-to-Value
**What is it?** How large the loan is compared with your own estimate of the property's current market value — not a bank-confirmed valuation.
**Why does it matter?** A higher ratio against value means less of a cushion if that value estimate turns out to be optimistic, or if prices fall.
**Caveat shown alongside the number:** *"Based on your own Market Value estimate — not an independent or bank-confirmed valuation."*

### Debt-to-Total-Investment
**What is it?** How much of the entire project cost — purchase price plus transfer/bond costs, sourcing fees, and Furniture, Setup & Renovation — is financed by debt.
**Why does it matter?** It gives a more complete leverage picture once you're also spending money on costs beyond the purchase price itself.

---

## 16. Zero / Missing / Invalid Denominators

**Current behaviour (unchanged, characterized in tests):** `calcLTV` returns a plain `0` (never `NaN`/`Infinity`) when `purchasePrice` is falsy. This `0` is a documented **sentinel**, not a real "0% LTV" — `applicability.ts`'s `requiresPositive(ctx.purchasePrice, ...)` intercepts it upstream and the UI shows "N/A," matching the exact pattern already used for `capRatePP`, `grossYield`, and every other purchase-price-denominated ratio in this codebase (see the doc comment atop `applicability.ts`). **No fake 0% ever reaches a user for a missing purchase price today.**

**One genuine gap found (not fixed — documented per §19):** a **negative** `purchasePrice` is not blocked anywhere in input validation and is not caught by `!inputs.purchasePrice` (only true for 0/null/NaN). `calcLTV` would return a negative, nonsensical percentage (pinned in the new characterization test: -R1,000,000 purchase price, R800,000 loan → -80%) rather than `null`/`N/A`. This is not a crash or a `NaN`, so per the brief's own carve-out it is **documented, not silently fixed** in this phase.

**Recommendation for any future implementation:** the engine-level function should return `number | null` directly (matching the precedent already set by `YearlyProjection.yearlyROI` in Phase 4.21) rather than relying on a `0`-sentinel + a separate applicability layer — but changing `calcLTV`'s return type today would be a broader, deliberate architectural change affecting every similarly-guarded ratio in `index.ts`, not an LTV-specific fix, and is left for a dedicated future phase.

---

## 17. Schema Changes Eventually Required (If Option C Is Approved)

None are *required* to introduce Debt-to-Total-Investment (it only needs `calcTotalInvestment`, already computed). Estimated LTV needs no new field either — it can read the existing `marketValue`. **No schema change is proposed or made in this phase.** If AssetVerdict later wants a genuinely distinct "Recognised/Formal Valuation" (as opposed to the unguided `marketValue` estimate), the closest existing building block is `PropertyValuation.estimatedValue` (§7) — connecting that to a conservative lender-style LTV (`min(purchasePrice, recognisedValuation)`, per §8's evidence) would be the natural next step, but is explicitly **not** recommended for activation without its own follow-up phase.

---

## 18. Tests Added

`lib/calculations/__tests__/index.test.ts` — new `describe("calcLTV — Phase 4.23 characterization baseline...")` block, 7 tests, all purely additive (no existing test changed, no formula touched):
1. Purchase Price R1,000,000 / Loan R800,000 → exactly 80%.
2. Loan = R0 / Purchase Price = R1,000,000 → 0%.
3. Invalid denominator (`purchasePrice = 0`) → sentinel `0`, never `NaN`/`Infinity`.
4. Negative purchase price → a negative, nonsensical percentage (documented limitation, not fixed).
5. Debt exceeding purchase price → >100% without error (110% case).
6. `marketValue` defaulting to `purchasePrice` when blank (`assembleInputs`) — documents the shared risk any future market-value-based ratio inherits.
7. The full §6 worked example — all three ratios (LTPP 80%, true LTV 57.1%, Debt-to-Total-Investment 64%) computed and proven to diverge from one another.

Coverage was already substantial before this phase (`calcLTV` describe block: proportional check, no-finance case, high-leverage >100% case, zero-purchase-price case) — this phase's additions specifically pin the brief's own literal worked numbers as a named baseline, per its explicit request.

---

## 19. Files Changed

- `lib/calculations/__tests__/index.test.ts` — 7 new characterization tests only.
- `AssetVerdict_Phase4.23_LTV_Leverage_Definition_Audit.md` — this report.

**No other file was modified.** `lib/calculations/index.ts`, `thresholds.ts`, `verdict.ts`, `applicability.ts`, `negotiation.ts`, `metricDefinitions.ts`, `dealCoachPrompt.ts`, `buildDealCoachContext.ts`, `DealSummaryPDF.tsx`, and the Summary page are all untouched.

---

## 20. Test / Type-Check / Lint / Build Results

```
$ npx vitest run
 Test Files  32 passed (32)
      Tests  836 passed (836)

$ npx tsc --noEmit
(clean — no output)

$ npx eslint .
✖ 1 problem (0 errors, 1 warning)   — pre-existing, unrelated Next.js font warning

$ npm run build
✓ Compiled successfully
✓ Generating static pages (16/16)
```

No failing or skipped tests.

---

## 21. Confirmation

**No verdict threshold, classification, applicability rule, or the `calcLTV` formula was activated, modified, or reinterpreted in this phase.** The 60/75 bands, the "modifier only, red-blocks-Strong" verdict rule, `deriveSafetyState`, `checkStructuralSafetyFailure`, `thresholds.ts`, `applicability.ts`, and every UI label are byte-for-byte unchanged from before this audit. This document is a decision-ready recommendation (§14–16), not an implementation.

---

## Summary — Direct Answers to the Brief's Own Recommendation Template

```
Current metric:
  Loan / Purchase Price

Correct name:
  Loan-to-Purchase Price (LTPP)

Recommended additional metrics:
  Estimated LTV = Loan / Estimated Market Value  (label must say "Estimated" — marketValue is an
                                                    unguided investor estimate, defaults silently to
                                                    Purchase Price when blank, and is not connected to
                                                    the existing PropertyValuation/AVM evidence model)
  Debt-to-Total-Investment = Loan / Total Investment  (uses the existing, unchanged calcTotalInvestment)

Recommended verdict metric:
  Keep Safety State keyed to Loan-to-Purchase Price (i.e., today's exact computation, renamed only) —
  its 60/75 bands have only ever been exercised against this denominator; switching to Estimated LTV
  without recalibration would systematically understate leverage risk across the existing book of deals
  (marketValue >= purchasePrice in the product's own worked examples). NOT ACTIVATED — pending approval
  and, if approved, a dedicated recalibration phase before any threshold changes denominator.
```
