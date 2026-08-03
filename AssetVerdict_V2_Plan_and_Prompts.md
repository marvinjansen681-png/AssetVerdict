# AssetVerdict V2 — Enhancement Plan & Build Prompts
> Extends the existing codebase. Read existing files before running each prompt.
> All prompts reference the current schema in `/prisma/schema.prisma` and components in `/components/`.

---

# PART 1 — WHAT WE ARE ADDING

## 1. Investment Strategy Engine
User selects one of 7 strategy types. The entire app — input tabs, cashflow fields,
metrics, gauge thresholds, and PDF — adapts to the chosen strategy.

| Strategy | Key Characteristics |
|---|---|
| **Buy to Let (BTL)** | Single tenant, long lease, standard cashflow |
| **Multi-Let (HMO)** | Multiple rooms/tenants, higher yield, higher management |
| **Student Accommodation** | Academic-year occupancy (40–44 weeks), per-room income, bills-included model |
| **Fix & Flip** | No long-term cashflow — profit = Sale Price - (Purchase + Renovation). Holding period months, not years. |
| **Instalment Sale Agreement (ISA)** | Seller-financed deal. Buyer pays seller monthly instalments. Different cashflow and tax treatment. |
| **Short-Term Rental (STR / Airbnb)** | Nightly rate × occupancy, seasonal variance, platform fees |
| **Commercial** | Current default — NOI-driven, cap rate focus, long leases |

---

## 2. Detailed Property Information
New "Property Details" section added to the Deal Introduction tab.

Fields added:
- Erf Number
- Erf Size (m²)
- Property Zoning (e.g. Residential 1, Residential 2, Business 1, Industrial 1, Agricultural, Special)
- Floor Size (m²)
- Number of Bedrooms
- Number of Bathrooms
- Number of Garages / Parking Bays
- Number of Units (for multi-unit/HMO)
- Year Built
- Rates Account Number (optional)
- Title Deed Number (optional)
- Sectional Title? (Yes/No toggle) → if yes: Unit Number, Scheme Name, Levy Amount

---

## 3. Detailed Renovation Cost Breakdown
Replace the single `renovationCost` field with a structured itemised renovation schedule.

Categories:
- Structural (foundations, walls, roof)
- Electrical
- Plumbing
- Kitchen
- Bathrooms (per unit count)
- Flooring
- Painting & Finishing
- Windows & Doors
- Landscaping & Exterior
- HVAC / Solar / Geysers
- Compliance & Certificates (COC, plumbing cert, etc.)
- Contingency (% of total, default 10%)
- Professional Fees (architect, engineer, quantity surveyor)
- Other / Miscellaneous

Each line item: description, budgeted amount, actual/quoted amount, status (Not Started / In Progress / Complete).
Total auto-calculates. Feeds into `renovationCost` for all existing calculations.

---

## 4. All-Three-Scenario PDF Export
Current PDF shows base case only. Enhance to show all three scenarios side-by-side.

New PDF structure:
- Page 1: Cover (unchanged)
- Page 2: Scenario Comparison — Bear / Base / Bull side-by-side for all 8 key metrics
- Page 3: Base Case detail (current Page 2)
- Page 4: Cashflow table (current Page 3) — enhanced with scenario columns
- Page 5: 20-year projection table for all three scenarios
- Page 6: Property Details (new page)
- Page 7: Deal Inputs (current Page 4)

---

## 5. Strategy-Specific Cashflow Adjustments
Each strategy changes which cashflow fields appear and how calculations work.

---

# PART 2 — DATABASE CHANGES

## New/Modified Prisma Models

```
Deal model additions:
- investmentStrategy  String?  @default("commercial")
- erfNumber           String?
- erfSize             Float?   (m²)
- propertyZoning      String?
- floorSize           Float?
- bedrooms            Int?
- bathrooms           Int?
- garages             Int?
- numUnits            Int?     @default(1)
- yearBuilt           Int?
- ratesAccountNumber  String?
- titleDeedNumber     String?
- isSectionalTitle    Boolean  @default(false)
- unitNumber          String?
- schemeName          String?
- schemeLevy          Float?

CashflowInputs additions (strategy-specific fields):
- platformFeesPct      Float?   (STR: Airbnb/platform fees %)
- nightlyRate          Float?   (STR: avg nightly rate)
- avgOccupiedNights    Int?     (STR: nights per year)
- billsIncluded        Boolean? (Student/HMO: landlord pays bills)
- academicYearWeeks    Int?     @default(42) (Student: occupancy weeks)
- holdingPeriodMonths  Int?     (Fix & Flip: how long before sale)
- instalmentAmount     Float?   (ISA: monthly instalment received)
- instalmentTerm       Int?     (ISA: term in months)
- instalmentRate       Float?   (ISA: implicit interest rate %)

New model: RenovationItem
- id           String  @id @default(cuid())
- dealId       String
- deal         Deal    @relation(...)
- category     String  (Structural / Electrical / Plumbing / etc.)
- description  String
- budgeted     Float
- quoted       Float?
- status       String  @default("Not Started")
- order        Int     @default(0)
```

---

# PART 3 — BUILD PROMPTS

---

## PROMPT V2-1 — Investment Strategy Selection

