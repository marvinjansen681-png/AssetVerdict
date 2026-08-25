# AssetVerdict — Phase 4.23.1: Leverage Metrics Implementation

**Status:** Complete. Implements the approved Option C model from `AssetVerdict_Phase4.23_LTV_Leverage_Definition_Audit.md`. Verdict logic, thresholds, financial formulas, Phase 4.21/4.22/4.22.1 work, and Fix & Flip verdict calibration are all byte-for-byte unchanged — proven, not merely asserted (see §"Verdict Parity Proof").

---

## 1. Old Model vs. Approved Model

**Before:** one function, `calcLTV(inputs)`, computing `Total Loan Amount ÷ Purchase Price`, labelled "LTV"/"Loan-to-Value" everywhere — a name that implied an independent property valuation the formula never actually used.

**After:** three separately-named, separately-computed metrics, each with one precise meaning:

| Metric | Formula | Verdict authority | Threshold |
|---|---|---|---|
| **Purchase LTV** | `Total Loan Amount ÷ Purchase Price × 100` | **Yes — unchanged** | 60/75 bands, unchanged |
| **Estimated Value LTV** | `Total Loan Amount ÷ Estimated Current Market Value × 100` | None — informational only | None (deliberately unclassified) |
| **Project Leverage** | `Total Loan Amount ÷ Total Investment × 100` | None — informational only | None (deliberately unclassified) |

---

## 2. Exact Formulas

```ts
// lib/calculations/index.ts

export function calcPurchaseLTV(inputs: DealInputs): number {
  if (!inputs.purchasePrice || inputs.purchasePrice < 0) return 0;
  return (calcTotalLoanAmount(inputs) / inputs.purchasePrice) * 100;
}

/** @deprecated — delegates directly, never a second formula. */
export function calcLTV(inputs: DealInputs): number {
  return calcPurchaseLTV(inputs);
}

export function calcEstimatedValueLTV(inputs: DealInputs): number | null {
  const value = inputs.estimatedMarketValue; // the RAW, never-defaulted field
  if (!isFiniteNumber(value) || value <= 0) return null;
  return (calcTotalLoanAmount(inputs) / value) * 100;
}

export function calcProjectLeverage(inputs: DealInputs): number | null {
  const totalInvestment = calcTotalInvestment(inputs); // the SAME existing function, unchanged
  if (!(totalInvestment > 0)) return null;
  return (calcTotalLoanAmount(inputs) / totalInvestment) * 100;
}
```

Both `calcTotalLoanAmount` and `calcTotalInvestment` are the exact, pre-existing, unmodified functions — no second debt or cost aggregation exists anywhere.

---

## 3. Where Each Metric Is Displayed

| Metric | Displayed | Coloured? |
|---|---|---|
| **Purchase LTV** | Summary page ("Leverage" section, new), PDF (comparison table), Deal Coach headline metrics, education registry (`purchaseLtv`), metric breakdown panel | **Yes** — real green/orange/red gauge, same 60/75 bands as before |
| **Estimated Value LTV** | Summary page ("Leverage" section), PDF (comparison table + footnote), education registry (`estimatedValueLtv`), metric breakdown panel; included in Deal Coach's "Debt & Safety" metric group when relevant | **No** — always neutral/grey (no threshold definition exists, so `getGaugeColorForStrategy` returns `"neutral"` automatically) |
| **Project Leverage** | Same surfaces as Estimated Value LTV | **No** — always neutral/grey, same mechanism |

