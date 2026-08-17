# AssetVerdict — Phase 4.13: Verdict Evidence & Calibration Audit

**Status: Evidence + calibration-authority audit. No verdict engine implemented. No thresholds recalibrated. No classifications changed. One TypeScript baseline defect fixed (pre-approved cleanup, §A).**

Phase 4.12's architecture (Hybrid category states + deterministic rules, safety override, deferred negotiation, Base-only scenarios, unclassified-blocks-Strong-but-never-Weak) is treated as locked. This phase asks a narrower question: **which specific metrics, at which specific authority level, have actually earned the right to drive that architecture today** — using real evidence, not intuition.

---

## A. Baseline repair / TypeScript discrepancy

**Root cause found and fixed.** Phase 4.11 (commit `7f03134`, "server-authoritative finance truth") added two new assertions to `lib/calculations/__tests__/assembleInputs.test.ts` (then lines 166–167) that accessed `metricsLow.exitSummary.remainingDebtAtExit` / `.terminalEquityValue` directly, without narrowing. `DealMetrics.exitSummary` has been an **optional** field (`exitSummary?: ExitSummary`) since commit `9047e31` ("Phases 4.3–4.5"), specifically to accommodate Fix & Flip deals, where `calcAllMetrics` deliberately sets it to `undefined`. Phase 4.11's own report of "tsc clean" was accurate at the time it was generated — the fresh assertions it added were the defect, not a reporting error on either side. Phase 4.12 correctly reported the resulting 4 errors as pre-existing (they predated Phase 4.12 entirely).

**Files affected:** `lib/calculations/__tests__/assembleInputs.test.ts` only. Not a regression in the calculation engine itself — `exitSummary`'s optionality and every metric it feeds were already correct; only two test assertions lacked type narrowing.