```
We are enhancing AssetVerdict. The existing codebase is in the current project directory.
Read the existing files before making changes, especially:
- /prisma/schema.prisma
- /types/index.ts
- /app/(app)/deals/[id]/edit/introduction/page.tsx
- /lib/calculations/index.ts

TASK: Add an Investment Strategy selector to the Deal Introduction tab.

STEP 1 — Schema update (/prisma/schema.prisma):
Add this field to the Deal model:
  investmentStrategy  String?  @default("commercial")

Run migration: `prisma migrate dev --name add_investment_strategy`

STEP 2 — Update /types/index.ts:
Add `investmentStrategy?: string | null` to the Deal interface.

Define and export this constant (put in /lib/strategies.ts, a new file):

export const INVESTMENT_STRATEGIES = [
  {
    id: "commercial",
    label: "Commercial",
    icon: "🏢",
    description: "Office, retail, or industrial property. NOI-driven, cap rate focus, long leases.",
    defaultOccupancy: 88,
    defaultManagementFee: 10,
    defaultBadDebt: 3,
    cashflowMode: "standard",
  },
  {
    id: "buy_to_let",
    label: "Buy to Let",
    icon: "🏠",
    description: "Single residential tenant on a fixed-term lease.",
    defaultOccupancy: 92,
    defaultManagementFee: 10,
    defaultBadDebt: 3,
    cashflowMode: "standard",
  },
  {
    id: "multi_let",
    label: "Multi-Let / HMO",
    icon: "🏘️",
    description: "Multiple rooms let individually. Higher yield, higher management intensity.",
    defaultOccupancy: 85,
    defaultManagementFee: 15,
    defaultBadDebt: 5,
    cashflowMode: "per_room",
  },
  {
    id: "student",
    label: "Student Accommodation",
    icon: "🎓",
    description: "Academic-year tenancy. Bills often included. Room-by-room income.",
    defaultOccupancy: 95,
    defaultManagementFee: 12,
    defaultBadDebt: 4,
    cashflowMode: "academic",
  },
  {
    id: "fix_and_flip",
    label: "Fix & Flip",
    icon: "🔨",
    description: "Buy, renovate, and resell for profit. Short holding period — no long-term cashflow.",
    defaultOccupancy: 0,
    defaultManagementFee: 0,
    defaultBadDebt: 0,
    cashflowMode: "flip",
  },
  {
    id: "str",
    label: "Short-Term Rental (STR)",
    icon: "🌴",
    description: "Airbnb / holiday rental. Nightly rate-based income with platform fees.",
    defaultOccupancy: 70,
    defaultManagementFee: 20,
    defaultBadDebt: 1,
    cashflowMode: "nightly",
  },
  {
    id: "instalment_sale",
    label: "Instalment Sale Agreement",
    icon: "📄",
    description: "Seller-financed deal. You receive monthly instalments from the buyer.",
    defaultOccupancy: 100,
    defaultManagementFee: 0,
    defaultBadDebt: 2,
    cashflowMode: "instalment",
  },
] as const;

export type StrategyId = typeof INVESTMENT_STRATEGIES[number]["id"];
export function getStrategy(id: string) {
  return INVESTMENT_STRATEGIES.find(s => s.id === id) ?? INVESTMENT_STRATEGIES[0];
}

STEP 3 — Update /app/(app)/deals/[id]/edit/introduction/page.tsx:
Add a "Investment Strategy" section ABOVE the existing form fields.

UI: Display strategies as a 3-column card grid (2 columns on mobile).
Each card shows: icon (large, centred), strategy label (bold), short description (small grey text).
Selected card: av-navy border (2px solid), av-gold icon tint, white background.
Unselected: av-light-grey border, grey icon.

When a strategy is selected:
1. Save it to the deal via PATCH /api/deals/[id]
2. Store it in DealContext so other tabs can read it
3. Show a subtle info banner below the grid:
   "💡 {strategyLabel} — {description}"

STEP 4 — Update DealContext (/lib/DealContext.tsx):
Export a `strategy` helper: const strategy = getStrategy(deal.investmentStrategy ?? 'commercial')
Make this available to all child components.

STEP 5 — Update the Deal card (/components/DealCard.tsx):
Show the strategy icon and label as a small badge on each deal card
(e.g. 🏢 Commercial, 🔨 Fix & Flip).
```

---

## PROMPT V2-2 — Property Details Fields

```
We are enhancing AssetVerdict. Read the existing files before making changes:
- /prisma/schema.prisma
- /types/index.ts
- /app/(app)/deals/[id]/edit/introduction/page.tsx
- /app/api/deals/[id]/route.ts

TASK: Add a comprehensive Property Details section to the Deal Introduction tab.

STEP 1 — Schema (/prisma/schema.prisma), add to Deal model:
  erfNumber           String?
  erfSize             Float?
  propertyZoning      String?
  floorSize           Float?
  bedrooms            Int?
  bathrooms           Int?
  garages             Int?
  numUnits            Int?     @default(1)
  yearBuilt           Int?
  ratesAccountNumber  String?
  titleDeedNumber     String?
  isSectionalTitle    Boolean  @default(false)
  unitNumber          String?
  schemeName          String?
  schemeLevy          Float?

Run: `prisma migrate dev --name add_property_details`

STEP 2 — Update /types/index.ts with all new fields on the Deal interface.

STEP 3 — Update /app/api/deals/[id]/route.ts PATCH handler:
Accept and save all new property detail fields.

STEP 4 — Add "Property Details" section to /app/(app)/deals/[id]/edit/introduction/page.tsx:
Place this BELOW the strategy selector and ABOVE the existing deal info fields.

Section title: "Property Details" (DM Serif Display, av-navy, with a thin av-gold underline)

PROPERTY ZONING options (South African municipal zones):
  Residential 1 (R1) | Residential 2 (R2) | Residential 3 (R3) | Residential 4 (R4)
  Business 1 (B1) | Business 2 (B2) | Business 3 (B3) | Business 4 (B4)
  Industrial 1 (I1) | Industrial 2 (I2) | Industrial 3 (I3)
  Agricultural (AG) | Special (SP) | Public Open Space | Mixed Use

Layout — 2-column grid:
Row 1: Erf Number (text) | Title Deed Number (text)
Row 2: Erf Size m² (number) | Floor Size m² (number)
Row 3: Property Zoning (select) | Year Built (number, min 1800, max current year)
Row 4: Rates Account Number (text) | [empty or Sectional Title toggle]

Conditional section — "Sectional Title Details" (shows only if isSectionalTitle = true):
  Toggle: "Is this a Sectional Title?" (styled toggle switch, default off)
  If on → show: Unit Number (text), Scheme Name (text), Monthly Levy (CurrencyInput)

Strategy-conditional fields (show/hide based on investmentStrategy):
- Show Bedrooms + Bathrooms + Garages for: buy_to_let, multi_let, student, str, fix_and_flip
- Show "Number of Units / Rooms" for: multi_let, student, commercial
- Hide Bedrooms/Bathrooms/Garages for: commercial, instalment_sale

Row for residential strategies:
Row 5: Bedrooms (number, 0–20) | Bathrooms (number, 0–20)
Row 6: Garages / Parking Bays (number) | Number of Units / Rooms (number, default 1)

Zod schema: add all fields to the intro form schema with appropriate types.
On save: PATCH /api/deals/[id] — include all property detail fields.

STEP 5 — Update the deal card in /components/DealCard.tsx:
Show a compact property summary under the deal name:
  "3 bed • 2 bath • 150m² • Erf 1234" (only fields that are filled in)
```

