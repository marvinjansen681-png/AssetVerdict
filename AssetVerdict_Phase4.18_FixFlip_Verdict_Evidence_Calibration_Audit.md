# AssetVerdict — Phase 4.18: Fix & Flip Verdict Evidence & Calibration Audit

**Status: Audit / evidence-gathering only. No verdict engine implemented. No financial formulas, thresholds, rental verdict/negotiation logic, UI, PDF, or Deal Coach code changed. No schema changes. One new file — this report.**

Phase 4.17/4.17.1 closed the Fix & Flip financial truth model: one authoritative, internally-reconciled set of numbers, with no verdict and no negotiation opportunity attached. This phase asks the narrower question the brief poses directly: **which of those numbers have actually earned the right to drive a Strong / Promising / High Risk / Does Not Meet Target verdict, and what evidence supports it** — mirroring the Phase 4.13 exercise that preceded the rental verdict engine, but for a strategy with materially less external institutional data available.

---

## A. Baseline verification

```
npx vitest run     → 21 test files, 628/628 passing
npx tsc --noEmit   → clean, 0 errors
npx eslint .       → 0 errors, 1 pre-existing warning (app/layout.tsx:32, @next/next/no-page-custom-font, unrelated)
```
Re-run at the start of this phase, before any research. No failures, unrelated or otherwise. No code was touched during this phase, so this baseline is also the closing baseline (§AQ–AR).

---

## B. Current Flip metric-role audit

Every metric `FixFlipAnalysis` currently exposes, classified against the brief's own A–G role taxonomy (A = structural safety/loss prevention, B = investor target, C = execution resilience, D = project economics, E = financing exposure, F = context only, G = not suitable for verdict use):

| Metric | Role(s) | Reasoning |
|---|---|---|
| Estimated Profit Before Tax | **A** (sign only) + F (Rand magnitude) | The sign is a structural fact (§G). The Rand amount is deal-size-dependent and unsuitable for a universal band (§8, confirmed). |
| Project Profit Before Financing & Tax | D | Unlevered project quality, diagnostic only — isolates financing's effect from the property's own economics. |
| Pre-Tax Project ROI | D | Leverage-independent project quality. Secondary/supporting, not primary (§H). |
| Pre-Tax Equity ROI | D | Life-of-project return on total equity contributed (not just Month-0 equity) — supporting, superseded by Equity IRR as the timing-aware primary. |
| Annualised Pre-Tax ROI | D | Unlevered, duration-adjusted. Supporting cross-check against Equity IRR, not a second primary (§J, §Z). |
| Equity IRR | **B** | Primary investor-target candidate, compared against Required Return (§I). |
| Pre-Tax Profit Margin | C | Execution-resilience framing — proven near-duplicate of Sale-Price Buffer, not independent (§K, §N). |
| Break-Even Sale Price | **G** | A Rand price target with no independent meaning; its only verdict value is as Buffer's input (§L). |
| Sale-Price Buffer % | **C** | The most execution-resilience-relevant Flip-specific metric AssetVerdict computes (§M). |
| Holding Period | F | Financial consequences already fully priced into holding cost, interest, and the IRR/ROI annualisation denominator (§O). |
| Total Loan / financing exposure | **E** | Needs a project-level (not purchase-price-level) leverage metric; not currently computed (§T). |
| Interest cost | D | Already fully absorbed into Estimated Profit Before Tax; not separately verdict-worthy. |
| Remaining balance at sale | F | Cashflow-timing mechanics, not a verdict signal on its own. |

---

## C. Research methodology

Live web research performed August 2026, in the priority order the brief specifies: South African primary/institutional sources first, then SA banks/lenders, SA property-industry bodies (SAPOA, Rode, TPN), SA valuation/data providers (Lightstone), SA accounting/tax authority (SARS), falling back to international institutional sources only where explicitly flagged as non-SA and directional. Each finding below is graded on source, date, geography, whether it supports an exact threshold or only a general principle, and confidence (strong/moderate/weak/none) — consolidated in the evidence table, §AJ. Real-estate-agency blog commentary was not excluded, since for Fix & Flip it is often the *only* SA-specific material available, but it is graded weak-to-moderate throughout, never treated as institutional data.

---

## D. South African evidence summary

**SARS — property disposal tax character (confirms, does not newly justify, the existing Pre-Tax boundary):** SARS's capital-vs-revenue distinction turns on intention at acquisition and disposal, assessed on the facts; a short holding period is evidence of trading intent but not conclusive on its own. Critically, the statutory "held > 3 years ⇒ deemed capital" safe harbour (Income Tax Act) is specific to **equity shares** — no equivalent deeming provision was found for fixed property. There is no SA-legislated holding period that makes a flip's tax character predictable. This *reinforces* Phase 4.10's decision (unchanged, untouched this phase) not to auto-apply CGT to Fix & Flip: no safe harbour exists to auto-apply it *against* either.

**Real-estate practitioner commentary (Harcourts, Pam Golding, RE/MAX) — weak-to-moderate, directional only, not institutional:**
- Richard Gray (CEO, Harcourts SA, Nov 2025): typical project size R2–3m; renovation budget commonly 15–20% of total project value; **"minimum 10% returns on total expenditure"**; explicit cost-overrun anecdote (a R100k budget "ballooning" to R250k).
- Carol Reynolds (Pam Golding, area principal, 2022): renovation ≈15% of property value; target *at least* 10% gain on total expenditure; sell within six months, "the quicker, the better, to reduce holding costs."
- Adrian Goslett (CEO, RE/MAX Southern Africa): "the profit is made at the time of purchase," not at sale; explicit market-ceiling caution (renovating a R5m-ceiling area property cannot manufacture a R7m sale); typical 3–6 month renovation/carry period.

These three independently converge on **10% minimum return on total expenditure** and a **3–6 month typical hold** — a real, repeated signal, but every source is an estate-agency executive's commentary/marketing content, not measured, audited, or peer-reviewed data. Treated as **directional evidence of industry practitioner consensus**, never as a defensible numeric threshold.

**ASAQS-adjacent construction contingency convention — moderate:** industry commentary consistent with Association of South African Quantity Surveyors practice describes **10–15% contingency** on construction/renovation budgets as standard (15% for first-time/inexperienced developers, 10% for experienced ones). Sourced via secondary industry commentary, not a directly-read ASAQS publication — graded moderate, not strong.

