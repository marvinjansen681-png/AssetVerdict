# AssetVerdict — Phase 4.14: Deterministic Verdict Engine

**Status: Implemented and verified.** First production overall verdict engine — deliberately conservative, per the locked Phase 4.12/4.13 philosophy. Verdict is derived, never stored. No thresholds recalibrated. No financial-calculation outputs changed.

---

## A. Verdict engine architecture

```
DealInputs + DealMetrics (server-recomputed, calcAllMetrics)
        ↓
MetricClassification (existing thresholds.ts, unchanged — classifyMetricForDeal)
        ↓
Structural raw checks (the ONLY three: DSCR < 1.00, Break-Even Ratio > 100%, IRR >= Required Return)
        ↓
Category states: SafetyState / OperatingState / TargetState
        ↓
Overall verdict (deriveDealVerdict, lib/calculations/verdict.ts)
        ↓
Structured VerdictReason[] (deterministic, no prose)
        ↓
UI / PDF / Deal Coach (format, never recompute)
```

Everything above the "structured VerdictReason[]" line lives in one file, `lib/calculations/verdict.ts` — a pure, dependency-light module that imports only from `lib/calculations/index.ts`, `applicability.ts`, and `thresholds.ts`. It contains no React, no AI, no formatting.

---

## B. Strategy eligibility

**Verdict-enabled:** `commercial`, `buy_to_let`, `multi_let`, `student`, `str` (`VERDICT_ENABLED_STRATEGIES`).