---

## PROMPT V2-3 — Renovation Cost Breakdown

```
We are enhancing AssetVerdict. Read the existing files:
- /prisma/schema.prisma
- /app/(app)/deals/[id]/edit/acquisition/page.tsx
- /lib/calculations/assembleInputs.ts
- /app/api/deals/[id]/route.ts

TASK: Replace the single `renovationCost` field with a full itemised renovation schedule.

STEP 1 — Schema: add new model to /prisma/schema.prisma:

model RenovationItem {
  id          String  @id @default(cuid())
  dealId      String
  deal        Deal    @relation(fields: [dealId], references: [id], onDelete: Cascade)
  category    String
  description String
  budgeted    Float   @default(0)
  quoted      Float?
  status      String  @default("Not Started")
  order       Int     @default(0)
  @@index([dealId])
}

Add relation to Deal model:
  renovationItems  RenovationItem[]

Keep the existing `renovationCost` Float? field — it will now be the auto-calculated total
(sum of all RenovationItem.budgeted amounts). Update it whenever items change.

Run: `prisma migrate dev --name add_renovation_items`

STEP 2 — Add to /types/index.ts:
export interface RenovationItem {
  id: string;
  dealId: string;
  category: string;
  description: string;
  budgeted: number;
  quoted?: number | null;
  status: string;
  order: number;
}
Add renovationItems: RenovationItem[] to DealWithRelations.

STEP 3 — Create API route /app/api/deals/[id]/renovation/route.ts:
GET: return all renovation items for deal (ordered by `order`)
PUT: replace all items for deal (delete existing, insert new array), recalculate total, update deal.renovationCost
POST (single item): add one item

STEP 4 — Update /lib/db/deals.ts to include renovationItems in getDeal() fetch (already fetches relations — add renovationItems here).

STEP 5 — Build the Renovation section in /app/(app)/deals/[id]/edit/acquisition/page.tsx:

Replace the single "Renovation & Inspections Costs" CurrencyInput with a full section:

SECTION HEADER: "Renovation Budget" with a "+ Add Item" button (right-aligned, av-gold outline).

PREDEFINED CATEGORIES (shown as quick-add chips the user can click to add a line):
  Structural | Electrical | Plumbing | Kitchen | Bathrooms | Flooring
  Painting & Finishing | Windows & Doors | Landscaping | HVAC / Solar / Geysers
  Compliance & Certs | Professional Fees | Contingency | Other

TABLE of items (each row):
  [drag handle ⠿] | Category (badge) | Description (text input) | Budgeted (CurrencyInput) | Quoted (CurrencyInput, optional) | Status (select) | [delete ✕]

STATUS options: Not Started | In Progress | Quoted | Complete

FOOTER ROW (auto-calculated, read-only):
  Subtotal: R xxx
  Contingency (editable % field, default 10%): R xxx  (applies to subtotal)
  TOTAL RENOVATION: R xxx  (shown large, Roboto Mono, av-navy)
  This total feeds into renovationCost for all downstream calculations.

Show a progress bar: X of Y items Complete (green fill).

On every change: auto-save items via PUT /api/deals/[id]/renovation and update renovationCost.

STEP 6 — Update /lib/calculations/assembleInputs.ts:
Calculate renovationCost as sum of all renovationItems.budgeted + contingency amount.
(Or use deal.renovationCost which is kept in sync by the API.)

STEP 7 — Update /lib/db/deals.ts getDeal() to include:
  renovationItems: { orderBy: { order: 'asc' } }
```

---

## PROMPT V2-4 — Strategy-Specific Cashflow Tab