The neutral rendering for the two new metrics required **zero new UI logic** — `GaugeDial`/`getGaugeColorForStrategy` already treat "no threshold definition" as `"neutral"` (the same mechanism that already renders Fix & Flip's currently-unclassified ROI/Annualised ROI gauges grey). Not adding a `thresholds.ts` entry for `estimatedValueLtv`/`projectLeverage` **is** the mechanism that keeps them judgement-free — this was verified with a dedicated test (`getThresholdDefinition("estimatedValueLtv"/"projectLeverage", ...)` returns `undefined`).

---

## 4. Which Metric Still Controls Verdict — And Why

**Purchase LTV, exclusively.** `lib/calculations/verdict.ts` was **not modified at all** (confirmed: `git diff --stat -- lib/calculations/verdict.ts` returns empty). It continues to read `metrics.ltv` — which is now documented as a deprecated alias that always equals `metrics.purchaseLtv` exactly (proven by test, see below) — through the exact same `classifyMetricForDeal("ltv", metrics.ltv, ...)` call it always used. `thresholds.ts` keeps the original `ltv` definition byte-identical (60/75 bands, `evidenceLevel: "internal"`) and adds a **new**, separately-keyed `purchaseLtv` definition with the identical bands, for the migrated UI/education call sites to use going forward.

Estimated Value LTV and Project Leverage are excluded from verdict/Safety-State/negotiation by construction: no `thresholds.ts` entry exists for either, so `classifyMetricForStrategy` returns `"unclassified"` for both regardless of value — there is no code path by which they could influence a classification, let alone the verdict engine, which never reads them at all.

---

## 5. Confirmation: Existing LTV Thresholds Unchanged

`lib/calculations/thresholds.ts`'s original `ltv` entry (60/75 bands, `"lower"` direction, `evidenceLevel: "internal"`) is untouched. The new `purchaseLtv` entry uses the **identical** `cutoff("financial_safety", "lower", 60, 75, ...)` call — proven equal by a dedicated test comparing `getThresholdDefinition("ltv", ...).bands` against `getThresholdDefinition("purchaseLtv", ...).bands`.

---

## 6. Confirmation: Verdict Outcomes Unchanged for Baseline Deals (Verdict Parity Proof)

Four independent proofs, all in `lib/calculations/__tests__/leverageMetrics.test.ts`:

1. **`metrics.ltv === metrics.purchaseLtv`** for every tested scenario (base deal, zero-debt, over-leveraged, zero purchase price) — the deprecated field and its replacement are numerically identical, always.
2. **`classifyMetricForDeal("ltv", ...)` and `classifyMetricForDeal("purchaseLtv", ...)` produce identical classification behaviour** (status, colour, label, model — the `reason` text is the one deliberate difference, reworded to say "Purchase LTV") across five representative scenarios: high leverage (red), low leverage (green), mid leverage (orange), all-cash (green), and zero purchase price (not applicable).
3. **A high-leverage deal (80% Purchase LTV, red) still blocks "Strong"** in the Safety State / Overall Verdict, exactly as the old metric did.
4. **A low-leverage deal (40% Purchase LTV, green) produces no `high_ltv` reason**, exactly as before.
5. **Estimated Value LTV and Project Leverage never appear in any verdict reason, blocker, or category state** — proven directly against `deriveDealVerdict()`'s actual output.

Additionally: `lib/calculations/verdict.ts`, `negotiation.ts`, `flipVerdict.ts`, `fixFlip.ts`, and `prisma/schema.prisma` all show **zero lines changed** in this phase's diff — the strongest possible form of this proof, since there is no code left that could have silently altered verdict behaviour even by accident.

---

## 7. Missing Estimated Market Value — Handling

`DealInputs.marketValue` (existing field) still silently defaults to `purchasePrice` when the investor leaves it blank (`assembleInputs.ts`, unchanged — legacy consumers like `calcCapRateMV`/`calcProjectedPropertyValue`/the 20-year projection genuinely depend on this and were not touched). A **new**, separate field, `DealInputs.estimatedMarketValue: number | null` (optional, mirroring the existing `wantToSell?`/`saleYear?` pattern so pre-existing test fixtures don't need updating), carries the **raw, never-defaulted** value from `deal.marketValue ?? null` — no purchase-price fallback. `calcEstimatedValueLTV` reads **only** this raw field. A blank estimate → `null` → the UI shows "N/A", never a fabricated percentage that would misleadingly imply the investor confirmed an independent value. Proven by test, including the specific case where `marketValue` (the legacy field) already equals `purchasePrice` via its own fallback — confirming that fallback never leaks into Estimated Value LTV.

---

## 8. Negative / Zero Denominators — Handling

| Metric | Denominator condition | Result |
|---|---|---|
| Purchase LTV | `purchasePrice <= 0` (zero **or now also negative**) | `0` (sentinel — caught upstream by `applicability.ts` and shown as "N/A"; never a raw negative %) |
| Estimated Value LTV | `estimatedMarketValue` missing, `null`, `0`, or negative | `null` (shown as "N/A") |
| Project Leverage | `calcTotalInvestment(inputs) <= 0` | `null` (shown as "N/A") |

The Phase 4.23-documented bug (a negative purchase price producing e.g. `-80%`) is fixed: `calcPurchaseLTV`'s guard now also catches `purchasePrice < 0`. This was verified to be **safe for verdict parity** before making the change — `applicability.ts`'s `requiresPositive(purchasePrice > 0)` already excluded any non-positive purchase price (negative included) from ever reaching the UI as a classified value, so widening the internal guard changes no observable behaviour for any real deal; it only hardens the low-level function itself, per the audit's own finding that this bug was invisible downstream but still worth closing at the calculation level.

---

## 9. Debt Exceeding Purchase Price

Not clamped. `calcPurchaseLTV` has no upper bound — a R1,100,000 loan against a R1,000,000 purchase price correctly returns `110`, proven by test. This is unchanged from the pre-4.23.1 `calcLTV` behaviour.

---

## 10. Changes to Acquisition Terminology

`app/(app)/deals/[id]/edit/acquisition/page.tsx`: the "Market Value" field is now labelled **"Estimated Current Market Value"** with help text: *"Your estimate of what the property is worth today. Do not use a future renovation value or expected sale price here. This is not a bank valuation. If you don't have a reasonable current-value estimate, leave this blank — that's better than false precision."* The "Discount to Market Value" readout is relabelled "Discount to Estimated Current Market Value." The underlying form field name (`marketValue`) and database column are **unchanged** — only user-facing copy changed, per the audit's finding that no schema change is required for this phase.

---

## 11. Changes to Education Copy

`lib/education/metricDefinitions.ts`: added `purchaseLtv` (name "Purchase LTV", full formula/explanation), `estimatedValueLtv` (with an explicit `commonMistake` limitation: *"Based on your own estimated current market value — it is NOT a bank-confirmed or formally verified valuation, and AssetVerdict does not classify or judge this figure"*), and `projectLeverage` (referencing Total Investment's real cost components). The deprecated `ltv` entry is kept (its `name` corrected to "Purchase LTV" too) so a stale lookup by that key still resolves sensibly. `lib/education/interpretMetric.ts` and `lib/education/metricBreakdowns.ts` gained matching `purchaseLtv`/`estimatedValueLtv`/`projectLeverage` cases (the `ltv` case is kept as a fallthrough alias, not removed, to avoid breaking existing tests that exercise it directly).

---

## 12. Changes to Deal Coach

`lib/ai/buildDealCoachContext.ts`: `HEADLINE_METRICS_RENTAL` now includes `"purchaseLtv"` instead of `"ltv"`. `lib/education/negotiationCopy.ts`'s `FIXED_LTV_ASSUMPTION_EXPLAINER` and `describeFixedLtvLimitation()` now say "Purchase LTV"/"debt-to-purchase-price ratio" throughout, explicitly noting *"a lower purchase price does NOT reduce your Purchase LTV percentage itself."* `lib/ai/dealCoachPrompt.ts`'s prose guardrails were updated at every "Loan-to-Value"/bare-"LTV" mention **except** the one sentence directly asserted by an existing test (`dealCoachPrompt.test.ts:145`, *"does not currently use DSCR or LTV as primary metrics"* for Fix & Flip) — left verbatim to avoid breaking that test, and because it is a statement about Fix & Flip **not using** these concepts at all, not a claim about what the rental-side metric is called. The AI prompt now explicitly states Purchase LTV is the only leverage metric the fixed-financing negotiation policy concerns, and that Estimated Value LTV/Project Leverage (when supplied) are informational only with no invented risk threshold.

---

## 13. Changes to PDF

`lib/pdf/DealSummaryPDF.tsx`'s scenario-comparison table gained three new rows: **Purchase LTV** (keeps its real gauge colour), **Estimated Value LTV**, and **Project Leverage** (both automatically neutral via the same no-threshold-definition mechanism as the UI). A footnote directly beneath the table states the three are not interchangeable and that Estimated Value LTV is *"based on the user-entered estimated current market value, not a bank-confirmed valuation."* The PDF previously displayed no LTV figure of any kind — this is a net-new addition, not a replacement of ambiguous copy.

---

## 14. Changes to Negotiation Terminology

`lib/education/negotiationCopy.ts` and `lib/ai/dealCoachPrompt.ts`: every "loan-to-price ratio (LTV)" / "Loan-to-Value ratio" mention in negotiation-specific copy now reads "Purchase LTV" / "debt-to-purchase-price ratio." **The negotiation mathematics were not touched** — `lib/calculations/negotiation.ts` shows zero lines changed in this phase's diff; `buildNegotiatedInputs`'s fixed-original-LTV financing policy still scales every finance source proportionally with the candidate price, exactly as before.

---

## 15. Files Changed

**New**
- `lib/calculations/__tests__/leverageMetrics.test.ts` — 26 tests (formulas, edge cases, verdict parity)
- `AssetVerdict_Phase4.23.1_Leverage_Metrics_Implementation.md` — this report

**Modified**
- `lib/calculations/index.ts` — `calcPurchaseLTV`, `calcEstimatedValueLTV`, `calcProjectLeverage`; `calcLTV` becomes a delegating alias; `DealInputs.estimatedMarketValue` (new, optional); `DealMetrics.purchaseLtv`/`estimatedValueLtv`/`projectLeverage` (new); `DealMetrics.ltv` kept, documented as deprecated
- `lib/calculations/assembleInputs.ts` — populates `estimatedMarketValue` from the raw `deal.marketValue` (no purchase-price fallback)
- `lib/calculations/applicability.ts` — new `purchaseLtv`/`estimatedValueLtv`/`projectLeverage` applicability rules; `estimatedMarketValue`/`totalInvestment` added to `ApplicabilityContext`
- `lib/calculations/thresholds.ts` — new `purchaseLtv` definition (bands byte-identical to `ltv`); deliberately **no** entry for the two new informational metrics
- `app/(app)/deals/[id]/edit/acquisition/page.tsx` — "Estimated Current Market Value" label + help text
- `app/(app)/deals/[id]/summary/page.tsx` — new "Leverage" section with all three gauges; old single "LTV" gauge removed from "Debt & Coverage" (now DSCR + Break-even only)
- `lib/education/metricDefinitions.ts`, `metricBreakdowns.ts`, `interpretMetric.ts` — new metric entries/cases; `ltv` kept as documented alias
- `lib/education/negotiationCopy.ts`, `verdictCopy.ts` — terminology fixes
- `lib/ai/buildDealCoachContext.ts`, `dealCoachPrompt.ts` — terminology fixes, headline metric rename
- `lib/pdf/DealSummaryPDF.tsx` — three new comparison-table rows + footnote
- `lib/calculations/__tests__/index.test.ts` — one Phase 4.23 characterization test updated to reflect the now-fixed negative-purchase-price behaviour (was documenting the bug; now documents the fix)

**Untouched (verified via empty `git diff`)**: `lib/calculations/verdict.ts`, `negotiation.ts`, `fixFlip.ts`, `flipVerdict.ts`, `furnitureCosts.ts`, `dealFieldPolicy.ts`, `transferDuty.ts`, `saveQueue.ts`, `prisma/schema.prisma`.

---

## 16. Tests Added

26 new tests in `leverageMetrics.test.ts`: Purchase LTV (80% example, >100% no-clamp, negative-price fix, zero-price, all-cash), Estimated Value LTV (57.142857% example, value-below-purchase-price case, missing/zero/negative estimate → null, all-cash, marketValue-fallback non-leakage), Project Leverage (64% example, shared `calcTotalInvestment`, zero Total Investment → null, all-cash), the full three-metric worked example, the `ltv`/`purchaseLtv` alias-equality proof, and the five-part verdict-parity proof described in §6. One pre-existing Phase 4.23 characterization test updated (not removed) to reflect the intentional negative-price bugfix.

---

## 17. Remaining Limitations

- **`Estimated Value LTV`'s denominator remains an unguided investor estimate** — this phase relabelled it honestly ("Estimated Current Market Value," with explicit non-bank-valuation copy) but did not change its reliability. Connecting the richer `PropertyValuation`/AVM evidence model is explicitly deferred to its own future "valuation-trust phase," per the audit's §23/Phase 4.23.1's own instruction not to wire it in yet.
- **No threshold calibration exists for Estimated Value LTV or Project Leverage**, by design — they remain purely informational until a dedicated, evidence-based calibration phase is run.
- **Fix & Flip carries no leverage metric of any kind** — unchanged; the Flip Dashboard still shows no LTV gauge, and no `Loan/ARV` or `Loan/Expected Sale Price` metric was introduced.
- **A negative or zero `purchasePrice` is still not blocked by Acquisition-tab form validation** — this phase hardened the calculation layer (§8) but did not add client-side input validation preventing a negative purchase price from being typed in the first place; the calculation-level guard is the actual protection in force.

---

## 18. Confirmations

- **PropertyValuation was not automatically wired into Estimated Value LTV.** `calcEstimatedValueLTV` reads only `DealInputs.estimatedMarketValue`, sourced solely from `Deal.marketValue`. No code in this phase reads or references `PropertyValuation.estimatedValue`, `valueConfidenceLow/High`, or any other field on that model.
- **Fix & Flip verdict logic was untouched.** `lib/calculations/flipVerdict.ts` and `fixFlip.ts` show zero lines changed. No leverage metric was added to `FlipDashboard.tsx` or Fix & Flip's Deal Coach context.

---

## 19. Verification

```
$ npx vitest run
 Test Files  33 passed (33)
      Tests  862 passed (862)

$ npx tsc --noEmit
(clean — no output)

$ npx eslint .
✖ 1 problem (0 errors, 1 warning)   — pre-existing, unrelated Next.js font warning

$ npm run build
✓ Compiled successfully
✓ Generating static pages (16/16)
```

```
$ git diff --stat -- lib/calculations/verdict.ts lib/calculations/negotiation.ts \
    lib/calculations/fixFlip.ts lib/calculations/flipVerdict.ts prisma/
(empty — zero lines changed in any of these)
```

No failing or skipped tests. No unrelated changes in the working tree.
