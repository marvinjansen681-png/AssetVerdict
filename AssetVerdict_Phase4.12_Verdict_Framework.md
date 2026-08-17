# AssetVerdict — Phase 4.12: Verdict Calibration Framework

**Status: Framework + Audit only. No verdict code implemented. No thresholds changed. No production behaviour changed.**

This document is the required output of Phase 4.12. It audits everything currently in the repo that touches judgement/classification, defines what an AssetVerdict "verdict" means, and proposes an architecture and set of owner decisions. Numeric threshold calibration is explicitly out of scope and is not attempted anywhere below.

---

## A. Current verdict implementation audit

**There is no overall deal-level verdict engine anywhere in the codebase today.** This was verified by grepping the full repo for `verdict`, `strong`, `promising`, `promising_if_negotiated`, `high_risk`, `does_not_meet_target`, `score`, `classification`, `threshold`, `risk` and reading every real match. Every non-trivial hit resolves to one of three things:

1. **The existing per-metric classification system** — [lib/calculations/thresholds.ts](lib/calculations/thresholds.ts) + [lib/calculations/applicability.ts](lib/calculations/applicability.ts). This is production code, well-documented, and is the *only* judgement layer that exists. It classifies one metric at a time into `classified` (Strong/Caution/Weak or Exceeds/Near/Below Target), `unclassified`, or `not_applicable`. It has no concept of combining metrics.
2. **The product name** "AssetVerdict" itself, in marketing copy, page titles, and loading states (`app/welcome/page.tsx`, `app/layout.tsx`, `app/(app)/deals/[id]/summary/page.tsx`). Not judgement logic.
3. **A structurally unrelated scoring system** — `lib/suburb-scoring.ts`, which produces an aggregate 0–100 score and a `"Strong Fit"/"Moderate Fit"/"Weak Fit"/"Insufficient Data"` label per *suburb × strategy* (used on `app/(app)/suburbs/[id]/dashboard/page.tsx`). This is not a deal verdict — it scores locations, not deals — and it hardcodes its own bands independently of `thresholds.ts` (e.g. `scoreFromBand(profile.fhGrossYield, 4, 12)`). It is the one existing precedent in the codebase for "combine several signals into one labelled judgement," and is worth being aware of for naming/pattern consistency, but a deal verdict does not need to reconcile with it numerically.

Two further things confirm the absence of a verdict is *deliberate*, not an oversight:

- **Deal Coach's own system prompt says so explicitly.** `lib/ai/dealCoachPrompt.ts:23`: *"AssetVerdict does not currently produce one single overall 'verdict' for a deal... Never invent an overall verdict AssetVerdict didn't give you, and never override a per-metric classification with your own judgement."*
- **Deal Coach's own test suite asserts it.** `lib/ai/__tests__/dealCoachPrompt.test.ts` has tests titled `"does not claim AssetVerdict has a single holistic verdict system"` and `"guards against collapsing investor-target results into an overall safety verdict"`.

**Consequence for Phase 4.13:** once a real verdict engine ships, `dealCoachPrompt.ts:23` becomes false and must be rewritten to describe the new contract ("explain the deterministic verdict, never override it") rather than "no verdict exists." Flagged for implementation, not touched now.

There is also **no persisted verdict field anywhere** in `prisma/schema.prisma` (grepped case-insensitively for `verdict|score|rating|recommendation` — zero matches on any model). Whatever gets built should be a derived/calculated output, never a stored column — see section L.

---

## B. Metric inventory

Every metric `calcAllMetrics` (`lib/calculations/index.ts:1148`) actually produces, with its snapshot/projected character:

| Metric | Function | Snapshot vs Projected |
|---|---|---|
| DSCR | `calcDSCR` (index.ts:651) | Year-1 snapshot only — no per-year or minimum-across-hold-period variant exists anywhere |
| LTV | `calcLTV` (index.ts:657) | Snapshot |
| Break-Even Ratio | `calcBreakEvenRatio` (index.ts:684) | Snapshot |
| Operating Expense Ratio | `calcOperatingExpenseRatio` (index.ts:698) | Snapshot |
| NOI Margin | `calcNOIMargin` (index.ts:711) | Snapshot (= 1 − OER exactly) |
| Utilities Ratio | `calcUtilitiesRatio` (index.ts:704) | Snapshot |
| Gross Yield | `calcGrossYield` (index.ts:592) | Snapshot |
| Cap Rate PP | `calcCapRatePP` (index.ts:582) | Snapshot |
| Cap Rate MV | `calcCapRateMV` (index.ts:587) | Snapshot |
| Cap Rate Spread | `calcCapRateSpread` (index.ts:717) | Snapshot, depends on user-typed market cap rate |
| Cash-on-Cash Pre-Tax | `calcNetYieldPreTax` (index.ts:631) | Snapshot (Year-1 cashflow / equity) |
| Cash-on-Cash Post-Tax | `calcNetYieldPostTax` (index.ts:638) | Snapshot |
| Equity IRR | `calcIRR` (index.ts:1046) | Full hold-period projection via `buildEquityCashflows` |
| Equity NPV | `calcNPV` (index.ts:1085) | Full hold-period projection, same cashflow stream as IRR |
| Payback Period | `calcPaybackPeriod` (index.ts:780) | Snapshot (equity ÷ Year-1 post-tax cashflow) |
| Flip: gross/net profit, ROI, Annualised ROI, profit margin | `calcFlipProfit` (index.ts:741) | Single lump-sum event, fix_and_flip only |
| Cashflow (monthly/annual) | `calcCashflowMonthly`/`calcCashflowAnnual` | Both snapshot and per-year in the 20-year projection |

**No negative-cashflow flag exists.** `cashflowMonthly` / `cashflowAnnualPreTax` on `DealMetrics` are plain signed numbers; nothing in `lib/` exposes a boolean "this deal is cashflow-negative." Any verdict rule that wants this signal must compute `< 0` itself against the raw field.

**No target-price / negotiation solver exists anywhere in `lib/calculations/`.** The only related code is prose: `dealCoachPrompt.ts:78` explicitly instructs the AI to *never* invent a "correct" offer price, and generic "negotiate the price" suggestions in `lib/education/metricDefinitions.ts`. This is decisive for section K.