```
We are enhancing AssetVerdict. Read these files carefully before starting:
- /lib/strategies.ts  (created in V2-1)
- /lib/DealContext.tsx
- /prisma/schema.prisma
- /app/(app)/deals/[id]/edit/cashflow/page.tsx
- /lib/calculations/index.ts
- /lib/calculations/assembleInputs.ts

TASK: Make the Cashflow tab adapt to the selected investment strategy.

STEP 1 — Schema: add strategy-specific cashflow fields to CashflowInputs model:
  // STR fields
  nightlyRate          Float?
  avgOccupiedNights    Int?    @default(200)
  platformFeesPct      Float?  @default(15)
  // Student / HMO
  billsIncluded        Boolean @default(false)
  academicYearWeeks    Int?    @default(42)
  pricePerRoom         Float?
  // Fix & Flip
  holdingPeriodMonths  Int?    @default(6)
  expectedSalePrice    Float?
  // Instalment Sale
  instalmentAmount     Float?
  instalmentTerm       Int?    @default(240)
  instalmentRate       Float?

Run: `prisma migrate dev --name add_strategy_cashflow_fields`

STEP 2 — Update /types/index.ts CashflowInputs interface with all new fields.

STEP 3 — Update /app/api/deals/[id]/cashflow/route.ts to accept and save new fields.

STEP 4 — Refactor /app/(app)/deals/[id]/edit/cashflow/page.tsx:

Read the current strategy from DealContext. Render different form sections based on strategy:

--- STRATEGY: "standard" (commercial, buy_to_let) ---
Show existing form as-is. No changes.

--- STRATEGY: "per_room" (multi_let / HMO) ---
Replace "Monthly Rent" with:
  Number of Rooms: (read from deal.numUnits, or editable here)
  Rent Per Room (CurrencyInput, monthly)
  → Monthly Rent auto-calculates as: Rooms × Rent Per Room × (Occupancy/100)

Add field:
  Bills Included? (toggle) → if yes, show: estimated monthly bills per room (CurrencyInput)
  Bills cost auto-adds to expense side (electricity, water)

--- STRATEGY: "academic" (student accommodation) ---
Fields:
  Number of Rooms: (read from deal.numUnits)
  Rent Per Room Per Week (CurrencyInput)
  Academic Year Length (weeks, default 42)
  → Annual Rent = Rooms × Rent/week × AcademicWeeks
  → Monthly equivalent = Annual / 12
  Bills Included? (toggle, typically yes for student) — same as HMO

Replace Occupancy Rate with:
  "Academic Year Occupancy" — pre-filled to 95%, note: "Based on X weeks of a 52-week year"
  Show effective annual occupancy: (academicYearWeeks/52 × 100)%

--- STRATEGY: "nightly" (STR / Airbnb) ---
HIDE: Monthly Rent, Occupancy Rate (standard fields)
SHOW:
  Nightly Rate (CurrencyInput)
  Average Occupied Nights Per Year (number, default 200)
  → Annual Revenue = NightlyRate × OccupiedNights
  → Effective monthly = Annual / 12
  Platform / Management Fees % (PercentInput, default 15%) — Airbnb/VRBO/agent cut
  Show info: "Effective occupancy: XX% (X nights of 365)"

Seasonal breakdown (optional, expandable):
  Q1 Avg Nights | Q2 Avg Nights | Q3 Avg Nights | Q4 Avg Nights
  (if filled, overrides the single annual figure)

HIDE non-applicable expenses: Security & Cleaning → rename to "Cleaning & Laundry"

--- STRATEGY: "flip" (Fix & Flip) ---
COMPLETELY REPLACE the standard cashflow form with a Flip Calculator:

"This strategy calculates profit at point of sale, not ongoing cashflow."

Fields:
  Expected Sale Price (CurrencyInput) — auto-suggests purchasePrice × 1.3 if blank
  Holding Period (months, default 6) — period between purchase and sale
  Holding Costs Per Month (CurrencyInput) — rates, insurance, interest during reno
  Agent Commission on Sale (PercentInput, default 5%)
  Capital Gains Tax (auto-pulled from Other Inputs, display only)

Auto-calculated summary box:
  Purchase Price:           R xxx
  Total Renovation Cost:    R xxx
  Holding Costs (X months): R xxx
  Agent Commission:         R xxx
  ─────────────────────────────
  Total Cost:               R xxx
  Expected Sale Price:      R xxx
  ─────────────────────────────
  Gross Profit:             R xxx
  CGT (XX%):               -R xxx
  ─────────────────────────────
  NET PROFIT:               R xxx  (green if positive, red if negative)
  ROI on Investment:        XX%
  Annualised ROI:           XX%

For Fix & Flip, the calculation engine should treat the "cashflow" as a single lump profit event
rather than an ongoing monthly cashflow.

--- STRATEGY: "instalment" (Instalment Sale Agreement) ---
REPLACE Monthly Rent with:
  Monthly Instalment Received (CurrencyInput) — from the buyer
  Agreement Term (months, number, default 240)
  Implicit Interest Rate (PercentInput) — interest component of instalment
  Outstanding Balance (CurrencyInput) — remaining principal buyer owes

Auto-calculate split:
  Interest Component Per Month: R xxx
  Principal Component Per Month: R xxx

Expenses remain standard (rates, insurance you still pay as registered owner).
Note shown: "In an ISA, you remain the registered owner until the final instalment is paid."

STEP 5 — Update /lib/calculations/assembleInputs.ts:
Map all new cashflow fields into DealInputs (add the new fields to DealInputs interface too).

STEP 6 — Update /lib/calculations/index.ts:
Add a `strategy` field to DealInputs (string).
In `calcGrossRevenueAnnual()` and related functions, branch on strategy:
  - 'nightly': return nightlyRate × avgOccupiedNights
  - 'academic': return pricePerRoom × numUnits × academicYearWeeks × (occupancyRate/100) — annualised to 12 months for consistency
  - 'per_room': return pricePerRoom × numUnits × (occupancyRate/100) × 12
  - 'flip': return 0 (profit is calculated separately via calcFlipProfit())
  - 'instalment': return instalmentAmount × 12
  - others: existing formula

Add new function `calcFlipProfit(inputs) → FlipMetrics`:
  {
    totalCost: purchasePrice + renovationCost + (holdingCosts × holdingMonths) + agentCommissionAmt,
    expectedSalePrice,
    grossProfit,
    cgt,
    netProfit,
    roi,
    annualisedROI (adjusted for holding period),
  }
```

---

## PROMPT V2-5 — Strategy-Specific Gauge Thresholds & Summary Page

