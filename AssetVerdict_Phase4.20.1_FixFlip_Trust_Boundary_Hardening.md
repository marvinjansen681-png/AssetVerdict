# AssetVerdict — Phase 4.20.1: Fix & Flip Verdict Trust-Boundary Hardening

**Status: COMPLETE.**

Phase 4.20's product behaviour is unchanged — same four verdict labels,
same precedence, same Policy A, same "no universal threshold" boundary,
same Pre-Tax/Base-case/no-negotiation limitations. This phase closes one
runtime defect, fixes overstated wording in two places, and produces an
exact, verified test-count reconciliation. No verdict redesign, no Flip
negotiation, no financial-formula change.

---

## 1. The trust-boundary defect — closed

**Before:** `PropertyValuation.valuationBasis` is a plain Prisma `String`
column (no DB-level enum/check constraint). The write path validates
correctly via `z.enum(["unknown", "current_condition", "post_renovation"])`,
but two read paths — `app/api/deals/[id]/calculate/route.ts` and
`app/api/deals/[id]/coach/route.ts` — turned the raw DB value into a typed
`FlipExitValuationInput["valuationBasis"]` with a bare `as` cast, which
provides zero runtime validation. Downstream, `flipVerdict.ts`'s Strong
evidence gate was written as two exclusions —
`if (valuationBasis === "unknown") reject; if (valuationBasis === "current_condition") reject;`
— with an implicit pass-through for anything else. If the database ever
held a value outside the three known literals (a typo, a manual edit, a
future migration bug), the cast would let it through and the elimination
logic would treat it as if it were `"post_renovation"`, incorrectly
granting it Strong authority. This was a fail-open defect.

**Fix — two layers, matching the brief's required trust principle
("only post_renovation may unlock Strong; unknown data must fail
CLOSED, never open"):**

1. **Ingestion normalization.** New exported function
   `normalizePropertyValuationBasis(value: unknown): FlipExitValueValuationBasis`
   in `lib/calculations/fixFlipExitValue.ts`:
   ```ts
   export function normalizePropertyValuationBasis(value: unknown): FlipExitValueValuationBasis {
     if (value === "current_condition") return "current_condition";
     if (value === "post_renovation") return "post_renovation";
     return "unknown";
   }
   ```
   Both cast sites now call this instead of `as ... ?? "unknown"`. Any
   value that isn't exactly one of the two non-default literals — `null`,
   `undefined`, a typo, a number, an object, a case-mismatch — normalizes
   to `"unknown"`.
2. **Positive proof at the decision point (defense in depth).**
   `evaluateStrongEvidence()` in `flipVerdict.ts` no longer eliminates two
   known-bad values and falls through; it now requires a positive match:
   ```ts
   if (evidence.valuationBasis !== "post_renovation") {
     return {
       cleared: false,
       blocker: evidence.valuationBasis === "current_condition" ? "valuation_current_condition" : "valuation_basis_unknown",
     };
   }
   ```
   This means even if some future caller of `flipVerdict.ts` ever bypassed
   the normalizer entirely, the verdict engine itself still cannot be
   tricked into granting Strong authority to anything other than the exact
   literal string `"post_renovation"`.

**Proven, not just asserted:** a new test in
`lib/calculations/__tests__/flipVerdict.test.ts` ("an unrecognised
valuationBasis string reaching evaluateStrongEvidence is treated as
unknown, NOT as post_renovation") constructs evidence with a
deliberately malformed basis value (cast past the type system, simulating
corrupted data that bypassed the normalizer) and confirms the verdict is
`promising`/`valuation_basis_unknown`, never `strong`. Four new tests in
`lib/calculations/__tests__/fixFlipExitValue.test.ts` cover
`normalizePropertyValuationBasis` directly: both valid literals pass
through, the default literal passes through, and `null`/`undefined`/`""`/
case-mismatch (`"Post_Renovation"`)/hyphen-typo (`"post-renovation"`)/
`"foo"`/a number/a boolean/an object all normalize to `"unknown"`.

**No behaviour change for valid data**, live-verified: a fresh test deal
with a `post_renovation` valuation and a profitable lower bound still
returns `strong` (`verdictModelVersion: "4.20"`, zero blockers); the same
deal with basis switched to `unknown` still returns
`promising`/`valuation_basis_unknown`. Both match Phase 4.20's original
acceptance results exactly.

## 2. Overstated "confirmed" wording — removed

Three places described `post_renovation`-basis evidence as "confirmed,"
which overstates what the field actually represents: `valuationBasis` is
metadata the user set on the valuation record, never something
AssetVerdict itself has verified or audited. "Confirmed" implies a
verification AssetVerdict doesn't perform.

- `lib/education/verdictCopy.ts` — Flip's Promising description: "does
  not have enough **confirmed** post-renovation downside evidence" →
  "does not have a **recorded** post-renovation valuation with a
  profitable lower confidence bound."
- `lib/education/verdictCopy.ts` — the `valuation_basis_unknown` reason
  template: "cannot treat it as **confirmed** post-renovation exit
  evidence" → "cannot treat it as post-renovation exit evidence" (also
  fixed a redundant "recorded valuation's basis... is not recorded"
  phrasing in the same sentence).
- `lib/ai/dealCoachPrompt.ts` — the Fix & Flip verdict guardrail section's
  "promising" bullet, same "confirmed" → "recorded ... with a profitable
  lower confidence bound" rewording, kept consistent with the UI copy.

A fourth occurrence at `dealCoachPrompt.ts:304` ("...never as confirmed
post-renovation exit value") was reviewed and left unchanged — it already
uses "confirmed" correctly, as a negation warning the model never to
claim confirmation, not as a claim of confirmation itself.

Live-verified: the Promising Summary page for a fresh unknown-basis test
deal now reads "AssetVerdict does not have a recorded post-renovation
valuation with a profitable lower confidence bound" and "The recorded
valuation's basis (current condition vs. post-renovation) was not set" —
no instance of "confirmed" remains in either string.

## 3. Test-count audit trail — reconciled exactly

Phase 4.20's final report stated "697/697 passing (696 pre-existing + 1
new model-version test...)" — an imprecise, internally inconsistent
breakdown that didn't actually add up (672 was the true baseline, not
696). This phase re-derived the number from first principles instead of
memory, using a disposable git worktree pinned to `a1c86c7` (the accepted
Phase 4.19.1 baseline commit) to run the real baseline suite in isolation
from the current working tree, then diffed exact `it(...)` declaration
counts per changed test file between that commit and Phase 4.20's close
(`c3a5838`):