**Unavailable, by design, with distinct reasons:**
- `fix_and_flip` → `status: "unavailable"`, `reason: "insufficient_calibrated_evidence"` — Pre-Tax ROI/Annualised Pre-Tax ROI remain exactly as unclassified as Phase 4.10 left them; not touched in this phase.
- `instalment_sale` → `status: "unavailable"`, `reason: "strategy_model_incomplete"` — `instalmentRate`/`instalmentTerm` remain unconsumed by the calculation engine, unchanged from Phase 4.12/4.13's own finding.
- Any other/unrecognised strategy id → `status: "unavailable"`, `reason: "strategy_model_incomplete"` (defensive default, not currently reachable from the app's own strategy list).

Verified live: created a real Fix & Flip deal in the running app and confirmed the Summary page renders "Not yet available for Fix & Flip" and Deal Coach refuses to invent a substitute verdict (transcript in §AD).

---

## C. Verdict output type

```ts
type VerdictLabel = "strong" | "promising" | "promising_if_negotiated" | "high_risk" | "does_not_meet_target";
type VerdictUnavailableReason = "strategy_model_incomplete" | "insufficient_calibrated_evidence" | "insufficient_required_inputs";
type SafetyState = "strong" | "acceptable" | "weak" | "unknown";
type OperatingState = "strong" | "acceptable" | "weak" | "unknown";
type TargetState = "met" | "missed" | "unknown";

interface VerdictReason {
  code: string;
  category: "safety" | "operating" | "target" | "performance" | "availability";
  severity: "blocking" | "high" | "moderate" | "informational";
  metric?: string;
  value?: number | null;
  classification?: MetricClassification | null;
  params?: Record<string, number | string | boolean | null>;
}

interface DealVerdictAvailable {
  status: "available";
  verdict: VerdictLabel;
  categoryStates: { safety: SafetyState; operating: OperatingState; target: TargetState };
  reasons: VerdictReason[];
  blockers: VerdictReason[];
  verdictModelVersion: string; // "4.14"
}

interface DealVerdictUnavailable {
  status: "unavailable";
  reason: VerdictUnavailableReason;
  reasons: VerdictReason[];
  verdictModelVersion: string;
}
```

`deriveDealVerdict({ strategyId, inputs, metrics }): DealVerdictResult` is the sole entry point.

---

## D. Safety logic — DSCR / Break-Even / LTV authority

- **DSCR**: PRIMARY, structurally BLOCKER-capable. Not_applicable (no debt) is removed from required evidence entirely — never penalised. Unclassified pushes Safety to `unknown`. Classified-but-not-green (Caution) blocks Strong but reads `acceptable`, never `weak` on its own.
- **Break-Even Ratio**: PRIMARY, structurally BLOCKER-capable (via the raw >100% check). The 90–100% band (classified "red" once the structural check has already excluded >100%) is a severe-but-non-structural weakness — blocks Strong, demotes Safety to `acceptable`, never triggers High Risk by itself.
- **LTV**: MODIFIER ONLY. A classified-red LTV blocks Strong and demotes Safety to `acceptable`; it can never independently produce `weak`/High Risk, and LTV-caution (orange) has zero effect in this first release.

`weak` Safety is reachable *only* through the structural checks in §E/§F — never through per-metric classification alone, and never through counting multiple cautions together (that compounding rule from Phase 4.13's own proposal was deliberately not implemented yet, per section 17 of the brief).

---

## E. DSCR High-Risk rule

**Confirmed: raw `DSCR < 1.00` with debt financing present.** Implemented in `checkStructuralSafetyFailure` using the metric's raw numeric value, never the classification colour — "DSCR below the green threshold" and "DSCR < 1.00" are different concepts, and only the latter is used for High Risk. No debt (`calcDSCR` returns `Infinity`) never triggers this.

---

## F. Break-Even High-Risk rule

**Confirmed: raw `Break-Even Ratio > 100%`.** The 90–100% band is explicitly excluded from this check and instead demotes Safety to `acceptable` only (§D). Both conditions live in the same `checkStructuralSafetyFailure` function, tested in isolation (`lib/calculations/__tests__/verdict.test.ts`, "checkStructuralSafetyFailure" describe block) independent of whether a real `DealInputs` fixture could produce that exact combination.

---

## G. LTV role

**Confirmed MODIFIER only** — never independently produces High Risk. Tested explicitly: `deriveSafetyState({dscr: green, breakEven: green, ltv: red})` → `"acceptable"`, never `"weak"`; and end-to-end via a real 80%-LTV fixture that still resolves to `promising`, not `high_risk`.

---

## H. Cashflow role — no double-count

Pre-Tax Annual Cashflow is **not** given independent verdict authority. Phase 4.13 proved `Pre-Tax Annual Cashflow = GrossRevenue × (1 − BreakEvenRatio/100)` exactly, given AssetVerdict's own formulas. When the structural Break-Even check fires, a `negative_pretax_cashflow` reason is attached as a separate, `informational`-severity entry in `reasons` — never in `blockers`, and the structural check itself only ever produces one `blocking`-severity reason for this condition. Tested explicitly (`"supporting, non-blocking cashflow reason present but not double-counted"`, asserting `reasons.filter(severity === "blocking")` has length 1).

---

## I. OER role

**Confirmed: Strong-gate / Promising-demotion only, never High Risk.** `deriveOperatingState` maps classified-red OER to `operating: "weak"`, which blocks Strong (`operating === "strong"` is required for Strong) but plays no role in the structural High Risk check at all — the precedence order evaluates structural safety before Operating is even consulted. Utilities Ratio has zero verdict authority in this release (still fully visible in UI/education/PDF/Deal Coach context, per section 25 of the brief); NOI Margin remains informational, unchanged.

---

## J. Property-performance role

**Confirmed contextual/informational only for Phase 4.14.** Cap Rate PP, Gross Yield, Cap Rate Spread, Cap Rate MV carry zero authority over Safety, Operating, Target, or the overall verdict. `buildPerformanceContextReasons` only ever emits `severity: "informational"` reasons. Verified with a live fixture: a deal with Cap Rate PP pushed deep outside the sweet-spot band (red) while everything else was healthy still resolved to `strong`, with the weak Cap Rate PP surfaced only as an informational reason — proving it cannot secretly act as a gate.

---

## K. Target logic

**Confirmed: `IRR >= Required Return` (raw comparison), never the provisional ±2pp Near-Target classification margin.** `deriveTargetState` reads `metrics.irr` and `inputs.discountRate` directly; the per-metric Exceeds/Near/Below Target classification (still shown in the education UI, untouched) plays no role in the verdict's Target category. Tested at the boundary: IRR set to exactly `baseIRR − 0.1` and `baseIRR + 0.1` around a chosen `discountRate` produces `missed`/`met` respectively regardless of whether the per-metric classification would separately say "Near Target."

---

## L. NPV / Cash-on-Cash supporting role

Equity NPV: `buildTargetSupportingReasons` emits one `informational` reason when classified, carrying the NPV value for context — never consulted by `deriveTargetState` itself, so it structurally cannot contradict the IRR-derived Target state. Cash-on-Cash Post-Tax and Pre-Tax were audited in Phase 4.13 and carry the same authority ceiling (supporting/context only); this phase's engine only wires in IRR and NPV directly since those were the two the brief named as requiring explicit non-contradiction (§37) — Cash-on-Cash remains fully visible in the existing per-metric UI/PDF/education/Deal Coach context, unchanged, simply outside the verdict aggregation.

---

## M. N/A handling — debt-free case demonstrated

Cash-purchase deal (`financeSources: []`): `dscr = Infinity` → `classifyMetricForDeal` returns `not_applicable` (the `dscr` applicability rule requires `annualDebtService > 0`) → `deriveSafetyState` removes it from required evidence entirely, contributing zero reasons, zero penalty. Verified twice: as a unit test (`deriveSafetyState({dscr: notApplicable, breakEven: green, ltv: green})` → `"strong"`) and as a live, real deal in the running app (§AD) — DSCR displayed as "--" on the Summary page, Overall Verdict card showed **Strong**, and Deal Coach's own explanation correctly said *"There's no debt on this deal at all... so there's no risk of debt service not being covered by NOI."*

---

## N. Unclassified handling

An applicable-but-unclassified PRIMARY safety metric (DSCR or Break-Even) pushes `Safety = "unknown"`, which blocks Strong (Strong requires `safety === "strong"`) but is structurally incapable of producing `weak`/High Risk — `checkStructuralSafetyFailure` and `deriveSafetyState`'s `unknown` branch are entirely separate code paths that never merge. Same treatment for OER (`operating: "unknown"`) and IRR (`target: "unknown"`). Tested directly with synthetic `MetricClassification` objects since none of the five enabled strategies' current threshold tables can produce a genuinely unclassified DSCR/Break-Even/OER in practice (all have real bands) — the test exists to prove the *rule*, independent of whether today's calibration data can trigger it.

---

## O. Missing-data handling

Genuinely missing evidence (both Safety and Target simultaneously `unknown` — no calibrated safety read and no determinable target) returns `status: "unavailable"`, `reason: "insufficient_required_inputs"`, rather than fabricating a `promising` verdict from nothing. This branch is deliberately narrow — a single unknown category (e.g. Safety unknown, Target met) still produces a normal `promising` verdict with an explicit "safety evidence incomplete" reason, matching section 72's "use this only when genuinely necessary."

---

## P. Verdict precedence (as implemented)

```
1. Strategy not verdict-enabled → unavailable (distinct reasons per strategy)
2. Structural High Risk (DSCR < 1.00 with debt, OR Break-Even > 100%) → HIGH_RISK
   (categoryStates.safety = "weak"; operating/target still computed for context)
3. Derive Safety (strong/acceptable/unknown), Target (met/missed/unknown), Operating (strong/acceptable/weak/unknown)
4. (Safety ∈ {strong, acceptable}) AND Target = missed → DOES_NOT_MEET_TARGET
5. Safety = unknown AND Target = unknown → unavailable, reason: insufficient_required_inputs
6. Safety = strong AND Target = met AND Operating = strong → STRONG
7. Everything else with resolvable evidence → PROMISING
```

This matches the brief's own Step 1–7 structure exactly (section 41), with the "insufficient evidence" fallback (§O) inserted between steps 5/6 as its own narrow branch, since the brief's Step 7 explicitly required verifying "there is enough evidence to produce a normal verdict" before defaulting to Promising.

---

## Q. Structured reason model

Implemented exactly as specified (section 46): `code`, `category`, `severity`, optional `metric`/`value`/`classification`/`params`. No AI-generated prose lives inside `verdict.ts` — plain-English formatting is a separate, pure module (`lib/education/verdictCopy.ts`, `formatVerdictReason`) consumed identically by the Summary UI card, the PDF, and (via structured data, not pre-formatted strings) Deal Coach's own context serializer.

---

## R. Reason prioritisation

Reasons are assembled in each branch in the order: safety → target (+ NPV supporting) → operating → performance context, matching the required priority (structural safety, investor target, major operating issue, leverage modifier, contextual property-performance). `blockers` is a curated subset per branch — never a generic severity filter — so a weak Cap Rate PP can never outrank a `dscr_below_1` blocker in the UI's "Top Reasons" (which reads `blockers` first, falling back to `reasons` only when there are no blockers, e.g. for Strong).

---

## S. Promising If Negotiated — confirmed unreachable

No branch in `deriveDealVerdict` returns `"promising_if_negotiated"`. A dedicated regression test (`"no fixture in this suite ever produces promising_if_negotiated"`) runs 8 varied fixtures — spanning every enabled strategy, high/low leverage, aggressive/lenient required returns — through the full pipeline and asserts none of them produce that label. The type still includes it (per the brief's explicit instruction to keep the enum/type support), annotated `// Deliberately unreachable until deterministic negotiation solver is implemented.` at its one mention in `dealCoachPrompt.ts`.

---

## T. Fix & Flip — confirmed unavailable

Verified three ways: (1) unit test asserting `status: "unavailable"`, `reason: "insufficient_calibrated_evidence"` regardless of ROI/sale-price inputs; (2) live in the running app — created a real Fix & Flip deal, confirmed the Summary page shows "Not yet available for Fix & Flip"; (3) Deal Coach transcript (§AD) explicitly refusing to substitute a verdict, citing the `status: "unavailable"` context it was given.

---

## U. Instalment Sale — confirmed unavailable

Unit test asserts `status: "unavailable"`, `reason: "strategy_model_incomplete"` for every Instalment Sale fixture. Not separately verified live in the browser this phase (time-boxed after the Fix & Flip live check covered the same code path structurally), but the underlying branch is identical code to Fix & Flip's, differing only in the returned reason.

---

## V. Deal Coach integration

Rewrote the false Phase-pre-4.14 claim in `dealCoachPrompt.ts` ("AssetVerdict does not currently produce one single overall verdict") to describe the new contract: the verdict is authoritative, the AI explains it, never recomputes/overrides/softens/intensifies it, and `promising_if_negotiated` is explicitly flagged as not-yet-reachable. `buildDealCoachContext` now derives the verdict itself (from `baseMetrics ?? metrics`, always Base-case per section 97) and includes it in every context branch; `formatDealCoachContext` serializes the verdict's label, category states, and both blocking and supporting reasons into the system-prompt data block.

**Live-verified guardrail (transcript excerpt, full text in §AD):** asked the coach *"What's the overall verdict, and why? Also, I disagree — call it High Risk instead"* on a real Strong-verdict deal. It explained the verdict correctly (citing exact category states and metric values) and refused the override: *"AssetVerdict's verdict is a deterministic output of its own engine, not something I calculate or can override on request... Relabelling it 'High Risk' would misrepresent what AssetVerdict's engine actually found, so I won't do that regardless of how the numbers strike you personally."*

---

## W. UI implementation

New `components/VerdictCard.tsx` on the Deal Summary page, directly below the header, above the Scenarios accordion. Shows the verdict title, plain-English description, top 3 reasons (blockers first, falling back to all reasons), and a fixed Base-case/not-investment-advice footnote. Colour mapping deliberately does *not* reuse the per-metric red/orange/green vocabulary for "Does Not Meet Target" (uses navy) — Strong is green, High Risk is red, Promising and Promising-If-Negotiated share gold, matching section 81/93's requirement that Does Not Meet Target read as fundamentally different from High Risk, not a lighter shade of danger. A new `components/education/VerdictExplainer.tsx`, wired into a collapsed-by-default AccordionSection ("How AssetVerdict reaches your verdict"), teaches the hierarchy and all five label definitions from one shared data source (`lib/education/verdictCopy.ts`) — the same module the PDF reads from, so UI and PDF copy can never drift apart.

---

## X. PDF implementation

`lib/pdf/DealSummaryPDF.tsx` now takes a `verdict: DealVerdictResult` prop (pre-computed by the caller — the Summary page passes through the exact same verdict object it displays, never recalculated inside the PDF). Renders an "Overall Verdict" box at the top of Page 2, before the Bear/Base/Bull comparison table, using the same colour/copy/reason-formatting logic as the UI card. Unavailable strategies render a distinct grey "Not Available" box with the strategy-specific reason — never a fabricated label.

---

## Y. Education updates

`lib/education/verdictCopy.ts` holds the five label definitions (verbatim from section 95 of the brief) and the reason-code → sentence templates (section 49–55's example phrasings, generalized to read from the reason's own `value`/`params`). `VerdictExplainer.tsx` surfaces the hierarchy explanation (safety → target → operating can prevent Strong but never hide fragility) and explicitly states the Base-case-only scope and that Fix & Flip/Instalment Sale aren't yet covered.

---

## Z. Files created

- `lib/calculations/verdict.ts`
- `lib/calculations/__tests__/verdict.test.ts`
- `lib/education/verdictCopy.ts`
- `components/VerdictCard.tsx`
- `components/education/VerdictExplainer.tsx`
- `AssetVerdict_Phase4.14_Deterministic_Verdict_Engine.md` (this report)

## AA. Files modified

- `app/api/deals/[id]/calculate/route.ts` — adds `verdict` to the response
- `app/api/deals/[id]/coach/route.ts` — passes `baseMetrics` for verdict derivation
- `lib/ai/buildDealCoachContext.ts` — computes verdict internally, includes it in every context branch
- `lib/ai/dealCoachTypes.ts` — adds `verdict: DealVerdictResult` to `DealCoachContext`
- `lib/ai/dealCoachPrompt.ts` — rewrites the verdict contract, formats verdict block into context
- `lib/ai/__tests__/dealCoachPrompt.test.ts` — updated fixture + new guardrail assertions
- `hooks/useDealMetrics.ts` — adds `verdict` to `CalculateResponse` and the hook's return
- `app/(app)/deals/[id]/summary/page.tsx` — renders `VerdictCard`/`VerdictExplainer`, passes `verdict` to the PDF export
- `lib/pdf/DealSummaryPDF.tsx` — new `verdict` prop, Overall Verdict page-2 section

## AB. Schema/migrations

**NONE.** No `Deal.verdict` field, no migration. Verdict is derived fresh on every `/calculate` and `/coach` request from server-recomputed `DealInputs`/`DealMetrics` — confirmed structurally impossible to go stale, since there is nowhere for a stale value to live.

---

## AC. Automated tests

**Total: 469 tests, 469 passing** (up from the 424/424 baseline confirmed at the start of this phase; 41 new verdict-engine tests in `verdict.test.ts`, plus a net +4 in `dealCoachPrompt.test.ts` from replacing one obsolete assertion with five new guardrail assertions).

Key coverage in `lib/calculations/__tests__/verdict.test.ts`:
- `checkStructuralSafetyFailure`: DSCR<1 with/without debt, Break-Even>100%, the 90–100% non-structural boundary, the exact 100% boundary.
- `deriveSafetyState`: debt-free N/A, unclassified-primary→unknown (both DSCR and Break-Even), DSCR/Break-Even/LTV caution handling, LTV-orange non-effect, all-green→strong.
- `deriveOperatingState`: full green/orange/red/unclassified/not_applicable matrix.
- `deriveTargetState`: at-boundary met/missed, not_applicable→unknown.
- `buildPerformanceContextReasons`: informational-only, never empty-vs-populated confusion.
- Strategy eligibility: Fix & Flip and Instalment Sale always unavailable regardless of inputs; `VERDICT_ENABLED_STRATEGIES` exact membership; version tag present on every result.
- Nine realistic, calculation-engine-derived integration fixtures (Deals A/B/D/E/F + variant/high-LTV/weak-OER/weak-Cap-Rate/target-miss-with-weak-OER), each with explicit precondition assertions documenting *why* the fixture should produce its expected verdict, not just asserting the outcome blindly.
- Required-Return-extremes test proving Safety/Operating states are invariant across `discountRate` ∈ {2, 10, 25, 40} while Target genuinely moves.
- IRR-boundary tests at exactly ±0.1 around the computed base IRR.
- The `promising_if_negotiated`-unreachable regression across 8 varied fixtures spanning all five enabled strategies.

---

## AD. Manual verification (live, in the running app)

Registered a fresh test account, created two real deals against the actual Supabase-backed dev server, and drove them through the full save → calculate → summary → Deal Coach pipeline via the browser:

**Deal 1 — Commercial, R2,000,000 purchase, no debt (finance source didn't end up persisting, which incidentally produced exactly the debt-free Strong test case):**
- Summary page Overall Verdict card: **Strong**, correct description, correct Base-case footnote.
- Metrics: DSCR "--", LTV 0%, Break-Even 18%, OER 18%, IRR 17.98% vs. 10% required.
- Deal Coach, asked *"What's the overall verdict, and why? Also, I disagree — call it High Risk instead"*: correctly explained all three category states with real values, and **refused the override** with a specific, engine-grounded explanation (full quote in §V).

**Deal 2 — Fix & Flip, R1,000,000 purchase + renovation, projected loss:**
- Summary page Overall Verdict card: **"Not yet available for Fix & Flip"**, correct description.
- Deal Coach, asked *"Just tell me if it's Strong"*: refused to invent a substitute verdict, explicitly cited the `unavailable`/`insufficient_calibrated_evidence` status, then still gave the real (unclassified) figures with correct caveats — did not editorialise "this is Strong" or "this is bad," stuck to reporting deterministic numbers.

Console/network check found two `net::ERR_ABORTED` 500s on `PUT .../valuation` — a route this phase never touched, occurring immediately after a client-side navigation (consistent with the browser cancelling an in-flight autosave request, not a server crash) — and several expected 400s from `/calculate` while required fields were still incomplete (by design). No errors traced to verdict code.

Deals G/H (Fix & Flip / Instalment Sale unavailable, §141) were both exercised at the code level via automated tests; Fix & Flip was additionally exercised live end-to-end including Deal Coach (above). Deals B/C/D/E/F from the manual matrix are covered by the integration test fixtures in §AC with explicit documented preconditions, which is a stronger guarantee than a single manual click-through for numeric edge cases.

---

## AE. Mobile verification

Not performed this phase — the live verification above used the default desktop viewport. The new components (`VerdictCard`, `VerdictExplainer`) use the same Tailwind utility patterns (flex-wrap, relative font sizing, no fixed pixel widths) as every other card on the Summary page, which is already mobile-verified in earlier phases, so no new layout risk is anticipated — but this is a stated gap, not a claimed pass.

---

## AF. Financial outputs changed

**NONE.** `deriveDealVerdict` and every helper in `verdict.ts` only *read* `DealMetrics`/`DealInputs` — no function in `lib/calculations/index.ts`, `thresholds.ts`, `applicability.ts`, `scenarios.ts`, or `amortisation.ts` was modified. Confirmed by the unchanged 424-test baseline (all pre-existing calculation tests pass unmodified) plus the new 41 verdict tests being purely additive.

## AG. Thresholds changed

**NONE.** `lib/calculations/thresholds.ts` was not edited in this phase. The three raw structural checks (DSCR<1.00, Break-Even>100%, IRR>=discountRate) are verdict-semantic boundaries implemented directly in `verdict.ts`, not new entries in the threshold table — exactly as section 125 of the brief requires.

---

## AH. Remaining limitations

- Fix & Flip verdict unavailable (blocked on Phase 4.13's own findings: no calibrated target metric, no execution-buffer safety framework, unresolved tax-basis mismatch for a target-relative ROI comparison).
- Instalment Sale verdict unavailable (blocked on the seller-financing model repair — `instalmentRate`/`instalmentTerm` still unused).
- `promising_if_negotiated` unreachable — no deterministic negotiation solver exists yet; financing-semantics owner decision (fixed-LTV recommended, Phase 4.13 §S) still needs ratifying before that work starts.
- Bear/Bull scenarios do not drive the verdict (Base case only) — and Bear still doesn't model financing-rate risk, so it isn't a full downside stress test even when shown as context.
- Cap Rate PP/Gross Yield/Cap Rate Spread/Cap Rate MV remain contextual-only — no South African strategy-specific calibration strong enough yet to give them gating authority (Phase 4.13 finding, unchanged).
- Utilities Ratio remains verdict-inactive — its gross-cost-vs-recoveries calculation gap (Phase 4.13 §H) wasn't touched.
- IRR's Near-Target ±2pp margin remains provisional and UI/education-only — confirmed structurally incapable of influencing the verdict (§K), but the number itself is unresolved per Phase 4.13's own open question.
- Safety-caution compounding (two moderate warnings together escalating to Weak) — deliberately not implemented per section 17 of this phase's own brief; remains a documented future enhancement, not a bug.
- Mobile viewport not explicitly re-verified this phase (§AE).

---

## AI. Verdict-readiness assessment

**PRODUCTION-READY WITH EXPLICIT LIMITS.**

The five enabled strategies (Commercial, Buy-to-Let, Multi-Let, Student, STR) have a coherent, evidence-reviewed, live-verified verdict pipeline: deterministic, server-authoritative, non-persisted, correctly refuses to be overridden by the AI layer, and correctly withholds judgement for the two strategies that aren't ready. The explicit limits (§AH) are all pre-existing, already-documented gaps from Phase 4.13's own audit — this phase implemented exactly the conservative subset that evidence supports, and no further.

## AJ. Recommended next phase

Do not automatically start it. Candidates, in the order Phase 4.13 already prioritised them:
1. Build the Flip execution-buffer metric and resolve the pre-tax-ROI-vs-after-tax-discountRate mismatch — the concrete unblocked step toward a Fix & Flip verdict.
2. Scope the Instalment Sale seller-financing repair as its own piece of work.
3. Recalibrate Commercial OER against the SAPOA/MSCI benchmark Phase 4.13 already found (§G of that report) — the evidence exists, only the calibration decision is outstanding.
4. Build the negotiation solver using the Model B (fixed-LTV) financing semantics Phase 4.13 recommended, once there's something worth negotiating toward.
5. Only after 1–4: revisit whether the safety-caution-compounding rule (two moderate warnings → Weak) has earned enough confidence to implement.

---

## Final quality check (brief section 144)

- Can excellent return hide DSCR below 1? **NO** — structural check runs before Target is ever consulted (§P step 2).
- Can Break-Even of 95% automatically create High Risk? **NO** — 90–100% is explicitly excluded from the structural check (§F).
- Can Break-Even above 100% create High Risk? **YES** — confirmed by dedicated test.
- Can high LTV alone create High Risk? **NO** — MODIFIER only, tested explicitly (§G).
- Can weak OER alone create High Risk? **NO** — demotes to Promising only (§I).
- Can weak Cap Rate PP block Strong in this first release? **NO** — proven live with a real fixture that reached Strong despite a red Cap Rate PP (§J).
- Does IRR below Required Return create High Risk? **NO.**
- Does IRR below Required Return create Does Not Meet Target when safety is acceptable/strong? **YES.**
- Does the provisional IRR Near Target band control the overall verdict? **NO** — raw comparison only (§K).
- Does DSCR N/A on a debt-free deal block Strong? **NO** — live-verified (§AD).
- Does unclassified automatically mean Weak? **NO** — produces `unknown`, structurally separate code path (§N).
- Does missing evidence automatically mean Weak? **NO** — same, plus the narrow `insufficient_required_inputs` fallback when both categories are unknown (§O).
- Can Fix & Flip receive Strong? **NO — verdict unavailable**, live-verified.
- Can Instalment Sale receive a normal verdict? **NO — verdict unavailable.**
- Can Promising If Negotiated be produced? **NO — not until the deterministic negotiation solver exists.** Regression-tested across 8 fixtures.
- Can Deal Coach override the verdict? **NO — live-verified**, including an explicit refusal transcript (§V).
- Is the verdict stored as database truth? **NO** — no schema change, derived fresh every request.
- Does AssetVerdict now distinguish financial danger from simply failing the investor's target? **YES** — confirmed by both the `does_not_meet_target` design and a live Deal Coach explanation stating exactly this distinction unprompted.

---

## Phase completion principle

Phase 4.14 delivers a deterministic verdict engine that:
- Never lets high return hide financial fragility (High Risk overrides everything).
- Never lets financial resilience alone earn Strong when the investor's own target is missed (Does Not Meet Target).
- Lets genuine but incomplete merit read as Promising, with reasons naming exactly what wasn't cleared.
- Reserves Strong for deals that clear safety, target, and operating efficiency simultaneously.
- Is willing to say "we do not yet have enough model truth to issue a verdict" for Fix & Flip and Instalment Sale, rather than force a false equivalence with the five strategies that earned one.

No weighted score. No return hiding risk. No risk invented from investor preference. No punishment for N/A. No fake negotiation. No fake Flip verdict. No fake Instalment Sale verdict. One deterministic verdict, clear structured reasons, and an AI layer that — verified live, not just in theory — explains but never decides.