```
We are enhancing AssetVerdict. Read these files:
- /lib/strategies.ts
- /lib/calculations/thresholds.ts
- /lib/DealContext.tsx
- /app/(app)/deals/[id]/summary/page.tsx
- /components/gauges/GaugeDial.tsx

TASK: Make gauge thresholds and the Summary page adapt per investment strategy.

STEP 1 — Update /lib/calculations/thresholds.ts:

Export a new function:
  getStrategyThresholds(strategyId: string): Record<string, ThresholdConfig>

Each strategy has different "good/ok/bad" benchmarks:

COMMERCIAL (existing defaults):
  IRR: green >15, orange 8-15, red <8
  GrossYield: green >10, orange 7-10, red <7
  DSCR: green >1.25, orange 1.0-1.25, red <1.0
  OER: green <40, orange 40-60, red >60
  PaybackPeriod: green <8, orange 8-12, red >12

BUY TO LET:
  IRR: green >12, orange 8-12, red <8
  GrossYield: green >8, orange 5-8, red <5
  DSCR: green >1.2, orange 1.0-1.2, red <1.0
  OER: green <45, orange 45-65, red >65
  PaybackPeriod: green <10, orange 10-15, red >15

MULTI-LET / HMO:
  IRR: green >18, orange 12-18, red <12
  GrossYield: green >12, orange 8-12, red <8
  DSCR: green >1.3, orange 1.0-1.3, red <1.0
  OER: green <50, orange 50-70, red >70 (higher costs accepted)
  PaybackPeriod: green <7, orange 7-10, red >10

STUDENT ACCOMMODATION:
  IRR: green >15, orange 10-15, red <10
  GrossYield: green >10, orange 7-10, red <7
  OER: green <55, orange 55-75, red >75 (bills included = higher OER)
  PaybackPeriod: green <8, orange 8-12, red >12

STR (Short-Term Rental):
  IRR: green >20, orange 12-20, red <12
  GrossYield: green >15, orange 10-15, red <10
  OER: green <50, orange 50-70, red >70 (higher — platform fees, cleaning)
  PaybackPeriod: green <6, orange 6-10, red >10

FIX & FLIP (only profit metrics matter):
  ROI: green >25, orange 15-25, red <15
  AnnualisedROI: green >40, orange 25-40, red <25
  NetProfit: green >0, red <=0 (no orange)
  HoldingPeriod: green <6mo, orange 6-12mo, red >12mo

INSTALMENT SALE:
  IRR: green >10, orange 7-10, red <7
  GrossYield: green >8, orange 5-8, red <5
  DSCR: not applicable (show as N/A)
  PaybackPeriod: green <12, orange 12-20, red >20

STEP 2 — Update /app/(app)/deals/[id]/summary/page.tsx:

Read strategy from DealContext.
Pass strategy-specific thresholds to each GaugeDial component.

For FIX & FLIP strategy: replace the standard Returns section entirely with a FlipDashboard:
  - Large "NET PROFIT" MetricCard (green if positive, red if negative)
  - ROI gauge dial
  - Annualised ROI gauge dial  
  - Total Cost breakdown card
  - Expected Sale Price vs Total Cost bar comparison
  - "Holding Period" metric card
  Hide: all standard NOI/cashflow/DSCR/cap rate sections (not relevant for flips)

For INSTALMENT SALE: hide DSCR gauge, replace with "Instalment Coverage Ratio" 
  (monthly instalment / your monthly carrying costs).

STEP 3 — Strategy label in Summary header:
Add a strategy badge next to the deal name in the summary header:
  <StrategyBadge strategy={strategy} />
  Shows: icon + label, styled as a pill (av-light-grey bg, av-navy text).

STEP 4 — Update Summary page info banner:
Below the scenario selector, add:
  "ℹ️ Thresholds shown are calibrated for {strategy.label} investments."
  (small, av-slate, italic)
```

---

## PROMPT V2-6 — All-Three-Scenario PDF Export

```
We are enhancing AssetVerdict. Read these files carefully:
- /lib/pdf/DealSummaryPDF.tsx  (existing PDF)
- /hooks/useDealMetrics.ts
- /lib/calculations/scenarios.ts
- /app/(app)/deals/[id]/summary/page.tsx
- /lib/strategies.ts

TASK: Enhance the PDF export to include all three scenarios (Bear/Base/Bull) 
and the new Property Details page.

STEP 1 — Update /lib/pdf/DealSummaryPDF.tsx completely.

New PDF props interface:
interface DealSummaryPDFProps {
  deal: DealWithRelations;
  base: { metrics: DealMetrics; projection: YearlyProjection[] };
  bear: { metrics: DealMetrics; projection: YearlyProjection[] };
  bull: { metrics: DealMetrics; projection: YearlyProjection[] };
  strategy: typeof INVESTMENT_STRATEGIES[number];
  renovationItems: RenovationItem[];
  activeScenario: 'bear' | 'base' | 'bull';
}

NEW PDF STRUCTURE (7 pages):

--- PAGE 1: Cover ---
(Keep existing cover design)
Add below deal name:
  Strategy badge: "{icon} {strategyLabel}"
  "Active Scenario: Base Case" (or whichever is selected)

--- PAGE 2: Scenario Comparison (NEW) ---
Title: "Bear / Base / Bull — Scenario Comparison"
Subtitle: "Bear adjusts rental growth and occupancy down by {realGrowthFactor}%. 
           Bull adjusts up by the same. Base is your modelled inputs."

3-column comparison table, one column per scenario:
Header row: [Metric] | 🐻 BEAR | ⚖️ BASE | 🐂 BULL

Rows (key metrics):
  IRR                  | bear% | base% | bull%
  Net Yield Yr 1       | %     | %     | %
  Gross Yield          | %     | %     | %
  Cap Rate (PP)        | %     | %     | %
  NPV                  | R     | R     | R
  DSCR                 | x     | x     | x
  Op. Expense Ratio    | %     | %     | %
  Payback Period       | Yrs   | Yrs   | Yrs
  Monthly Cashflow     | R     | R     | R
  NOI Margin           | %     | %     | %

Color coding per cell:
  Use getGaugeColor(metric, value) → green/orange/red text (matching gauge colours)
  Bear column header: red, Base: gold, Bull: green

Year 1 / Year 5 / Year 10 / Year 20 Cashflow row:
  Show cashflow at key milestones for all 3 scenarios in a mini table below.

--- PAGE 3: Base Case Key Metrics ---
(Same as current Page 2 — 8 metric boxes in 2×4 grid)
Title: "Base Case — Key Metrics"

--- PAGE 4: Cashflow Summary ---
Title: "Cashflow Summary (Monthly)"
Keep existing 3-column Revenue / Operating Costs / Provisions table.
ADD: a second mini-table below showing the same figures for Bear and Bull scenarios
  (two-column comparison: Bear vs Bull, labelled clearly)

--- PAGE 5: 20-Year Projection (all 3 scenarios) ---
Title: "20-Year Cashflow Projection"
Three tables side by side (or stacked if too wide), one per scenario:
  Bear | Base | Bull — each showing:
  Year | Revenue | Costs | Cashflow | Cum. Cashflow | ROI%
  Show Years 1, 2, 3, 4, 5, 8, 10, 12, 15, 18, 20 (key milestones only to fit page)

--- PAGE 6: Property Details (NEW) ---
Title: "Property Details"
Two-column info layout:
  Left column:
    Erf Number | Erf Size | Floor Size | Year Built
    Property Zoning | Title Deed No | Rates Account No
  Right column:
    Asking Price | Purchase Price | Market Value
    Discount to Asking | Discount to Market
    Sectional Title? | Unit No | Scheme | Levy

  If strategy is residential: also show Bedrooms | Bathrooms | Garages | Units

  Renovation Summary:
  Show total renovation budget and the itemised renovation table:
  Category | Description | Budgeted | Quoted | Status
  Footer: Total Renovation Cost: R xxx

--- PAGE 7: Deal Inputs ---
(Same as current Page 4 — acquisition, finance, cashflow inputs)
Keep as-is.

STEP 2 — Update the export trigger in /app/(app)/deals/[id]/summary/page.tsx:
Change the "Export PDF" button handler to pass all 3 scenarios + renovation items + strategy to DealSummaryPDF.

Filename: "AssetVerdict_{dealName}_{Strategy}_{Date}.pdf"

STEP 3 — Add a scenario selector in the PDF export modal (before download):
Small modal: "Choose PDF scenarios to include"
  ☑ Bear Case
  ☑ Base Case  
  ☑ Bull Case
  [Download PDF] button
(For now, always include all 3 — the checkboxes are UX for future.)
```

