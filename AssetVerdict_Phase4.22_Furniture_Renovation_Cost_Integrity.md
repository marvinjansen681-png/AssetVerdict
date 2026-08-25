# AssetVerdict — Phase 4.22: Furniture & Renovation Cost Integrity

**Status:** Complete
**Scope:** Financial input-integrity correction only. LTV was not touched. No verdict thresholds, verdict labels, tax policy, DSCR/IRR/OER/Break-Even policy, financing policy, CGT policy, transfer duty, Phase 4.21 formulas, or unrelated UI/architecture were changed. No large database migration was performed.

---

## 1. Baseline — the Traced Flow

```
Furniture/setup UI (RenovationBudget.tsx)
  Quantity, Unit Cost -> Budgeted (locally computed)
  Quoted (typed independently, never consulted downstream)
  ↓ 800ms debounce, PUT
/api/deals/[id]/renovation (route.ts) — zod-validated, NOT recomputed
  ↓
upsertRenovationItems (lib/db/deals.ts) — DELETE ALL + INSERT ALL, one transaction
  Deal.renovationCost = naive sum(item.budgeted)   <- quoted, contingency ignored
  ↓
assembleInputs() reads Deal.renovationCost directly (lib/calculations/assembleInputs.ts, unchanged)
  ↓
calcTotalInvestment() = purchasePrice + transferBondCost + renovationCost + sourcingFee (lib/calculations/index.ts, unchanged)
  ↓
calcInitialEquityInvestment / calcNetYieldPreTax / calcIRR / calcNPV / calcPaybackPeriod / verdict inputs (all unchanged — pure functions of the DealInputs the furniture cost feeds into)
```

Files touched by this trace: `components/forms/RenovationBudget.tsx`, `app/api/deals/[id]/renovation/route.ts`, `lib/db/deals.ts`, `app/api/deals/[id]/route.ts` (the general Deal PATCH endpoint — see Defect 8 below), `lib/pdf/DealSummaryPDF.tsx`, `components/FlipDashboard.tsx`, `app/(app)/deals/[id]/edit/acquisition/page.tsx`, and `prisma/schema.prisma`'s `RenovationItem` model (`budgeted Float @default(0)`, `quoted Float?`, `quantity Float?`, `unitCost Float?` — no new column was needed, see §2).

`lib/calculations/index.ts`'s `calcTotalInvestment`/`assembleInputs.ts` were confirmed to read `Deal.renovationCost` as a single field — no double-counting risk existed at that layer; every defect found was upstream of it, in how that one field got computed and persisted.

---

## 2. Defects Confirmed and Root Causes