**Bear/Base/Bull does not stress financing.** `calcScenarios` (`scenarios.ts:41`) shifts only `rentalGrowthRate`, `capitalGrowthRate`, and `occupancyRate`. `financeSources` (loan amount, interest rate, term) passes through unchanged. Because `occupancyRate` is an instant Year-1 shift (not a growth-over-time one), Bear's Year-1 DSCR *does* move — but only via occupancy, never via rate stress. "Bear resilience" is therefore a partial, occupancy-only stress test, not a full downside scenario — see section L.

---

## C. Metric-role matrix (required output §85)

| Metric | Category | Strategy scope | Classification status today | Recommended role | Threshold confidence | Verdict-eligible now? |
|---|---|---|---|---|---|---|
| DSCR | Financial Safety | All rental strategies (unclassified for fix_and_flip — no entry) | Classified (fixed_bands, strategy-tuned green/orange) | **PRIMARY** | Moderate | Yes (rental only) |
| Break-Even Ratio | Financial Safety | All rental strategies (unclassified for flip) | Classified | **PRIMARY** | Internal/low | Yes (rental only) |
| LTV | Financial Safety | All rental strategies (unclassified for flip) | Classified | **SUPPORTING** (severity amplifier, not independent gate) | Internal/low | Yes, as modifier |
| Operating Expense Ratio | Operating Quality | All rental strategies, strategy-tuned bands (unclassified for flip) | Classified | **PRIMARY** | Internal/low | Yes (rental only) |
| Utilities Ratio | Operating Quality | All rental strategies (single commercial band, no per-strategy override) | Classified | **SUPPORTING** | Internal/low, gross-cost limitation | Yes, low weight |
| NOI Margin | Operating Quality | All | Deliberately unclassified (exact complement of OER) | **INFORMATIONAL** | n/a | No — by design |
| Cap Rate PP | Property Performance | All rental strategies (unclassified for flip) | Classified (sweet_spot) | **PRIMARY** | Internal/low | Yes (rental only) |
| Gross Yield | Property Performance | All rental strategies, strategy-tuned (unclassified for flip) | Classified | **SUPPORTING** | Internal/low | Yes, low weight |
| Cap Rate MV | Property Performance | All | Deliberately unclassified (unverified market-value provenance) | **INFORMATIONAL** | n/a | No — by design |
| Cap Rate Spread | Property Performance | All rental strategies (unclassified for flip) | Classified, but depends on user-typed market cap rate | **SUPPORTING / contextual** | Internal/low, assumption-dependent | Low weight only |
| Equity IRR | Investor Target | All rental strategies (unclassified for flip) | Classified (target_relative), provisional margin | **PRIMARY** | Provisional | Yes (rental only) |
| Equity NPV | Investor Target | All rental strategies (unclassified for flip) | Classified (zero_relative), provisional tolerance | **SUPPORTING / confirmatory** (near-total correlation with IRR — see §F) | Provisional | Yes, not double-counted |
| Cash-on-Cash Post-Tax | Investor Target | All rental strategies (unclassified for flip) | Classified (target_relative), provisional | **SUPPORTING** | Provisional | Yes, low weight |
| Cash-on-Cash Pre-Tax | Investor Target | All rental strategies (unclassified for flip) | Classified (target_relative), provisional | **INFORMATIONAL** (conceptually messier pre-tax-vs-after-tax-hurdle comparison, flagged in the code's own rationale) | Provisional | No |
| Payback Period | Investor Target | All | Deliberately unclassified | **INFORMATIONAL** | n/a | No — by design |
| Flip Pre-Tax ROI | Strategy-specific (Flip) | fix_and_flip only | Deliberately unclassified (Phase 4.10, post pre-tax redefinition) | **INFORMATIONAL for now** | None — needs calibration | No |
| Flip Annualised Pre-Tax ROI | Strategy-specific (Flip) | fix_and_flip only | Deliberately unclassified | **INFORMATIONAL for now** | None — needs calibration | No |
| Flip Net Profit | Strategy-specific (Flip) | fix_and_flip only | Deliberately unclassified (absolute Rand, no deal-size context) | **INFORMATIONAL** | n/a | No — by design |
| Flip Profit Margin | Strategy-specific (Flip) | fix_and_flip only | **No threshold entry exists at all** (not even explicit `unclassified`) | **INFORMATIONAL** | None | No — see backlog §R |

**Consequence:** under this table, **Fix & Flip currently has zero verdict-eligible metrics in any category.** This is addressed explicitly in section S — it is not something to patch inside this framework phase.

---

## D. Category model

Four categories, unchanged from Phase 4's own framing, confirmed against the actual code (`ClassificationCategory` in `thresholds.ts:31-36` already encodes `financial_safety | operating_quality | property_performance | investor_target`, plus `strategy_specific` for Flip's own metrics):

- **Financial Safety** — *"Can this deal financially withstand pressure?"* DSCR, Break-Even Ratio (primary); LTV (supporting/modifier).
- **Operating Quality** — *"How efficiently does the property operate?"* OER (primary); Utilities Ratio (supporting); NOI Margin (informational, by design).
- **Property Performance** — *"How well does the property itself perform economically?"* Cap Rate PP (primary); Gross Yield, Cap Rate Spread (supporting); Cap Rate MV (informational, by design).
- **Investor Target** — *"Does this deal meet the investor's required return?"* Equity IRR (primary); Equity NPV, Cash-on-Cash Post-Tax (supporting); Cash-on-Cash Pre-Tax, Payback (informational).

Fix & Flip does not map cleanly onto Financial Safety or Investor Target as defined (see §S). Its only real category today is a thin, currently-unclassified Strategy-Specific one.

---

## E. Primary vs supporting metrics — rationale