**Fix made:** added explicit `expect(metricsLow.exitSummary).toBeDefined()` / `expect(metricsHigh.exitSummary).toBeDefined()` checks (strengthening the test, since it's now explicit that this rental-strategy fixture must produce a defined `exitSummary`), then used non-null assertions (`exitSummary!`) on the two comparison lines — the exact pattern already used elsewhere in the suite (`lib/calculations/__tests__/index.test.ts:1016-17`). No assertion was weakened or removed.

**Final baseline (re-run for this phase):**
```
npx vitest run     → 18 test files, 424/424 passing
npx tsc --noEmit   → clean, 0 errors
npx eslint .       → 0 errors, 1 pre-existing warning (app/layout.tsx:32, @next/next/no-page-custom-font, unrelated)
npx next build     → succeeds, all 16 routes generated
```
Committed separately (`ac8c47e`) before any evidence work, per the phase's own instruction to restore a clean baseline first.

---

## B. Current threshold inventory

Re-confirmed against `lib/calculations/thresholds.ts` (unchanged since Phase 4.12 — no edits made in this phase):

| Metric | Model | Commercial bands | BTL | Multi-Let | Student | STR | Instalment Sale | Fix & Flip |
|---|---|---|---|---|---|---|---|---|
| DSCR | fixed_bands (higher) | 1.25 / 1.00 | 1.20 / 1.00 | 1.30 / 1.00 | 1.25 / 1.00 (inherited) | 1.25 / 1.00 (inherited) | 1.25 / 1.00 (inherited) | no entry |
| LTV | fixed_bands (lower) | 60 / 75 | same (no override) | same | same | same | same | no entry |
| Break-Even Ratio | fixed_bands (lower) | 75 / 90 | same | same | same | same | same | no entry |
| OER | fixed_bands (lower) | 40 / 60 | 45 / 65 | 50 / 70 | 55 / 75 | 50 / 70 | 40 / 60 (inherited) | no entry |
| Utilities Ratio | fixed_bands (lower) | 15 / 30 | same | same | same | same | same | no entry |
| Gross Yield | fixed_bands (higher) | 10 / 7 | 8 / 5 | 12 / 8 | 10 / 7 (inherited) | 15 / 10 | 8 / 5 | no entry |
| Cap Rate PP | fixed_bands (sweet_spot) | 8–12 / 5–13 | same (no override) | same | same | same | same | no entry |
| Cap Rate Spread | fixed_bands (higher) | 2 / 0 | same | same | same | same | same | no entry |
| IRR | target_relative, ±2pp caution margin, provisional | — | — | — | — | — | — | no entry |
| NPV | zero_relative, ±5%-of-equity tolerance, provisional | — | — | — | — | — | — | no entry |
| CoC Pre/Post-Tax | target_relative, ±2pp margin, provisional | — | — | — | — | — | — | no entry |
| Flip ROI/Annualised ROI/Net Profit | unclassified (Phase 4.10) | — | — | — | — | — | — | unclassified |
| Flip Profit Margin | **no entry at all** | — | — | — | — | — | — | absent |

Every non-target, non-Flip band's `evidenceLevel` is `internal` except DSCR-commercial (`moderate`) — meaning AssetVerdict's own rationale text already concedes these are its own reference numbers, "not sourced to a named lender," for every band except commercial DSCR.

---

## C. External evidence methodology

Search performed via live web research (August 2026), prioritising, in order: named South African bank/lender product terms and broker aggregators reporting them (moderate-quality secondary sources — not primary bank policy PDFs, which were not publicly accessible in this pass), a South African institutional property-industry index (SAPOA, compiled by MSCI South Africa — high-quality, primary, quantified), and general international commercial/residential real-estate-finance convention (US/UK-centric, used only where explicitly flagged as non-SA and directional). Generic SEO content and anonymous investor forum posts were excluded as primary evidence per the phase's instruction; several results (DealCheck, Mashvisor, FNRP-style explainer sites) were used only where their stated figures converged with an independent, more credible source (e.g. a HUD-program-referencing calculator), never alone.

No source claiming a specific numeric SA lender DSCR minimum was found. This absence is itself reported, not papered over, in §D.

---

## D. DSCR evidence

**International convention (not SA-specific):** multiple independent sources converge on **1.20×–1.25× as a common minimum**, with **1.30×+ for higher-risk property types** (office, retail, value-add). This roughly matches AssetVerdict's own commercial band (1.25/1.00) and is *directionally* consistent with the multi-let band being stricter (1.30/1.00) than BTL (1.20/1.00) — multi-tenant income is generally considered higher-variance than a single BTL tenant, which lines up with "riskier property type → higher DSCR bar." No source was found calibrating a South African bank's specific published DSCR cutoff for commercial property lending, despite targeted searches naming Nedbank, Absa, Investec, and Standard Bank directly.

**Important and materially relevant finding — DSCR does not match how South African residential buy-to-let lending actually works.** Evidence found (Absa/FNB buy-to-let product descriptions) shows SA residential investment-property lenders assess loans via a **personal affordability test**, applying a **70–80% haircut to projected rental income** and folding that into the borrower's *overall* (not property-isolated) income and existing-debt picture — not a standalone asset-level "property NOI ÷ property debt service" ratio the way US/UK commercial DSCR loans work. This means: **AssetVerdict's DSCR, as currently computed (NOI ÷ annual debt service, property-only), is not a proven model of how any confirmed South African residential lender actually approves a buy-to-let loan.** It is a legitimate, well-established *financial-resilience* concept (does the property's own income structurally cover its own debt service, independent of the owner's other finances) — but it must not be described, in rationale text or future UI/Deal Coach copy, as "what a South African bank requires," since for residential buy-to-let that claim is not supported by the evidence found. Commercial property lending is more plausibly DSCR-style internationally, but still without a confirmed SA-primary source.

**§9's distinction (lender eligibility vs. financial resilience) is answered:** evidence only supports DSCR as a *financial-resilience concept*, not a confirmed *lender eligibility test*, for South African residential deals specifically. Recommend the metric's rationale text (currently "a well-established debt-coverage safety concept... not sourced to a named lender") be read and treated exactly at that strength — no stronger — and that `evidenceLevel: "moderate"` on commercial DSCR be reconsidered against `internal` in a future calibration pass, since "moderate" arguably overstates what was actually found. **This is a recommendation only — not changed in this phase**, per §63's caution against unreviewed metadata edits during an audit phase.

**Recommendation:** DSCR remains **PRIMARY, BLOCKER-capable** (§T) — not because a specific SA source proves the exact 1.25/1.00 cliff, but because the underlying resilience concept (can the property's own income structurally service its own debt) is close to a structural fact about solvency risk, not a matter of taste, and no evidence found contradicts the general shape of the band. The cutoff numbers themselves stay flagged for future recalibration (§W).

---

## E. LTV evidence

**South African evidence found, but genuinely disagreeing across sources — reported honestly, not averaged:**
- **Residential buy-to-let:** some lenders reportedly offer up to 90% LTV for properties ≤R2m and 85% for R2–3m; a different source states FNB caps *investment* property specifically at 70% LTV regardless of price. These are not reconcilable into one number — different banks, different products, different eras of the same broker content.
- **Commercial property finance:** multiple sources converge more tightly around **60–80% LTV** (i.e. 20–40% deposit), with "up to 75%" cited as a common practical ceiling; 100% financing is described as rare/exceptional.

**Calibration-relevant finding:** AssetVerdict currently applies **one identical LTV band (60/75 green/orange) to every rental strategy**, with no strategy override anywhere in `thresholds.ts` (unlike DSCR, OER, and Gross Yield, which all get strategy-specific bands). The evidence above suggests this is measurably mismatched in both directions: a bank-approved 85% LTV residential BTL deal (well within what at least one cited lender offers) reads **red/weak** under AssetVerdict's single band, while the commercial market's own typical ceiling (~75–80%) sits almost exactly on AssetVerdict's orange/red boundary. This is evidence a future calibration phase should strategy-differentiate LTV the same way OER and Gross Yield already are — **not changed here**, added to §W.

**Role test (§10 — can high leverage alone justify High Risk if DSCR and Break-Even are strong?):** no evidence found supports this. Every source treats LTV purely as a capital-structure/funding-requirement fact (how much deposit is needed), never as a standalone coverage or default-probability test — that role is filled by DSCR/affordability assessment in every source reviewed. Financial-safety theory generally treats leverage as an *amplifier of consequence if something goes wrong*, not itself a measure of whether something is likely to go wrong. **Phase 4.12's MODIFIER / Strong-gate-qualifier recommendation is confirmed, not overturned.** LTV cannot independently trigger High Risk; it can cap Strong and amplify an already-weak/caution DSCR or Break-Even reading into a more severe one (§M).

---

## F. Break-Even evidence

**Formula reconfirmed directly from code** (`index.ts:684-689`): `BreakEvenRatio = (OperatingExpensesAnnual[incl. provisions] + AnnualDebtService) / GrossRevenueAnnual × 100`. Not literal occupancy — confirmed, matches its own documentation exactly.

**External evidence (general international convention, not SA-specific, but convergent across multiple independent sources including one HUD-multifamily-program-adjacent calculator):** a **BER below ~85% is a commonly cited lender safety threshold**, with **60–80% described as the normal range** in ordinary practice. AssetVerdict's own orange→red cutoff sits at **90%**, i.e. slightly more lenient than the commonly-cited 85% cliff. This is a real, evidence-backed gap worth flagging for recalibration (tightening 90 → something closer to 85) — **not changed here**, added to §W.

**DSCR/Break-Even correlation — resolved with an exact formula, not a guess.** Read together, `calcDSCR` and `calcBreakEvenRatio`:
```
DSCR         = NOI / AnnualDebtService                          where NOI = GrossRevenue − OperatingExpenses[excl. debt service]
BreakEven%   = (OperatingExpenses[incl. provisions] + DebtService) / GrossRevenue × 100
```
DSCR nets operating expenses out of revenue *before* comparing to debt service; Break-Even folds operating expenses and debt service into one combined numerator against gross revenue directly. **These are genuinely independent facts, not double-counting the same risk.** A concrete counter-example proves it: a low-leverage deal with small debt service but very high operating costs relative to revenue can show an excellent DSCR (NOI comfortably exceeds the small debt service) while still showing a fragile Break-Even Ratio (high opex pushes the combined obligation close to gross revenue) — Break-Even catches an operating-cost-driven fragility that DSCR, by construction, cannot see, because DSCR never looks at revenue directly, only NOI vs. debt service. **§35's question is answered: keep both as independent PRIMARY safety signals — this is not "one weakness confirmed twice."** The nuance that does need explicit handling is *when they move together* (§M's Safety Interaction Matrix), not whether they should exist independently.

---

## G. OER evidence

**Strongest, most specific piece of evidence found in this entire phase.** SAPOA's Operating Costs Report, compiled by MSCI South Africa, is a genuinely authoritative, South-Africa-specific, institutional, quantified benchmark: based on **1,837 properties across 23 portfolios — 56% of professionally managed investment property in South Africa, R378.9bn in capital value.** Its "total gross operating cost-to-income ratio" (the SAPOA/MSCI equivalent of AssetVerdict's OER) has run: **~39% (mid-2021) → 43.1% (end 2023) → ~43% record high (Dec 2024) → 42.8% (June 2025).**

**This is decision-relevant, not just descriptive.** AssetVerdict's current commercial OER band is **green ≤40%, orange ≤60%, red >60%**. The actual South African commercial market average has been running **above** AssetVerdict's own "green" cutoff for several years straight (42.8–43.1% vs. a 40% green threshold) — meaning a commercial property performing exactly at the current national market average would read as **Caution**, not **Strong**, under today's bands. That may be an intentional design choice (only above-average efficiency should read green) or it may mean the green cutoff is set unrealistically tight relative to observed market central tendency. **Not resolved or changed here** — this is squarely a calibration decision for the owner, but it is now backed by real, specific, high-confidence evidence rather than the "internal, undocumented" status quo. Recommend `evidenceLevel` be reconsidered from `internal` toward `strong` for **commercial OER specifically** once the owner reviews this benchmark (§X Decision), and recommend this be the **first item pulled off the research backlog into an actual calibration exercise** in Phase 4.14, since the evidence already exists — it just hasn't been acted on.