---

## PROMPT V2-7 — Strategy-Adaptive Tab Navigation & Labels

```
We are enhancing AssetVerdict. Read:
- /lib/strategies.ts
- /lib/DealContext.tsx
- /components/TabNav.tsx
- /app/(app)/deals/[id]/edit/layout.tsx

TASK: Make the tab navigation and section labels adapt to the investment strategy.

STEP 1 — Update /components/TabNav.tsx:
Accept an optional `strategy` prop (StrategyId).
For Fix & Flip strategy: rename "Cashflow" tab to "Flip Calculator"
For STR: rename "Cashflow" tab to "Rental Income"
For Instalment Sale: rename "Cashflow" tab to "Instalment Details"
All other strategies: keep "Cashflow"

For Fix & Flip: hide "Other Inputs" tab (escalations not relevant) — or grey it out with tooltip:
  "Escalations are not used in Fix & Flip calculations."

STEP 2 — Update /app/(app)/deals/[id]/edit/layout.tsx:
Read strategy from deal and pass to TabNav.

STEP 3 — Add strategy-specific helper text at the top of each tab:
Create /components/forms/StrategyHint.tsx:
  Shows a coloured info box at the top of form pages with strategy-specific guidance.
  
  Examples:
  - HMO / Multi-Let on Cashflow tab:
    "🏘️ Multi-Let: Enter per-room rent. Management fees are typically higher (15–20%) 
     due to tenant turnover and room management."
  - Student on Cashflow tab:
    "🎓 Student Accommodation: Income is based on academic year (typically 42 weeks). 
     Bills-included models are common — factor these into your expense side."
  - STR on Cashflow tab:
    "🌴 Short-Term Rental: Revenue is driven by nightly rate × occupancy. 
     Platform fees (Airbnb, etc.) typically run 15–20% of revenue."
  - Fix & Flip on Cashflow tab:
    "🔨 Fix & Flip: This tab calculates your profit at point of sale. 
     Renovation quality and timeline are your biggest risk variables."
  - ISA on Cashflow tab:
    "📄 Instalment Sale: You receive monthly instalments. You remain the registered 
     owner and still carry rates, insurance, and other holding costs."

Use the strategy's icon and a soft background (e.g. av-gold at 10% opacity) for the hint box.

STEP 4 — Update /components/DealCard.tsx:
Replace the plain property type text with:
  Strategy icon + label (e.g. "🏘️ Multi-Let")
  Property type as secondary text (e.g. "Residential")
  Key metric preview: show the most relevant metric for each strategy:
    - commercial/btl/hmo/student/str: "IRR: XX% | Yield: XX%"
    - fix_and_flip: "Net Profit: R xxx | ROI: XX%"
    - instalment_sale: "Monthly: R xxx | IRR: XX%"
```

---

## PROMPT V2-8 — Schema Migration & Data Backfill

```
We are enhancing AssetVerdict. This prompt handles the database migration
and ensures existing deals are not broken by the new fields.

Read:
- /prisma/schema.prisma  (with all changes from V2-1 through V2-3 applied)
- /prisma/migrations/  (check existing migrations)
- /lib/db/deals.ts
- /lib/calculations/assembleInputs.ts

TASK: Consolidate all schema changes and ensure existing data integrity.

STEP 1 — Write a combined final migration (if running individually wasn't done in prior prompts):
Check that schema.prisma includes ALL additions from V2-1, V2-2, and V2-3:
  On Deal: investmentStrategy, erfNumber, erfSize, propertyZoning, floorSize,
           bedrooms, bathrooms, garages, numUnits, yearBuilt, ratesAccountNumber,
           titleDeedNumber, isSectionalTitle, unitNumber, schemeName, schemeLevy
  On CashflowInputs: nightlyRate, avgOccupiedNights, platformFeesPct, billsIncluded,
           academicYearWeeks, pricePerRoom, holdingPeriodMonths, expectedSalePrice,
           instalmentAmount, instalmentTerm, instalmentRate
  New model: RenovationItem

Run: `prisma migrate dev --name v2_full_enhancement`

STEP 2 — Update /lib/db/deals.ts:
Ensure getDeal() includes renovationItems in its Prisma select/include:
  include: {
    financeSources: { orderBy: { order: 'asc' } },
    cashflowInputs: true,
    capexItems: true,
    renovationItems: { orderBy: { order: 'asc' } },  // ADD THIS
  }

STEP 3 — Update /lib/calculations/assembleInputs.ts:
Add all new DealInputs fields with safe null-coalescence defaults:
  strategy: deal.investmentStrategy ?? 'commercial',
  numUnits: deal.numUnits ?? 1,
  // STR fields
  nightlyRate: cf?.nightlyRate ?? 0,
  avgOccupiedNights: cf?.avgOccupiedNights ?? 200,
  platformFeesPct: cf?.platformFeesPct ?? 15,
  // Student/HMO
  billsIncluded: cf?.billsIncluded ?? false,
  academicYearWeeks: cf?.academicYearWeeks ?? 42,
  pricePerRoom: cf?.pricePerRoom ?? 0,
  // Flip
  holdingPeriodMonths: cf?.holdingPeriodMonths ?? 6,
  expectedSalePrice: cf?.expectedSalePrice ?? 0,
  // ISA
  instalmentAmount: cf?.instalmentAmount ?? 0,
  instalmentTerm: cf?.instalmentTerm ?? 240,
  instalmentRate: cf?.instalmentRate ?? 0,

STEP 4 — Backfill existing deals:
Write a Prisma script /prisma/seed-backfill.ts that:
  - Finds all deals where investmentStrategy IS NULL
  - Sets investmentStrategy = 'commercial' (safe default — existing deals were commercial)
  - Finds all deals where numUnits IS NULL → set to 1
Run via: `npx ts-node prisma/seed-backfill.ts`

STEP 5 — Update /types/index.ts:
Add all new fields to Deal, CashflowInputs interfaces.
Add RenovationItem interface.
Update DealWithRelations to include renovationItems: RenovationItem[].

STEP 6 — Verify the calculate API route still works:
Open /app/api/deals/[id]/calculate/route.ts and confirm assembleInputs()
is called correctly and calcAllMetrics() handles the new strategy field without errors.
Run the test suite: `npm test` and fix any failures.
```