A metric is **PRIMARY** only if (a) it has a defensible, if internal, threshold basis, (b) it measures something no other classified metric already measures, and (c) its category's central question genuinely turns on it. DSCR and Break-Even Ratio both qualify independently — they are correlated but not redundant (§F). Cap Rate PP is primary in Property Performance because the code itself already treats it as "the property's primary acquisition cap-rate metric" (comment at `thresholds.ts:179`). Equity IRR is primary in Investor Target because it's the standard long-run, whole-hold-period, industry-standard figure investors already think in.

Everything demoted to **SUPPORTING** either (a) shares most of its economic signal with a primary metric (Equity NPV vs IRR, Gross Yield vs Cap Rate PP), or (b) has a structurally weaker evidentiary basis (LTV as risk *level* rather than risk *outcome*; Cap Rate Spread depending on an unverified user assumption). **INFORMATIONAL** metrics are ones the codebase has already, deliberately, refused to classify (NOI Margin, Cap Rate MV, Payback) — this framework preserves that decision rather than re-litigating it.

---

## F. Double-counting risk map (required output §86)

| Metric A | Metric B | Relationship | Double-count risk | Recommended treatment |
|---|---|---|---|---|
| OER | NOI Margin | Exact mathematical complement (NOI Margin = 1 − OER) | High — already resolved in code | NOI Margin stays informational-only, zero verdict weight (already the case) |
| Equity IRR | Equity NPV | Same discounted equity-cashflow stream; for a conventional cashflow shape (one outflow, then positive), NPV > 0 ⟺ IRR > discountRate — near-total logical overlap | High | Treat IRR as the primary target signal; NPV as confirmatory context only (magnitude in Rand terms), not separately weighted in category aggregation |
| Cash-on-Cash Pre-Tax | Cash-on-Cash Post-Tax | Same underlying Year-1 cashflow figure, differing only by tax treatment | High | Only Post-Tax counts toward the Investor Target category (cleaner hurdle comparison per the code's own rationale at `thresholds.ts:236`); Pre-Tax stays informational |
| Cash-on-Cash (either) | Equity IRR / NPV | Both answer "does return clear my hurdle," but CoC is Year-1-only while IRR/NPV span the full hold + terminal value | Moderate | IRR remains primary; CoC Post-Tax is supporting near-term-liquidity context, not equally weighted |
| DSCR | Break-Even Ratio | Both measure income-coverage resilience, but BER also folds in operating costs, which DSCR structurally excludes | Moderate — related, not redundant | Both remain independent primary safety gates (see §Q, §64) |
| DSCR | LTV | Coverage ability vs. leverage level — genuinely different questions (a highly-levered deal can have strong or weak coverage) | Low | LTV never substitutes for DSCR; used only as a severity amplifier/Strong-gate qualifier |
| Gross Yield | Cap Rate PP | Both are acquisition-price-relative income ratios; Gross Yield ignores expenses, Cap Rate PP doesn't | Moderate | Cap Rate PP primary; Gross Yield supporting quick-screen only |
| Utilities Ratio | OER | Utilities cost is very likely already a component inside total operating expenses driving OER | Moderate–High (partial subset, not confirmed exact) | Utilities Ratio kept diagnostic/low-weight only — it explains *why* OER might be weak, never independently moves the verdict |
| Payback Period | IRR / NPV | Same "is the return good" question, but ignores time value and all post-payback cashflow | Low (already resolved) | Stays informational (already unclassified) |
| Cap Rate Spread | Cap Rate MV / Gross Yield | Shares acquisition-yield economics, but is additionally contaminated by a user-typed market cap rate assumption | Low–Moderate | Contextual/supporting only, never primary |

---

## G. Strategy matrix (required output §87)

| Strategy | Safety metrics available | Operating metrics available | Performance metrics available | Target metrics available | Missing critical truth |
|---|---|---|---|---|---|
| Commercial | DSCR, Break-Even, LTV | OER, Utilities Ratio | Cap Rate PP, Gross Yield | IRR, NPV, CoC Post-Tax | None structural |
| Buy-to-Let | DSCR (1.2/1.0), Break-Even, LTV | OER (45/65) | Cap Rate PP, Gross Yield (8/5) | IRR, NPV, CoC Post-Tax | None structural |
| Multi-Let | DSCR (1.3/1.0), Break-Even, LTV | OER (50/70) | Cap Rate PP, Gross Yield (12/8) | IRR, NPV, CoC Post-Tax | None structural |
| Student | DSCR, Break-Even, LTV | OER (55/75) | Cap Rate PP, Gross Yield (10/7) | IRR, NPV, CoC Post-Tax | Utilities Ratio uses the generic commercial band — no student-specific research done |
| STR | DSCR, Break-Even, LTV | OER (50/70) | Cap Rate PP, Gross Yield (15/10) | IRR, NPV, CoC Post-Tax | Utilities Ratio uses the generic commercial band — STR utility inclusion patterns likely differ sharply from long-let |
| Instalment Sale | DSCR, Break-Even, LTV | OER, Utilities Ratio | Cap Rate PP, Gross Yield (8/5) | IRR, NPV, CoC Post-Tax | Engine treats it as a plain rental strategy — `instalmentTerm`/`instalmentRate` are captured on input but never read by any calculation (confirmed dead fields); the "financing arrangement" character of an instalment sale is not actually modeled |
| Fix & Flip | **None** — DSCR/LTV/Break-Even are still computed as numbers (`calcAllMetrics` doesn't skip them) but have no threshold entry for `fix_and_flip`, so they're always unclassified/not_applicable | **None** modeled — OER/Utilities Ratio are computed off rental-style inputs that don't represent flip economics | **None classified** — Cap Rate PP/Gross Yield/Cap Rate MV computed but unclassified for flip | Pre-Tax ROI, Annualised Pre-Tax ROI (both unclassified pending Phase 4.10 recalibration); IRR/NPV are technically computed by `calcAllMetrics` but carry no flip threshold entry, so they're unclassified too | Financial-safety category doesn't exist for Flip at all — not merely "weak evidence," structurally absent. See §S. |

**Answer to §21 (Instalment Sale):** the calculation engine currently models Instalment Sale as a rental strategy — `instalmentAmount` feeds `calcBaseMonthlyRevenue` exactly like rent, and the full rental metric suite runs against it. It is **not** modeled as a seller-financing arrangement (the interest/term fields exist on input but are unused). The verdict framework should therefore treat Instalment Sale using the same rental category framework as everything else, while flagging the unused `instalmentRate`/`instalmentTerm` fields as a modeling gap for a future phase, not something Phase 4.12 should paper over.

---

## H. Verdict definitions (required output §88)

- **Strong** — The deal has no active weak reading on either primary financial-safety metric (DSCR, Break-Even Ratio), no unclassified primary safety metric, meets the investor's required return (Equity IRR ≥ discountRate), and shows no weak reading on the primary operating-quality and property-performance metrics. Strong is deliberately hard to reach — any gap in the safety evidence blocks it, even if every visible number looks good.
- **Promising** — The deal has genuine investment merit and no severe structural weakness, but does not clear every Strong requirement — e.g. safety is acceptable but not verifiably strong, or one supporting-category metric is weak while the primary metrics hold up. Promising is not "everything that isn't obviously bad" — it still requires safety to be at least acceptable and no primary metric to be flatly weak.
- **Promising If Negotiated** — The deal is currently below the desired standard, but a specific, currently-computable negotiable acquisition term (in practice: purchase price) would move it into acceptable territory, *and AssetVerdict can prove this deterministically by recomputing the deal at that term* — not by assertion. **This label cannot be honestly produced today** — see §K. Until a deterministic solver exists, no deal should receive this verdict.
- **High Risk** — One or more primary financial-safety metrics reads Weak (DSCR below its sustainable-coverage cutoff, or Break-Even Ratio too close to/above 100% of gross income), or a combination of moderate safety cautions compounds into an unresilient structure. Return potential does not offset this — a High Risk deal can simultaneously show an excellent IRR.
- **Does Not Meet Target** — Financial safety is acceptable or strong (no primary safety metric weak), but the investor's own required return is not cleared (IRR below discountRate, confirmed by NPV not exceeding the near-zero tolerance). This is explicitly not a danger signal — it means the deal is viable but not good enough for *this* investor's stated hurdle.

---

## I. Safety override philosophy

**Yes — a severe safety failure must block Strong and must block every target-driven positive outcome, including Promising If Negotiated.** The architecture is a hard gate, evaluated first: if either primary safety metric (DSCR or Break-Even Ratio) reads Weak, the verdict is High Risk regardless of how attractive IRR/NPV/Cap Rate look. This directly answers the Phase 4.12 brief's own worked example (IRR = 30%, DSCR = 0.90 → never Strong) and the required quality check "can a high IRR hide a severe safety failure? — NO."

**Unknown safety is not the same as weak safety.** If a primary safety metric is unclassified or has no data (e.g. Fix & Flip, or a rental deal missing debt-service inputs), Strong is blocked (safety cannot be certified), but the deal is not automatically pushed to High Risk — that would punish absence of evidence as if it were evidence of danger, violating §77/§98's "unclassified must never secretly act like Weak." It instead falls to Promising or Does Not Meet Target depending on the target read, carrying an explicit reason that safety evidence is insufficient.

---

## J. Investor-target philosophy

Investor Target is evaluated entirely independently of Safety and never promoted or demoted by it. A deal with `discountRate = 40%` failing target is not High Risk — it's `does_not_meet_target`, because the *investor's own aggressive personal hurdle* is not a financial-safety fact. Symmetrically, a `discountRate = 2%` hurdle being cleared does not manufacture Strong on its own — Strong still requires the safety gate to pass independently. This directly satisfies §59/§60/§61 and the required quality checks ("can a low investor target make a fragile deal Strong? NO" / "can a high investor target make a resilient deal High Risk? NO").

Because `discountRate` is investor-entered, a user can influence whether their own deal meets *their own target* — that's intentional and correct (it's their hurdle). What they cannot do is influence the Safety, Operating, or Performance category states through `discountRate`, since none of those categories' rules reference it (`ClassificationContext.discountRate` is only ever consumed by `target_relative`/`zero_relative` models — confirmed in `thresholds.ts:460-477` — fixed_bands metrics never see it).

---

## K. Negotiation philosophy — and negotiation-engine readiness (required output §91)

**Readiness: NO.** There is no deterministic target-price, maximum-offer, or required-discount solver anywhere in `lib/calculations/`. The only code that even mentions negotiation is a Deal Coach prompt instruction that explicitly forbids the AI from inventing a specific offer price (`dealCoachPrompt.ts:78`).

This *is* buildable, however, and cheaply: `calcAllMetrics(inputs)` is already a pure function of `DealInputs`, and every classification is already a pure function of a metric value plus strategy plus (for target-relative metrics) `discountRate`. A deterministic solver — e.g. binary-search `purchasePrice` downward until Safety and Target categories both clear, or report "no price in a sane range fixes it" — is a Phase 4.13-scoped, self-contained addition that needs no new architecture, only a new pure function plus a defined search variable set.

**Recommendation (owner Decision 3): Option A, phased.** `promising_if_negotiated` must not ship until the deterministic solver exists. Until then, the verdict engine should simply not produce that label — a deal that would have qualified instead resolves to `does_not_meet_target` (or `high_risk`, per the safety gate), and its *reasons* may still mention, in plain language, that "purchase price is the dominant lever affecting this outcome" without asserting a specific negotiated verdict. This is honest: it uses the same negotiable-variable framing Deal Coach already uses today, without fabricating a verdict AssetVerdict cannot yet prove.

**Negotiable variable map:**

| Variable | Negotiable? | Why | Metrics affected | Eligible for verdict improvement today? |
|---|---|---|---|---|
| Purchase Price | Yes | Direct acquisition-side lever, fully user-controllable pre-close | LTV, Equity, Cap Rate PP, Cash-on-Cash, IRR, NPV, Break-Even Ratio | Only once a deterministic solver exists (§K) |
| Deposit / financing structure | Yes, partially | Negotiable with the lender, not the seller, but still a real pre-close lever | LTV, DSCR, equity invested | Not modeled as a negotiation input today |
| Renovation budget (Flip) | Possibly | Controllable scope decision, not a "negotiation" with a counterparty in the strict sense | Flip cost basis, ROI | Not modeled |
| Seller terms (e.g. instalment rate) | Theoretically | `instalmentRate`/`instalmentTerm` exist on input but are unused by any calculation (§G) | None currently — dead fields | No — not computed at all today |
| Occupancy, rent growth, capital growth, market value, interest rates | **No** | These are forecast/market assumptions, not things a buyer negotiates with a seller | Everything | Must never be treated as "negotiation" |

---

## L. Scenario role

**Recommendation (owner Decision 4): Option A — Base only determines the verdict; Bear/Bull are shown as context, not folded into the verdict engine, for now.**

Reasoning: Bear only stresses `rentalGrowthRate`, `capitalGrowthRate`, and `occupancyRate` — it does not stress financing rates at all (§B). Using Bear to certify "safety resilience" for the verdict would imply a downside stress test that doesn't actually cover the single biggest real-world driver of DSCR deterioration (rate rises / refinancing risk). Calling that "resilience" would be a false precision the framework explicitly must avoid. Option B (Base determines verdict, Bear caps/qualifies Strong) becomes viable only once financing-rate stress is added to `calcScenarios` — flagged as a future enhancement, not attempted now.

**Current vs projected safety (§15):** confirmed — DSCR, LTV, Break-Even Ratio, OER, Utilities Ratio are all Year-1/current snapshots; none has a "minimum across the hold period" variant. The verdict engine must describe DSCR as "current DSCR," never as "minimum projected DSCR" — that metric doesn't exist.

---

## M. Unclassified / N/A handling

Both are already correctly modeled at the metric layer (`MetricClassification`'s three-state union in `thresholds.ts:400-412`, `not_applicable` from `applicability.ts`) and both UI/PDF layers already respect the distinction (GaugeDial renders "neutral" as grey, never a colour; the PDF renders literal "N/A" text in slate, distinct from red/orange/green — confirmed by direct code inspection, §Verification below). The verdict engine must preserve this exactly:

- **N/A metrics contribute nothing** — not a soft caution, not a missing-strong-requirement. A DSCR that's N/A because the deal has no debt is neither a safety point in favour nor against.
- **Unclassified metrics contribute nothing to color/severity**, but (per §I and §Q) an unclassified *primary* metric does block Strong, because Strong requires certainty, not because unclassified is being treated as Weak. This is a subtle but load-bearing distinction: unclassified metrics never generate a negative *reason*, they generate an *"insufficient evidence to certify Strong"* reason — structurally different text, never phrased as a weakness.

---

## N. Missing-data handling

**Recommendation:** calculate the verdict from whatever evidence is actually available, using the same unknown-state handling as §I/§M — never invent or assume a value for a missing input. If a verdict-critical primary metric can't even be computed as `not_applicable` or `unclassified` (i.e., the underlying `DealInputs` field itself is missing/null upstream of the calculation engine), that should surface as "cannot be evaluated" for that category, blocking Strong exactly as an unclassified metric would, with a reason naming the missing input.

---

## O. Verdict precedence (required output §89)

```
1. Any PRIMARY Financial Safety metric (DSCR or Break-Even Ratio) = Weak
        → HIGH_RISK                                  (hard override, always wins)

2. Financial Safety = weak-by-compounding
   (two or more moderate/caution-level primary+supporting safety signals
    together, e.g. DSCR caution + LTV high)
        → HIGH_RISK

3. Financial Safety ∈ {strong, acceptable} AND Investor Target = missed
   AND a deterministic negotiation solver exists AND finds a qualifying price
        → PROMISING_IF_NEGOTIATED           (unavailable until Phase 4.13 — see §K)

4. Financial Safety ∈ {strong, acceptable} AND Investor Target = missed
   AND no qualifying negotiation exists (or solver doesn't exist yet)
        → DOES_NOT_MEET_TARGET

5. Financial Safety = strong AND Investor Target = met
   AND Operating Quality ≠ weak AND Property Performance ≠ weak
   AND no PRIMARY metric anywhere is unclassified/unknown
        → STRONG

6. Financial Safety = unknown (primary safety metric unclassified/no data,
   not proven weak) → STRONG is blocked regardless of how step 5 would read;
   falls through to PROMISING (if Target met/near) or DOES_NOT_MEET_TARGET
   (if Target clearly missed) with an explicit "insufficient safety evidence"
   reason — never HIGH_RISK for absence of evidence alone.

7. Everything else with genuine merit and no severe weakness
        → PROMISING
```

---

## P. Conflict case testing (required output §90 — 12 cases)

| # | Case | Safety state | Target state | Expected verdict | Why |
|---|---|---|---|---|---|
| 1 | High IRR, weak DSCR | weak | met | **High Risk** | Step 1 hard override — return never hides fragility |
| 2 | Strong DSCR, IRR below target | strong | missed | **Does Not Meet Target** | Safety fine; simply doesn't clear investor's own hurdle |
| 3 | Strong everything | strong | met | **Strong** | Clears every gate |
| 4 | Mixed caution signals (DSCR caution, Break-Even caution, LTV high) | weak (compounding, step 2) | met | **High Risk** | Three moderate warnings compound — no single one is severe alone, but together they describe a fragile structure |
| 5 | Target barely missed (IRR 0.3pts below discountRate, within caution margin) | strong | missed (but "near", within provisional 2pt caution band) | **Does Not Meet Target** (with "Near Target" reason wording, not "Below Target") | Target-relative classification already distinguishes Exceeds/Near/Below — verdict reasons should carry that nuance rather than flattening it |
| 6 | Very aggressive Required Return (40%), otherwise healthy deal | strong | missed | **Does Not Meet Target** | §59 — an aggressive personal hurdle is not proof of danger |
| 7 | Very low Required Return (2%), fragile deal | weak | met | **High Risk** | §60 — safety gate is independent of how easy the investor's own hurdle is |
| 8 | Missing safety metric (no debt-service data available) | unknown | met | **Promising**, not Strong, with an explicit "safety cannot be certified — missing debt-service data" reason | §I/§98 — unknown ≠ weak, but also ≠ automatically Strong |
| 9 | Fix & Flip, unclassified Pre-Tax ROI, otherwise clean numbers | n/a (no safety category exists for Flip) | n/a (Flip has no classified target metric today) | **Cannot currently be verdicted with confidence — see §S**; if forced, the only honest label is a Promising-ceiling with heavy "insufficient calibrated evidence" caveats, never Strong | §43/§56/§S — a whole strategy currently has zero verdict-eligible metrics |
| 10 | Strong acquisition yield (Cap Rate PP excellent) but weak cashflow (negative Year-1 cashflow) | Safety metrics themselves may read acceptable, but negative cashflow is a distinct hard fact | met or missed independent of this | **High Risk**, with negative Year-1 cashflow surfaced as its own explicit reason, for rental strategies where sustained income is the point | §58 — negative cashflow deserves independent verdict weight for rental strategies even if DSCR/Break-Even happen to still clear, since DSCR/Break-Even do not directly encode "is the number actually negative this year" |
| 11 | High leverage (LTV 85%) + strong DSCR + strong Break-Even | acceptable, capped below strong-tier Safety | met | **Promising**, not Strong | §27/§64 — LTV as amplifier/Strong-gate qualifier: strong coverage with high leverage is real merit but not the cleanest possible safety profile, so it caps Strong without triggering High Risk |
| 12 | Low leverage (LTV 40%) + weak DSCR | weak | met | **High Risk** | §27 — low leverage does not rescue a coverage failure; DSCR is an independent primary gate regardless of LTV |

---

## Q. Threshold-confidence audit (required output §92, partial — full backlog below)

Confidence levels, read directly from `ThresholdDefinition.evidenceLevel` in `thresholds.ts` (not invented for this report):

- **`moderate`**: DSCR only (commercial). Everything else classified is `internal` or `provisional` — i.e. AssetVerdict's own reference values, not sourced to a named external body.
- **`provisional`, explicitly flagged in code comments as needing research**: IRR's 2-point caution margin, NPV's 5%-of-equity near-zero tolerance, both Cash-on-Cash comparisons.
- **`internal`**: LTV, Break-Even Ratio, OER, Utilities Ratio, Gross Yield, Cap Rate PP, Cap Rate Spread, and DSCR on every non-commercial strategy.

## R. Threshold research backlog (required output §92)

| Metric | Why research is needed | Strategy scope | Current evidence quality | Decision blocked |
|---|---|---|---|---|
| DSCR | 1.25x/1.0x (and per-strategy variants) are AssetVerdict's own reference numbers, not sourced to a named lender | All rental strategies | Moderate (commercial), internal (others) | Whether DSCR should be a hard Strong-blocking gate at its current cutoffs, or needs recalibration first |
| LTV | Band values are undocumented internally | All rental strategies | Internal | How strongly LTV should amplify safety severity |
| Break-Even Ratio | Same-character measure as DSCR but independently unsourced | All rental strategies | Internal | Whether it should retain independent hard-gate power (§Q) or be demoted to supporting |
| Utilities Ratio | Calculation doesn't distinguish gross utility cost from tenant recoveries; single band used across strategies with very different utility-inclusion norms (STR vs BTL) | All rental strategies, especially STR/Student | Internal, explicitly flagged as limited in its own rationale text | Whether it can carry any verdict weight at all before this is fixed |
| Commercial lease context | Flagged in Phase 4.6/4.7 work; not re-audited here | Commercial | Not assessed in this phase | Whether OER/Break-Even need commercial-lease-specific handling |
| Flip Pre-Tax ROI | Definition changed in Phase 4.10 (now pre-tax); old post-tax-calibrated bands no longer apply; no new bands set | Fix & Flip | None — explicitly unclassified pending research | Blocks any Flip verdict eligibility — see §S |
| Flip Annualised Pre-Tax ROI | Same as above | Fix & Flip | None | Same |
| Flip Profit Margin | No threshold entry exists at all (not even an explicit `unclassified` with rationale) — an inconsistency with how ROI/Annualised ROI/Net Profit were handled in Phase 4.10 | Fix & Flip | None | Low-risk cleanup: give it an explicit `unclassified` entry with rationale, matching its siblings — recommended for a future small PR, not this phase (see §83 rule: does not meet the "UI directly contradicts code" bar for an in-phase fix) |

**Recommendation for each:** `KEEP FOR UI ONLY` — none should be removed from the UI (they remain useful individually-classified information). `RESEARCH BEFORE VERDICT` applies to all rows above before they're allowed to drive a PRIMARY-tier verdict decision; in the interim they can still participate as SUPPORTING/INFORMATIONAL signals per the role matrix in §C, since that tier already discounts their influence.

---

## S. Fix & Flip calibration plan (required output §93)

Fix & Flip is structurally different from every rental strategy: it has no ongoing income stream, no debt-service coverage question in the DSCR sense, and its risk is concentrated in execution (cost overrun, resale-price shortfall, holding-period slippage) rather than ongoing financial resilience. Forcing DSCR/Break-Even/OER onto it (as the current calculation engine technically still computes, unclassified, for flip deals — §G) would misrepresent the deal; the framework should not do this.

**What Flip verdict-readiness actually needs, not yet available:**
1. A defensible Pre-Tax ROI / Annualised Pre-Tax ROI band — requires either (a) external evidence of what pre-tax flip returns "good/marginal/poor" actually look like in this market, or (b) a decision to make Flip's target metric investor-target-relative (compare ROI against the investor's own required return, the same way IRR works for rentals) rather than a universal fixed band. **Recommendation: investor-target-relative is the more defensible path** — it avoids inventing a universal "good ROI" law (violating §54) and reuses the exact `target_relative` model already built and tested for IRR/Cash-on-Cash. This needs an owner decision, not a guess, since it changes what kind of number Pre-Tax ROI is being judged against.
2. A genuine Flip "safety"-equivalent category — likely built from execution/margin-safety signals the engine doesn't currently expose as ratios at all (e.g. renovation cost as a % of total budget, contingency margin, days-on-market assumption sensitivity) — not a retrofit of rental DSCR logic.
3. The missing Profit Margin threshold entry (§R) should be added for UI/education consistency regardless of when Flip becomes verdict-eligible.

Until (1) and (2) exist, **Fix & Flip deals should not receive Strong, Promising, or Does Not Meet Target verdicts on the strength of numeric evidence the framework can't yet certify.** The honest interim behaviour is a distinct "insufficient calibrated evidence" state for Flip specifically — see owner decision list, §Y.

---

## T. Negotiation-engine readiness

Restated from §K for the required-output list: **NO.** No deterministic price solver exists. `promising_if_negotiated` should not be produced by Phase 4.13's initial verdict engine.

---

## U. Recommended verdict architecture (owner Decision 1)

**Recommendation: Option C — Hybrid (category states, then deterministic rules across categories).**

Option A (weighted score) is rejected outright — it is explicitly prohibited by this phase's brief and would average away exactly the kind of severe-but-isolated safety failure the whole framework exists to protect against.

Option B (a flat decision tree over raw metrics) is workable but harder to explain and harder to extend per-strategy — every strategy would need its own tree rather than sharing one.

Option C keeps one shared verdict philosophy (the precedence rules in §O operate purely on category states: Safety/Operating/Performance/Target/Negotiation) while letting **category aggregation** be strategy-aware (§C/§G show exactly which metrics feed each category per strategy, including the empty Flip Safety category). This is the only option that lets Commercial, Buy-to-Let, and Fix & Flip share one verdict engine without forcing Flip through rental-shaped logic.

---

## V. Proposed pseudocode (not implemented)

```ts
type CategoryState = "strong" | "acceptable" | "weak" | "unknown" | "not_applicable";
type TargetState = "met" | "near" | "missed" | "unknown" | "not_applicable";

function deriveSafetyState(metrics, classifications, strategyId): CategoryState {
  // strategyId === "fix_and_flip" -> "not_applicable" (no safety category exists yet, §S)
  const dscr = classifications.dscr;
  const breakEven = classifications.breakEvenRatio;
  const ltv = classifications.ltv;

  if (dscr.status === "classified" && dscr.color === "red") return "weak";
  if (breakEven.status === "classified" && breakEven.color === "red") return "weak";

  const cautionCount = [dscr, breakEven, ltv]
    .filter(c => c.status === "classified" && c.color === "orange").length;
  if (cautionCount >= 2) return "weak"; // compounding moderate warnings, §65/case 4

  if (dscr.status !== "classified" || breakEven.status !== "classified") return "unknown"; // §I

  if (dscr.color === "green" && breakEven.color === "green" && ltv.color !== "red") return "strong";
  return "acceptable";
}

function deriveTargetState(classifications): TargetState {
  const irr = classifications.irr; // primary
  if (irr.status !== "classified") return "unknown";
  if (irr.label === "Exceeds Target") return "met";
  if (irr.label === "Near Target") return "near";
  return "missed";
}

function deriveOperatingState(classifications): CategoryState { /* OER primary, Utilities supporting — same worst-primary-wins shape as Safety, no compounding rule needed (no evidence yet two moderate operating cautions compound the way safety ones do) */ }
function derivePerformanceState(classifications): CategoryState { /* Cap Rate PP primary, Gross Yield/Cap Rate Spread supporting */ }
function deriveNegotiationState(inputs): "none" { return "none"; /* until Phase 4.13 solver exists, §K/§T */ }

function deriveVerdict(inputs, metrics, classifications, strategyId) {
  const safety = deriveSafetyState(metrics, classifications, strategyId);
  const target = deriveTargetState(classifications);
  const operating = deriveOperatingState(classifications);
  const performance = derivePerformanceState(classifications);
  const negotiation = deriveNegotiationState(inputs);

  if (strategyId === "fix_and_flip") {
    return insufficientEvidenceVerdict(reasons: ["Fix & Flip has no calibrated safety or target metrics yet — see Phase 4.12 §S"]);
  }

  if (safety === "weak") return highRisk(reasonsFrom(safety, target));

  if (target === "missed") {
    if (negotiation === "plausible") return promisingIfNegotiated(...); // unreachable until §K solver ships
    return doesNotMeetTarget(reasonsFrom(safety, target));
  }

  if (safety === "unknown") {
    return promising(reasons: ["Safety evidence insufficient to certify Strong", ...]);
  }

  if (safety === "strong" && target === "met" && operating !== "weak" && performance !== "weak") {
    return strong(reasonsFrom(safety, target, operating, performance));
  }

  return promising(reasonsFrom(safety, target, operating, performance));
}
```

This is illustrative only — not to be implemented in Phase 4.12.

---

## W. Proposed deterministic reason model (required output §95)

```ts
interface VerdictReason {
  category: "safety" | "operating" | "performance" | "target" | "negotiation";
  severity: "blocking" | "high" | "moderate" | "informational";
  metric: string;              // e.g. "dscr"
  messageKey: string;          // e.g. "weak_dscr", "target_irr_missed", "high_oer", "safety_evidence_insufficient"
  value: number | null;
  classification: MetricClassification; // the exact object thresholds.ts already produces — never re-derived
}
```

Examples:

```ts
{ category: "safety", severity: "blocking", metric: "dscr", messageKey: "weak_dscr", value: 0.90,
  classification: { status: "classified", color: "red", label: "Weak", category: "financial_safety", model: "fixed_bands" } }

{ category: "target", severity: "high", metric: "irr", messageKey: "target_irr_missed", value: 8.2,
  classification: { status: "classified", color: "red", label: "Below Target", category: "investor_target", model: "target_relative" } }

{ category: "operating", severity: "moderate", metric: "operatingExpenseRatio", messageKey: "high_oer", value: 58,
  classification: { status: "classified", color: "orange", label: "Caution", category: "operating_quality", model: "fixed_bands" } }

{ category: "negotiation", severity: "informational", metric: "purchasePrice", messageKey: "negotiation_lever_available", value: null,
  classification: null } // no deterministic solver yet — this reason may only ever be prose, never a verdict-changing fact, until §K ships
```

Reasons are structured data produced by the engine; **all copy generation happens downstream** (UI/education/PDF), never inside the engine itself — matching the existing pattern where `thresholds.ts` returns structured classification and callers format it.

---

## X. Deal Coach integration architecture (required output §96)

```
Deterministic Verdict Engine (lib/calculations/*, new, Phase 4.13+)
        │
        ▼
  { verdict, categoryStates, reasons, blockers }
        │
        ▼
Deal Coach (lib/ai/buildDealCoachContext.ts, dealCoachPrompt.ts)
        │
        ▼
  Explanation only — quotes/paraphrases the deterministic reasons
```

This is already the pattern Deal Coach uses for individual metric classifications today — confirmed by direct code inspection: `buildDealCoachContext.ts` copies `classification.label`/`category`/`model` straight from `thresholds.ts` into the AI's context, and `dealCoachPrompt.ts:19` instructs the model to *"Never calculate, recompute, re-derive, adjust, or 'sanity check' a metric yourself."* Extending this to a future overall verdict is a natural, already-proven extension — Deal Coach never independently invents a per-metric judgement today, and must never independently invent an overall verdict once one exists. `dealCoachPrompt.ts:23` must be rewritten at that point (§A) to describe the new contract instead of asserting no verdict exists.

---

## Y. Owner decisions required

**Decision 1 — Verdict architecture.** Recommend **C: Hybrid** (category states + deterministic cross-category rules). See §U.

**Decision 2 — Safety override.** Recommend **YES** — severe safety weakness (a weak PRIMARY safety metric, or compounding moderate safety warnings) blocks Strong and blocks every target-driven positive verdict, forcing High Risk regardless of return. See §I, §O step 1–2.

**Decision 3 — Negotiation verdict.** Recommend **`promising_if_negotiated` requires the deterministic solver described in §K before it can ever be produced.** Do not ship the label with a heuristic substitute (e.g. "IRR is within 2 points of target, assume price fixes it") — that would be exactly the "wishful thinking" this phase was warned against. Build the solver as an early Phase 4.13 task; it's cheap given the calculation engine is already pure.

**Decision 4 — Scenario role.** Recommend **A: Base only** determines the verdict; Bear/Bull remain contextual until financing-rate stress is added to `calcScenarios`. See §L.

**Decision 5 — Unclassified critical metrics.** Recommend **YES**, they block Strong (but never manufacture High Risk on their own — see §I, §M). This is also the deciding factor that makes Fix & Flip currently unable to reach Strong under any circumstances, since it has zero classified primary metrics in any category (§S) — an explicit owner call on whether Fix & Flip should get its own interim verdict state ("insufficient calibrated evidence") rather than being silently forced through the rental logic, or be excluded from verdicts entirely until §S's calibration work lands, is needed before Phase 4.13 implementation.

---

## Z. Recommended Phase 4.13 scope

Phase 4.13 should NOT start with numeric threshold calibration. Recommended order:

1. Owner sign-off on Decisions 1–5 above (§Y).
2. Implement the deterministic verdict engine per §U/§V, gated behind the *existing* threshold/applicability data — no new numeric bands, just aggregation logic over what already exists.
3. Implement the deterministic negotiation/target-price solver described in §K (self-contained, reuses `calcAllMetrics` — needed before `promising_if_negotiated` can ever be truthfully produced).
4. Decide Fix & Flip's interim verdict treatment (§S/§Y Decision 5) — most likely a distinct "insufficient calibrated evidence" state rather than forcing it through Strong/Promising/High Risk logic built for rental deals.
5. Update `dealCoachPrompt.ts:23` to describe the new verdict contract (§A/§X).
6. Only then: commission the actual research listed in §R (DSCR/LTV/Break-Even/OER/Utilities Ratio calibration evidence, Flip Pre-Tax ROI band vs. target-relative decision) before any PRIMARY-tier threshold is treated as final.

---

## Final quality check (§98)

- Can a high IRR hide a severe safety failure? **NO** — §O step 1 is a hard override.
- Can a low investor target make a financially fragile deal Strong? **NO** — §J, §O step 1 fires before target is ever consulted.
- Can a high investor target make a financially resilient deal High Risk? **NO** — §J, §O step 4 (Does Not Meet Target), never High Risk.
- Are financial safety and investor return treated separately? **YES** — §O's precedence never merges the two into one score.
- Are mathematically related metrics prevented from receiving duplicate verdict weight? **YES** — §F.
- Can an unclassified metric secretly act like Weak? **NO** — §I/§M: unknown blocks Strong, never manufactures High Risk.
- Can N/A act like zero? **NO** — §M, confirmed against actual GaugeDial/PDF rendering code, not just intent.
- Can Deal Coach independently override the deterministic verdict? **NO** — confirmed by existing prompt guardrails and test suite (§A, §X); the pattern already exists and needs extending, not inventing.
- Does Promising If Negotiated have a real deterministic basis rather than wishful thinking? **Not yet — explicitly deferred until §K's solver ships.** This is the single biggest open gap this phase found.
- Do we have a coherent verdict philosophy before assigning or changing numerical thresholds? **YES** — and no thresholds were changed to get here.

---

## Verification note

The audits in §A–§G were produced by directly reading `lib/calculations/index.ts`, `thresholds.ts`, `applicability.ts`, `scenarios.ts`, `lib/ai/buildDealCoachContext.ts`, `dealCoachPrompt.ts`, `dealCoachTypes.ts`, `app/api/deals/[id]/coach/route.ts`, `components/DealCoachDrawer.tsx`, `lib/pdf/DealSummaryPDF.tsx`, `components/gauges/GaugeDial.tsx`, and the summary page/components, plus `prisma/schema.prisma`. The test/build baseline was re-run for this phase: **424/424 tests passing (unchanged)**, `eslint` clean (0 errors, 1 pre-existing warning), `tsc --noEmit` has 4 pre-existing type errors confined to `lib/calculations/__tests__/assembleInputs.test.ts` (unguarded optional `exitSummary` access in two assertions) — not a regression, not touched, since it's outside this phase's scope and not verdict-related.

**No production code, thresholds, classifications, or schema were changed in this phase.**