**Lightstone AVM — strong, primary, SA institutional:** Lightstone publishes an **Accuracy Score** (confidence the AVM is within 20% of true value) and a **Safety Score** (confidence it does not over-predict by more than 10%), both back-tested monthly against physical valuations and independently audited by Fitch and Moody's for mortgage-securitisation use — the only SA AVM approved by both. Current performance: roughly 85% of AVMs now predict "within range," with the majority of confidence scores landing in the 71–80% accuracy band when checked against physical valuations. This is the single strongest, most SA-specific, most institutionally-credible piece of evidence found in this audit, and it is directly relevant to §U–§V's exit-price-confidence question.

**SA bridging/short-term property finance market — strong on the fact that it's material, not on a specific cutoff:** bank-linked bridging runs roughly prime + 2–4% (currently ≈12–14% APR); specialised bridging-finance providers charge 3–6% *per month* (≈39–63% effective APR). This confirms a materially large share of real SA flip financing is **not** standard amortising principal-and-interest — reinforcing §25/§AI's finding that AssetVerdict's current financing-structure limitation needs prominent disclosure.

**SAPOA / Rode / TPN — no public benchmark found; stated plainly, per §4's instruction.** SAPOA's property-market research is member-only and commercial/institutional-property focused (offices, retail, industrial); no residential flip-economics content was found. Rode's indices similarly track commercial property yields and rentals. TPN's data is tenant-payment/credit-behaviour focused. None of the three publish anything usable as a residential Fix & Flip verdict threshold. **This absence is real, not a search failure** — these bodies' mandates simply don't cover this product.

---

## E. International evidence used

**US "70% rule" — origin and context (audited in full in §F).** Investor-education sites (BiggerPockets, Lima One, FlipperForce), a decades-old US informal convention, no institutional or regulatory backing found anywhere.

**ATTOM Q3 2025 U.S. Home Flipping Report — strong data, wrong metric and wrong geography for direct import.** Median gross flipping ROI 23.1%, median holding period 161 days (≈5.4 months), median gross profit $60,000. Critically, ATTOM's own definition: *"gross flipping ROI = gross flipping profit ÷ original purchase price,"* where gross profit is *"the difference between the purchase price and the flipped price"* — **renovation and other costs are explicitly excluded from both the numerator and the denominator.** This is a fundamentally cruder, different metric than AssetVerdict's `preTaxProjectROI` (profit *after all costs* ÷ *total project cost including renovation, holding, interest, and selling costs*). Importing ATTOM's "23%" as a benchmark for AssetVerdict's Project ROI would be a direct instance of the exact mistake §46 warns against.

**RICS professional valuation margin-of-error convention — moderate-to-strong, international, conceptually adjacent but not designed for this purpose.** UK case law and RICS guidance converge on an acceptable valuer-to-valuer margin of **±5%** for a residential property with good comparable evidence, up to **±15%** for a complex property or one with no comparables; courts treat anything beyond 15% as exceptional. This is a *professional-negligence tolerance*, not a designed investment safety margin, and it is UK case law, not SA — but it is the closest credible, sourced anchor found for "how much uncertainty is normal in a single property valuation," directly relevant to §M/§48.

**UK development finance LTC/LTGDV convention — directional only, and explicitly capped in authority by §51.** Development lenders size loans against both Loan-to-Cost and Loan-to-Gross-Development-Value, taking whichever is lower; development exit finance is commonly capped around 70–75% LTGDV. No SA-specific figures were found. Even if they had been, §51's principle applies without exception: a lender's ceiling describes the lender's risk appetite, not investment quality.

---

## F. 70% Rule audit

**Formula:** Maximum Allowable Offer = (ARV × 0.70) − Repair Costs.

**Origin:** a decades-old informal US real-estate-investor heuristic, propagated through investor-education content (BiggerPockets, FlipperForce, Lima One and similar). No government, regulatory, lending-institution, or academic origin was found. It is explicitly described by its own proponents as varying "investor to investor and market to market," with cash/licensed investors sometimes offering 75–80% instead.