---

## PROMPT V2-9 — Fix & Flip Summary Dashboard

```
We are enhancing AssetVerdict. Read:
- /app/(app)/deals/[id]/summary/page.tsx
- /lib/calculations/index.ts (ensure calcFlipProfit() exists from V2-4)
- /lib/strategies.ts
- /components/gauges/GaugeDial.tsx
- /components/gauges/MetricCard.tsx

TASK: Build a dedicated Fix & Flip summary dashboard that replaces the standard
Returns section when strategy === 'fix_and_flip'.

STEP 1 — Ensure calcFlipProfit() is in /lib/calculations/index.ts:
export interface FlipMetrics {
  totalCost: number;              // purchasePrice + renovationCost + holdingCosts + agentFee
  purchasePrice: number;
  renovationCost: number;
  holdingCosts: number;           // holdingCostPerMonth × holdingPeriodMonths
  agentFee: number;               // expectedSalePrice × agentCommission/100
  expectedSalePrice: number;
  grossProfit: number;            // expectedSalePrice - totalCost
  cgt: number;                    // grossProfit × capitalGainsTaxRate/100 (if positive)
  netProfit: number;              // grossProfit - cgt
  roi: number;                    // netProfit / totalCost × 100
  annualisedROI: number;          // roi / (holdingPeriodMonths / 12)
  profitMargin: number;           // netProfit / expectedSalePrice × 100
}

STEP 2 — Create /components/charts/FlipWaterfallChart.tsx:
A horizontal stacked bar showing the deal waterfall:
  [Purchase Price][Renovation][Holding Costs][Agent Fee] → [Sale Price]
  Then below: [Total Cost] vs [Net Profit]

Use Recharts BarChart in horizontal layout.
Colours: Purchase = av-navy, Renovation = av-orange, Holding = av-slate, Agent = av-red,
Sale Price bar = av-green.

STEP 3 — Create /components/FlipDashboard.tsx:
Props: { flipMetrics: FlipMetrics; inputs: DealInputs }

Layout (shown instead of Returns section for flip strategy):

TOP ROW — 3 large metric cards:
  [NET PROFIT: R xxx] (green if +, red if -) | [ROI: XX%] | [Annualised ROI: XX%]

SECOND ROW — cost breakdown table:
┌─────────────────────────────────┐
│ Purchase Price          R xxx   │
│ Total Renovation Cost   R xxx   │
│ Holding Costs (X mo)    R xxx   │
│ Agent Commission        R xxx   │
│ ─────────────────────────────   │
│ TOTAL COST              R xxx   │
│ Expected Sale Price     R xxx   │
│ ─────────────────────────────   │  
│ Gross Profit            R xxx   │
│ Capital Gains Tax       -R xxx  │
│ ══════════════════════════════  │
│ NET PROFIT              R xxx   │  (green/red colour)
└─────────────────────────────────┘

THIRD ROW — FlipWaterfallChart (full width)

FOURTH ROW — 2 gauge dials:
  ROI %: green >25%, orange 15-25%, red <15%, max=60
  Holding Period: green <6 months, orange 6-12, red >12, max=24, unit='mo'

STEP 4 — Integrate into /app/(app)/deals/[id]/summary/page.tsx:
Import FlipDashboard.
Where the Returns section is rendered, check strategy.cashflowMode === 'flip':
  if flip: <FlipDashboard flipMetrics={metrics.flipMetrics} inputs={assembledInputs} />
  else: <standard Returns section>

STEP 5 — Update /hooks/useDealMetrics.ts:
Ensure DealMetrics type includes flipMetrics?: FlipMetrics (optional, only populated for flip strategy).
Update the calculate API route to include flipMetrics in its response when strategy === 'fix_and_flip'.
```

---

## PROMPT V2-10 — Final Integration & Regression Testing