| # | Defect | Root cause |
|---|---|---|
| 1 | Stale budget after clearing Quantity/Unit Cost | `updateItem`'s recompute only fired when **both** `quantity !== null && unitCost !== null`; clearing one left `next.budgeted` un-touched by the `{...i, ...patch}` spread, carrying the old product forward |
| 2 | Quoted cost captured but never used | `total`/`subtotal` in the old component, and `Deal.renovationCost` server-side, both only ever summed `budgeted`; `quoted` was display-only |
| 3 | Contingency stored as a stale fixed amount | `defaultBudgeted = subtotal * 0.1` was computed **once**, at add-time, then became an ordinary editable `budgeted` number — never recalculated as the subtotal changed |
| 4 | Duplicate contingency possible | The `+ Contingency` category chip added a new row every click, unlike the presets branch which deduplicates by description — nothing prevented two competing contingency rows |
| 5 | Autosave loses the last edit | The 800ms debounce's cleanup only cleared the pending timer on unmount — it never fired the save, so navigating away inside the 800ms window silently dropped the edit |
| 6 | Autosave races | No mechanism prevented two overlapping PUT requests; whichever transaction committed last won, regardless of which held newer data |
| 7 | Server trusted client-computed `budgeted` | The zod schema validated `budgeted` as `nonnegative()` and persisted it as-is — `quantity * unitCost` was never recomputed server-side, so a client (bug or manipulation) sending a conflicting `budgeted` was accepted verbatim |
| 8 | **(found during this phase's own repository-wide search, §9)** `Deal.renovationCost` was also writable directly through the general `PATCH /api/deals/[id]` endpoint | `coerceNumericFields` spreads the **entire** request body through to `prisma.deal.update`, and `renovationCost` was listed in that endpoint's numeric-coercion whitelist — a request body containing `renovationCost` would silently overwrite the authoritative computed value, completely bypassing the furniture-cost pipeline |

Defects 1–4 and 7–8 are pure trust/staleness bugs; 5–6 are the autosave reliability defects the brief specifically asked to be audited.

---

## 3. The Authoritative Formulas

### Budget Cost (requirement 2/3)
```
lib/calculations/furnitureCosts.ts — calcFurnitureItemBudgetCost(item)

if unit pricing was never engaged (quantity === null AND unitCost === null):
    Budget Cost = item's own directly-typed `budgeted` (a lump sum — nothing to recompute it from)
else if BOTH quantity and unitCost are present and valid:
    Budget Cost = quantity * unitCost
else (one is missing/invalid — unit pricing engaged but incomplete):
    Budget Cost = null   <- never the stale prior number
```

### Quoted vs Budget — Cost Used hierarchy (requirement 4)
```
calcFurnitureItemResult(item):
  budgetCost = calcFurnitureItemBudgetCost(item)
  quotedCost = a valid, non-negative `quoted`, else null
  variance   = quotedCost === null ? null (N/A) : quotedCost - (budgetCost ?? 0)
  costUsed   = quotedCost !== null ? quotedCost : (budgetCost ?? 0)   <- NEVER budgetCost + quotedCost
```

### Contingency (requirements 7–9)
```
calcFurnitureCostSummary(items, contingencyPct):
  costUsedTotal    = sum of costUsed across every non-Contingency item
  contingencyBase  = costUsedTotal          <- same Cost Used basis as the items themselves
  contingencyAmount = contingencyPct !== null ? contingencyBase * contingencyPct/100 : 0
  grandTotal       = costUsedTotal + contingencyAmount   <- this becomes Deal.renovationCost
```
Contingency is modelled as **one dedicated percentage control** (`RenovationBudget.tsx`), never a repeatable line item — see §5 for why no schema change was needed to store it durably.

### Server-authoritative recomputation (requirement 13)
```
lib/db/deals.ts — upsertRenovationItems / app/api/deals/[id]/renovation/route.ts POST

Server-side, EVERY item's persisted `budgeted` = calcFurnitureItemBudgetCost(item) ?? 0
— a client-sent `budgeted` is ALWAYS ignored/overwritten whenever quantity/unitCost are present.
Deal.renovationCost = calcFurnitureCostSummary(items, contingencyPct).grandTotal
— never a naive sum of `budgeted` alone.
```

---

## 4. Before / After — Worked Examples (all figures taken from passing test assertions, not hand-computed)

**Stale budget after clearing (`furnitureCosts.test.ts`):**
Quantity 12 × Unit Cost R3,000 = Budget R36,000. Quantity cleared → **Before:** R36,000 silently remained. **After:** `budgetCost = null`, `costUsed = 0`.

**Quote overrides budget:**
Budget R25,000, Quote R32,000 → **Before:** deal used R25,000 (Quote ignored). **After:** Cost Used = **R32,000**.

**Partial quotes, no double count (`furnitureCosts.test.ts`, `deals.renovation.test.ts`):**
Beds — Budget R30,000, Quote R35,000. Desks — Budget R20,000, no quote.
**Before:** `Deal.renovationCost` = R30,000 + R20,000 = R50,000 (Quote never consulted).
**After:** Cost Used Total = R35,000 + R20,000 = **R55,000**. And for a single item with Budget R25,000/Quote R32,000, Cost Used is confirmed to be exactly R32,000, never R57,000 (Budget + Quote).

**Dynamic contingency (`furnitureCosts.test.ts`):**
Base R100,000, 10% → R10,000. Base rises to R150,000 → **Before:** would have stayed at R10,000 (stored fixed amount). **After:** recalculates to **R15,000** automatically, because contingency is derived fresh from the current Cost Used total on every render/save, never stored as a fixed number.

**Server ignores a manipulated client Budget (`furnitureCosts.test.ts`, `deals.renovation.test.ts`):**
Client sends Qty=10, Unit Cost=R2,500, Budget=R99,000. **Before:** R99,000 persisted verbatim. **After:** server persists **R25,000** (`quantity x unitCost`), R99,000 is discarded entirely.

**Total Investment reconciliation (`furnitureCostsIntegration.test.ts`):**
Purchase R2,000,000 + Transfer/Bond R150,000 + Sourcing R50,000 + Furniture Cost Used (2 items, one quoted, 10% contingency) = R110,000 → **Total Investment = R2,310,000**, proven to equal `calcTotalInvestment(inputs)` exactly, with an explicit assertion that it is **not** the double-counted R2,000,000+150,000+50,000+25,000+32,000 figure.

**Downstream returns respond deterministically (`furnitureCostsIntegration.test.ts`):**
Furniture Cost Used R100,000 → R150,000, all else equal: Total Investment rises by **exactly R50,000**; Initial Equity Investment rises by the same R50,000 (financing unchanged); Cash-on-Cash Return, Equity IRR, and Equity NPV all move in the correct direction (lower for a larger equity base against the same projected cashflows) — read straight off `calcAllMetrics()`, nothing manually re-derived.

**Client manipulation via the general Deal PATCH endpoint (Defect 8, `app/api/deals/[id]/__tests__/route.test.ts`):**
`PATCH /api/deals/deal-1` with `{ purchasePrice: 2000000, renovationCost: 99999999 }` → **Before:** `renovationCost` would have been accepted and overwritten the authoritative computed value. **After:** `renovationCost` is stripped before the update ever reaches the database; the field is now settable **only** via `/api/deals/[id]/renovation`.

---

## 5. Design Decisions Worth Recording

**No database migration was performed.** Contingency needed one durable numeric field to survive reloads. Rather than adding a new `Deal`/`RenovationItem` column (a real remote Supabase database backs this app — see Phase 4.21's session notes), the existing `RenovationItem.unitCost` field is **repurposed, exclusively for the reserved `"Contingency"` category**, to hold the percentage (0–100) instead of a Rand unit cost; `quantity` is always `null` for this row. This is documented explicitly in `furnitureCosts.ts`'s module doc comment and in `CONTINGENCY_CATEGORY`'s own comment — nowhere else in the codebase may a `"Contingency"`-category `unitCost` be read as anything but a percentage. Pre-Phase-4.22 saved deals (where a Contingency row stored a plain Rand `budgeted` amount, since no percentage concept existed yet) are hydrated on first load via `inferLegacyContingencyPct()` — a one-time, best-effort inference from the legacy Rand amount relative to the deal's current Cost Used total, not a database migration. This is documented as a Remaining Limitation (§8).

**Contingency UI:** the `"Contingency"` category chip was removed from `DEFAULT_CATEGORIES`/`STUDENT_CATEGORIES` entirely and replaced with one dedicated percentage control — structurally impossible to duplicate from the UI. The server independently rejects a request carrying more than one `"Contingency"`-category item (defense in depth), in both `upsertRenovationItems` and the `POST` single-item route.

**Autosave (requirements 10–11):** a new dependency-free `lib/saveQueue.ts` (`createSerialSaveQueue`) guarantees (a) at most one save request is ever in flight, and (b) only the *latest* known snapshot is ever sent once the in-flight save completes — structurally impossible for an older save to finish after, and overwrite, a newer one, since there is never more than one request in flight to race against. `RenovationBudget.tsx` flushes the queue (bypassing the 800ms debounce) on component unmount and on `visibilitychange === "hidden"`, and every save uses `fetch(..., { keepalive: true })` so a request already in flight survives an actual tab close/navigation.

**Delete-all/insert-all persistence was kept** (matching the pre-existing `upsertFinanceSources` convention elsewhere in the codebase) rather than moved to update-by-stable-ID. It was already fully transactional (`prisma.$transaction`, no partial state ever observable), and the new client-side serial save queue closes the realistic single-session race this phase needed to close. True multi-tab/multi-device optimistic-concurrency protection (a version column) is out of scope — documented in §8.

---

## 6. Files Changed

**New**
- `lib/calculations/furnitureCosts.ts` — the one authoritative helper (requirement 14)
- `lib/saveQueue.ts` — dependency-free serial save queue
- `lib/calculations/__tests__/furnitureCosts.test.ts`
- `lib/calculations/__tests__/furnitureCostsIntegration.test.ts`
- `lib/__tests__/saveQueue.test.ts`
- `lib/db/__tests__/deals.renovation.test.ts`
- `app/api/deals/[id]/__tests__/route.test.ts`

**Modified**
- `components/forms/RenovationBudget.tsx` — stale-budget fix, quote hierarchy, dedicated contingency control, Cost Used column + variance, active-cost summary block, serial-queue autosave with flush-on-unmount/hide, terminology defaults
- `app/api/deals/[id]/renovation/route.ts` — server-side duplicate-contingency rejection (PUT) and recomputation + rejection (POST)
- `lib/db/deals.ts` — `upsertRenovationItems` server-authoritative recomputation and `grandTotal`-based `Deal.renovationCost`
- `app/api/deals/[id]/route.ts` — Defect 8 fix: `renovationCost` excluded from the PATCH whitelist and explicitly stripped from the update payload
- `lib/pdf/DealSummaryPDF.tsx` — "Furniture, Setup & Renovation Summary" / "Cost Used in Deal" relabelling, new Cost Used column, Contingency-row-aware rendering
- `components/FlipDashboard.tsx` — "Renovation Cost" → "Furniture, Setup & Renovation Cost"
- `app/(app)/deals/[id]/edit/acquisition/page.tsx` — removed the now-redundant student-specific title/label override (the component defaults already say the right thing for every strategy)

No changes to `prisma/schema.prisma`, `lib/calculations/index.ts`, `lib/calculations/assembleInputs.ts`, `lib/calculations/verdict.ts`, or `lib/calculations/thresholds.ts`.

---

## 7. Tests Added

44 new tests across 6 new files, covering every scenario listed in requirement 20: basic arithmetic (10×R2,500), clearing Quantity/clearing Unit Cost (stale value cannot survive), quote-overrides-budget, no-quote, partial quotes across multiple items, no-double-count, dynamic contingency (base change), duplicate-contingency rejection, client-manipulation resistance (server ignores a conflicting Budget), Total Investment reconciliation (exactly-once inclusion), downstream-returns determinism (R100k→R150k regression scenario), preview/persisted parity, and out-of-order-save protection (3 dedicated race-condition tests in `saveQueue.test.ts`, including a same-order-preserved-despite-latency case and a never-two-concurrent-saves case).

---

## 8. Remaining Limitations

- **Legacy contingency inference is approximate.** A pre-4.22 deal with a Contingency row that never used unit pricing has its percentage *inferred* from `(legacy Rand amount) / (current Cost Used total) × 100` on first load — a best-effort, one-time conversion, not an exact recovery (the old data literally never stored a percentage).
- **Multi-tab/multi-device concurrent editing** of the same deal's furniture budget is not fully protected — the serial save queue closes the realistic single-session race, but two different browser tabs (or two devices) editing the same deal simultaneously could still have one PUT's delete-all/insert-all overwrite the other's. A version/optimistic-concurrency column would close this fully; out of scope for this phase.
- **`FlipWaterfallChart.tsx`'s bar label** still reads "Renovation" (not relabelled) — a space-constrained chart axis label, left as-is rather than risk layout breakage for a minor terminology point.
- **The general Deal PATCH endpoint (`app/api/deals/[id]/route.ts`) still spreads the entire request body through to Prisma** (`coerceNumericFields` does not strip unlisted fields) for every field *other than* `renovationCost`, which is now explicitly stripped. This broader mass-assignment pattern was not otherwise fixed — closing it fully for every Deal field is a larger, unrelated-architecture change outside this phase's scope; flagged here for a future security-focused pass.

---

## 9. Repository-Wide Search (requirement 21)

Searched for `renovationCost`, `budgeted`, `quoted`, `quantity`/`unitCost` products, `contingency`, `totalFurniture`, `setupCost` across `app/`, `components/`, `lib/`. Every remaining hit outside `lib/calculations/furnitureCosts.ts` is either (a) a plain field reference/passthrough (`assembleInputs.ts`, education copy, Deal Coach context — none independently compute a furniture total), or (b) already fixed as part of this phase. The one genuine second calculation path found (Defect 8, the general Deal PATCH endpoint's ability to directly overwrite `Deal.renovationCost`) has been closed.

---

## 10. Verification

```
$ npx vitest run
 Test Files  30 passed (30)
      Tests  781 passed (781)

$ npx tsc --noEmit
(clean — no output)

$ npx eslint .
✖ 1 problem (0 errors, 1 warning)   — pre-existing, unrelated Next.js font warning

$ npm run build
✓ Compiled successfully
✓ Generating static pages (16/16)
```

No failing or skipped tests.

```
$ git diff --stat
 7 files changed, 372 insertions(+), 90 deletions(-)
$ git status --short
 (7 modified, 6 new files — all Phase 4.22 work, nothing unrelated)
```

---

## 11. Confirmations

1. **Furniture/setup cost is included exactly once in Total Investment** — `calcTotalInvestment()` (unchanged) reads the single `renovationCost` field, which is now always `calcFurnitureCostSummary(...).grandTotal`; proven by the reconciliation tests in §4 and §7.
2. **Budget + Quote are never double-counted** — `costUsed` is `quotedCost` *or* `(budgetCost ?? 0)`, never their sum; explicitly tested (`R57,000` is asserted to never occur where `R32,000` is correct).
3. **LTV and verdict thresholds were not changed** — `lib/calculations/verdict.ts`, `thresholds.ts`, and `calcLTV` in `index.ts` were not touched in this phase.