**Strategy-specific bands (BTL 45/65, Multi-Let 50/70, Student 55/75, STR 50/70):** no equivalent authoritative source was found — SAPOA covers professionally-managed commercial portfolios, not small residential BTL/multi-let/student/STR units, and no comparable residential-sector index surfaced in this research pass. These remain internal, unevidenced estimates exactly as Phase 4.12 found them. **Confirmed still on the research backlog (§W)** — the progressive loosening from BTL through Student (45/65 → 55/75) is a directionally sensible guess (more operationally intensive strategies plausibly run higher cost ratios) but is not evidence-backed.

**Role (§12):** operating inefficiency is a cost-structure fact, not inherently a solvency fact — a high-OER deal can still have strong DSCR and Break-Even if leverage/debt service is low. No evidence found supports OER independently triggering High Risk. **Recommend: PRIMARY within Operating Quality, can block Strong, cannot independently trigger High Risk** (matches the brief's own hint at §37).

---

## H. Utilities Ratio evidence

No new external evidence changes Phase 4.12's own finding: the calculation is **gross utility cost as a % of gross revenue**, with no reconciliation against tenant recoveries — meaning the same computed ratio can represent very different real landlord exposure depending on lease/billing structure. A single band is applied identically across every strategy despite plainly different utility-inclusion norms between, e.g., STR (utilities near-universally landlord-absorbed, priced into the nightly rate) and long-let BTL (utilities typically tenant-metered/-paid directly, minimal landlord exposure). This is a **calculation-level modeling gap, not merely a threshold-calibration gap** — better numeric bands would not fix the fact that the ratio itself doesn't distinguish gross cost from net exposure.

**Recommendation revised from Phase 4.12's "supporting, low weight" to UNCALIBRATED** (this phase's own authority vocabulary, §4) — "potentially important but must not influence verdict until evidence/model work is completed" is a more accurate description than "supporting" for a metric whose underlying formula, not just its threshold, needs work before it can be trusted with any verdict weight.

---

## I. Cap Rate PP / Gross Yield evidence

No SA-specific cap-rate-by-strategy benchmark data was located in this research pass (this would most plausibly live inside the same SAPOA/MSCI dataset used for OER, but pulling and interpreting cap-rate-specific figures from it was not attempted here — flagged as a discrete future research task, §W, not fabricated).

**Architectural finding, independent of numeric evidence:** Cap Rate PP is currently **not** strategy-differentiated anywhere in `thresholds.ts` (single 8–12/5–13 sweet-spot band for every rental strategy), even though its close cousin Gross Yield *is* strategy-tuned per strategy. This asymmetry (one acquisition-yield metric gets strategy nuance, the near-identical other doesn't) is worth flagging as an internal inconsistency for a future calibration pass — not evidence of a wrong number, just an unexplained gap in how much care was given to sibling metrics.

**Role (§14):** the phase brief's own reasoning is sound and requires no new evidence to confirm: cap rate reflects a market's collective pricing of risk/growth/location, not investment quality in isolation — a low cap rate can be a *correct* price for a low-risk, high-growth asset, and a high cap rate can correctly price a genuinely riskier one. **Recommend: Cap Rate PP determines the Property Performance category state only — PRIMARY within that category, but structurally barred from influencing Safety, Target, or High Risk.** This requires no code change; it is already consistent with Phase 4.12's own precedence rules (§O of that report), which never route Property Performance into High Risk — this phase simply makes that authority ceiling explicit and confirms it against evidence rather than leaving it implicit.

**Gross Yield:** confirmed **SUPPORTING**, unchanged from Phase 4.12 — it ignores operating expenses and financing entirely (already caveated in the app's own education copy), and Cap Rate PP already captures the same acquisition-yield economics with expenses netted out. No new evidence overturns this.

**Cap Rate Spread:** this phase applies a stricter authority vocabulary than Phase 4.12's "supporting/contextual." Because its value is structurally dependent on a user-typed, unverified market cap rate assumption, **downgrade to CONTEXT ONLY** — it should never carry verdict weight, even minor, until AssetVerdict has a verified market-cap-rate data source (the same provenance problem already benching Cap Rate MV).

---

## J. Investor-target metrics

Per §7's own instruction, no "what's a good IRR" research was performed — only coherence of the target-relative *logic* was audited.

**IRR "Near Target" band — coherence problem found.** The current caution margin is a flat **±2 percentage points**, applied identically regardless of the investor's own required return. Because `discountRate` legitimately ranges from very low to very aggressive in this product (Phase 4.12's own test cases went from 2% to 40%), a flat 2pp band means wildly different things in relative terms: for a 40% hurdle, 2pp is a ~5% relative buffer; for a 5% hurdle, 2pp is a ~40% relative buffer. **This is not scale-consistent**, and the phase brief is right not to want it preserved "merely because it already exists." Of the three options offered (§17): a relative-percentage buffer (B) is more scale-consistent in principle, but no evidence was found calibrating what relative percentage would itself be defensible — inventing one now would repeat exactly the mistake being audited against. **Recommendation: this is an explicit, unresolved owner decision (not silently resolved here) — retain the existing 3-state Exceeds/Near/Below classification architecture for the verdict's Target category (reuse, don't rebuild), but flag the underlying 2pp figure as provisional pending either (a) a defensible relative-percentage replacement, or (b) collapsing to a simple met/missed binary (Option C) if no defensible relative figure can be found.** Not changed in this phase.

**NPV ±5%-of-equity tolerance — confirmed as low-stakes to resolve now.** Because IRR and NPV are near-mathematically-redundant for AssetVerdict's conventional single-outflow-then-positive cashflow shape (established in Phase 4.12 §F: NPV > 0 ⟺ IRR > discountRate for that shape), and because this phase demotes NPV to **SUPPORTING/confirmatory** rather than co-primary (§54), **its own tolerance figure does not need independent defensible calibration to be usable for verdict purposes** — it contributes context/magnitude, never an independent category-determining vote. §18's own suggested conclusion is confirmed by this reasoning, not merely asserted.

**Cash-on-Cash Post-Tax vs. Required Return — conceptual mismatch confirmed, role capped accordingly.** `discountRate` is used elsewhere (IRR/NPV) as a whole-of-life hurdle across the full hold period including terminal value; CoC Post-Tax is a single Year-1 cash-yield snapshot. Comparing a one-year number against a hurdle that embeds expectations about years 2 through exit is conceptually imperfect — real, but a difference of degree, not a disqualifying flaw, since it's still measuring "does the cash I get this year clear my hurdle rate." **Recommend: SUPPORTING only, never promoted to co-equal PRIMARY with IRR** — this avoids exactly the "three related target metrics, three votes" problem §19 warns against; only IRR is PRIMARY, NPV and CoC Post-Tax are both confirmatory/supporting and must never be independently counted alongside it.

**Cash-on-Cash Pre-Tax:** confirmed **CONTEXT ONLY**, matching Phase 4.12 — comparing a pre-tax number against a hurdle that's implicitly after-tax (per the code's own rationale text) is the "less conceptually clean" of the two CoC comparisons; no new evidence changes this.

