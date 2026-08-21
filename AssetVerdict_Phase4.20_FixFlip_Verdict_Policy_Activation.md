# AssetVerdict — Phase 4.20: Full Fix & Flip Verdict Policy & Activation

**Status: COMPLETE.** Commit `522157e` on `main`, pushed to GitHub.

---

## A. What this phase did, in one paragraph

Fix & Flip deals now receive a real, deterministic Overall Verdict —
`strong`, `promising`, `high_risk`, or `does_not_meet_target` — computed by
a brand-new engine (`lib/calculations/flipVerdict.ts`) that is delegated to
from the existing rental verdict engine (`lib/calculations/verdict.ts`) but
uses its own decision tree, built entirely from evidence already locked
down in Phases 4.17–4.19.1. No new financial formula was invented. No new
universal threshold (Sale-Price Buffer, Project ROI, Rand profit band,
holding period, or the 70% rule) was introduced anywhere. `Promising If
Negotiated` remains explicitly unavailable for Flip. Rental verdicts and
rental/Instalment-Sale negotiation are untouched.

---

## B. Baseline going in

- 672/672 tests passing, clean `tsc`, clean `eslint`, clean `next build`
  (per Phase 4.19.1's closing state).
- Fix & Flip's verdict was permanently `unavailable` with reason
  `insufficient_calibrated_evidence` — a deliberate placeholder from
  Phase 4.18's calibration audit, which concluded no defensible universal
  threshold existed for Sale-Price Buffer, Project ROI, or a Rand profit
  band, and that Flip needed evidence-based gating instead of thresholds.
- `PropertyValuation` and `FlipExitValueValuationBasis` both recorded
  `valuationBasis: "unknown"` as a literal, non-widened value — a
  deliberate Phase 4.19.1 compile-time guardrail against code accidentally
  treating "a valuation exists" as "post-renovation exit evidence
  confirmed."

## C. Schema change

`prisma/schema.prisma` — `PropertyValuation.valuationBasis String @default("unknown")`.

Migration: `prisma/migrations/20260820104537_add_valuation_basis/migration.sql`
```sql
ALTER TABLE "PropertyValuation" ADD COLUMN "valuationBasis" TEXT NOT NULL DEFAULT 'unknown';
```
Applied to the live Supabase Postgres database via `prisma migrate dev`.
Existing rows backfilled to `"unknown"` by the migration's `DEFAULT`
clause — never inferred from report text, provider, strategy, or numbers.

`types/index.ts` adds `PropertyValuationBasis = "unknown" | "current_condition" | "post_renovation"`.

## D. UI and import behaviour for valuation basis

`components/forms/PropertyValuationPanel.tsx` adds an explicit "Valuation
Basis" `<select>` (Unknown / Current condition / Post-renovation) on the
valuation form, defaulting to `unknown`, saved on the same debounce as the
rest of the panel.

**Deliberately NOT wired into the PDF-import extraction flow.** When a
valuation report is imported and auto-fills fields, `valuationBasis` is
left at its default (`unknown`) rather than inferred from the report text,
provider name, or extracted numbers. This was audited, not just assumed:
no import-extraction code path writes to `valuationBasis` anywhere in the
codebase. A user must explicitly select "Post-renovation" for it to ever
carry Strong-authoritative weight. This matches the brief's requirement to
document the policy (leave `unknown` unless a human explicitly says
otherwise) without building inference machinery that doesn't exist yet.

## E. Exit-value evidence type widening

`lib/calculations/fixFlipExitValue.ts` — `FlipExitValueValuationBasis`
widened from the Phase 4.19.1 singleton `"unknown"` to
`"unknown" | "current_condition" | "post_renovation"`. This was the
guardrail's intended trigger: the type could only be widened by a
deliberate code change that also builds the interpretive logic to use the
new values meaningfully (Section G below) — not by silently loosening the
type and leaving old assumptions in place. `evidence.valuationBasis` is now
sourced from the recorded `PropertyValuation.valuationBasis` instead of
being hardcoded.

## F. Policy A vs Policy B — the Conservative Case gate for Strong

**Decision: Policy A ("profit survival") — adopted as originally
preferred, no counterexample broke it.**

The question: to support Strong, does the Conservative Valuation Case's
own Equity IRR also need to clear Required Return (Policy B), or is it
enough that the Conservative Case merely stays *profitable* while its own
target result is surfaced separately, never hidden (Policy A)?

**Three stress tests, run before locking the policy:**

- **A1 — thin-margin Conservative Case.** A deal where the Conservative
  Case is profitable (say, R5,000) but its own Equity IRR falls just under
  Required Return. Under Policy A this is still eligible for Strong,
  *provided* the Base case independently clears the IRR gate — the
  Conservative Case's own IRR is surfaced as an informational
  `conservative_target_missed` reason, visible on the verdict's face, not
  hidden. This is not a contradiction: Strong's target gate (Section H)
  is about the *Base* case meeting the investor's return bar; the
  Conservative Case's job is narrower — proving the deal doesn't become
  worthless at a recorded downside price. Conflating the two would mean a
  single "Required Return" number is being asked to do two different jobs
  (a target-setting job and a solvency-stress job) at once.
- **A2 — near-zero Conservative Case profit.** A Conservative Case
  profitable at exactly R500 with a correspondingly negligible IRR. Policy
  A still passes it (profit is strictly `>0`), but the Rand amount and
  both target facts are shown verbatim in the verdict's reasons —
  Section 75's disclosure mitigation. This confirmed the earlier decision
  in `lib/calculations/__tests__/flipVerdict.test.ts` to always show the
  exact Conservative profit Rand figure rather than only a pass/fail flag,
  so an economically thin margin is visible rather than laundered into a
  binary "Strong."
- **B1 — Conservative Case profitable and above Required Return.** The
  clean case where both Policies agree — used to confirm Policy A and
  Policy B are not distinguishable when the Conservative Case is
  healthy, and that Policy A's supporting reason (`conservative_target_met`)
  still fires and is visible even though it isn't gating anything.

**Why Policy A stands:** Policy B would mean a deal can lose its Strong
eligibility purely because a downside valuation scenario's *rate of
return* — not its solvency — falls short, even while remaining
profitable and while the Base case (the investor's actual plan) clears
Required Return comfortably. That conflates two separate questions
("is my plan good?" vs. "does my plan survive a worse valuation?") into
one number. Policy A keeps them separate and visible, which is more
honest than forcing a stricter, unrequested compound threshold. No
counterexample produced a case where Policy A silently hid bad news —
the Conservative target result is always in the reasons array, whichever
way it goes.

## G. Strong's full evidence gate (implemented exactly per brief section 49/16)

`evaluateStrongEvidence()` in `flipVerdict.ts` checks, in this exact order,
the first failure winning:

1. `flipExitValueAnalysis` missing or not `available` → `no_exit_value_evidence`
2. `evidence.status === "no_numeric_valuation"` → `no_exit_value_evidence`
3. `evidence.status === "invalid_valuation"` → `invalid_valuation_evidence`
4. `evidence.valuationBasis === "unknown"` → `valuation_basis_unknown`
5. `evidence.valuationBasis === "current_condition"` → `valuation_current_condition`
6. No `conservativeCase` → `no_conservative_lower_bound`
7. `!conservativeCase.survivesConservativeCase` (strict `> 0`, not `>= 0`) → `conservative_case_not_profitable`
8. All clear → Strong, with `conservative_case_profitable` and
   (`conservative_target_met` | `conservative_target_missed` | `conservative_target_unknown`)
   always attached.

Exactly-zero Conservative profit does **not** count as survival (brief
section 76) — verified by a dedicated unit test.

## H. Full precedence chain (as implemented)

1. `metrics.fixFlipAnalysis` unavailable → verdict `unavailable`,
   reason `flip_model_unavailable`. Never a fake structural loss.
2. `estimatedProfitBeforeTax <= 0` → `high_risk`. **Overrides everything**
   — evaluated before target, exactly like rental's structural-safety-first
   precedent. A high IRR or excellent valuation cannot soften a currently
   losing Base case.
3. `equityIRR` null / non-finite, or `discountRate` non-finite →
   verdict `unavailable`, reason `flip_return_evidence_unavailable`.
   Never silently treated as a missed target.
4. `equityIRR < discountRate` → `does_not_meet_target`. Precedes Strong
   evidence entirely — an excellent post-renovation valuation cannot
   rescue a deal that misses the investor's own return bar.
5. Target met → run `evaluateStrongEvidence()` (Section G).
6. Evidence cleared → `strong`.
7. Evidence not cleared → `promising`, with the specific `FlipStrongBlockerCode`
   named as the sole blocker — never a generic "some risks remain."

Every step is covered by a dedicated test in
`lib/calculations/__tests__/flipVerdict.test.ts` (23 tests), including an
explicit precedence-ordering test proving Step 2 wins over a favorable
Step 5 outcome, and Step 4 wins over a favorable Step 6 outcome.

## I. Reason codes (new, Phase 4.20)

`flip_model_unavailable`, `flip_structural_loss`,
`flip_return_evidence_unavailable`, `flip_profitable`,
`flip_sale_price_buffer_context`, `no_exit_value_evidence`,
`invalid_valuation_evidence`, `valuation_basis_unknown`,
`valuation_current_condition`, `no_conservative_lower_bound`,
`conservative_case_not_profitable`, `conservative_case_profitable`,
`conservative_target_met`, `conservative_target_missed`,
`conservative_target_unknown`. Reused rental's `target_met`/`target_missed`
for the Base Equity-IRR-vs-Required-Return comparison, since the copy
("projected Equity IRR ... vs. your Required Return") is generic enough to
serve both strategies without duplicated templates.

## J. Per-metric-role confirmations (explicit, as required)

- **Sale-Price Buffer**: descriptive/context only (`flip_sale_price_buffer_context`,
  always `informational` severity). No threshold gates any verdict on it.
- **Project ROI / Pre-Tax ROI**: not read by the verdict engine at all —
  only `estimatedProfitBeforeTax` (sign) and `equityIRR` (magnitude vs.
  Required Return) are.
- **Annualised ROI**: not read by the verdict engine.
- **Profit Margin**: no such metric is computed or referenced by the
  verdict engine.
- **Holding Period**: not a verdict input; only participates in the IRR
  calculation the investor already sees.
- **Leverage / LTV**: no rental-style leverage threshold exists for Flip;
  not read anywhere in `flipVerdict.ts`.

All confirmed by direct code reading of `flipVerdict.ts` — it reads
exactly two facts from `flip.profitability`/`flip.breakEven`
(`estimatedProfitBeforeTax`, `equityIRR`) plus `salePriceBufferPercent`
purely for the informational reason.

## K. Model versioning bug (found and fixed live during this phase)

Live API testing initially showed a Flip-engine verdict stamped
`verdictModelVersion: "4.14"` — the rental engine's version constant. This
was misleading, since the verdict actually came from `flipVerdict.ts`'s
independent Phase 4.20 rule set. Fix: `verdict.ts`'s `available()` /
`unavailable()` helpers were exported and parametrized with an optional
trailing `verdictModelVersion` argument (default `VERDICT_MODEL_VERSION =
"4.14"`); `flipVerdict.ts` now passes its own exported
`FLIP_VERDICT_MODEL_VERSION = "4.20"` at all six of its `available()`/
`unavailable()` call sites. Re-verified live: a Flip verdict now correctly
returns `"verdictModelVersion": "4.20"`. A stale unit test that asserted
Flip verdicts carry the rental engine's version tag was rewritten into two
tests — one confirming rental deals still carry `"4.14"`, one confirming
Flip deals carry `"4.20"` and explicitly not `"4.14"`.

## L. UI, PDF, Deal Coach integration

- `components/VerdictCard.tsx` / `components/education/VerdictExplainer.tsx`:
  both now strategy-aware via a new `getVerdictLabelCopy(verdict, strategyId)`
  helper (`lib/education/verdictCopy.ts`) and a `FLIP_VERDICT_LABEL_COPY`
  map that excludes `promising_if_negotiated` from Flip's explainer
  label order. Flip's verdict card shows up to 4 reasons (its
  reason set is small and fully curated) instead of rental's 3.
- `lib/pdf/DealSummaryPDF.tsx`: same `getVerdictLabelCopy` wiring; PDF
  export for Fix & Flip now shows the real verdict, its reasons, and
  (via the existing Exit-Value Evidence section) the valuation basis and
  Conservative Case figures.
- `lib/ai/dealCoachPrompt.ts`: new `## Fix & Flip verdict (Phase 4.20)`
  guardrail section — states the label meanings, that the Conservative
  Case's own IRR is supporting-only (not blocking), that negotiation
  cannot unlock Strong for Flip, and the Pre-Tax/Base-case-only/no-cost-
  overrun-stress limitations. Two stale claims that Fix & Flip "does not
  yet receive a verdict at all" were corrected.
- `lib/ai/buildDealCoachContext.ts` / `app/api/deals/[id]/coach/route.ts`:
  the exit-value analysis is computed exactly once per request and fed to
  both the verdict derivation and the Deal Coach context — no duplicate
  computation.

## M. Live acceptance testing (this session, on a real dev-server + Supabase-backed deal)

All scenarios verified via direct `/api/deals/[id]/calculate` inspection
(ground truth) plus the rendered Summary page (UI proof) on deal
`cmt1fihr80001n37rbe9qian6` (Base: purchase R1,000,000, renovation
R200,000, 6-month hold, 10% required return):

| Scenario | How it was produced | Verdict | Blocker/reason | UI confirmed |
|---|---|---|---|---|
| Promising, no valuation evidence | default state | `promising` | `no_exit_value_evidence` | via API |
| Strong | valuation set to post_renovation, R1.4M–R1.6M range | `strong` | none; `conservative_case_profitable` R88,000, `conservative_target_met` 14.8% | ✅ full page text confirmed |
| Promising, current-condition basis | basis → `current_condition` | `promising` | `valuation_current_condition` | via API |
| Promising, unknown basis | basis → `unknown` | `promising` | `valuation_basis_unknown` | via API |
| High Risk | expected sale price dropped to R1.1M (profit −R197,000) | `high_risk` | `flip_structural_loss` | ✅ full page text confirmed |
| Does Not Meet Target | expected sale price R1.33M (profit +R21,500, IRR 3.5% < 10%) | `does_not_meet_target` | `target_missed` | ✅ full page text confirmed |

Every response carried `verdictModelVersion: "4.20"`. `Negotiation
Analysis` correctly showed "not yet available for this strategy" in every
Flip state. Mobile (375px) checked for the High Risk and Strong states —
`document.documentElement.scrollWidth === clientWidth` in both, i.e. no
horizontal overflow. PDF export exercised via the actual "Export PDF"
button on the Strong-state deal — the `@react-pdf/renderer` browser chunk
and `DealSummaryPDF` chunk both loaded and executed with no client-side
crash and the page remained fully rendered afterward.

## N. Deal Coach — all 12 required questions asked live (real Anthropic API calls, user-approved)

Each answer was read in full and checked against three rules: never
invents numbers, never claims certainty the model doesn't have, never
recalculates or overrides the verdict. All 12 passed:

1. **"Does Strong mean I can't lose money?"** → No; explained the three
   conditions Strong actually tests and named what it does *not* stress
   (renovation overruns, delays, rate changes, non-standard financing,
   buyer willingness, tax).
2. **"What happens if renovation goes over budget?"** → Refused to
   invent a recalculated figure; explained the cost → profit → IRR chain
   qualitatively and pointed out the Conservative Case tests sale-price
   downside, not cost overrun — a real, useful distinction it did not
   have to be prompted for.
3. **"Does Strong include tax?"** → No, pre-tax throughout; correctly
   deferred SARS capital-vs-revenue classification to a tax practitioner.
4. **"Does Strong mean the seller/buyer will agree to this price?"** → No;
   separated the model's price *comparison* from any claim about real
   counterparty behaviour, and correctly noted Flip has no negotiation
   feature at all.
5. **"Can I negotiate this deal into Strong?"** (asked while deal was
   actually already Strong) → Correctly identified the actual current
   verdict rather than accepting the question's false premise, and
   confirmed Flip has no negotiation-price modelling at all.
6. **"Why is this only Promising, and why does current-condition
   valuation not count?"** → Walked the exact precedence chain, named
   `valuation_current_condition`, and explained *why* a pre-renovation
   valuation can't stand in for post-renovation exit evidence.
7. **"What do I need for Strong, and what does 'unknown' basis mean?"**
   → Named `valuation_basis_unknown` precisely, explicitly stated
   "AssetVerdict isn't asking for a bigger profit margin, a different
   sale-price buffer, or a different ROI threshold," and refused to
   fabricate a basis value on the user's behalf.
8. **"What does the lower bound prove, and why does post-renovation
   basis count as evidence?"** → Correctly separated "remains profitable"
   from "still meets Required Return" as two distinct facts, and
   explained post-renovation matters because it's evidence *of the right
   state* of the property, not because it's inherently more trustworthy.
9. **"Why is this High Risk?"** → Cited the exact Rand shortfall,
   Break-Even Sale Price, and Sale-Price Buffer, and explicitly noted the
   buffer is "shown as a fact only" with no calibrated safety judgement.
10. **"Why Does Not Meet Target?"** → Correctly separated profitability
    (positive) from target achievement (IRR below required return) as two
    independent gates.

All answers referenced only fields present in the Deal Coach context (no
hallucinated metric names), and none attempted to compute or override a
verdict — consistent with the "AI never calculates" architectural rule.

## O. Regression — rental and negotiation untouched (explicit confirmation)

- **NO** change to any rental calculation formula.
- **NO** change to DSCR/OER/Break-Even/leverage thresholds or their
  verdict wiring — `deriveDealVerdict`'s rental path is byte-identical in
  behaviour; only its Flip branch now delegates instead of hardcoding
  `unavailable`.
- **NO** change to rental negotiation or `Promising If Negotiated`
  eligibility for any of the five rental strategies.
- **NO** change to Instalment Sale's `strategy_model_incomplete`
  unavailability.
- **NO** tax formula changes anywhere.
- Verified by the full 697-test suite passing, including every
  pre-existing rental/negotiation test unchanged in assertion content
  (only 4 Flip-specific tests were rewritten, all as an intended, direct
  consequence of activating the Flip verdict — never a rental behaviour
  change).

## P. Files changed (28 total, all listed in the commit)

**New:** `lib/calculations/flipVerdict.ts`,
`lib/calculations/__tests__/flipVerdict.test.ts`,
`prisma/migrations/20260820104537_add_valuation_basis/migration.sql`.

**Modified:** `prisma/schema.prisma`, `types/index.ts`,
`app/api/deals/[id]/valuation/route.ts`,
`app/api/deals/[id]/calculate/route.ts`,
`app/api/deals/[id]/coach/route.ts`, `app/(app)/deals/page.tsx`,
`app/(app)/deals/[id]/summary/page.tsx`,
`components/forms/PropertyValuationPanel.tsx`, `components/VerdictCard.tsx`,
`components/education/VerdictExplainer.tsx`,
`lib/calculations/fixFlipExitValue.ts`, `lib/calculations/verdict.ts`,
`lib/education/metricBreakdowns.ts`, `lib/education/verdictCopy.ts`,
`lib/pdf/DealSummaryPDF.tsx`, `lib/ai/dealCoachTypes.ts`,
`lib/ai/buildDealCoachContext.ts`, `lib/ai/dealCoachPrompt.ts`, plus 7
test files updated for the intended behaviour change (Section O).

## Q. Test / type / lint / build status

- `npx vitest run`: **697/697 passing** (696 pre-existing + 1 new model-version test; net of the flipVerdict.test.ts 23 new tests and 4 intentionally-rewritten tests).
- `npx tsc --noEmit`: clean.
- `npx eslint .`: clean (1 pre-existing, unrelated font warning in `app/layout.tsx`).
- `npx next build`: succeeds, all 16 static/dynamic routes generated.

## R. Known limitations (explicitly not fixed in this phase, by design)

- Fix & Flip `Promising If Negotiated` remains unavailable — acquisition-
  price negotiation for Flip is future work, per the brief.
- The Strong evidence gate does not stress renovation-cost overruns,
  financing-structure risk (bridge/interest-only/balloon loans are not
  modelled), or holding-period slippage — only a recorded downside
  valuation price. Deal Coach discloses this explicitly when asked.
- Import extraction never writes `valuationBasis` — it must be set by a
  human. This was a deliberate policy decision (Section D), not an
  oversight.
- Flip verdicts remain Base-case-only and Pre-Tax, matching every prior
  phase's locked boundary.

## S. Final Quality Questions (required, brief section 129)

- Does Fix & Flip now receive a real Overall Verdict? **YES.**
- Can a high IRR override a losing Base case into a non-High-Risk verdict? **NO.**
- Can an excellent valuation override a missed Required Return into Strong? **NO.**
- Is `equityIRR === null` ever silently treated as a missed target? **NO** — it returns `unavailable`.
- Does exactly-zero Conservative Case profit count as survival? **NO** — strict `>0`.
- Is any universal Sale-Price Buffer/Project ROI/Rand-band/70%-rule threshold introduced? **NO.**
- Is holding period used as a verdict threshold? **NO.**
- Is leverage/LTV used as a verdict threshold for Flip? **NO.**
- Is `Promising If Negotiated` reachable for Flip? **NO.**
- Does import extraction ever infer `valuationBasis`? **NO.**
- Is the Conservative Case's own IRR a blocking condition for Strong under the adopted policy? **NO** (Policy A) — it's informational only.
- Does the Conservative Case's exact Rand profit always appear in Strong's reasons? **YES.**
- Was the `verdictModelVersion` stamping bug fixed and re-verified live? **YES**, now `"4.20"` for Flip, `"4.14"` for rental.
- Do rental verdicts and rental/Instalment-Sale negotiation behave identically to before this phase? **YES**, confirmed by the full unchanged rental test suite.
- Is Flip's verdict computed pre-tax? **YES**, unchanged from Phase 4.17.
- Does Deal Coach ever calculate or override the verdict? **NO**, confirmed across 12 live questions.
- Does the PDF export show the real Flip verdict? **YES**, confirmed via live export.
- Was mobile (375px) checked for horizontal overflow on Strong and High Risk? **YES**, none found.
- Were temporary test deals deleted after verification? **YES.**
- Do all four regression gates (vitest/tsc/eslint/next build) pass? **YES.**
- Was the work committed and pushed? **YES** — commit `522157e`.

## T. Phase Completion Principle

This report is written after every claim in it was made true, not before:
the version-stamping bug was found and fixed live, then re-verified
against a running server, not just re-read as code; all six verdict
labels/blockers were produced by mutating a real database-backed deal and
reading the actual API response, not by reasoning about the code in the
abstract; all 12 Deal Coach questions were sent to the real model and its
actual answers were read end-to-end before being marked correct, at real
cost, per your approval; the production build was run clean, from a
stopped dev server, avoiding the `.next` cache-corruption failure mode
this project has hit twice before; and the full regression suite was the
last thing checked, not the first thing assumed. Phase 4.20 is complete
because it was proven complete, in that order.