| File | Baseline (a1c86c7) | Phase 4.20 close (c3a5838) | Delta |
|---|---|---|---|
| `lib/calculations/__tests__/flipVerdict.test.ts` | 0 (new file) | 23 | **+23** |
| `lib/ai/__tests__/dealCoachPrompt.test.ts` | 37 | 38 | **+1** (one combined Fix-Flip/Instalment-Sale test split into two) |
| `lib/calculations/__tests__/verdict.test.ts` | 45 | 46 | **+1** (the model-version test was rewritten in place — net 0 — and one new companion test was added alongside it — net +1) |
| `lib/calculations/__tests__/fixFlip.test.ts` | 51 | 51 | 0 (rewritten in place) |
| `lib/calculations/__tests__/fixFlipExitValue.test.ts` | 44 | 44 | 0 (rewritten in place) |
| `lib/calculations/__tests__/negotiation.test.ts` | 57 | 57 | 0 (one assertion changed, no count change) |
| `lib/__tests__/areaIntelligence.test.ts` | 7 | 7 | 0 (fixture-only edit) |
| `lib/__tests__/propertyValuation.test.ts` | 8 | 8 | 0 (fixture-only edit) |

**672 (verified baseline) + 23 + 1 + 1 = 697** — matches the actual
`vitest run` result at `c3a5838` exactly (23 test files, 697 tests), which
was independently re-confirmed by literally running the suite at both
commits, not just counting `it()` occurrences by inspection.

Phase 4.20.1 then added 5 more tests on top of that reconciled 697 (1 in
`flipVerdict.test.ts` for the fail-closed hardening, 4 for
`normalizePropertyValuationBasis` — see Section 1), independently
confirmed by a real `vitest run`: **701/701 passing.**

## 4. Regression gate

- `npx vitest run`: **701/701 passing**, 23 test files.
- `npx tsc --noEmit`: clean.
- `npx eslint .`: clean (1 pre-existing, unrelated font warning).
- `npx next build`: clean, all 16 routes generated (dev server stopped
  first, `.next` removed, rebuilt, dev server restarted afterward — same
  discipline as Phase 4.20 to avoid webpack-cache corruption).
- Live-verified on a fresh test deal (created and deleted within this
  session): Strong scenario unchanged (`verdictModelVersion: "4.20"`, zero
  blockers), unknown-basis Promising scenario unchanged
  (`valuation_basis_unknown`), and the corrected wording confirmed
  rendering on the actual Summary page.

## 5. Explicit confirmations

- Verdict labels, precedence, and Policy A: **unchanged.**
- No universal Sale-Price Buffer/Project ROI/Rand-band/leverage/70%-rule
  threshold introduced: **confirmed, none added.**
- Fix & Flip negotiation: **still not started** — untouched.
- Financial formulas: **unchanged** — this phase touched only
  `valuationBasis` type-safety, verdict-copy wording, and test-audit
  documentation.
- Rental calculations/verdict/negotiation: **untouched**, confirmed by the
  full 701-test suite including every pre-existing rental test unchanged
  in assertion content.

## 6. Files changed

`lib/calculations/fixFlipExitValue.ts` (new `normalizePropertyValuationBasis`
export), `lib/calculations/flipVerdict.ts` (positive-match Strong gate),
`app/api/deals/[id]/calculate/route.ts` and
`app/api/deals/[id]/coach/route.ts` (both cast sites replaced with the
normalizer), `lib/education/verdictCopy.ts` and `lib/ai/dealCoachPrompt.ts`
(wording fixes), `lib/calculations/__tests__/flipVerdict.test.ts` and
`lib/calculations/__tests__/fixFlipExitValue.test.ts` (5 new tests).
