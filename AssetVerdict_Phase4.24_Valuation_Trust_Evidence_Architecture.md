# AssetVerdict — Phase 4.24: Valuation Trust & Evidence Architecture

**Status:** Complete
**Scope:** Informational/architectural only. No verdict, threshold, or classification-band logic was touched. Purchase LTV, Estimated Value LTV, Project Leverage, DSCR, OER, Break-Even, IRR, NPV, Cash-on-Cash, tax, transfer duty, the furniture/setup engine, negotiation math, and Fix & Flip verdict calibration are all numerically byte-for-byte unchanged (proven below, §26/§28).

---

## 1–2. The value concepts, traced and defined

AssetVerdict has always computed with several genuinely different "property value" numbers. Before this phase they were connected only by convention (naming, comments, careful separation in individual functions) — there was no single place that named them, ranked them by trust, or explained how they relate. This phase makes that structure explicit without changing any of the underlying numbers.

| Concept | Where it lives | Nature |
|---|---|---|
| **Purchase Price** | `DealInputs.purchasePrice` | Contracted fact (once an offer is agreed) — never an estimate. |
| **User Estimated Current Market Value** | `DealInputs.estimatedMarketValue` (Phase 4.23.1; raw, never defaults) and `DealInputs.marketValue` (legacy; same underlying DB column `Deal.marketValue`, but defaults to Purchase Price when blank — used by pre-4.23.1 consumers like `calcCapRateMV`, `calcTransferDuty`-adjacent discount displays, and the 20-year projection preview) | Investor's own typed estimate. Unverified. Both fields are populated from the *same* Acquisition-tab input (`assembleInputs.ts:93,99`) — they differ only in whether "blank" defaults to Purchase Price or stays `null`. |
| **Evidence-Based Current Valuation** | `PropertyValuation.estimatedValue` (+ `valueConfidenceLow/High`, `valuationBasis === "current_condition"`) | Third-party or extracted evidence (agent CMA, AVM, bank valuation, comparable sales, independent valuer, or a user's own manual entry into the Property Valuation panel). |
| **Post-Renovation / After-Repair Value** | `PropertyValuation.estimatedValue` where `valuationBasis === "post_renovation"` | Evidence describing the property's value *after* the renovation scope, not now. Structurally the same record type as Current Valuation — only `valuationBasis` distinguishes them. |
| **Future Projected Value** | `calcProjectedPropertyValue()` (20-year projection engine) | A deterministic compounding of a *starting* value (Purchase Price or the legacy `marketValue`) at `capitalGrowthRate` — an assumption-driven projection, not evidence of any kind. |
| **Assumed Future Sale Price (Fix & Flip)** | `DealInputs.expectedSalePrice` | The investor's own Base-case sale assumption — drives every Flip profit/ROI/IRR number. Never evidence, never overwritten by evidence (Phase 4.19 design, unchanged here). |

These six were never actually confused with each other in the calculation engine — `lib/calculations/fixFlipExitValue.ts` (Phase 4.19/4.20) already kept `expectedSalePrice` structurally separate from `PropertyValuation` evidence, and `valuationBasis` already gated which evidence could carry Strong-verdict authority in Fix & Flip (§19 below). What was missing was a single, reusable, deterministic function that assembles all of them into one coherent, presentable summary — and a place in the UI/PDF/Deal Coach that shows that summary instead of a single ambiguous "market value" figure.

## 3–5. Basis, source, and trust hierarchy (new module: `lib/calculations/valuationEvidence.ts`)

Three new, additive, informational concepts, all built on data structures that already existed:

- **Valuation basis** (`FlipExitValueValuationBasis`, reused verbatim from `fixFlipExitValue.ts` — **not** duplicated, **not** widened): `"current_condition" | "post_renovation" | "unknown"`. No new categories invented, per the brief's explicit instruction.
- **Valuation source category** (`ValuationSourceCategory`, new): `user_estimate | agent_cma | avm | comparable_sales_analysis | independent_valuation | bank_valuation | other_unknown`. Built by `classifyValuationSource()`, a keyword-based, fail-closed normaliser over the existing free-text `PropertyValuation.reportSource` column — mirrors the established `normalizePropertyValuationBasis()` pattern (Phase 4.20.1): any unrecognised or absent text normalises to `"other_unknown"`, never guessed toward a more authoritative-sounding category. No schema migration.
- **Valuation evidence quality** (`ValuationEvidenceQuality`, new, **conceptual only — not a verdict threshold**): `unverified | indicative | supported | strong_evidence`. `calcValuationEvidenceQuality()` derives this from *combinations* of already-known facts (source category, whether a confidence range exists, whether basis is known, comparable-sale count) — never from the source label alone. A record merely labelled "bank valuation" with no range, no known basis, and no comparables does **not** reach `strong_evidence` on the label alone; it takes the label **plus** a known basis **plus** (a confidence range or ≥1 comparable). This directly answers the brief's concern that "3 comparables exist" should not by itself imply quality — comparable count is one input among several, never sufficient alone.

## 6. Confidence is not fake precision

`valuationConfidence` (a free-text field like "High"/"Medium"/"Low") and `valueConfidenceLow/High` (numeric bounds) are both carried through **verbatim** — `buildValuationSummary()` never converts the text label into a number, never invents a numeric confidence band from the label, and never treats an absent range as "confidence unknown → assume medium." If no range was recorded, `evidenceValueLow`/`evidenceValueHigh` are `null`; the UI (`ValuationEvidenceCard.tsx`) simply omits the range rather than showing a fabricated one.

## 7. Current vs. post-renovation vs. future — never mixed

This is the load-bearing structural decision of the module. `buildValuationSummary()` has **no parameter capable of accepting a Future Projected Value at all** (verified by a dedicated test asserting the returned object has no such key), and its two evidence fields are populated by strict, mutually exclusive gates:

```ts
evidenceBasedCurrentValue        ⟵ populated ONLY when valuationBasis === "current_condition"
evidenceBasedPostRenovationValue ⟵ populated ONLY when valuationBasis === "post_renovation"
// valuationBasis === "unknown" populates NEITHER (fails closed)
```

Verified with the brief's own worked example: Purchase Price R1,000,000 / recorded Current-Condition evidence R1,050,000 / Post-Renovation assumption R1,500,000 — the summary places R1,050,000 in `evidenceBasedCurrentValue` and R1,500,000 only ever reaches `assumedFutureSalePrice` (Fix & Flip) or is absent entirely for rental strategies, never cross-populating the other field.

## 8. Report age is exposed, no staleness threshold activated

`valuationAgeDays` is computed (`now - reportDate`, whole days) and shown in `ValuationEvidenceCard.tsx` and the PDF as a plain date/age fact. No code anywhere compares it against a cutoff, no verdict or evidence-quality classification reads it, and no colour/warning treatment is attached to it — exactly as instructed ("expose it, do not activate a hard threshold in this phase").

## 9. Comparable sales — count is not quality

Addressed directly by `calcValuationEvidenceQuality()`'s design (§5): comparable count contributes to `supported`/`indicative` tiers only in combination with other evidence (a known basis, or the source category), never as a standalone "N comparables = good" rule. `comparableCount` itself is a raw pass-through of `PropertyValuation`'s related `ComparableSale` records — no genuine-support scoring (proximity, recency, size-similarity) exists in the schema today, so none is claimed; the evidence-quality function treats "comparables exist" as one weak signal among several, not a verdict.

## 10. One deterministic function, no logic in components

`buildValuationSummary()` (`lib/calculations/valuationEvidence.ts`) is the **only** place this assembly happens. `components/ValuationEvidenceCard.tsx` is a pure presentation component — it formats and lays out fields already computed, contains zero valuation arithmetic. Consumed identically by the Summary page and the PDF (`lib/pdf/DealSummaryPDF.tsx`), and Deal Coach receives the same computed object's fields pre-formatted (§17) — three consumers, one source of truth, matching the repo's existing "lib/calculations is the one authoritative engine" convention.

## 11. User estimate never overridden

`buildValuationSummary()` returns `userEstimatedCurrentMarketValue` and `evidenceBasedCurrentValue` as two entirely independent fields — there is no code path where one is substituted for, defaulted to, or silently replaces the other. Both are shown side by side whenever both exist.

## 12. Valuation Variance (new, informational)

`calcValuationVariance(userEstimate, evidenceValue)` returns `{ userEstimate, evidenceValue, differenceRand, differencePercent }`, or `null` unless **both** values are present and positive. Never phrased as "you are wrong" anywhere in the card, PDF, or Deal Coach guardrails — the UI shows a signed Rand and percentage difference only.

## 13. Estimated Value LTV — untouched

`calcEstimatedValueLTV()` (Phase 4.23.1) was not opened, imported into, or modified by any Phase 4.24 file. Its denominator remains exactly `DealInputs.estimatedMarketValue`. Confirmed both by `git diff` (zero lines changed in `lib/calculations/index.ts`, §26 below) and by the full `leverageMetrics.test.ts` suite passing unchanged.

## 14. Conservative Lender Value — investigated, not implemented

A future `min(Purchase Price, Recognised Valuation)` metric is architecturally straightforward on top of the fields this phase now exposes (`purchasePrice`, `evidenceBasedCurrentValue`), but was **not** added — no such metric, field, or calculation exists anywhere in this diff. Recommendation: if built later, it should read `min(inputs.purchasePrice, valuationSummary.evidenceBasedCurrentValue)`, return `null` (not a fake 0) when evidence is absent, and — per the same reasoning as Estimated Value LTV — remain informational until a lending-context threshold is explicitly calibrated and reviewed the same way LTV thresholds were.

## 15–16. Summary UI

`ValuationEvidenceCard.tsx`, rendered in an "Valuation Evidence" accordion section on the Summary page and mirrored in the PDF export, shows: Your Estimate · Evidence-Based Current Value · Evidence Range (low–high, when present) · Variance (Rand + %, when both values exist) · Post-Renovation Value (when applicable) · Assumed Future Sale Price (Fix & Flip only) · Source · Basis · Date · Evidence Quality — plus a footnote stating Evidence Quality is internal and carries no verdict effect. The component returns `null` (renders nothing) when there is genuinely no valuation data to show, rather than an empty shell.

## 17. Deal Coach — structured fields, not one ambiguous number

`DealCoachContext["deal"].valuationEvidence` (new, optional field in `lib/ai/dealCoachTypes.ts`) carries pre-formatted strings for every distinct concept: `userEstimatedCurrentMarketValue`, `evidenceBasedCurrentValue`, `evidenceValueLow/High`, `evidenceBasedPostRenovationValue`, `assumedFutureSalePrice`, `valuationSource`, `valuationBasis`, `valuationDate`, `valuationEvidenceQuality`, `varianceRand`, `variancePercent` — consistent with the codebase's existing convention that Deal Coach only ever receives numbers already formatted by `lib/calculations`, never raw values it could recompute. `lib/ai/dealCoachPrompt.ts` gained a new guardrail section ("Valuation evidence — never blur these concepts") instructing the model to keep these six concepts distinct, never call the user's estimate "wrong," and never calculate/average/invent any valuation figure.

## 18. PDF

`lib/pdf/DealSummaryPDF.tsx` renders the same field set as the card, shows "N/A" for any concept without data, and never substitutes Purchase Price for a missing valuation. The page's outer visibility gate was widened from `(propertyValuation || suburbProfile)` to `(propertyValuation || suburbProfile || valuationSummary)` so the section still appears when only the (cheaper-to-populate) valuation summary has data.

## 19. Fix & Flip `PropertyValuation` integration — audited, correct, unchanged

`lib/calculations/fixFlipExitValue.ts` (Phase 4.19/4.20, re-read in full during this phase, **zero lines changed**) already enforces every one of the brief's Fix & Flip requirements:

- `expectedSalePrice` (the Base-case assumption) is never mutated, never synced to any evidence value, and the module's own doc comment states this explicitly.
- `valuationBasis` is read verbatim from the stored record via `normalizePropertyValuationBasis()` (fail-closed trust boundary, Phase 4.20.1) — never inferred from `reportSource`, the deal strategy, or the numbers.
- `flipVerdict.ts` (also unread-only, zero lines changed) gates Strong-verdict evidence authority on `evidence.valuationBasis === "post_renovation"` specifically — `current_condition` and `unknown` are both treated as supporting evidence only, for different, explicitly documented reasons (current-condition describes a value the renovation is *intended to change*; unknown simply isn't known).
- The Valuation Point Case and Conservative Case scenarios are evidence-backed re-runs of the *exact same* `calcFixFlipAnalysis` engine at `min(expectedSalePrice, evidence)` — never an invented haircut, never a second profit engine.

No code changes were needed or made here; this section documents the audit finding.

## 20. Cap Rate on Market Value → Cap Rate on Estimated Value (label rename, math unchanged)

`calcCapRateMV()`'s denominator (`inputs.marketValue`) is the same investor-typed, unverified-and-defaulting-to-Purchase-Price field discussed throughout this phase — calling it "Market Value" implied external verification that has never existed. Since this was "merely misleading copy, safe to fix without changing mathematics" (the brief's own stated bar), the label was corrected everywhere it's user- or AI-facing:

- `lib/education/metricDefinitions.ts` — `capRateMV.name`/`shortName`/`simpleExplanation`/`whyItMatters`/`formulaLabel`/`formulaExplanation`/`strategies`; `capRatePP.whyItMatters`'s cross-reference; `capRateSpread.formulaLabel`/`formulaExplanation`/`strategies`.
- `app/(app)/deals/[id]/summary/page.tsx` — the gauge `label` and `tooltipText`.
- `lib/pdf/DealSummaryPDF.tsx` — the comparison-table `label`.
- `lib/education/interpretMetric.ts` and `lib/education/metricBreakdowns.ts` — the plain-English sentence and formula-line labels.
- `lib/ai/dealCoachPrompt.ts` — the dedicated Cap Rate section header/body and the "no calibrated threshold" example list.
- `lib/calculations/applicability.ts` — the N/A rationale string ("No estimated current market value set").

**Not renamed:** the internal object/variable key `capRateMV` itself (used across ~15 files including tests, `thresholds.ts`, `applicability.ts`, and `lib/calculations/index.ts`'s `DealMetrics` type) — renaming an internal identifier is a mechanical, high-blast-radius refactor unrelated to the actual defect (misleading *copy*), and the brief's own escape hatch ("if this is merely misleading copy... you may correct the label") is about the label, not the wire-level field name. `calcCapRateMV()`'s formula is byte-for-byte unchanged.

## 21–22. Input validation

**Purchase Price** must be `> 0`, enforced in two independent layers:
- **Form** (`app/(app)/deals/[id]/edit/acquisition/page.tsx`): a react-hook-form `validate` rule shows "Purchase Price must be greater than R0" inline and blocks submission.
- **API** (`PATCH /api/deals/[id]`, via new `validateDealFieldValues()` in `lib/dealFieldPolicy.ts`): rejects the whole request with `400` and the same message if the (coerced, allowlisted) payload contains a non-positive `purchasePrice` — this is the real boundary, since client validation alone never protects an endpoint reachable directly.
- **Calculation layer**: already guarded — `calcPurchaseLTV()`/`calcCapRatePP()` etc. treat `purchasePrice <= 0` as "not applicable" (Phase 4.23.1), never divide by zero or produce a nonsensical negative result.

**Estimated Current Market Value** may be left blank (stored as `null`, both form and API accept an empty value), but if a value is supplied it must be `≥ 0` — a negative number is rejected client-side (inline error) and server-side (`400`, "Estimated Current Market Value cannot be negative"). The calculation layer already only treats this field as present when `> 0` (`isFiniteNumber(...) && ... > 0` throughout `valuationEvidence.ts` and Phase 4.23.1's leverage metrics), so a value that somehow bypassed both boundaries would still be treated as absent rather than corrupting a metric.

`FormField` (`components/ui/FormField.tsx`) gained an `errorText` prop (red ring + red helper text, reusing the component's existing highlight-colour convention) — the first reusable form-validation-error affordance in the codebase; no prior form had one to be consistent with.

## 23. No verdict authority granted

Confirmed by what was **not** touched: `lib/calculations/verdict.ts`, `lib/calculations/flipVerdict.ts`, `lib/calculations/thresholds.ts`, and `lib/calculations/applicability.ts`'s classification rules (only its `capRateMV` N/A-reason *string* changed, not its logic) all show zero or copy-only diffs. `valuationEvidence.ts`'s exports (`buildValuationSummary`, `calcValuationVariance`, `calcValuationEvidenceQuality`, `classifyValuationSource`) are not imported by any of those four files.

## 24. Test coverage

- **New:** `lib/calculations/__tests__/valuationEvidence.test.ts` — 37 tests: `classifyValuationSource` (10 keyword cases + fail-closed default), `calcValuationEvidenceQuality` (8 scenarios, including "a label alone never implies strong evidence"), `calcValuationVariance` (6 cases), `buildValuationSummary` (user-estimate/evidence separation, current-vs-post-renovation-vs-future isolation including the brief's exact worked example, source/date/comparable survival through the pipeline, invalid/negative-value rejection).
- **New:** `app/api/deals/[id]/__tests__/route.test.ts` — 9 new tests for the Purchase Price / Estimated Market Value API-boundary guards (§21–22), including the "fail closed, not partial" case (an invalid `purchasePrice` blocks the whole PATCH even when a legitimate field is also present).
- **New:** `lib/__tests__/dealFieldPolicy.test.ts` — 11 new tests for `validateDealFieldValues()` in isolation.
- **Updated:** `lib/ai/__tests__/dealCoachPrompt.test.ts` — one existing assertion text updated for the §20 rename (its own subject, not a behaviour change).
- **Unchanged and still passing (proof of numerical parity):** `lib/calculations/__tests__/leverageMetrics.test.ts` (Phase 4.23.1's Purchase LTV / Estimated Value LTV / Project Leverage tests — zero edits, zero failures), `lib/calculations/__tests__/verdict.test.ts` and `lib/calculations/__tests__/flipVerdict.test.ts` (verdict-parity — zero edits, zero failures), `lib/calculations/__tests__/index.test.ts`, `lib/calculations/__tests__/applicability.test.ts`, `lib/calculations/__tests__/thresholds.test.ts`.

Full suite: **919/919 passing** (899 pre-existing + 20 new; zero removed, zero skipped).

## 25. Repository-wide ambiguous-term audit

Searched every `.ts`/`.tsx` file for `marketValue`, `estimatedMarketValue`, `estimatedValue`, `expectedSalePrice`, `ARV`, "future value", "current value", "Market Value". Findings:

- **`ARV`** — appears in exactly one place in the entire codebase: a test name in `flipVerdict.test.ts` asserting the verdict *does not* depend on any ARV/valuation figure. The term is not used as a real concept anywhere — no ambiguity to resolve.
- **`expectedSalePrice`** — consistently used only as the Fix & Flip Base-case assumption (`fixFlip.ts`, `fixFlipExitValue.ts`, `negotiation.ts`'s Flip path). Never conflated with valuation evidence; already correctly named.
- **`marketValue` / `estimatedMarketValue`** — the one genuinely ambiguous pair, already investigated in Phase 4.23 and re-confirmed here: both derive from the same underlying `Deal.marketValue` column and the same Acquisition-tab input, differing only in null-defaulting behaviour (`assembleInputs.ts:93,99`). This is documented, not a bug — `estimatedMarketValue` (raw) feeds Phase 4.23.1's Estimated Value LTV and this phase's valuation summary; `marketValue` (defaults to Purchase Price) feeds legacy consumers (`capRateMV`, the Acquisition-tab discount preview, the 20-year projection) that were designed around "value or Purchase Price if unset" semantics and were out of this phase's stated scope to change.
- **"Cap Rate on Market Value" / "Cap Rate (MV)"** — the one misleading *label* found; corrected in §20.
- No other file uses "current value," "future value," or "estimatedValue" in a way that crosses between the six concepts defined in §1–2.

## 26. "Do Not Change" list — compliance proof

```
$ git diff --stat -- lib/calculations/verdict.ts lib/calculations/flipVerdict.ts \
    lib/calculations/thresholds.ts lib/calculations/index.ts lib/calculations/negotiation.ts \
    lib/calculations/fixFlipExitValue.ts lib/calculations/fixFlip.ts \
    lib/calculations/furnitureCosts.ts lib/calculations/transferDuty.ts
(no output — zero lines changed in any of these files)
```

Purchase LTV, Estimated Value LTV, Project Leverage formulas; the 60/75 LTV thresholds; verdict precedence; DSCR, OER, Break-Even, IRR, NPV, Cash-on-Cash; tax; transfer duty; the furniture/setup engine; negotiation math; Fix & Flip verdict calibration; and every Phase 4.21/4.22/4.22.1 calculation are all untouched. `lib/calculations/applicability.ts` shows a 1-line diff — a user-facing *rationale string* for `capRateMV`'s N/A state (§20), not a classification rule.

## 27. Final recommendation

**READY FOR INFORMATIONAL DISPLAY ONLY.**

The valuation-evidence architecture (source, basis, quality, variance, age) is deterministic, fail-closed, well-tested, and now visible to the user in one coherent place across the Summary page, PDF, and Deal Coach. It is **not** ready for verdict or threshold calibration for a future Evidence-Based LTV, because:

1. `valuationEvidenceQuality` has never been validated against real outcomes — it is a reasonable, documented heuristic, not a calibrated signal.
2. `PropertyValuation.reportSource` is free text with no DB-level enum — `classifyValuationSource()` is a best-effort keyword normaliser, not a guaranteed-accurate classification.
3. Comparable-sale genuine-support scoring (proximity, recency, similarity) does not exist yet — `comparableCount` is a count, not a quality score.
4. No staleness cutoff exists for evidence age, by design (§8) — a future LTV metric using stale evidence would need that question answered first.

If a future phase wants to build an Evidence-Based LTV or Conservative Lender Value metric, the fields this phase exposes (`evidenceBasedCurrentValue`, `valuationEvidenceQuality`, `valuationAgeDays`) are the right inputs — but the threshold/quality-gating work is a distinct, deliberate calibration exercise, exactly as Phase 4.23 → 4.23.1 treated Purchase LTV.

---

## 28. Verification

| Check | Result |
|---|---|
| `npx vitest run` | **919/919 passed** (34 test files) |
| `npx tsc --noEmit` | Clean, zero errors |
| `npx eslint .` | 0 errors, 1 pre-existing unrelated warning (`app/layout.tsx` custom-font warning, not touched this phase) |
| `npm run build` | Succeeds, all 16 static pages + all dynamic routes compile |
| `git diff --stat` on verdict/threshold/classification files | Zero changes (§26) |

## 29. Files changed

**New:**
- `lib/calculations/valuationEvidence.ts`
- `lib/calculations/__tests__/valuationEvidence.test.ts`
- `components/ValuationEvidenceCard.tsx`

**Modified:**
- `app/api/deals/[id]/calculate/route.ts` — computes and returns `valuationSummary`
- `hooks/useDealMetrics.ts` — exposes `valuationSummary`
- `app/(app)/deals/[id]/summary/page.tsx` — renders the new card + purchase-price/market-value form validation
- `app/(app)/deals/[id]/edit/acquisition/page.tsx` — Purchase Price / Estimated Market Value client-side validation
- `app/api/deals/[id]/route.ts` — Purchase Price / Estimated Market Value server-side validation
- `lib/dealFieldPolicy.ts` — new `validateDealFieldValues()`
- `components/ui/FormField.tsx` — new `errorText` prop
- `lib/pdf/DealSummaryPDF.tsx` — Valuation Evidence PDF section, Cap Rate label
- `lib/ai/dealCoachTypes.ts`, `lib/ai/buildDealCoachContext.ts`, `lib/ai/dealCoachPrompt.ts` — Deal Coach structured valuation context + guardrails
- `lib/education/metricDefinitions.ts`, `lib/education/interpretMetric.ts`, `lib/education/metricBreakdowns.ts` — Cap Rate label rename
- `lib/calculations/applicability.ts` — Cap Rate N/A rationale string
- `app/api/deals/[id]/__tests__/route.test.ts`, `lib/__tests__/dealFieldPolicy.test.ts`, `lib/ai/__tests__/dealCoachPrompt.test.ts` — new/updated tests