```
We are finalising AssetVerdict V2. This prompt runs a full integration check.

Read all modified files and verify the following end-to-end flows work correctly.

STEP 1 — TypeScript compile check:
Run: `npx tsc --noEmit`
Fix all type errors. Common issues to look for:
  - DealWithRelations missing renovationItems
  - DealInputs missing strategy and new cashflow fields
  - FlipMetrics not in DealMetrics type
  - getStrategyThresholds not imported in summary page

STEP 2 — Test each strategy end-to-end (manual checklist — write the test file):

Create /lib/calculations/__tests__/strategies.test.ts:

For each strategy, test that calcAllMetrics() returns sensible values:

BUY TO LET test case:
  purchasePrice: 1_500_000, monthlyRent: 12_000, occupancyRate: 92,
  strategy: 'buy_to_let', managementFeeValue: 10, ...standard expenses
  Expected: grossYield > 8%, cashflowMonthly > 0

HMO test case:
  purchasePrice: 2_000_000, numUnits: 6, pricePerRoom: 4_000, occupancyRate: 85,
  strategy: 'multi_let', managementFeeValue: 15, billsIncluded: true
  Expected: grossRevenue = 6 × 4000 × 0.85 × 12 = 244,800 annually

STUDENT test case:
  numUnits: 10, pricePerRoom: 3_500, academicYearWeeks: 42, occupancyRate: 95,
  strategy: 'student'
  Expected: annualRevenue = 10 × 3500 × 42 × 0.95 ≈ 1,396,500

STR test case:
  nightlyRate: 850, avgOccupiedNights: 200, platformFeesPct: 15,
  strategy: 'str'
  Expected: grossRevenue = 850 × 200 × 0.85 = 144,500 annually

FIX & FLIP test case:
  purchasePrice: 1_200_000, renovationCost: 300_000, expectedSalePrice: 1_950_000,
  holdingPeriodMonths: 8, agentCommission: 5, capitalGainsTaxRate: 22,
  strategy: 'fix_and_flip'
  Expected: netProfit > 0, roi > 20%

INSTALMENT SALE test case:
  purchasePrice: 2_500_000, instalmentAmount: 35_000, instalmentTerm: 240,
  strategy: 'instalment_sale'
  Expected: grossRevenue = 35_000 × 12 = 420_000 annually

STEP 3 — PDF export check:
Open a deal for each strategy and verify:
  - PDF generates without errors
  - Page 2 (Scenario Comparison) shows all 3 columns with correct colours
  - Page 6 (Property Details) shows the new fields
  - Filename includes strategy name

STEP 4 — Renovation items check:
Add 5 renovation items to a deal.
Verify: 
  - Items appear in the table with correct totals
  - Total feeds correctly into acquisition costs
  - PDF shows renovation itemisation on Page 6
  - Deleting the deal cascades to delete renovation items (check DB)

STEP 5 — Update the completion checklist in /app/(app)/deals/[id]/summary/page.tsx:
The "missing fields" prompt should be strategy-aware:
  - Fix & Flip: require expectedSalePrice and renovationCost (not monthlyRent)
  - STR: require nightlyRate and avgOccupiedNights (not monthlyRent)  
  - ISA: require instalmentAmount
  - Others: existing required fields

STEP 6 — Update .env.example if any new environment variables were added.

STEP 7 — Update the onboarding flow (/app/welcome/page.tsx):
In Step 2 ("Create your first deal"), add the strategy selector cards
so new users choose their strategy before naming their deal.
Pre-select "Buy to Let" as the default for new users (most common starting strategy).

FINAL CHECK — Run full test suite:
  npm test
  npm run build
Both should pass with 0 errors.
```

---

# APPENDIX — QUICK REFERENCE

## 🔁 PROMPT A — Add a New Investment Strategy

```
Add a new investment strategy to AssetVerdict.

Strategy name: [e.g. "Co-Living"]
Strategy id: [e.g. "co_living"]  (snake_case, no spaces)
Icon: [emoji]
Description: [1-sentence description]
Default occupancy: [%]
Default management fee: [%]
Cashflow mode: [standard | per_room | nightly | academic | flip | instalment | custom]

Thresholds (what constitutes green/orange/red for this strategy):
  IRR: green >[X]%, orange [Y]-[X]%, red <[Y]%
  Gross Yield: green >[X]%, orange [Y]-[X]%, red <[Y]%
  DSCR: green >[X], orange [Y]-[X], red <[Y]
  OER: green <[X]%, orange [X]-[Z]%, red >[Z]%
  Payback Period: green <[X]yrs, orange [X]-[Y]yrs, red >[Y]yrs

Special cashflow fields (if any): [describe any unique revenue or expense fields]

Tasks:
1. Add to INVESTMENT_STRATEGIES array in /lib/strategies.ts
2. Add thresholds to getStrategyThresholds() in /lib/calculations/thresholds.ts
3. If cashflowMode is 'custom': add the revenue calculation branch in calcGrossRevenueAnnual()
4. Add StrategyHint text for this strategy in /components/forms/StrategyHint.tsx
5. Verify the strategy card appears in the Introduction tab selector
6. Verify the Summary page shows correct gauge colours for this strategy
```

---

## 🔁 PROMPT B — Add a New Property Detail Field

```
Add a new property detail field to AssetVerdict.

Field name (display label): [e.g. "Swimming Pool"]
Field key (camelCase): [e.g. "hasSwimmingPool"]
Field type: [Boolean | String | Float | Int]
Model: Deal  (all property details live on the Deal model)
Default value: [e.g. false]
Show for strategies: [all | list of strategy ids]
Section in form: [Property Details | Valuation | Selling Costs]

Tasks:
1. Add column to Deal model in /prisma/schema.prisma
2. Run migration
3. Add to Deal interface in /types/index.ts
4. Add to PATCH handler in /app/api/deals/[id]/route.ts
5. Add form field to /app/(app)/deals/[id]/edit/introduction/page.tsx 
   with strategy-conditional show/hide if needed
6. If it affects calculations: add to DealInputs in /lib/calculations/index.ts
   and update assembleInputs.ts
7. Add to PDF Property Details page (/lib/pdf/DealSummaryPDF.tsx Page 6)
```

---

## 🔁 PROMPT C — Add a Renovation Category Template

```
Add a predefined renovation category template to AssetVerdict.
When a user clicks a category chip, it pre-fills a renovation line with sensible defaults.

Category name: [e.g. "Solar Installation"]
Default description: [e.g. "Solar PV system with battery backup"]
Typical cost range: R [min] – R [max]
Default budgeted amount: R [e.g. 85000]
Relevant strategies: [all | list of strategy ids where this is commonly shown as a quick-add]

Tasks:
1. Add to the RENOVATION_CATEGORIES constant in /app/(app)/deals/[id]/edit/acquisition/page.tsx
2. Clicking the chip creates a new RenovationItem with the default description and budgeted amount
3. If strategy-specific: only show the chip when the relevant strategy is active
```

---

*AssetVerdict V2 — Know Before You Commit.*