---

## K. Cashflow — verdict role (definitively resolved, not just discussed)

**This question can be answered with an exact formula proof from the code itself, not intuition.** Read `calcCashflowAnnual` (`index.ts:606-619`) alongside `calcBreakEvenRatio`/`calcOperatingExpensesAnnual`/`calcOperatingCostsMonthly` (`index.ts:670-689`, `542-563`) line by line:

```
Pre-Tax Annual Cashflow
  = GrossRevenue − OperatingCosts.total×12 − Provisions.total×12
  = GrossRevenue − (Finance + Utilities + RatesInsuranceOther)×12 − Provisions.total×12
                     ^^^^^^ = AnnualDebtService, confirmed identical to the term
                              BreakEvenRatio also uses (both call calcTotalFinanceCostMonthly)

Break-Even Ratio (as a fraction)
  = (OperatingExpensesAnnual[Utilities+RatesInsuranceOther+Provisions] + AnnualDebtService) / GrossRevenue
```

Substituting, **Pre-Tax Annual Cashflow = GrossRevenue × (1 − BreakEvenRatio/100), exactly, always** — the two subtracted totals are built from identical component functions (`calcOperatingCostsMonthly`, `calcProvisionsMonthly`, `calcTotalFinanceCostMonthly`), not merely correlated approximations. **Negative Pre-Tax Annual Cashflow and Break-Even Ratio > 100% are the same fact, expressed in two different units (Rand vs. %), with mathematical certainty.**

This directly answers §20–22:
- **Which cashflow?** Pre-Tax Annual (`cashflowAnnualPreTax` — already exists on `DealMetrics`). Monthly and annual are the same information at different granularity; annual matches the compounding cadence of every other safety metric (DSCR, Break-Even) and avoids single-month noise (relevant for STR seasonality).
- **Post-Tax vs. Pre-Tax:** confirmed **Pre-Tax is the structurally correct choice** (§23) — Post-Tax additionally subtracts a term driven by the user-entered, entity-agnostic `incomeTaxRate`, which would inject a personal/company-structure assumption into what should be a property-level structural safety fact, and which also breaks the clean algebraic identity above (Post-Tax cashflow can go negative purely from a high personal tax-rate assumption even when the property itself, pre-tax, is in perfectly healthy Break-Even territory).
- **Does it add independent safety information?** **No — not new information, but a legitimate severity refinement of already-monitored Break-Even Ratio.** AssetVerdict's current Break-Even red cutoff is >90%, but cashflow only actually turns negative at exactly >100% — meaning a deal already reading "Weak" on Break-Even (91–100%) can still have *positive* cashflow, while only the more severe >100% subset is genuinely out-of-pocket. Pre-Tax negative cashflow is therefore useful as a **severity escalator within an already-Weak Break-Even reading**, never as an independent second vote.

**Recommended authority: MODIFIER, not PRIMARY, not BLOCKER independently.** Specifically: within the Safety category, if Break-Even Ratio is already Weak *and* Pre-Tax Annual Cashflow is confirmed negative (i.e. BER genuinely exceeds 100%, not just the 90–100% band), this may be surfaced as a distinct, higher-severity reason ("this deal is currently cashflow-negative, not just below the comfort threshold") — but it must never be counted as a second, independent piece of evidence toward a High Risk determination, since doing so would double-count the identical underlying fact this proof just established.

---

## L. Double-counting conclusions

Updated from Phase 4.12 with this phase's new evidence:

| Pair | Relationship | Verdict |
|---|---|---|
| Pre-Tax Annual Cashflow ↔ Break-Even Ratio | **Exact algebraic identity** (§K) — not correlation, identity | Cashflow is a MODIFIER/severity-escalator of Break-Even only, never independently counted |
| DSCR ↔ Break-Even Ratio | Related (both driven by revenue/opex/debt-service) but formally independent — proven by counter-example (§F) | **Not** double-counting; both remain independent PRIMARY gates, but their *compounding* needs a correlation-aware rule (§M), not simple addition |
| Equity IRR ↔ Equity NPV | Near-total mathematical overlap for AssetVerdict's conventional cashflow shape (confirmed Phase 4.12) | NPV stays SUPPORTING/confirmatory only |
| Cash-on-Cash Pre-Tax ↔ Post-Tax | Same underlying Year-1 figure, tax-treatment variant | Only Post-Tax counts (SUPPORTING); Pre-Tax is CONTEXT ONLY |
| Cap Rate PP ↔ Gross Yield | Share acquisition-yield economics; Gross Yield ignores expenses | Cap Rate PP PRIMARY (Property Performance only), Gross Yield SUPPORTING |
| Utilities Ratio ↔ OER | Utilities is very likely a subset component already inside OER's opex total (confirmed by formula: `calcOperatingExpensesAnnual` includes `utilities` directly, `index.ts:670-676`) | Utilities Ratio UNCALIBRATED, never independently moves verdict — it's diagnostic of *why* OER moved, not new information |

---

## M. Safety interaction model (required output §51)

**DSCR + Break-Even + LTV interaction matrix** (conceptual states, not numeric):

| DSCR | Break-Even | LTV | Recommended Safety state | Why |
|---|---|---|---|---|
| Strong | Strong | High leverage | **Acceptable (capped below Strong)** | Both independent primary gates clear; LTV alone never manufactures High Risk (§E), but high leverage is real enough structural exposure to deny the top tier |
| Weak | Strong | Low leverage | **Weak** | DSCR is an independent PRIMARY gate — low leverage doesn't rescue a proven coverage failure (§E, §12 Case) |
| Caution | Caution | Moderate leverage | **Weak** (compounding) | Two correlated moderate warnings on the *same* underlying income-vs-obligations question reinforce each other into one confirmed weak reading — but see the correlation caveat below |
| Strong | Caution | High leverage | **Weak** | Break-Even catches an opex-driven fragility DSCR structurally cannot see (§F); this is genuinely new evidence, not noise, so it isn't overridden by DSCR alone reading well |
| N/A (no debt) | Strong | 0 (structurally) | **Strong-eligible** | See §N/§O — a cash purchase must not be penalised for DSCR being legitimately not_applicable |

**Correlation caveat (§34–36), stated precisely:** DSCR and Break-Even Ratio share drivers (revenue, opex, debt service) even though they are not identical (§F). When *both* read Caution together, the honest interpretation is closer to "one underlying income-resilience concern, confirmed from two angles" than "two independent pieces of bad news" — the recommended treatment is that this combination escalates severity **once** (Caution+Caution → Weak), not that it should be treated as somehow worse than a single Weak reading from either metric alone. This resolves §34's "do not implement without evidence" caution: the evidence (the formula relationship in §F) supports the compounding rule existing, but supports it producing **Weak**, not a distinct "worse than Weak" tier that was never defined and has no evidentiary basis.