**Compatibility with the SA model:** the 30% margin implicit in the "70%" figure is an undifferentiated bundle covering holding costs, US realtor commissions (typically 5–6%, higher than SA's typical Fix & Flip agent commission), financing cost, profit, and an error margin on both the ARV and repair estimates — all folded into one flat number, none of it calibrated to SA transfer duty, bond registration cost, SA agent commission conventions, SA renovation cost ratios, or SA financing rates.

**A notable finding:** several SA-facing blog sources (TJ Tribe, Sell My House Fast Cash) reproduce the identical "70% of ARV" figure for the South African market with no independent derivation shown — i.e., the same US heuristic appears to have been copied into SA content verbatim, rather than reconstructed from SA-specific costs. This is itself a small but real piece of evidence *against* treating the 70% figure as SA-validated: its reappearance in SA content looks like reproduction, not independent confirmation.

**Conclusion (matches the brief's expected posture exactly):** the 70% rule is **rejected** as a universal AssetVerdict verdict threshold. It may be referenced in future educational copy as a widely-known informal heuristic investors may have heard of, explicitly labelled as such — never as AssetVerdict truth, never as a computed gate.

---

## G. Estimated Profit authority

**Should `Estimated Profit Before Tax <= 0` be a structural High Risk candidate?** Yes — with **HIGH confidence**, but note precisely *what kind* of confidence this is: it is not an empirically-calibrated threshold like DSCR's 1.25×, it is a **definitional fact**. A Base-case-negative or Base-case-zero project is, under AssetVerdict's own stated assumptions, currently modelled as *not making money*. This requires no external benchmark to defend, in exactly the same way `checkStructuralSafetyFailure`'s `dscr < 1.0` and `breakEvenRatio > 100` checks in the rental engine require none — both are raw structural facts, not classified bands.

**Exactly zero:** treat `<= 0` as one bucket, not a separate "borderline" third state. A Base-case profit of exactly R0 carries *zero* margin against every estimation error this audit has documented elsewhere (renovation-cost uncertainty §P, valuation uncertainty §D/§E, financing-structure mismatch §D/§S) — it is not meaningfully safer than a small negative number, and treating it as a distinct "safe" tier would understate that risk.

**Absolute Rand magnitude:** confirmed **NO** universal Strong/Promising/Weak banding (§8). A R100,000 profit means something entirely different on a R500,000 flip than on a R5,000,000 one. Profit's only verdict authority is its **sign**; its Rand value remains context/explanation-only, exactly as Phase 4.10 already concluded for `unclassified` status.

---

## H. Project ROI authority

`Pre-Tax Project ROI` = Estimated Profit Before Tax ÷ Total Project Cost — genuinely leverage-independent (neither the loan amount nor the equity split appears in either term), so it answers a different question than Equity IRR: "is this project good on its own merits, stripped of how it was financed?" No credible fixed numeric benchmark was found: ATTOM's "23% ROI" is a different, cruder metric (§E) and the wrong geography; SA practitioner commentary only offers a vague, weak-confidence "minimum 10% on total expenditure" (§D). **Recommendation: SECONDARY/supporting role.** No numeric threshold. Its primary value is as a guardrail alongside Equity IRR (§I, §Y) — a project whose Project ROI is thin but whose Equity IRR looks large is exactly the leverage-amplification pattern §Y proves must not be allowed to pass unguarded.

---

## I. Equity IRR authority

**Recommendation: PRIMARY investor-target metric, compared against the user's own Required Return** — `equityIRR >= discountRate`. This exactly mirrors the rental engine's `deriveTargetState` (`irr >= discountRate`) and requires **no external numeric evidence at all**, because it is a comparison against a number the investor already supplies, not a claim about what return is universally "good" (§52 — return target ≠ market law). Confidence in the *rule* is HIGH; confidence in what the resulting number *means* is bounded by the short-hold distortion problem below — which is why Equity IRR cannot be given unguarded sole authority (§X, §Y).

---

## J. Annualised ROI authority

Now that Phase 4.17.1 has made it the correct compounding-equivalent figure, `Annualised Pre-Tax ROI` is unlevered where Equity IRR is levered — a genuinely different signal, not a duplicate. **Recommendation: SECONDARY/supporting.** Its main verdict value is diagnostic: comparing it against Equity IRR on the same deal exposes leverage amplification directly (a large gap between the two is itself informative, §Y) — it should not be given independent primary target authority alongside Equity IRR, which would double-count the same "return + duration" signal twice under two different leverage assumptions.

---

## K. Profit Margin authority

`Pre-Tax Profit Margin` = Estimated Profit Before Tax ÷ Projected Sale Price. This is **profit margin on sale value**, distinct by definition from **profit-on-cost** (Project ROI's denominator is cost, not price) and from **developer margin on GDV**, a large-scale-development underwriting concept not evidenced as applicable to small residential flips (§46's explicit warning against this exact substitution is directly on point — no evidence was imported from development-margin sources for this reason). §N proves algebraically that Profit Margin is a near-exact linear rescaling of Sale-Price Buffer (differing only by the constant `1 − commission%`) — it is not independent new information once Buffer exists. **Recommendation: supporting/context only**, useful as an alternate framing in explanatory copy, not a second independently-weighted verdict signal.

---

## L. Break-Even Sale Price role

Confirmed: a Rand price target with no independent meaning in isolation (a R1.35m break-even price says nothing without the R1.5m projected sale price to compare it against). **It should never be directly classified or thresholded.** Its entire verdict value is as the input to Sale-Price Buffer %. Role: context/explanatory only.

---

## M. Sale-Price Buffer role

`(Projected Sale Price − Break-Even Sale Price) ÷ Projected Sale Price × 100` — the closest thing Fix & Flip has to the rental engine's Break-Even Ratio: a downside-cushion / margin-of-safety concept, and the single most execution-resilience-relevant Flip-specific metric AssetVerdict currently computes.

Evidence found is **relevant but not threshold-grade**: RICS's ±5% (good comparables) to ±15% (complex/no comparables) valuation margin-of-error convention (§E) suggests a Buffer thinner than roughly 5–10% is arguably within the range of ordinary valuation disagreement on the exit-price assumption *alone* — before even considering renovation-cost or holding-cost estimation error stacked on top. This is genuinely useful **directional** evidence that a very thin buffer is fragile. It does **not** license an exact "Strong requires Buffer ≥ X%" cutoff: RICS's number describes valuer-to-valuer disagreement tolerance, not a designed investment safety margin, is UK case law rather than SA, and was never derived for flipping specifically. SA practitioner commentary's "10% minimum" (§D) measures a different thing (return on expenditure, closer to Project ROI) and is too weak/directional to anchor Buffer's threshold either.

**Conclusion:** Buffer's *role* (execution resilience, Strong-gate candidate) is well-supported. Its *exact numeric threshold* is **not yet defensible** — status: directional evidence only, no defensible exact threshold, exactly matching §15/§58's instruction not to invent 5/10/15% without evidence.

---

## N. Profit/Buffer redundancy — proved algebraically

This is derived directly from the live `fixFlip.ts` formulas (`estimatedProfitAtSalePrice`, `solveBreakEvenSalePrice`, and the `profitability`/`breakEven` block of `calcFixFlipAnalysis`), not approximated.

Let `P` = projected sale price, `c` = agentCommission/100, `F` = `breakEvenFixedCosts` (purchase + acquisition + renovation + holding + interest — everything except selling costs).

```
estimatedProfitBeforeTax(P) = P·(1 − c) − F                          [directly from the code]
breakEvenSalePrice (BE) solves: BE·(1 − c) − F = 0  ⟹  BE = F / (1 − c)
```

Substituting `F = BE·(1 − c)` into the profit formula:

```
profit(P) = P·(1 − c) − BE·(1 − c) = (1 − c)·(P − BE)
```

And since `bufferPercent = (P − BE)/P × 100 ⟹ (P − BE) = bufferPercent·P/100`:

```
profit(P) = (1 − c) × (bufferPercent/100) × P
```

**This is an exact identity, not an approximation, given the current selling-cost model** (a flat percentage of sale price, the only sale-price-dependent cost term). It proves `profit ≤ 0 ⟺ bufferPercent ≤ 0` **exactly**. Directly answers §17's question and the corresponding Final Quality Question: **no**, Sale-Price Buffer must not be given independent High Risk-triggering authority alongside Profit's sign — doing so would double-count the identical structural fact under two names.

**A further finding not explicitly asked for but directly relevant:** dividing through by `P`, `profitMargin = profit/P × 100 = (1 − c) × bufferPercent` — **Profit Margin is also an exact linear rescaling of Buffer**, differing only by the constant factor `(1 − commission%)`. At a typical 5% commission, Profit Margin ≈ 0.95 × Buffer — i.e. the two are numerically almost identical on any given deal. This confirms §13's instruction to be precise about definitions: as currently implemented, Profit Margin is *not* meaningfully distinct information from Buffer.

**Recommended architecture (confirms the brief's own §17 hypothesis):**
- **Profit sign** (binary: loss vs. not-loss) → the structural High Risk gate. One bit of information.
- **Buffer magnitude** (continuous: *how much* margin) → execution-resilience / Strong-gate modifier. The graduated information the sign alone doesn't carry.

These two are not redundant *as a pair* when given different roles — they are the same underlying continuous number used for two different jobs (a binary gate and a graduated one). Giving both *independent High Risk authority* would be redundant; giving Profit sign the binary gate and Buffer magnitude the graduated Strong-gate role is not.

---

## O. Holding Period role

Financial consequences of a longer hold (more holding cost, more financing interest, lower annualised return, more exposure time) are **already fully priced** into holding costs, interest, and the IRR/ROI annualisation denominator. The only *additional* risk a longer hold carries that isn't already captured — market-timing risk (price moves against the seller during the hold, per Goslett's market-ceiling caution) and schedule/execution risk — has **no deterministic way to be measured** with current evidence; quantifying it would require the cost-overrun/sale-price stress modelling explicitly deferred to a future phase (§Q, §R). No SA-specific "safe" duration benchmark was found either — the 3–6 month figure from practitioner commentary describes what's typically *achievable/desirable*, not a safety cutoff a longer hold breaches.

**Recommendation: informational/context only in V1.** Do not create a duration-based verdict gate or modifier — its financial effects are already elsewhere, and its non-financial effects are unevidenced (avoids exactly the double-counting §21 warns against).

---

## P. Renovation execution-risk findings

`renovationCost` is a single deterministic user input; the model applies no overrun stress or contingency. Evidence found (§D's ASAQS-adjacent 10–15% convention) shows contingency ranges are real, standard industry practice — but Harcourts' own anecdotal example (a R100k budget "ballooning" to R250k, a 150% overrun) shows even a properly-contingencied 15% allowance would not have caught a real-world blowout of that magnitude. Renovation cost is, and will remain, a **user assumption AssetVerdict cannot independently verify** — structurally identical to the Projected Sale Price problem (§U/§65).

**Recommendation (per the brief's own A/B/C framing, §18):** **(C)** — Strong can exist without a contingency stress test in V1, but must carry an explicit, prominent model-limitation disclosure *specifically attached to Strong* (not buried in generic documentation), since Strong is the tier making the strongest quality claim and is exactly where an unstressed cost assumption matters most.

---

## Q. Cost-overrun contingency evidence

Evidence (§D, §P) supports that contingency ranges exist as real industry practice, but does **not** support a single universal percentage AssetVerdict should silently apply on the user's behalf — the range itself (10–15%) depends on renovation scope, complexity, and the developer's experience level, none of which AssetVerdict currently captures as a structured input. **Recommendation: do not implement an automatic contingency deduction.** For a future phase only, consider a user-triggered "what if renovation cost rises by X%" stress tool, analogous to the existing Bear/Base/Bull scenario mechanism already in the app — never a silently-applied haircut baked into Base-case Strong eligibility. Not implemented this phase.

---

## R. Sale-price stress evidence

No SA-specific evidence was found calibrating a defensible downside sale-price stress percentage for flips. RICS's ±5–15% valuation margin-of-error convention (§E) is the closest analog, but it describes valuer-to-valuer disagreement, not "how far below my own assumed exit price should I stress-test." Base-case Sale-Price Buffer tells an investor how far price can fall before break-even, but not *how likely* that fall is — it is not a full substitute for a deterministic downside stress. Building one now would require exactly the kind of invented, unevidenced percentage this whole audit has been instructed to avoid. **Recommendation:** V1 relies on Buffer's descriptive framing plus explicit disclosure (§O, §56); flag the absence of a downside stress as a real, named gap for a future phase, not a silently-missing feature.

---

## S. Financing/leverage evidence

SA bridging-finance market data (§D) confirms a materially large share of real Flip financing is not standard amortising P&I. The UK LTC/LTGDV convention (§E) is directionally useful for *defining* what "leverage" conceptually means at a project level for a flip — but per §51's mandatory principle, even an SA-sourced lender ceiling would describe lender risk appetite, not investment quality, so its absence does not block a leverage *metric* from being useful context; it only blocks that metric from having verdict-gate authority.

---

## T. Recommended Flip leverage metric

**Recommend: Project Leverage Ratio = Total Loan Amount ÷ Total Project Cost** — an LTC-style ratio using `fixFlipAnalysis.profitability.totalProjectCost`, a figure AssetVerdict already computes; **zero new inputs required**. This is superior to reusing rental LTV (Loan ÷ Purchase Price) for the exact reason §22–§23 identify: a flip loan legitimately funds renovation and costs, not just the purchase, so >100% of *purchase price* is not automatically unsafe (Phase 4.15.1's rental negotiation >100%-LTV guard must not be imported into Flip verdict semantics). No exact numeric threshold is recommended — no evidence supports one, and §51 means even a found lender ceiling wouldn't settle a *verdict* cutoff. **Recommend: context/informational role only** if this metric is added in a future phase; not a verdict gate in V1.

---

## U. Projected Sale Price semantics

Traced directly through the code: `expectedSalePrice` is a raw user-entered number on the Cashflow/"Flip Calculator" tab (`FlipCalculator` form, backing `DealInputs.expectedSalePrice`, consumed by `calcFixFlipAnalysis`), UI-labelled "Expected Sale Price." It is semantically **whatever the user intends** — an ARV estimate, a comparables-informed guess, a carried-over market value, or a pure guess — and it has **no structural link** to `marketValue` or the separate `PropertyValuation` record (confirmed by direct inspection of `lib/propertyValuation.ts` and the `PropertyValuation` interface in `types/index.ts`: entirely independent fields, no cross-validation anywhere in the codebase). **"Unsupported user assumption" is not a hypothetical risk for this field — it is its default state today.**

---

## V. Exit-value confidence findings

The app has real, existing infrastructure for this: `hasMeaningfulPropertyValuation()` (`lib/propertyValuation.ts`) and the `PropertyValuation` model (`estimatedValue`, `valueConfidenceLow`/`High`, `valuationConfidence` label, `comparables`, `transactions`, `bonds`), populated via a per-deal "Property Valuation (AVM)" panel on the Acquisition tab with an "Import from PDF" flow — `reportSource` is a free-text field (user/PDF-supplied), **not a live TPN/Lightstone API integration**, though the confidence-scoring concept it stores maps naturally onto Lightstone's own Accuracy/Safety Score methodology (§D).

**Critically, this record is never compared against `expectedSalePrice` anywhere in the codebase.** A deal could carry a fully-populated, high-confidence AVM valuation *and* a wildly different, unsupported `expectedSalePrice`, with the deterministic engine having no way to notice the discrepancy — this is exactly the mechanism behind Counterexample C (§AK) and the "optimistic exit price" failure mode (§63).

**Recommendation:** the prerequisite for a credible Strong gate is not a schema change — the data already exists — it is a **new derived comparison**: `expectedSalePrice` vs. `propertyValuation.estimatedValue` (± its confidence range) when `hasMeaningfulPropertyValuation()` is true. This is, in this audit's judgement, the single most important open item standing between the current model and a trustworthy Strong verdict.

---

## W. Required Return treatment

**Recommend Equity IRR as the metric compared against Required Return** (`equityIRR >= discountRate`), not Annualised Pre-Tax ROI. Equity IRR reflects the investor's actual cash timing (levered, month-by-month); Annualised Pre-Tax ROI is unlevered and doesn't reflect what the investor's equity actually experiences. This mirrors the rental precedent exactly and needs no external numeric evidence (§52). Annualised Pre-Tax ROI keeps a supporting role (§J, §Y) — a diagnostic cross-check, not a second target.

---

## X. Short-hold IRR distortion

The central, load-bearing finding of this audit. Worked example: a R50,000 profit on a R1,000,000 total cost, realised over a single month, compounds under Phase 4.17's own formula to `(1.05)^12 − 1 ≈ 79.6%` annualised — mathematically correct, and **not evidence of a repeatable, low-risk deal**. A margin that thin can be erased by a few days' delay, a modest selling-cost miscalculation, or a R10–20k swing in any single cost line, yet it would compound into a headline figure that reads as extraordinarily strong.

Equity IRR (also monthly-then-annualised) suffers the identical mechanism, and worse: leverage amplifies it further (§Y). **Answering §61 directly: yes**, a naive "IRR ≥ Required Return ⇒ Strong" rule could wrongly earn Strong on this pattern. The required guardrail is Sale-Price Buffer (and, secondarily, Project ROI) sitting alongside Equity IRR as a **co-equal, non-overridable gate** — a large IRR must never be allowed to override a thin or negative buffer, mirroring the rental engine's own "a huge return cannot hide a structural problem" philosophy (§32).

---

## Y. Leverage amplification risk

Mechanism: equity contributed ≈ Total Project Cost − Loan Amount. As leverage rises, the equity base shrinks while profit (only slightly reduced by the marginal extra interest cost of the larger loan) is divided by that smaller base — Equity IRR/ROI **mechanically increases with leverage even though the underlying project is unchanged**, while Project ROI (leverage-independent) barely moves — this is the standard leverage-amplifies-equity-returns mechanism; it needs no citation, it is arithmetic, not an empirical claim.

**Concrete risk (§62):** two flips with *identical* project quality (same profit, same Buffer) but different financing — 100% cash vs. 90% financed — will show wildly different Equity IRR. The heavily-financed deal can look "more Strong" by IRR alone despite being the objectively riskier structure (thinner equity cushion in Rand terms, larger payoff-at-sale exposure, higher debt-service burden). **Required understanding, confirmed: yes**, high leverage can artificially amplify Equity IRR. **The guardrail must be leverage-independent** — Sale-Price Buffer qualifies exactly because it is a pure function of price vs. the break-even cost stack, unaffected by how the deal is financed. This is why §I/§X/§Y converge on the same conclusion: IRR alone is insufficient primary authority; Buffer (and/or Project ROI) must gate it.

---

## Z. Double-counting map

| Pair | Relationship | Verdict implication |
|---|---|---|
| Profit (Rand) sign ↔ Buffer ≤ 0% | **Exact identity** (§N) | Use Profit's sign once, as the structural gate. Buffer's *magnitude* (not its own sign check) does separate, graduated work. |
| Profit Margin ↔ Buffer | **Near-exact linear rescale**, factor `(1 − commission%)` (§N) | Profit Margin is an alternate framing for explanatory copy, not a second independent gate. |
| Project ROI ↔ Profit/Buffer | Correlated (shares the profit numerator) but **not** an exact transform — different denominator (cost vs. price) | Keep as a distinct secondary signal; genuinely different information. |
| Equity IRR ↔ Annualised Project ROI | Both "return + duration," but one levered, one not | Keep both; the *gap* between them is diagnostic of leverage amplification (§Y). IRR primary, Annualised ROI supporting. |
| Holding Period ↔ (holding cost + interest + annualisation) | Financial effects already fully captured elsewhere | No independent verdict role; informational only (§O). |

---

## AA. Recommended minimum V1 metric set

Confirms and refines the brief's own hypothesis (§36):

1. **Structural viability:** Estimated Profit Before Tax sign (`> 0` required; `<= 0` → High Risk).
2. **Investor target:** Equity IRR `>=` Required Return.
3. **Execution resilience / Strong gate:** Sale-Price Buffer magnitude — role confirmed, exact threshold provisional/unsupported (§M).
4. **Critical assumption confidence:** Projected Sale Price credibility — currently uncross-checked against any valuation evidence in the engine (§U/§V); this is the honest, correctly-scoped V1 gap, not yet a metric AssetVerdict can compute.

Add, as a mandatory accompaniment to any Strong verdict specifically (not a fifth metric, a disclosure requirement): explicit acknowledgement of the renovation-cost and financing-structure model limitations (§P, §AI).

---

## AB. Structural High-Risk candidates

- **Estimated Profit Before Tax `<= 0`** → High Risk. HIGH confidence, ready.
- **Sale-Price Buffer `<= 0%`** → proven mathematically identical to the above (§N). Must **not** be a second independent trigger — folding it in as a separate check double-counts, it doesn't add a new signal.
- **`fixFlipAnalysis.status === "unavailable"`** (e.g. invalid holding period) → should map to a verdict-**unavailable** state (mirroring rental's `insufficient_required_inputs`), **not** High Risk (§33). Unknown must never silently become unsafe.

No other structural High-Risk candidate is currently evidence-supported — a "severe negative buffer" tier beyond plain `<= 0` would require the sale-price-stress evidence this audit found unsupported (§R).

---

## AC. Does Not Meet Target rule

**Project profitable (`Estimated Profit Before Tax > 0`) AND Equity IRR < Required Return → Does Not Meet Target**, regardless of Buffer/execution-resilience state — mirrors the rental engine's `deriveTargetState` precedent exactly (safety/viability resolved favourably, target comparison resolved unfavourably). **READY** — same confidence level as the rental version, since it is the identical "IRR vs. the user's own hurdle" comparison rule, applied to Flip's own Equity IRR.

---

## AD. Promising rule

Project viable (profit `> 0`) and target met (or the specific "target genuinely unknown" edge case, mirroring rental) but one or more of Strong's stronger gates (Buffer resilience threshold, sale-price credibility) not cleared. **READY WITH LIMITS** — the *shape* of "Promising = viable and no disqualifying weakness, but not the top tier" is sound and directly evidence-backed by the redundancy proof in §N; its precise boundary against Strong is provisional because it inherits Strong's own unresolved Buffer threshold.

---

## AE. Strong rule

Project viable, target met, Buffer resilient (exact % to be determined), and no critical unresolved exit-price assumption. **NOT READY.** Blocked specifically on: (a) no defensible Buffer numeric threshold (§M), and (b) Projected Sale Price has zero cross-check against any valuation evidence today (§U/§V). Recommend Strong remain unavailable until at minimum a "Strong under your own assumptions" disclosure framing (§54) is designed — even before any numeric Buffer threshold is locked — since Strong's entire claim currently rests on an assumption the engine cannot verify at all.

---

## AF. Proposed precedence

Mirrors the rental engine's own step ordering in `verdict.ts` exactly, renumbered for Flip:

1. Strategy/deal-level model unavailable (invalid holding period, or — currently, in totality — no Flip verdict built at all) → unavailable.
2. Structural High Risk (`Estimated Profit Before Tax <= 0`) → High Risk, evaluated *before* target, independent of IRR size — never overridden by a large IRR (§32, §X).
3. Target missed (`Equity IRR < Required Return`, profit still positive) → Does Not Meet Target.
4. Target met but Strong gates (Buffer, exit-price credibility) not cleared → Promising.
5. Target met + Buffer resilient + exit-price credible → Strong.

No deviation from this pattern is recommended — it is already proven, tested, and battle-hardened across five rental strategies, and Fix & Flip's evidence gives no reason to reorder it.

---

## AG. Missing/N/A treatment

Invalid holding period, missing/zero sale price, or a non-converging Equity IRR must **not** auto-become High Risk (§33). Recommend mirroring rental's `DealVerdictUnavailable` branch exactly — a distinct, named "unavailable" reason (analogous to `insufficient_required_inputs`), never a silent default into any of the four real labels. Unknown is a fifth, structurally separate state, not a synonym for unsafe.

---

## AH. Assumption-confidence treatment

**No schema change recommended** (§53's explicit instruction, and confirmed by §V's finding that the needed data — `PropertyValuation` — already exists; what's missing is a *comparison*, not a *field*). Recommend a future phase derive confidence from `hasMeaningfulPropertyValuation()` plus a comparison between `expectedSalePrice` and `propertyValuation.estimatedValue`/its confidence range, rather than inventing a new user-facing "verified / supported / user_estimate / unknown" input the user self-reports — which would just be another unverifiable claim, one level removed from the same problem.

---

## AI. Model limitations and verdict impact

Classified per §56's A (disclosure only) / B (blocks Strong) / C (blocks all verdicts):

| Limitation | Classification |
|---|---|
| Pre-Tax only | **A** — disclosure only. SARS evidence (§D) reinforces this was already the right call; no safe harbour exists to justify auto-applying tax either. |
| Base-case only, no Bear/Bull verdict influence | **A** — matches rental precedent exactly. |
| Standard amortising P&I finance only | **A, with emphasis** — real and material (§S), but should not outright block Strong for users whose real financing approximates it; genuinely non-P&I structures deserve a stronger, unmissable disclosure given SA's material specialised-bridging market. |
| No staged renovation drawdowns / single-point-estimate renovation cost | **A** — real limitation; combines with the missing exit-price cross-check to be a reason Strong specifically isn't ready yet (two unverified assumptions compounding on the same tier's confidence claim). |
| No construction-delay/cost-overrun stress | **A** for now (§P/§Q) — future stress tooling recommended, not a blocker today. |
| Missing sale-price ↔ valuation-evidence cross-check | **B** — the one limitation this audit recommends actually blocking Strong specifically, once a Flip verdict exists, until the comparison in §V is built. |

None rise to **C** (block all verdicts) — High Risk and Does Not Meet Target do not depend on any of these limitations being resolved.

---

## AJ. Threshold evidence table

| Metric / rule | Value | Source | Confidence | Geography | Status |
|---|---|---|---|---|---|
| Profit sign (`<=0` → structural failure) | Definitional, not a number | Internal — mirrors rental's raw structural-check pattern | HIGH (conceptual, not empirical) | N/A | **CONFIRMED** |
| Equity IRR vs. Required Return | Comparison rule, no fixed number | Internal — mirrors rental `deriveTargetState`; user's own hurdle (§52) | HIGH | N/A | **CONFIRMED** |
| Precedence order (structural → target → Strong gates) | Rule ordering | Internal — mirrors `verdict.ts` exactly | HIGH | N/A | **CONFIRMED** |
| Sale-Price Buffer as Strong-gate concept | Role only, no %  | RICS margin-of-error (§E); SA practitioner "10%" commentary (§D) | MODERATE (role) / **NONE** (exact %) | UK (margin concept) / SA (10% figure, wrong metric) | **PROVISIONAL** (role) / **UNSUPPORTED** (number) |
| 10% minimum return on total expenditure | R value, not verified | Harcourts, Pam Golding, RE/MAX (§D) | WEAK | SA | **UNSUPPORTED** as a verdict threshold |
| 70% rule (ARV × 0.7 − repairs) | US formula | BiggerPockets/FlipperForce/Lima One (§F) | WEAK (as SA truth) | US | **REJECTED** |
| ATTOM 23% gross ROI | US figure, different metric definition | ATTOM Q3 2025 report (§E) | STRONG (as data) / **NONE** (as applicable benchmark) | US | **REJECTED** (metric + geography mismatch) |
| Project Leverage Ratio = Loan / Total Project Cost | Metric definition only, no threshold | Internal derivation from UK LTC/LTGDV convention (§T) | MODERATE (definition) / NONE (threshold) | Concept: UK; application: internal | **PROVISIONAL** (definition) / **UNSUPPORTED** (threshold) |
| Construction contingency 10–15% | Range, not a single number | ASAQS-adjacent industry commentary (§D) | MODERATE | SA | **PROVISIONAL** — supports future stress tooling, not an automatic deduction |
| Lightstone AVM accuracy (~85% within-range, majority 71–80% confidence band) | Descriptive statistic | Lightstone, Fitch/Moody's-audited (§D) | STRONG | SA | **CONFIRMED** as evidence of AVM reliability; not itself a verdict threshold |

---

## AK. Counterexample matrix

| # | Scenario | Should classify as | Why |
|---|---|---|---|
| A | Huge IRR, tiny Rand profit / tiny Buffer | **Not Strong** — Promising at best, High Risk if Buffer `<=0` | Buffer gate (leverage-independent) catches what IRR alone (leverage-amplified) hides — §X/§Y. |
| B | Large positive profit, IRR below Required Return | **Does Not Meet Target** | Viable project, target not met — §AC. |
| C | Negative profit, high annualised IRR "artifact" | **High Risk** | Profit sign is evaluated independent of and before target/IRR — a negative-profit deal cannot mathematically produce a *positive* IRR on a properly-signed cashflow series in the first place, but if a solver artefact ever did, structural Profit-sign check still fires first and is not overridable (§32/§AF step 2). |
| D | Strong Buffer, target missed | **Does Not Meet Target** | Target-missed check applies regardless of resilience — mirrors rental precedent, safety/resilience being fine does not excuse a missed return target. |
| E | Target met, exit price wholly unsupported | **Not Strong** (Promising at best) | §V's missing cross-check is exactly this case — this is the scenario that motivates classifying the cross-check as a Strong-blocker (**B**, §AI). |
| F | Cash deal (no debt) | Equity IRR ≈ unlevered Project ROI's annualised equivalent | No leverage amplification risk (§Y) — IRR is trustworthy here without the same distortion concern, though the short-hold distortion (§X) can still apply on its own. |
| G | Highly leveraged deal | Buffer/Project ROI must gate; IRR alone insufficient | Direct application of §Y. |
| H | Long-hold deal | No special duration penalty — judge on the same Profit/IRR/Buffer gates | §O — duration's financial effects are already priced in. |
| I | Short-hold deal (1–3 months) | Buffer/Project ROI must gate; IRR alone insufficient | Direct application of §X. |

---

## AL. Readiness by verdict label

| Label | Readiness |
|---|---|
| High Risk | **READY** |
| Does Not Meet Target | **READY** |
| Promising | **READY WITH LIMITS** |
| Strong | **NOT READY** |

---

## AM. Can Fix & Flip Verdict V1 be implemented now?

**NO — CALIBRATION GAP REMAINS**, specifically for a complete four-label verdict.

This needs precision: High Risk and Does Not Meet Target are backed by HIGH-confidence *rules* that need no numeric threshold invention (Profit's sign is definitional; the IRR-vs-Required-Return comparison uses the user's own number). Those two labels alone could be implemented today with real confidence. Strong's blocker, however, is not merely "the threshold is provisional" — the brief's third option would cover that case. It is that **the mechanism itself doesn't exist yet**: there is no code path anywhere that compares `expectedSalePrice` against `propertyValuation.estimatedValue`, and no evidence-backed Buffer percentage to gate on even if that comparison existed. That is a build gap, not a labelling-confidence gap, and it is why this audit does not choose "YES — WITH EXPLICIT PROVISIONAL RULES" for the *complete* verdict.

---

## AN. Exact rules recommended for implementation

Only rules this audit would stand behind at implementation time:

- `Estimated Profit Before Tax <= 0` → structural High Risk. HIGH confidence.
- `Equity IRR < Required Return` (profit still positive) → Does Not Meet Target. HIGH confidence.
- Precedence order exactly mirroring `verdict.ts` (§AF). HIGH confidence in the pattern.

**No exact Sale-Price Buffer percentage is recommended for implementation.** No exact Project Leverage Ratio threshold is recommended. Both remain provisional-role, unsupported-number.

---

## AO. Rules specifically rejected

- The 70% rule, in any form, as an AssetVerdict threshold (§F).
- ATTOM's 23% "ROI" as a benchmark for Project ROI (§E, §H) — wrong metric definition, wrong geography.
- Reusing rental LTV bands for Flip leverage (§22–§23, §T) — wrong denominator concept.
- Sale-Price Buffer as a *second independent* High Risk trigger alongside Profit's sign (§N) — proven exact redundancy.
- Holding Period as a direct verdict gate or modifier (§O) — financial effects already fully captured elsewhere; no independent evidence for anything beyond that.
- An automatic renovation-cost contingency deduction (§P, §Q) — no universal percentage defensible; would silently override the user's own number with an invented one.
- Lender LTC/LTGDV ceilings, from any geography, as investment-quality thresholds (§51, mandatory) — rejected on principle, not evidence quality.

---

## AP. New input recommended?

**NONE.** Every recommended metric (Profit sign, Equity IRR, Sale-Price Buffer, a possible future Project Leverage Ratio) is already computed by the existing Phase 4.17 engine from existing inputs. The one genuine gap (exit-price credibility, §U/§V) is a missing *comparison* against data (`PropertyValuation`) that already exists in the schema — not a missing input.

---

## AQ. Financial formulas changed

**NONE.** No production code was modified during this phase. Every figure and formula cited in this report was read directly from `lib/calculations/fixFlip.ts` and `lib/calculations/index.ts` as they stood at the start of the phase (§A's baseline), not altered.

---

## AR. Rental verdict/negotiation changed

**NONE.** `lib/calculations/verdict.ts`, `lib/calculations/negotiation.ts`, and `lib/calculations/thresholds.ts` were read for architectural reference only; none were edited.

---

## AS. Tests

No new production tests were added — an audit-only phase, per the brief's own expectation (§AS). The algebraic identity proven in §N (`profit ≤ 0 ⟺ buffer ≤ 0`; `profitMargin ≈ (1 − commission%) × buffer`) is presented here as a mathematical proof, verified against the live `fixFlip.ts` source, not encoded as a new test. **Recommendation:** at implementation time, this identity should become an explicit regression test (e.g. "Buffer's sign matches Profit's sign exactly, for all sale prices") so any future change to the selling-cost model that breaks the identity is caught immediately.

---

## AT. Recommended next phase

**Phase 4.19 — Fix & Flip Verdict V1 (Partial).** Implement only the two READY labels:
- Structural High Risk (`Estimated Profit Before Tax <= 0`).
- Does Not Meet Target (`Equity IRR < Required Return`, profit positive).
- Everything else that clears those two gates → Promising (the "viable, not disqualified, not yet Strong-eligible" bucket).
- **Leave Strong explicitly unavailable** — a new, named reason (e.g. `insufficient_evidence_for_strong`), not a silent cap or a Promising deal that merely never shows Strong — until a follow-up phase builds the `expectedSalePrice` ↔ `PropertyValuation` credibility comparison (§V) and either researches a defensible Sale-Price Buffer threshold or ships Strong behind an explicit "Strong under your own assumptions" framing (§54) that doesn't require one.

Not started in this phase, per §69's own instruction to be decisive without starting the next phase automatically.

---

## Final Quality Questions

**Is Estimated Profit Before Tax `<=0` a defensible structural failure?** Yes — defensible as a *definitional* fact about the Base-case model's own output, not as a calibrated empirical threshold (§G). No external evidence is needed to defend it, the same way DSCR `< 1.0` needed none.

**Should absolute Rand profit have universal Strong bands?** **NO** — confirmed (§G, §8). Deal-size-dependent; Rand profit stays context/explanation only.

**Should Equity IRR be compared with Required Return?** Yes (§I, §W) — mirrors the rental precedent exactly, respects the investor's own hurdle rather than a universal band, and needs no external threshold evidence.

**Can a huge annualised IRR alone make a Flip Strong?** **NO** — confirmed (§X). Short-hold compounding can manufacture an enormous IRR from a fragile, thin absolute margin; IRR must be gated by Buffer/Project ROI, never sufficient alone.

**Can high leverage artificially amplify Equity IRR?** **YES** — confirmed and mechanistically proven (§Y).

**Should leverage amplification be guarded by another metric?** Yes — Sale-Price Buffer (leverage-independent by construction) and, secondarily, Project ROI (§Y, §H).

**Are Project ROI and Equity IRR the same economic signal?** **NO** — confirmed (§H, §Z). Different denominators (cost vs. equity), different leverage-exposure (unlevered vs. levered).

**Are Project ROI, Profit Margin and Sale Buffer partly correlated?** **YES — mapped exactly (§N, §Z).** Profit Margin ≈ `(1 − commission%) × Buffer` (near-exact linear rescale — practically the same number). Project ROI is correlated (shares the profit numerator) but not an exact transform of either, since its denominator is cost, not sale price.

**Can Sale-Price Buffer independently trigger High Risk if profit sign already captures the same break-even boundary?** **NO** — proven algebraically exact (§N), not merely likely.

**Can missing exit-price evidence automatically mean High Risk?** **NO** — unknown must never silently become unsafe (§33, §AG).

**Can missing critical exit-price evidence reasonably block Strong?** Yes — recommended explicitly (§AI, classification **B**; §V; §AE). This is the one limitation this audit recommends actually blocking a specific verdict tier.

**Can a user-entered optimistic sale price produce false-looking Strong economics?** **YES** — confirmed and traced through the code: `expectedSalePrice` has zero structural link to any valuation evidence today (§U, §V, Counterexample E in §AK).

**Can an underestimated renovation budget do the same?** **YES** — confirmed (§P), same "unverifiable user assumption" mechanism as sale price.

**Does the deterministic engine validate those assumptions?** **NO** — confirmed. AssetVerdict can verify internal financial consistency (and does, exhaustively, per Phase 4.17/4.17.1); it cannot verify the truth of a user's sale-price or renovation-cost assumption (§65).

**Should lender underwriting limits be treated as investment-quality thresholds?** **NO** — mandatory principle, applied without exception regardless of source geography or credibility (§51, §T, §AO).

**Is the 70% rule universal enough to become AssetVerdict truth?** **NO**, unless extraordinary evidence proves otherwise — none was found; rejected (§F).

**Can Fix & Flip currently support an overall verdict without automatically determining tax?** **YES, if clearly labelled Pre-Tax** — consistent with the already-locked Phase 4.10/4.17 boundary, reinforced (not newly justified) by the SARS evidence in §D (no safe-harbour holding period exists to auto-apply tax against either).

**Can Promising If Negotiated be activated for Flip now?** **NO** — no exceptions (§42). Fix & Flip acquisition-price solving does not exist yet; this remains unavailable.

**Were any production financial formulas changed?** **NO** — confirmed (§AQ).

**Do we now have enough evidence to build a Fix & Flip verdict that is useful without pretending subjective assumptions are objective facts?** **Partially.** Enough evidence and enough architectural clarity exists to build the High Risk and Does Not Meet Target labels honestly, today. Not enough exists — not a calibration shortfall, an actual missing mechanism — to build a Strong label that doesn't quietly pretend an unverified sale-price assumption is a verified fact. The honest answer is to ship the part that's ready and say so plainly about the part that isn't (§AT).

---

## Phase Completion Principle

These are the few metrics that genuinely deserve verdict authority for Fix & Flip: **Estimated Profit Before Tax's sign**, as the structural viability gate; **Equity IRR compared against the investor's own Required Return**, as the target; and **Sale-Price Buffer's magnitude**, as the execution-resilience gate that keeps a thin, leverage-amplified, short-hold IRR from masquerading as Strong.

These signals measure different risks rather than counting the same margin multiple times — proved, not assumed, by the algebraic identity in §N showing Profit's sign and Buffer's zero-crossing are mathematically the same fact, and Profit Margin is a near-linear rescale of Buffer, while Project ROI and Equity IRR remain genuinely distinct along the leverage dimension.

These thresholds are supported by evidence: the *rules* — Profit's sign as a structural fact, IRR compared against the user's own hurdle, the precedence order mirroring five already-proven rental strategies. These thresholds remain provisional: the exact Sale-Price Buffer percentage that should gate Strong, and any Project Leverage Ratio cutoff, because no South African or properly-matched international source was found strong enough to defend a specific number.

These assumptions cannot be independently verified by AssetVerdict: the Projected Sale Price, and the renovation budget — both user-supplied, both currently un-cross-checked against any external evidence, both capable of manufacturing false-looking Strong economics on their own.

And this is exactly why a Fix & Flip deal can honestly become **High Risk** or **Does Not Meet Target** today, but not yet **Strong**: Strong is the verdict that claims the most, and it is the one tier this audit cannot yet defend without either inventing a threshold or pretending an unverified assumption is a verified fact. Financial truth came first. Evidence came second. The verdict — all four labels of it, released together and honestly — comes third, and not yet.