**LTV as amplifier — the three test cases from §36, resolved:**
- Case A (DSCR strong, Break-Even strong, LTV high) → **caps Strong, does not trigger High Risk.** No evidence supports LTV alone as a coverage-failure signal (§E).
- Case B (DSCR weak, Break-Even weak, LTV low) → **High Risk.** Low leverage cannot rescue two independent primary-gate failures.
- Case C (DSCR caution, Break-Even acceptable, LTV high) → **Weak/High Risk-leaning**, i.e. LTV amplifies a borderline DSCR reading into a more severe one, consistent with "amplifier" rather than "independent trigger."

---

## N. N/A / Unclassified / Missing behaviour (required output §52)

This phase's own §29–31 correctly identifies a real gap in Phase 4.12's pseudocode: it did not clearly separate **not_applicable** from **missing** from **unclassified**, and risked letting "DSCR = N/A on a cash purchase" read the same as "safety unknown, block Strong." That must not happen.

| Metric state | Meaning | Verdict effect | Strong effect | High Risk effect |
|---|---|---|---|---|
| `classified`, strong/green | Active judgement, favourable | Positive evidence toward its category | Contributes toward clearing Strong | Never |
| `classified`, caution/orange | Active judgement, borderline | Contributes to compounding rules (§M) | Blocks Strong on its own | Only via compounding (§M), never alone |
| `classified`, weak/red | Active judgement, unfavourable | Independent PRIMARY-tier gates (DSCR, Break-Even) can trigger High Risk alone | Blocks Strong | Yes, if the metric is BLOCKER-tier (§T) |
| `unclassified` (calculable, no defensible band — e.g. Flip ROI) | AssetVerdict deliberately has no judgement | Zero weight, zero colour | **May** block Strong if the metric is a PRIMARY/BLOCKER-tier one for that category (§43 of Phase 4.12) | **Never** — absence of a rule is not evidence of danger |
| `not_applicable` (structurally doesn't apply — e.g. DSCR with no debt) | The question doesn't exist for this deal | **Removed entirely from required evidence for that category** — not counted as missing, not counted as unknown | **Does not block Strong**, provided the category has other sufficient applicable primary evidence (§30–31) | Never |
| `missing` (underlying input absent, calculation itself can't run) | Evidence gap, not a deliberate design choice | Category state = unknown | Blocks Strong (safety must be provable, not assumed) | **Never** — missing evidence is not proof of danger |

The critical distinction the pseudocode must encode explicitly (not left implicit, as Phase 4.12's draft left it): **`not_applicable` metrics are subtracted from the set of evidence a category needs before Strong is evaluated; `unclassified`/`missing` metrics remain part of that required set but can't be satisfied, which is what blocks Strong.** A cash-purchase deal's Safety category should be evaluated only on Break-Even Ratio and (structurally-zero) LTV — DSCR is removed from consideration entirely, not held against it as "unproven."

---

## O. Cash-purchase / debt-free safety model (required output §30–31)

Explicit test, per §30: no debt, DSCR = not_applicable, LTV = structurally 0, Break-Even Ratio remains fully meaningful (it doesn't require debt to compute — with `AnnualDebtService = 0`, Break-Even collapses to `OperatingExpensesAnnual / GrossRevenue`, a perfectly real operating-margin fact).

**A debt-free deal can reach Strong.** With DSCR removed from required evidence (§N) and LTV structurally at its best possible reading (0% — no leverage risk at all, nothing to amplify), the remaining required Safety evidence is Break-Even Ratio alone. If Break-Even reads Strong and every other category clears, Strong is achievable. **This confirms §30's own expected answer ("potentially yes") and is the concrete worked case that proves the not_applicable-vs-unclassified distinction in §N is not just a theoretical nicety — it changes a real verdict outcome.**

---

## P. Rental strategy calibration matrix

| Strategy | Primary metrics | Modifiers | Context/Uncalibrated | Missing truth |
|---|---|---|---|---|
| Commercial | DSCR, Break-Even, OER, Cap Rate PP, IRR | LTV, Pre-Tax Cashflow, Gross Yield, CoC Post-Tax | Utilities Ratio (uncalibrated), Cap Rate MV, Cap Rate Spread, CoC Pre-Tax, Payback | None structural — OER now has strong SA-specific benchmark evidence (§G) ready for a future calibration pass |
| Buy-to-Let | DSCR, Break-Even, OER, Cap Rate PP, IRR | LTV, Pre-Tax Cashflow, Gross Yield, CoC Post-Tax | Same as Commercial | LTV band evidence suggests current 60/75 band is measurably too strict for this strategy specifically (§E) |
| Multi-Let | Same shape as Commercial | Same | Same | Same LTV caveat as BTL |
| Student | Same shape as Commercial | Same | Same | OER band (55/75) has no SA-specific evidence — internal estimate only |
| STR | Same shape as Commercial | Same | Same | OER band (50/70) unevidenced; Utilities Ratio especially unreliable for this strategy given SA STR utility-inclusion norms almost certainly differ sharply from long-let |
| Instalment Sale | **See §Q — recommend withheld, not merely "same as Commercial"** | — | — | `instalmentRate`/`instalmentTerm` unused; every "primary" metric above is computed on a revenue figure the engine treats as ordinary rent, not a seller-financing receivable |

---

## Q. Instalment Sale verdict readiness — **NOT READY**

Not merely "insufficiently evidenced" — this is a modeling-completeness problem, not a threshold-calibration problem, and the phase brief's own §28 warning ("do not silently accept the current strategy merely because metrics calculate") applies directly.

The engine currently computes every rental-strategy metric (DSCR, Break-Even, OER, Cap Rate PP, IRR, etc.) for Instalment Sale by feeding `instalmentAmount` into the exact same pipeline as ordinary monthly rent. That produces numbers that *calculate cleanly* but do not represent what an instalment sale actually is: a seller-financing arrangement carrying its own credit/default risk on the buyer, priced (in principle) via `instalmentRate` and `instalmentTerm` — both of which are captured on input and **used by no calculation anywhere in the engine** (confirmed in Phase 4.12's audit and re-confirmed here; no calculation change was found in this phase's re-reading of `index.ts`). The presence of these unused fields suggests the product intended a real seller-financing model that was never finished, not a deliberate simplification decision — that ambiguity itself argues for caution rather than treating the current rental-shaped numbers as trustworthy.

**Classification: NOT READY.** Every metric currently computed for this strategy is standing in for a financial instrument the engine doesn't actually model (credit/default risk on the instalment buyer, the true economics of the receivable). Verdicting on it today would give a false sense of the deal being understood as well as, say, a Buy-to-Let deal is. **Recommend withholding verdicts for Instalment Sale until either (a) the seller-financing model is completed using the already-captured `instalmentRate`/`instalmentTerm` fields, or (b) the owner makes an explicit, disclosed decision to treat it as a rental-framework deal with a clear limitation notice** (Decision 4, §X).

---

## R. Fix & Flip verdict readiness — **NOT READY** (confirmed, as expected)

Confirmed by direct re-inspection: `FIX_AND_FLIP_DEFINITIONS` contains exactly three entries (ROI, Annualised ROI, Net Profit), all `unclassified`; Profit Margin has no entry at all; no Safety-equivalent category exists in any form. Zero verdict-eligible metrics in any category — unchanged from Phase 4.12's finding, no new evidence located in this phase overturns it (none was sought, per this phase's own instruction not to retrofit rental logic onto Flip).

**What must exist before Flip can be verdict-ready:**
1. A resolved target-model decision for ROI/Annualised ROI (§R below).
2. An execution-buffer/margin-safety framework distinct from rental DSCR/Break-Even logic (§R below).
3. An explicit Profit Margin threshold entry (even if `unclassified` with rationale, for UI/education consistency — a small, low-risk fix, not attempted in this phase since it touches `thresholds.ts`, which this phase's rules keep untouched).

---

## R. Flip calibration architecture (required output §58)

Two real options, evaluated against evidence gathered:

**A. Universal fixed bands** — rejected as the primary approach. No credible, deal-size/market/hold-period-invariant evidence was found (or plausibly exists) for a single "good pre-tax flip ROI %" figure; the phase brief itself warns against manufacturing one (§54 of Phase 4.12, reaffirmed here).

**B. Investor-target-relative** (compare Annualised Pre-Tax ROI against the investor's own `discountRate`) — directionally attractive (reuses the already-built, already-tested `target_relative` model), but the phase brief's own §25 flags a real problem this phase confirms: `discountRate` is used elsewhere against **after-tax** equity cashflows (IRR/NPV), while Flip's ROI is explicitly **pre-tax** (Phase 4.10's own deliberate redefinition). Comparing a pre-tax return directly against a hurdle calibrated for after-tax comparisons is the same tax-basis mismatch already flagged for Cash-on-Cash Pre-Tax (§J) — real, not cosmetic, since tax rates on flip profit (which SARS may treat as revenue income rather than capital gain depending on intent/frequency — a distinction the app's own Deal Coach prompt already flags to users, per Phase 4.12's audit) can be substantial.

**C. Execution-buffer / margin framework** — evidence found (§ below) supports this as a genuinely different, complementary dimension, not a replacement for B.

**Recommendation: Hybrid — B for the target/return dimension (with the tax-basis mismatch explicitly flagged and unresolved, an owner decision, §X Decision 5) + C for a Flip-specific safety-equivalent dimension.**

**Execution-buffer evidence (§27):** the widely-known US house-flipping "70% rule" (`Max Offer = ARV × 0.70 − Repair Costs`) is built around baking in an explicit **~30% margin buffer** to absorb agent fees, closing costs, holding costs, financing interest, and profit — explicitly *not* SA-specific and explicitly a rule-of-thumb rather than an empirical study, but directionally useful as evidence that flip risk is conventionally managed via a **margin/buffer against total cost**, not an income-coverage ratio the way rental safety is. A deterministic AssetVerdict-native version — `(Expected Sale Price − Total Project Cost) / Expected Sale Price` or `/ Total Project Cost` — is fully computable today from existing `FlipMetrics` fields (`calcFlipProfit`, `index.ts:741`) without new inputs, and would give Flip a genuine safety-equivalent signal distinct from its return metrics. **Not implemented in this phase** — flagged as the concrete starting point for Phase 4.14's Flip work.

---

## S. Negotiation financing semantics (required output §59 — owner decision only, not built)

Two coherent models, as the brief frames them:

**Model A — loan amount fixed.** Mathematically breaks down for typical negotiation scenarios: if purchase price decreases while the loan Rand-amount stays fixed, deposit shrinks and LTV *increases* — the opposite of what "successfully negotiating a lower price" should intuitively do to leverage, and it can produce an impossible negative deposit if the fixed loan exceeds the new price. Not recommended as the default.

**Model B — original LTV fixed**, loan amount and deposit both scale proportionally with the negotiated price, debt service changes accordingly. This mirrors how real financing actually responds to a price change (lenders generally underwrite to a target LTV/affordability against the agreed price, not to a Rand figure fixed independently of it), and produces internally consistent results — DSCR, Break-Even, and IRR all recompute coherently as price moves.

**Recommendation: Model B as the default deterministic assumption**, with **Model C (explicit user-chosen financing-response mode) as a worthwhile future refinement** once the core solver exists, since some investors genuinely do have a fixed pre-approved bond amount that won't scale with price. **This is an owner decision to ratify, not something this phase builds** — recorded for Phase 4.14/whenever the negotiation solver is actually scoped.

---

## T. Calibration authority matrix (required output §49)

| Metric | Final verdict role | Can block Strong? | Can trigger High Risk? | Can modify a category? | Context only? |
|---|---|---|---|---|---|
| DSCR | **BLOCKER** (Safety) | Yes | Yes, alone | — | No |
| Break-Even Ratio | **BLOCKER** (Safety) | Yes | Yes, alone | — | No |
| LTV | **MODIFIER** (Safety) | Yes (caps Strong under high leverage) | Only via compounding, never alone | Yes — amplifies DSCR/Break-Even severity | No |
| Pre-Tax Annual Cashflow | **MODIFIER** (Safety) | No independent block (redundant with Break-Even, §K) | Only as a severity-escalator of an already-Weak Break-Even reading, never alone | Yes | No |
| OER | **PRIMARY** (Operating Quality) | Yes | No | — | No |
| Utilities Ratio | **UNCALIBRATED** | No | No | No | Effectively yes, until model repair |
| NOI Margin | CONTEXT ONLY (by design, Phase 4.12) | No | No | No | Yes |
| Cap Rate PP | **PRIMARY** (Property Performance only) | No (Property Performance never gates Strong/High Risk directly — only Safety/Target do, per Phase 4.12 precedence) | No | Determines Property Performance category state | No |
| Gross Yield | **MODIFIER** (Property Performance) | No | No | Yes, minor | No |
| Cap Rate MV | CONTEXT ONLY (by design, Phase 4.12) | No | No | No | Yes |
| Cap Rate Spread | **CONTEXT ONLY** (downgraded this phase) | No | No | No | Yes |
| Equity IRR | **PRIMARY** (Investor Target) | Yes (Target category) | No | — | No |
| Equity NPV | **MODIFIER** (Investor Target, confirmatory) | No independently | No | Yes, minor | No |
| Cash-on-Cash Post-Tax | **MODIFIER** (Investor Target) | No independently | No | Yes, minor | No |
| Cash-on-Cash Pre-Tax | CONTEXT ONLY | No | No | No | Yes |
| Payback Period | CONTEXT ONLY (by design, Phase 4.12) | No | No | No | Yes |
| Flip ROI / Annualised ROI | **UNCALIBRATED** | Yes (blocks Flip verdict entirely today) | No | No | Effectively yes, until §R resolved |
| Flip Profit Margin | **UNCALIBRATED** (no threshold entry exists) | Same | No | No | Same |
| Flip Net Profit | CONTEXT ONLY (by design, Phase 4.10) | No | No | No | Yes |

---

## U. Threshold evidence matrix (required output §50)

| Metric | Current threshold | Current confidence | Evidence found this phase | Recommended confidence | Keep / Change / Remove from verdict |
|---|---|---|---|---|---|
| DSCR (commercial) | 1.25 / 1.00 | moderate | General international convention converges 1.20–1.25×; no SA-primary source; SA residential BTL lending doesn't use DSCR-style testing at all | internal (downgrade recommended, not applied) | **Keep** for verdict — resilience concept sound even without a named-lender source |
| DSCR (BTL/Multi-Let) | 1.20/1.30 vs 1.00 | internal | Same — directional risk-ordering (multi-let stricter) is plausible but unsourced | internal (unchanged) | **Keep** |
| LTV (all strategies) | 60/75 | internal | SA sources disagree (70–90% residential ceilings depending on lender; 60–80% commercial); single band evidenced as mismatched to both ends | internal (unchanged, evidence quality didn't improve, only specificity of the mismatch did) | **Keep as MODIFIER**, flag strategy-split for future calibration |
| Break-Even Ratio | 75/90 | internal | International convention converges ~85% as common cliff; AssetVerdict's 90 is slightly more lenient | internal (unchanged) | **Keep**, flag 90→~85 tightening for future calibration |
| OER (commercial) | 40/60 | internal | **Strong, SA-specific, institutional (SAPOA/MSCI) benchmark found: ~39-43% market average** | **strong** (recommend upgrading — not applied this phase) | **Keep**, but this is now the single highest-priority item to actually recalibrate in Phase 4.14 |
| OER (BTL/Multi-Let/Student/STR) | 45/65, 50/70, 55/75, 50/70 | internal | No SA-specific residential/STR/student equivalent found | internal (unchanged) | **Keep**, remains on research backlog |
| Utilities Ratio | 15/30 (all strategies) | internal | Confirmed calculation-level flaw (gross cost, no recoveries reconciliation), not just threshold gap | internal (unchanged) | **Remove primary verdict weight — UNCALIBRATED** |
| Cap Rate PP | 8–12/5–13 (all strategies) | internal | No SA-specific evidence found this phase; architectural inconsistency noted (unlike Gross Yield, not strategy-tuned) | internal (unchanged) | **Keep**, confined to Property Performance category only |
| Cap Rate Spread | 2/0 | internal | Structurally assumption-dependent (unverified user-typed market cap rate) | internal (unchanged) | **Remove from verdict — CONTEXT ONLY** |
| IRR near-target margin | ±2pp | provisional | Coherence problem found: not scale-consistent across the product's full discountRate range | provisional (unchanged, flagged more specifically) | **Keep for now**, unresolved owner decision on relative-vs-absolute (§J) |
| NPV near-zero tolerance | ±5% of equity | provisional | Demoted to confirmatory-only role reduces the stakes of this figure | provisional (unchanged) | **Keep**, low-priority since NPV is SUPPORTING only |
| Flip ROI/Annualised ROI | none (unclassified) | none | Target-relative recommended in principle, but tax-basis mismatch against `discountRate` confirmed unresolved | none | **Remain unclassified** pending Phase 4.14 architecture decision |
| Flip Profit Margin | none (absent entirely) | none | Execution-buffer framing recommended (§R) | none | **Remain absent from verdict**, candidate for the new execution-buffer metric instead |

---

## V. Verdict-ready metric list (required output §61)

| Metric | Status |
|---|---|
| DSCR | **VERDICT-READY** (rental strategies except Instalment Sale) |
| Break-Even Ratio | **VERDICT-READY** (rental strategies except Instalment Sale) |
| LTV | **SUPPORTING-ONLY** (modifier, never independent) |
| Pre-Tax Annual Cashflow | **SUPPORTING-ONLY** (modifier of Break-Even, never independent) |
| OER | **VERDICT-READY** (commercial, strongest evidence; others still internal-only but usable at PRIMARY-within-category level, per Phase 4.12's existing bar of "internal is enough to classify, not enough to claim external authority") |
| Utilities Ratio | **CONTEXT-ONLY / effectively NOT-READY** for verdict weight |
| NOI Margin, Cap Rate MV, Payback, CoC Pre-Tax | **CONTEXT-ONLY** (by design, unchanged) |
| Cap Rate PP | **VERDICT-READY**, confined to Property Performance category |
| Gross Yield | **SUPPORTING-ONLY** |
| Cap Rate Spread | **CONTEXT-ONLY** (downgraded this phase) |
| Equity IRR | **VERDICT-READY** (Target category) |
| Equity NPV, CoC Post-Tax | **SUPPORTING-ONLY** |
| Flip ROI, Annualised ROI, Profit Margin, Net Profit | **NOT-READY** |
| Any Instalment Sale metric | **NOT-READY** (strategy-level block, §Q) |

---

## W. Remaining research backlog

| Metric | What's still unknown | Why it matters | Blocks implementation? |
|---|---|---|---|
| OER (commercial) | Not "unknown" anymore — evidence exists (§G); what's missing is an owner decision on how to act on it | Current green cutoff (≤40%) sits below the real SA market average (~43%) | Does not block a verdict engine shipping — current internal band is usable at PRIMARY level; blocks *confident* recalibration only |
| OER (BTL/Multi-Let/Student/STR) | No SA-specific residential/STR/student benchmark located | Strategy-specific bands are currently unevidenced guesses | No — usable as-is, flagged for future evidence |
| LTV strategy split | Evidence suggests commercial (~60-80%) and residential BTL (~70-90%, contested) norms genuinely differ; AssetVerdict uses one band for both | Current single band reads a normal, bank-approved BTL deal as "weak" | No — MODIFIER role tolerates imprecision better than a BLOCKER role would |
| Break-Even cutoff (90 vs ~85 convention) | International convention suggests tightening; no SA-specific confirmation | Marginal deals near the boundary could be classified differently | No |
| Cap Rate PP by strategy | No SA-specific cap-rate-by-strategy data pulled (SAPOA/MSCI dataset likely has it, not yet mined) | Currently one band for all strategies, inconsistent with Gross Yield's own strategy-tuning | No — confined to Property Performance only, lower stakes |
| Utilities Ratio | Calculation itself needs repair (gross cost vs. net exposure), not just a new number | Currently unusable for verdict at any confidence | Yes, blocks it from ever exceeding UNCALIBRATED until fixed |
| Flip target model | Tax-basis mismatch between pre-tax ROI and after-tax-calibrated `discountRate` unresolved | Blocks a coherent Flip Target category | **Yes, blocks Flip verdict entirely** |
| Flip execution-buffer metric | Not yet built; only the 70%-rule analogy exists as directional, non-SA evidence | Flip currently has no safety-equivalent category at all | **Yes, blocks Flip verdict entirely** |
| Instalment Sale seller-financing model | `instalmentRate`/`instalmentTerm` captured but unused; no credit-risk modeling exists | Every metric computed for this strategy stands in for something the engine doesn't actually model | **Yes, blocks Instalment Sale verdict entirely** |
| IRR near-target margin (2pp) | Not scale-consistent across the product's discountRate range; no defensible relative-% replacement found | Affects how "Near Target" is worded/weighted at extreme hurdle rates | No — architecture (3-state classification) survives either way |

---

## X. Owner decisions required

**Decision 1 — Break-Even authority.** Recommend **A: keep PRIMARY** (independent BLOCKER alongside DSCR). Evidence (§F) proves it captures a distinct opex-driven fragility DSCR structurally cannot see — not redundant.

**Decision 2 — LTV authority.** Recommend **B: Modifier / Strong-gate only.** No evidence found supports LTV independently triggering High Risk; every source treats it as a capital-structure fact, not a coverage/default test.

**Decision 3 — Cashflow role and definition.** Recommend **Pre-Tax Annual Cashflow, MODIFIER role, confined to escalating an already-Weak Break-Even reading.** This is not a judgement call — it follows from the exact algebraic identity proven in §K.

**Decision 4 — Instalment Sale.** Recommend **B: block verdict until the seller-finance model is repaired**, given the unused `instalmentRate`/`instalmentTerm` fields suggest an unfinished feature rather than a deliberate simplification, and every metric currently computed for this strategy stands in for an instrument the engine doesn't model. **A: allow with explicit limits** is a defensible fallback if the owner judges the rental-framework approximation acceptable for now — but that must be a conscious, disclosed choice, not a default.

**Decision 5 — Flip target model.** Recommend **C: Hybrid** — target-relative (B) for the return dimension once the pre-tax/after-tax basis mismatch against `discountRate` is explicitly resolved (a separate, still-open sub-decision), plus a new execution-buffer/margin metric (C) for the safety-equivalent dimension Flip currently lacks entirely. Universal fixed bands (A) are not recommended — no credible size/market-invariant evidence exists.

**Decision 6 — Negotiation financing semantics.** Recommend **B: keep original LTV fixed** as the default deterministic assumption for the (not-yet-built) negotiation solver, with an explicit user-choosable mode (C) as a future refinement. Model A (fixed loan amount) breaks down mathematically for ordinary price-reduction scenarios.

---

## Y. Verdict-engine implementation readiness

**READY WITH LIMITED METRIC SET.**

Not fully ready: Instalment Sale and Fix & Flip are both explicitly NOT-READY (§Q, §R) and must be excluded, not silently forced through rental logic. The negotiation solver remains unbuilt and its financing semantics undecided (§S) — `promising_if_negotiated` stays unreachable. Several thresholds remain internal-confidence estimates (§U).

Not blocked, however: for Commercial, Buy-to-Let, Multi-Let, Student, and STR, there is now a coherent, evidence-reviewed authority assignment for every category-driving metric (§T), a resolved and code-proven Cashflow role (§K), a resolved Safety-interaction/compounding model (§M), and a precise not_applicable/unclassified/missing distinction (§N) that specifically protects debt-free deals from being penalised for a legitimately absent DSCR (§O). This is enough to implement the Phase 4.12 pseudocode faithfully for those five strategies without inventing new judgement calls mid-implementation.

---

## Z. Recommended Phase 4.14 scope

1. Owner sign-off on Decisions 1–6 (§X).
2. Implement the deterministic verdict engine (Phase 4.12 §U/§V architecture) for Commercial, Buy-to-Let, Multi-Let, Student, and STR only — explicitly excluding Instalment Sale and Fix & Flip pending §Q/§R.
3. Build the Flip execution-buffer metric (§R) — it's computable today from existing `FlipMetrics` fields with no new inputs, and is the most concrete unblocked piece of Flip-readiness work.
4. Resolve the Flip pre-tax-ROI-vs-after-tax-discountRate basis mismatch (§R) as its own focused sub-decision before Flip's Target category can exist at all.
5. Scope the Instalment Sale seller-financing repair (§Q) as a discrete piece of work, not a verdict-engine side effect.
6. Only then: revisit the OER commercial recalibration opportunity flagged in §G — the evidence already exists; this is the one item on the backlog ready to become a real threshold change rather than more research.
7. Build the negotiation solver (Phase 4.12 §K) using the Model B financing semantics ratified in Decision 6, once the core engine (step 2) is stable enough to have something worth negotiating toward.

**Do not automatically start Phase 4.14.**

---

## Final quality check (§67)

- Does every metric with High-Risk authority have defensible evidence? **DSCR and Break-Even Ratio, the only two BLOCKER-tier metrics, both do** (§D, §F) — general international convention plus, for Break-Even, a formula-level proof they're independent. LTV explicitly does **not** have BLOCKER-tier evidence and does not get that authority (§E).
- Are DSCR and Break-Even being double-counted? **NO** — proven independent by counter-example (§F), with a specific correlation-aware compounding rule (§M) preventing them from being treated as two full independent votes when they move together.
- Can LTV alone create High Risk without evidence that it should? **NO** — confirmed MODIFIER only (§E, §T).
- Does N/A block Strong? **Only if the category has no other sufficient applicable primary evidence** — confirmed and worked through concretely for the debt-free case (§O), which the previous phase's pseudocode did not yet make explicit.
- Does unclassified mean Weak? **NO** — confirmed (§N); it can block Strong (when the unclassified metric is PRIMARY/BLOCKER-tier) but never manufactures a negative reading.
- Does missing evidence mean Weak? **NO** — same table, same distinction (§N).
- Is cashflow's verdict role formally defined? **YES** — and resolved with an exact formula proof, not a placeholder (§K).
- Is Instalment Sale genuinely modelled well enough to receive a verdict? **NO** — evidence-based answer, not a default assumption (§Q).
- Is Fix & Flip genuinely calibrated enough to receive a verdict? **NO** — confirmed, zero verdict-eligible metrics in any category (§R).
- Can Promising If Negotiated be built before financing semantics are defined? **NO** — and this phase adds the specific reason why not (Model A breaks down mathematically, §S), not just the abstract caution.
- Have the metrics earned the authority the future verdict engine will give them? Where evidence was found, yes, and the authority level now matches the evidence's actual strength rather than an assumed uniform confidence. Where evidence was searched for and not found (LTV strategy-split, residential OER, Flip bands), authority was deliberately kept modest rather than inflated to match the architecture's ambitions.

---

## Verification note

This phase's evidence claims are sourced as follows: DSCR/LTV/Break-Even international and South African findings from live web research conducted in this session (§D, §E, §F — sources cited inline by name; full URLs available on request but intentionally not embedded in financial-truth code per §46's own instruction); the OER benchmark from SAPOA's Operating Costs Report as compiled by MSCI South Africa (§G); the Cashflow↔Break-Even identity from direct line-by-line reading of `lib/calculations/index.ts` (§K, verifiable by anyone re-reading the same four functions); the Flip 70%-rule analogy from live web research, explicitly flagged as a non-SA rule of thumb, not an empirical study (§R). No source was averaged against a conflicting one to manufacture a false consensus; disagreements (e.g. SA residential LTV ceilings) are reported as disagreements (§E).

**No production code, thresholds, classifications, or schema were changed in this phase, apart from the pre-approved TypeScript test fix in §A.** Final baseline: 424/424 tests passing, `tsc --noEmit` clean, `eslint` 0 errors (1 pre-existing unrelated warning), `next build` succeeds.
