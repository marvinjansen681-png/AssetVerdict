# AssetVerdict — Complete Area Analysis Module
## Updated Plan & Build Prompts
> Incorporates all TPN report types observed:
> - TPN Investor Report (suburb-level, 12 pages)
> - TPN Investor Report (province-level, 13 pages)
> - TPN Property Valuation Report (property-level AVM, 8 pages)
> Based on reports dated November 2022, January 2023, April 2023, August 2026

---

# PART 1 — THREE TIERS OF MARKET INTELLIGENCE

AssetVerdict Area Analysis operates across three nested tiers.
Each tier answers a different investor question.

```
TIER 1: PROPERTY LEVEL (TPN Valuation Report)
  "What is this specific property worth and what have nearby properties sold for?"
  → Automated Valuation Model (AVM): Estimated Value + Low + High + Confidence
  → Comparable Sales: up to 20 nearby Deeds Office transactions
  → Transaction & Bond History: who owns it, what they paid, what they owe
  → Area Rentals: individual rental scatter (actual market data points)
  → Area Property Size Distribution: stand size histogram
  → Buyer/Seller Age Demographics: who is transacting in this area

TIER 2: SUBURB LEVEL (TPN Investor Report — suburb)
  "What is the rental market like in this suburb?"
  → Rental payment goodstanding (POT/GP/PL/PP/DNP)
  → Residential yield (gross and effective, sectional and freehold)
  → Rental price trends and distribution by bedroom count
  → Property demographics (rented %, ownership split)
  → Household demographics (income, employment, age, education)
  → Investment property ratio

TIER 3: PROVINCE LEVEL (TPN Investor Report — province)
  "How does this suburb compare to the broader provincial market?"
  → Province-wide goodstanding vs national
  → Province yield benchmarks
  → Province rental price ranges (upper bound context)
  → Province demographics (macro context)
```

---

# PART 2 — THE STRATEGY RENT MISMATCH FRAMEWORK

This is the core principle governing how TPN rent data is applied per strategy.

## The Problem
TPN Investor Reports show conventional residential rental averages by bedroom count.
These do NOT directly apply to:
- **Student Accommodation** — rented per room per academic week, not per unit per month
- **HMO / Multi-Let** — rented per room, often above conventional per-unit averages
- **STR / Airbnb** — priced per night, seasonal, premium above conventional rents

## The Solution: Primary Income vs Conventional Fallback

Every strategy in AssetVerdict will carry TWO rent figures from area data:

### PRIMARY INCOME (strategy-specific, user-entered)
The actual income the strategy generates. TPN data does NOT set this figure.
The user enters it based on their own research and market knowledge.
AssetVerdict provides a light calibration: "Is this realistic given local market conditions?"

### CONVENTIONAL FALLBACK (from TPN data)
The rent the property would generate if the primary strategy failed and
the investor had to revert to a standard long-term BTL let.
This IS directly sourced from TPN Investor Report averages.
It answers: "What's my floor if this strategy doesn't work out?"

### Per-Strategy Application Table

| Strategy | Primary Income Source | TPN Investor Report Use | TPN Valuation Report Use |
|---|---|---|---|
| Commercial | NOI/Cap Rate model | Market cap rate benchmark, yield comparison | Comparable sales for exit pricing |
| Buy to Let | Monthly rent (user) | Direct: suggest avg rent by bed count | Comparable sales, AVM for market value |
| Multi-Let / HMO | Per-room rent × rooms (user) | Fallback: "Conventional BTL: R X,XXX/mo if let as a single unit" | Area rental scatter for market floor |
| Student Accommodation | Per-room × academic weeks (user) | Fallback: "Standard BTL fallback: R X,XXX/mo" | Area rental scatter upper band |
| Fix & Flip | Exit sale price (user) | Not directly used for income | Primary: comparable sales for exit price, AVM for estimated value |
| STR / Airbnb | Nightly rate × nights (user) | Fallback: "Long-term rental fallback: R X,XXX/mo" | Area rental scatter, comparable rents |
| Instalment Sale | Monthly instalment (user) | Fallback: "Market rent if ISA fails: R X,XXX/mo" | AVM for security/collateral value |

### How Fallback is Displayed

For non-BTL strategies, show a dedicated "Exit / Fallback Analysis" card
on the Summary page and in the PDF:

```
┌─────────────────────────────────────────────────────────┐
│ 🚪 STRATEGY FALLBACK ANALYSIS                           │
│                                                          │
│ If [Student Accommodation] strategy fails, this          │
│ property would revert to a conventional BTL let.         │
│                                                          │
│ Conventional BTL Fallback Rent: R X,XXX/mo              │
│ (Source: TPN [SuburbName] — [X] bed [property type])    │
│                                                          │
│ Fallback Gross Yield: X.X%                              │
│ Fallback Cashflow: R X,XXX/mo                           │
│ Fallback vs Primary Income: -R X,XXX/mo (XX% lower)     │
│                                                          │
│ DSCR at fallback rent: X.XX                             │
│ [Green: >1.25 — serviceable | Red: <1.0 — distress]    │
│                                                          │
│ Assessment: "At fallback rent, this deal [can/cannot]   │
│ service its debt. The strategy carries [low/medium/high]│
│ exit risk."                                              │
└─────────────────────────────────────────────────────────┘
```

---

# PART 3 — COMPLETE DATA INVENTORY

## 3.1 TPN Property Valuation Report Fields

Extractable from the Property Valuation Report PDF:

**Property Identity:**
- SG Code (unique cadastral identifier)
- Property Description (Erf number, suburb, province)
- Property Address (full street address)
- Property Type (Full Title / Sectional Title)
- Stand Size (sqm)
- Longitude / Latitude (GPS coordinates)
- Valuation Zoning (Residential / Non-Residential / Agricultural / etc.)

**Automated Valuation:**
- Estimated Value (R)
- Market Low (R)
- Market High (R)
- Confidence Level (1–5 dots)

**Transaction History (per event):**
- Date
- Buyer Name(s) (up to 2)
- Buyer ID(s)
- Transaction Type (Transfer / Council Valuation / Auction / etc.)
- Amount (R)
- Title Deed Number

**Bond Information (per bond):**
- Bond Registration Date
- Bond Amount (R)
- Bond Number
- Institution (bank name)

**Comparable Sales (up to 20 nearby properties):**
- ID (1–20)
- Street Address
- Erf Number
- Portion
- Property Size (sqm)
- Purchase Date
- Purchase Price (R)

**Area Property Size Distribution:**
- Histogram data: % of properties at each 50sqm bracket (400 → 1,100+ sqm)
- Property type: Full Title / Sectional Title

**Area Transactions:**
- Scatter plot data: individual sale prices by date (Full Title + Sectional Title)
- Property Transactions trend: volume + avg purchase price (sectional and full title)

**Area Demographics (Deeds Office):**
- Buyer age distribution by band (<30 / 30-40 / 40-50 / 50-60 / 60-70 / 70-80 / >=80 / Juristic)
- Seller age distribution by same bands
- Period: last 2 years
- Current Owner age distribution by property type (Full Title / Sectional Title)

**Area Rentals:**
- Scatter plot: individual rental transaction data points by date
- Property type: Freehold / Sectional (where available)
- Note: this shows actual rental data, not averages

**Investment Properties:**
- % second properties trend (time series)
- Map: investment property density by suburb colour band

## 3.2 TPN Investor Report — Suburb Level Fields
(As documented in the original Area Analysis plan — all 15 sections)
Key additions from 2026 reports:
- Now shows >3Bed freehold category (not just 3Bed)
- Province field added to payment table (Suburb / Province / National)
- Yield charts now extend to 2026Q2

## 3.3 TPN Investor Report — Province Level Fields
Same structure as suburb report but:
- No suburb-level payment comparison (Province and National only)
- Broader demographic counts (province totals)
- Useful as upper-bound context and cross-check for suburb data
- Province-level rental prices represent the premium segment ceiling

---

# PART 4 — UPDATED DATABASE SCHEMA

## 4.1 New Model: PropertyValuation

```prisma
model PropertyValuation {
  id           String   @id @default(cuid())
  dealId       String   @unique
  deal         Deal     @relation(fields: [dealId], references: [id], onDelete: Cascade)
  
  // Property Identity
  sgCode           String?
  erfNumber        String?
  propertyAddress  String?
  propertyType     String?   // Full Title / Sectional Title
  standSize        Float?    // sqm
  longitude        Float?
  latitude         Float?
  valuationZoning  String?
  reportDate       DateTime?
  
  // AVM
  estimatedValue   Float?
  marketLow        Float?
  marketHigh       Float?
  confidenceLevel  Int?      // 1-5
  
  // Area context (aggregated from report)
  areaAvgSalePrice     Float?
  areaMedianSalePrice  Float?
  areaPriceGrowthPct   Float?   // YoY from area transactions
  areaRentalFloor      Float?   // lowest rent in scatter
  areaRentalCeiling    Float?   // highest rent in scatter
  areaRentalMedian     Float?   // estimated median from scatter
  investmentPropertyPct Float?
  
  // Buyer/Seller Demographics (last 2 years)
  buyerAge30to40Pct    Float?
  buyerAge40to50Pct    Float?
  sellerAge60plusPct   Float?   // signals ageing seller pool
  
  // Area property size
  areaTypicalStandSize  Float?  // modal bracket
  areaStandSizeMin      Float?
  areaStandSizeMax      Float?
  
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  
  comparableSales ComparableSale[]
  transactionHistory PropertyTransaction[]
  bondHistory BondRecord[]
}

model ComparableSale {
  id                  String  @id @default(cuid())
  propertyValuationId String
  propertyValuation   PropertyValuation @relation(...)
  
  streetAddress   String
  erfNumber       String?
  portion         Int?    @default(0)
  propertySizeSqm Float?
  purchaseDate    DateTime?
  purchasePrice   Float
  distanceM       Float?  // metres from subject property (if calculable)
  
  @@index([propertyValuationId])
}

model PropertyTransaction {
  id                  String  @id @default(cuid())
  propertyValuationId String
  propertyValuation   PropertyValuation @relation(...)
  
  date          DateTime?
  buyerName     String?
  buyerId       String?
  transType     String?   // Transfer / Council Valuation / etc.
  amount        Float?
  titleDeedNo   String?
}

model BondRecord {
  id                  String  @id @default(cuid())
  propertyValuationId String
  propertyValuation   PropertyValuation @relation(...)
  
  registrationDate DateTime?
  bondAmount       Float?
  bondNumber       String?
  institution      String?
}
```

Add to Deal model:
```prisma
propertyValuation PropertyValuation?
```

## 4.2 Updated SuburbProfile Model

Add province-level benchmarking fields:
```prisma
// Province benchmarks (from TPN Province Investor Report)
provinceSTGrossYield     Float?
provinceFHGrossYield     Float?
provinceGoodstandingPct  Float?
provinceST2BedAvgRent    Float?
provinceFH3BedAvgRent    Float?
provinceSTLargeBedAvg    Float?  // >2Bed ST (now tracked in 2026 reports)
provinceFHLargeBedAvg    Float?  // >3Bed FH (added in 2026 reports)
reportYear               Int?    // year of data (for staleness tracking)
```

---

# PART 5 — BUILD PROMPTS (FULL SET)

---

## PROMPT AA-1 — Three-Tier Schema & Database Setup

```
We are building the Area Analysis module for AssetVerdict.
Read /prisma/schema.prisma before starting.

TASK: Add all three tiers of area analysis to the database.

STEP 1 — Add to /prisma/schema.prisma:

1a. PropertyValuation model (property-level AVM from TPN Valuation Report):
Fields: sgCode, erfNumber, propertyAddress, propertyType, standSize, 
longitude, latitude, valuationZoning, reportDate,
estimatedValue, marketLow, marketHigh, confidenceLevel (Int 1-5),
areaAvgSalePrice, areaMedianSalePrice, areaPriceGrowthPct,
areaRentalFloor, areaRentalCeiling, areaRentalMedian,
investmentPropertyPct,
buyerAge30to40Pct, buyerAge40to50Pct, sellerAge60plusPct,
areaTypicalStandSize, areaStandSizeMin, areaStandSizeMax
Relation: @unique dealId → Deal (one-to-one, cascade delete)

1b. ComparableSale model:
Fields: streetAddress, erfNumber, portion, propertySizeSqm,
purchaseDate, purchasePrice, distanceM
Relation: propertyValuationId → PropertyValuation (cascade delete)

1c. PropertyTransaction model:
Fields: date, buyerName, buyerId, transType, amount, titleDeedNo
Relation: propertyValuationId → PropertyValuation (cascade delete)

1d. BondRecord model:
Fields: registrationDate, bondAmount, bondNumber, institution
Relation: propertyValuationId → PropertyValuation (cascade delete)

1e. SuburbProfile model (full model from original AA plan):
Add province-level benchmark fields:
provinceSTGrossYield, provinceFHGrossYield, provinceGoodstandingPct,
provinceST2BedAvgRent, provinceFH3BedAvgRent,
provinceSTLargeBedAvg, provinceFHLargeBedAvg, reportYear

1f. DealSuburb model (links Deal → SuburbProfile)

1g. Add to Deal model:
  propertyValuation PropertyValuation?
  dealSuburbs DealSuburb[]

Run: `prisma migrate dev --name add_area_analysis_full`

STEP 2 — Update /types/index.ts:
Export interfaces for all new models.
Update DealWithRelations to include:
  propertyValuation: PropertyValuation & {
    comparableSales: ComparableSale[]
    transactionHistory: PropertyTransaction[]
    bondHistory: BondRecord[]
  } | null
  dealSuburbs: (DealSuburb & { suburbProfile: SuburbProfile })[]

STEP 3 — Create /lib/db/area.ts with helpers:
  // Valuation
  upsertPropertyValuation(dealId, data)
  getPropertyValuation(dealId)
  addComparableSale(propertyValuationId, data)
  bulkAddComparableSales(propertyValuationId, sales[])
  
  // Suburb
  createSuburbProfile(userId, data)
  getSuburbProfile(id, userId)
  listSuburbProfiles(userId)
  updateSuburbProfile(id, userId, data)
  deleteSuburbProfile(id, userId)
  linkSuburbToDeal(dealId, suburbProfileId, isPrimary)
  getSuburbsForDeal(dealId)
  searchSuburbs(userId, query)

STEP 4 — Create API routes:
  /app/api/deals/[id]/valuation/route.ts (GET, PUT)
  /app/api/deals/[id]/valuation/comparables/route.ts (GET, POST bulk)
  /app/api/suburbs/route.ts (GET list, POST create)
  /app/api/suburbs/[id]/route.ts (GET, PATCH, DELETE)
  /app/api/deals/[id]/suburbs/route.ts (GET, POST link)
  /app/api/deals/[id]/suburbs/[suburbId]/route.ts (DELETE unlink)

STEP 5 — Update /lib/db/deals.ts getDeal() to include:
  propertyValuation: {
    include: {
      comparableSales: { orderBy: { purchaseDate: 'desc' } },
      transactionHistory: { orderBy: { date: 'desc' } },
      bondHistory: { orderBy: { registrationDate: 'desc' } }
    }
  },
  dealSuburbs: {
    include: { suburbProfile: true },
    orderBy: { isPrimary: 'desc' }
  }
```

---

## PROMPT AA-2 — Property Valuation Tab (Tier 1)

```
Build the Property Valuation data entry and display for AssetVerdict.
This is the Tier 1 area data — property-specific AVM from TPN Valuation Reports.

Read: /app/(app)/deals/[id]/edit/acquisition/page.tsx
      /prisma/schema.prisma (after AA-1 migration)

TASK: Add a "Property Valuation" section to the Acquisition Costs tab.

SECTION PLACEMENT:
Add above the existing Valuation section (Asking Price / Purchase Price / Market Value).
Collapsible with default: open if data exists, collapsed if empty.

SECTION TITLE: "TPN Property Valuation" with a "📊 Upload Report" button (top right)

--- IF NO VALUATION DATA YET ---
Show: empty state card with:
  "Add TPN Property Valuation data to validate your Market Value input."
  Two options:
  [📄 Upload TPN Valuation PDF] — triggers extraction (see AA-6 updated)
  [✏ Enter Manually] — shows the manual form below

--- IF DATA EXISTS ---

SUBSECTION A: AVM (Automated Valuation Model)
Three-column display (like the existing Market Low/Estimated/High in the TPN report):
  Market Low: R [marketLow] (grey)
  Estimated Value: R [estimatedValue] (bold, av-navy, large)
  Market High: R [marketHigh] (green)

Confidence dots: show 5 dot indicators, filled = confidenceLevel
Label: "TPN Confidence: [X/5]"
Sub-label: "Statistical estimate only — does not account for property condition"

AUTO-POPULATE BUTTON:
If estimatedValue exists and user hasn't set Market Value yet:
  Show gold banner: "TPN estimates this property at R [estimatedValue]
  (R [marketLow] – R [marketHigh])"
  [Use as Market Value] button → sets deal.marketValue = estimatedValue
  [Use Low as Market Value] button → sets to marketLow
  [Use High] → sets to marketHigh

SUBSECTION B: Transaction & Ownership History
Compact table:
  Date | Type | Buyer | Amount | Title Deed
  (most recent first, max 5 rows, "Show all" expands)

Bond row below:
  "Current Bond: R [bondAmount] with [institution] (registered [date])"
  If bond amount > 0 and purchase price known:
    "Estimated equity: R [purchasePrice - bondAmount] ([pct]%)"
    This helps gauge seller motivation and negotiation room.

SUBSECTION C: Comparable Sales
Title: "Comparable Sales (Deeds Office)" with report date shown

Table (sortable by date or price):
  # | Address | Size (sqm) | Sale Date | Price | R/sqm
  20 rows max, zebra striped

Below table — auto-calculated stats:
  Min sale price: R [x] | Max sale price: R [x]
  Avg price: R [x] | Median price: R [x]
  Avg R/sqm: R [x] | Most recent sale: [date] at R [x]
  
  Price trend note: "Recent sales ([last 6 months]) average R [x] vs
  older sales average R [x] — prices are [rising/falling/stable]."

  [Use Median as Market Value] button
  [Use Most Recent Sale as Market Value] button

SUBSECTION D: Area Property Context
Two stats displayed:
  "Typical stand size in this area: [areaTypicalStandSize]m²"
  "This property ([standSize]m²) is [above/below/within] the area norm."
  
  Investment property %: "[x]% of properties in this area are investment properties"
  (helps gauge rental demand vs competition)

SUBSECTION E: Buyer/Seller Age Context
Small info card:
  "Recent buyers (last 2 years): [x]% aged 30–40, [x]% aged 40–50"
  "Recent sellers: [x]% aged 60+"
  
  If sellerAge60plusPct > 40%:
    🟡 "High proportion of older sellers — may indicate motivated/estate sellers in the area"
  If buyerAge30to40Pct > 35%:
    🟢 "Strong young buyer demand — positive for future capital growth"

SAVE: All changes via PUT /api/deals/[id]/valuation
Auto-save comparables in bulk via POST /api/deals/[id]/valuation/comparables
```

---

## PROMPT AA-3 — Suburb Profile Data Entry Form (Tier 2 + Tier 3)

```
Build the suburb profile data entry form for AssetVerdict.
This handles both suburb-level (Tier 2) and province-level (Tier 3) data.

Read: /prisma/schema.prisma | /types/index.ts | /lib/strategies.ts

ROUTE: /app/(app)/suburbs/[id]/edit/page.tsx

Build a multi-section form with React Hook Form + Zod.
Sections are collapsible accordions — user fills what they have.

SECTION 0 — Report Identity (always visible)
  Suburb Name (text, required)
  City / Town (text)
  Province (select: all 9 SA provinces)
  Report Type (select: Suburb | Multiple Suburbs | Province)
  Report Date (date)
  Report Source (text, default "TPN Investor Report")
  Notes (textarea)

SECTION 1 — Rental Market Overview
Fields:
  Rented % of all properties (PercentInput)
  Sectional Title Gross Yield % (most recent quarter)
  Freehold Gross Yield %
  Sectional Title Effective Yield %
  Freehold Effective Yield %
  National Gross Yield % (from report national benchmark)
  Investment Property % (second properties ratio)
  Rental Price Trend — ST (select: >10%Up/Up/None/Down/>10%Down)
  Rental Price Trend — FH (select: same)

SECTION 2 — Rental Payment Index
  GoodStanding % — Suburb (POT+GP+PL)
  GoodStanding % — Province
  GoodStanding % — National
  POT % — Suburb
  GP % — Suburb
  PL % — Suburb
  PP % — Suburb
  DNP % — Suburb

Auto-display below: 
  "Suggested Bad Debts provision: [DNP + PP×0.5]%"
  "Suggested Occupancy Rate: [GoodStanding]%"

SECTION 3 — Rental Prices (Sectional Title)
  <2Bed: Low | Average | High (CurrencyInputs)
  2Bed:  Low | Average | High
  >2Bed: Low | Average | High
  Year of data: (select: 2024/2025/2026)

SECTION 4 — Rental Prices (Freehold)
  <3Bed: Low | Average | High
  3Bed:  Low | Average | High
  >3Bed: Low | Average | High (added in 2026 reports)
  Year of data: (select)

SECTION 5 — Province Benchmarks (Tier 3 data)
Label: "Province-level data (from TPN Province Investor Report)"
Helper: "Fill this in if you have a province-level TPN report. 
         Used as context when suburb data is unavailable."
  Province ST Gross Yield %
  Province FH Gross Yield %
  Province GoodStanding %
  Province ST 2Bed Average Rent (CurrencyInput)
  Province FH 3Bed Average Rent (CurrencyInput)
  Province ST >2Bed Average Rent
  Province FH >3Bed Average Rent

SECTION 6 — Property Transactions
  ST Avg Purchase Price (CurrencyInput)
  ST Transaction Volume (number per year)
  FH Avg Purchase Price (CurrencyInput)
  FH Transaction Volume (number per year)

SECTION 7 — Demographics Summary
  Formal Sector Employment %
  Unemployed %
  Income R76k–R307k % (middle band, rental sweet spot)
  Income R307k+ %
  Household Head Age 26–40 % (prime renter age)
  Household Head Age 41–60 %
  Household Head Age 17–25 % (student market signal)
  Large Household (6+ persons) % (HMO/multi-let demand signal)

AUTO-DERIVED DISPLAY (read-only, below Section 7):
Strategy suitability chips based on demographics:
  🎓 Student demand signal: [high/medium/low]
     (based on age 17–25 %, proximity to universities — user notes field)
  🏘️ HMO demand signal: [high/medium/low]
     (based on single-person households %, flatlet %)
  🏠 BTL demand signal: [high/medium/low]
     (based on rented %, formal employment %, middle income %)

ON SAVE: POST or PATCH /api/suburbs/[id]
Show toast: "Suburb profile saved"
```

---

## PROMPT AA-4 — Strategy-Aware Rent Suggestion Engine

```
Build the rent suggestion engine that applies area data correctly per strategy.
This is the most nuanced part of the Area Analysis integration.

Read:
  /lib/strategies.ts
  /lib/DealContext.tsx
  /app/(app)/deals/[id]/edit/cashflow/page.tsx
  /types/index.ts (SuburbProfile, PropertyValuation, ComparableSale)

TASK: Create /lib/area-suggestions.ts

This module computes what to suggest to the user in the Cashflow tab
based on: (1) their investment strategy, (2) their property details,
(3) linked suburb profile, (4) linked property valuation.

TYPES:
export interface RentSuggestion {
  primaryLabel: string;          // e.g. "Market average rent (2-bed ST)"
  primaryLow: number;
  primaryAvg: number;
  primaryHigh: number;
  primarySource: string;         // e.g. "TPN Investor Report — Port Elizabeth Central, Apr 2023"
  primaryApplicable: boolean;    // false for student/HMO/STR
  primaryCaveat?: string;        // explanation if not directly applicable

  fallbackLabel: string;         // "Conventional BTL fallback rent"
  fallbackLow: number;
  fallbackAvg: number;
  fallbackHigh: number;
  fallbackSource: string;

  scatterMin?: number;           // from PropertyValuation.areaRentalFloor
  scatterMax?: number;           // from PropertyValuation.areaRentalCeiling
  scatterMedian?: number;

  comparablesSaleAvg?: number;   // for fix & flip exit price
  comparablesSaleMedian?: number;
  comparablesCount?: number;

  occupancySuggestion: number;   // %
  badDebtsSuggestion: number;    // %
  rentalGrowthSuggestion: number; // %
  capitalGrowthSuggestion: number; // %
  marketCapRate: number;          // %
}

FUNCTION: calcRentSuggestion(
  strategy: StrategyId,
  deal: DealWithRelations,
  suburb: SuburbProfile | null,
  valuation: PropertyValuation | null
): RentSuggestion

LOGIC PER STRATEGY:

'commercial':
  primaryApplicable = true
  Use suburb freehold or sectional yield × (askingPrice or marketValue) / 12 as rent
  If suburb has no commercial data: use freehold >3Bed as proxy
  primaryCaveat = "Commercial rents vary significantly by use type — verify with local agents"
  fallback = same figure

'buy_to_let':
  primaryApplicable = true
  Match bedroom count from deal.bedrooms to TPN bracket:
    1 bed → <2Bed ST (if flat/sectional) or <3Bed FH (if freehold)
    2 bed → 2Bed ST or <3Bed FH
    3 bed → 3Bed FH or >2Bed ST
    4+ bed → >2Bed ST or >3Bed FH
  Use suburb data if available, fallback to province data
  fallback = same figure

'multi_let':
  primaryApplicable = false
  primaryCaveat = "Multi-let income is per room, not per unit. 
                   TPN data shows conventional whole-unit rents only."
  fallbackLabel = "Conventional BTL (whole unit, single tenant)"
  fallbackAvg = same BTL calculation as buy_to_let
  scatterMin/Max from PropertyValuation.areaRental* (if available)
  Show note: "Per-room HMO rents typically run 20–40% above the 
              equivalent whole-unit conventional rent per room."

'student':
  primaryApplicable = false
  primaryCaveat = "Student accommodation rents are per room per week 
                   during academic term. TPN data is not directly comparable."
  fallbackLabel = "Conventional BTL fallback (whole property, long-term tenant)"
  fallbackAvg = same BTL calculation
  Show note: "If student strategy fails, conventional fallback rent is R [fallbackAvg]/mo.
              At this rent, your DSCR would be [calculated live]."
  scatterMin/Max from PropertyValuation.areaRental* as floor reference
  Extract age 17–25 % from suburb if available as demand signal

'str':
  primaryApplicable = false
  primaryCaveat = "STR/Airbnb income is nightly and seasonal. 
                   TPN monthly averages are not comparable."
  fallbackLabel = "Long-term rental fallback"
  fallbackAvg = BTL calculation
  Show note: "If Airbnb strategy fails, conventional long-term rent is R [fallbackAvg]/mo."

'fix_and_flip':
  primaryApplicable = false (no rental income — profit at sale)
  Use ComparableSales instead:
    comparablesSaleAvg = mean of comparableSales.purchasePrice
    comparablesSaleMedian = median of comparableSales.purchasePrice
    comparablesCount = comparableSales.length
  Show in Cashflow/Flip tab:
    "Comparable sales suggest exit price: R [median] 
     (range R [min] – R [max], based on [n] recent sales)"
  AVM: "TPN estimated value: R [estimatedValue] 
        (R [marketLow] – R [marketHigh], confidence [x]/5)"

'instalment_sale':
  primaryApplicable = false
  fallbackLabel = "Market rent if ISA fails"
  fallbackAvg = BTL calculation
  AVM: useful for collateral value assessment

FALLBACK HIERARCHY:
If suburb data not available:
  1. Try province data
  2. If neither: show "No area data — enter manually"
  Never show null suggestions — always show a form field

OCCUPANCY SUGGESTION:
  All strategies: suburb.goodstandingPct ?? suburb.paidOnTimePct + suburb.gracePeriodPct + suburb.paidLatePct
  If no suburb: national average 82%
  HMO/Student: cap at min(goodstanding, 85%) — higher vacancy risk

BAD DEBTS SUGGESTION:
  = suburb.didNotPayPct + (suburb.partialPaymentPct × 0.5)
  If no suburb: national DNP 5% → suggest 5%
  HMO/Student: add 2% extra (higher tenant turnover risk)

RENTAL GROWTH SUGGESTION:
  Map suburb.stRentalTrend or fhRentalTrend to %:
    ">10%Up" → 10%
    "Up"     → 7%
    "None"   → 4%
    "Down"   → 2%
    ">10%Down" → 0%
  Default if no trend data: 5% (SA long-run average)

MARKET CAP RATE:
  suburb.freeholdGrossYield or sectionalTitleGrossYield
  Province yield if suburb unavailable
  National average 8% if neither

CAPITAL GROWTH SUGGESTION:
  Derived from comparable sales price trend (if Valuation Report available):
    Compare avg of last 12 months vs prior 12 months in comparableSales
  Else: fall back to suburb purchase price trend direction
  Default: 3%
```

---

## PROMPT AA-5 — Cashflow Tab Strategy-Aware Suggestions Panel

```
Wire the rent suggestion engine into the Cashflow tab.
Read: /app/(app)/deals/[id]/edit/cashflow/page.tsx
      /lib/area-suggestions.ts (from AA-4)
      /lib/strategies.ts
      /lib/DealContext.tsx

TASK: Add a "Market Intelligence" panel to the top of the Cashflow tab.

The panel shows only when a suburb profile OR property valuation is linked to the deal.
It is collapsible (default open).

PANEL HEADER:
  "📊 Area Intelligence" 
  Source badges: [🏘️ SuburbName] [📋 TPN Valuation] (whichever are linked)
  [Collapse ↑] button

--- FOR STRATEGIES WHERE primaryApplicable = true (BTL, Commercial) ---

RENT GUIDANCE BOX (av-gold left border, soft yellow bg):
  Title: "Market Rental Range — [X bed, property type, suburb]"
  
  Three-column display:
    LOW          |    AVERAGE     |    HIGH
    R [low]      |  R [avg] ★    |  R [high]
  
  "★ Market average" label under middle column
  
  Source: "TPN Investor Report — [SuburbName] ([reportDate])"
  
  Three apply buttons below:
    [Use R [low] — Conservative]
    [Use R [avg] — Market Rate]  ← primary CTA, av-gold
    [Use R [high] — Optimistic]
  
  On click: sets deal's monthlyRent field, marks form dirty

OCCUPANCY, BAD DEBTS, GROWTH suggestions (3 smaller chips):
  Each shows: label | suggested value | [Apply] button
  
  "Occupancy Rate — based on [suburb] goodstanding ([goodstandingPct]%): [suggestion]%"
  "Bad Debts — based on [suburb] DNP [didNotPayPct]% + partial [partialPaymentPct]%: [suggestion]%"
  "Rental Growth — [suburb] trend: [Up/Down/None] → suggest [x]%/yr"

--- FOR STRATEGIES WHERE primaryApplicable = false (Student, HMO, STR, ISA) ---

PRIMARY STRATEGY NOTE (soft blue bg):
  Icon + Strategy label
  "[Strategy] income is not directly benchmarkable against TPN rental averages."
  Specific caveat text from calcRentSuggestion().primaryCaveat

FALLBACK ANALYSIS BOX (amber left border):
  "🚪 If [strategy] fails — Conventional BTL Fallback"
  
  Three-column:
    LOW          |    AVERAGE     |    HIGH
    R [low]      |  R [avg]      |  R [high]
  
  "This is what the property would rent for as a standard long-term let."
  
  Live calculation shown:
    "At fallback rent: Cashflow = R [calc]/mo | DSCR = [calc]"
    Colour coded: green if DSCR >1.25, orange 1.0-1.25, red <1.0
  
  [Save as Fallback Reference] button → stores fallbackRent on the deal

--- FOR FIX & FLIP ---

COMPARABLE SALES BOX (replaces rent panel):
  "🏠 Comparable Sales — Exit Price Reference"
  
  Stats row:
    Median: R [x] | Average: R [x] | Range: R [x] – R [x]
    Based on [n] comparable sales in [suburb] ([date range])
  
  Mini table: 5 most recent comps (address | size | date | price | R/sqm)
  "View all [n] comparables →" link → opens comparable sales modal
  
  TPN AVM box:
    "TPN Estimated Value: R [estimatedValue]"
    Confidence: [dots]
    Range: R [low] – R [high]
  
  [Use AVM as Expected Sale Price] button
  [Use Median Comparable as Expected Sale Price] button
  
--- AREA RENTAL SCATTER CONTEXT (all strategies) ---
If PropertyValuation has areaRentalFloor/Ceiling/Median:
  Small grey info box at bottom of panel:
  "Area rental scatter (TPN Valuation Report): R [floor] – R [ceiling] 
   (median: R [median])"
  "This shows the actual spread of individual rental transactions in [area]."
```

---

## PROMPT AA-6 — Fallback Analysis on Summary Page

```
Add the Strategy Fallback Analysis to the AssetVerdict Summary page.

Read:
  /app/(app)/deals/[id]/summary/page.tsx
  /lib/area-suggestions.ts
  /lib/calculations/index.ts
  /lib/strategies.ts

TASK: Build the FallbackAnalysisCard component and add to Summary page.

CREATE: /components/FallbackAnalysisCard.tsx

Props:
  strategy: StrategyId
  suggestion: RentSuggestion
  metrics: DealMetrics
  inputs: DealInputs

DISPLAY: Only show for strategies where primaryApplicable = false
(Student, HMO, STR, Instalment Sale)
For Fix & Flip: show a different ExitAnalysisCard (see below)

--- FALLBACK ANALYSIS CARD ---

HEADER:
  "🚪 Exit Strategy — If [Strategy Label] Fails"
  Subtitle: "Based on [SuburbName] conventional rental market data"

THREE COLUMNS:

Column 1 — Fallback Income:
  Title: "Conventional BTL Fallback"
  Monthly Rent: R [fallbackAvg]
  (Low: R [fallbackLow] | High: R [fallbackHigh])
  Annual Revenue: R [fallbackAvg × 12]
  Source badge: TPN [suburb] [date]

Column 2 — Fallback vs Primary:
  Primary monthly income: R [deal.cashflowInputs.monthlyRent × occupancyRate]
  Fallback monthly income: R [fallbackAvg]
  Shortfall: -R [x]/mo (XX% lower)
  
  Gauge: "Fallback covers [x]% of primary income"
  Green >80% | Orange 50-80% | Red <50%

Column 3 — Fallback Debt Serviceability:
  Calculate DSCR using fallback rent instead of primary income:
  DSCR at fallback = (fallbackAvg × 12 - expenses) / annualDebtService
  
  Display as gauge dial:
    Green >1.25 — Deal survives strategy change
    Orange 1.0-1.25 — Tight but serviceable
    Red <1.0 — Can't service debt on conventional rent
  
  Label: "DSCR at Conventional Rent"
  
BOTTOM ROW — Risk Assessment:
  Auto-generated one-line verdict:
  If DSCR_fallback > 1.25:
    "🟢 Low exit risk — this property services its debt even at conventional BTL rents."
  Elif DSCR_fallback > 1.0:
    "🟡 Medium exit risk — debt barely covered at conventional rents. 
        Monitor [strategy] performance carefully."
  Else:
    "🔴 High exit risk — conventional rents would not cover debt repayments. 
        This deal depends on [strategy] succeeding. Ensure robust contingency plan."

--- EXIT ANALYSIS CARD (Fix & Flip only) ---

CREATE: /components/ExitAnalysisCard.tsx

Shows comparable sales analysis:
  Comparable Sales: [n] sales found
  Median exit price: R [x]
  Your expected sale price: R [x] ([x]% above/below median)
  
  Price position:
    "Your expected sale price is in the [top/middle/bottom] third of comparable sales."
  
  Confidence signal:
    If expectedSalePrice between comparablesSaleAvg × 0.9 and × 1.1:
      "🟢 Expected price is within 10% of the comparable sales average — realistic."
    If above × 1.1:
      "🟡 Expected price is [x]% above the comparable sales average — verify with agents."
    If above × 1.25:
      "🔴 Expected price is [x]% above comparable sales average — may be optimistic."

INTEGRATION:
In /app/(app)/deals/[id]/summary/page.tsx:
After the Returns section and before Yields & Returns:
  if (strategy.cashflowMode !== 'standard' && strategy.id !== 'buy_to_let') {
    <FallbackAnalysisCard ... />  // for student/HMO/STR/ISA
    // OR
    <ExitAnalysisCard ... />      // for fix_and_flip
  }
```

---

## PROMPT AA-7 — PDF Upload & AI Extraction (Both Report Types)

```
Build the AI-powered PDF extraction for both TPN report types.

Read: /app/api/suburbs/extract/route.ts (if it exists from prior build)

CREATE: /app/api/area/extract/route.ts (POST)
This unified route handles extraction from BOTH report types.

STEP 1 — Report Type Detection:
On upload, first call Claude to detect the report type:

Detection prompt:
"Look at this TPN PDF report. Return ONLY one of these exact strings:
 'VALUATION' if this is a TPN Property Valuation Report (contains AVM, comparable sales)
 'INVESTOR_SUBURB' if this is a TPN Investor Report for a specific suburb or multiple suburbs
 'INVESTOR_PROVINCE' if this is a TPN Investor Report for an entire province
 Nothing else — just the one word."

STEP 2 — Extract based on detected type:

IF 'VALUATION':
Call Claude with valuation extraction prompt:
{
  reportType: 'VALUATION',
  sgCode: string | null,
  propertyAddress: string | null,
  propertyType: string | null,    // "Full Title" or "Sectional Title"
  standSize: number | null,       // sqm
  latitude: number | null,
  longitude: number | null,
  valuationZoning: string | null,
  reportDate: string | null,      // ISO date
  estimatedValue: number | null,
  marketLow: number | null,
  marketHigh: number | null,
  confidenceLevel: number | null, // 1-5 (count filled dots)
  transactionHistory: Array<{
    date: string | null,
    buyerName: string | null,
    transType: string | null,
    amount: number | null,
    titleDeedNo: string | null
  }>,
  bondHistory: Array<{
    registrationDate: string | null,
    bondAmount: number | null,
    bondNumber: string | null,
    institution: string | null
  }>,
  comparableSales: Array<{
    streetAddress: string,
    erfNumber: string | null,
    propertySizeSqm: number | null,
    purchaseDate: string | null,
    purchasePrice: number
  }>,
  investmentPropertyPct: number | null,
  areaRentalFloor: number | null,    // lowest dot on rental scatter (approx)
  areaRentalCeiling: number | null,  // highest dot on rental scatter (approx)
  areaTypicalStandSize: number | null,  // modal bracket on size distribution
  buyerAge30to40Pct: number | null,
  buyerAge40to50Pct: number | null,
  sellerAge60plusPct: number | null
}

IF 'INVESTOR_SUBURB' or 'INVESTOR_PROVINCE':
Call Claude with suburb extraction prompt (same as original AA plan prompt):
{
  reportType: 'INVESTOR_SUBURB' | 'INVESTOR_PROVINCE',
  suburbName: string | null,       // null if province report
  province: string | null,
  reportDate: string | null,
  rentedPct: number | null,
  goodstandingPct: number | null,
  paidOnTimePct: number | null,
  gracePeriodPct: number | null,
  paidLatePct: number | null,
  partialPaymentPct: number | null,
  didNotPayPct: number | null,
  provinceGoodstandingPct: number | null,
  nationalGoodstandingPct: number | null,
  sectionalTitleGrossYield: number | null,
  freeholdGrossYield: number | null,
  nationalGrossYield: number | null,
  // Sectional Title rents
  stSmallBedLow: number | null,   stSmallBedAvg: number | null,   stSmallBedHigh: number | null,
  st2BedLow: number | null,       st2BedAvg: number | null,       st2BedHigh: number | null,
  stLargeBedLow: number | null,   stLargeBedAvg: number | null,   stLargeBedHigh: number | null,
  // Freehold rents
  fhSmallBedLow: number | null,   fhSmallBedAvg: number | null,   fhSmallBedHigh: number | null,
  fh3BedLow: number | null,       fh3BedAvg: number | null,       fh3BedHigh: number | null,
  fhLargeBedLow: number | null,   fhLargeBedAvg: number | null,   fhLargeBedHigh: number | null,
  stAvgPurchasePrice: number | null,
  fhAvgPurchasePrice: number | null,
  investmentPropertyPct: number | null,
  stRentalTrend: '>10%Up'|'Up'|'None'|'Down'|'>10%Down' | null,
  fhRentalTrend: '>10%Up'|'Up'|'None'|'Down'|'>10%Down' | null,
  formalSectorPct: number | null,
  unemployedPct: number | null,
  incomeMiddleBandPct: number | null,   // R76k-R307k band
  age17to25Pct: number | null,          // student market signal
  singlePersonHouseholdPct: number | null,
  // Province benchmarks (fill if province report)
  provinceSTGrossYield: number | null,
  provinceFHGrossYield: number | null,
  provinceST2BedAvgRent: number | null,
  provinceFH3BedAvgRent: number | null,
  provinceSTLargeBedAvg: number | null,
  provinceFHLargeBedAvg: number | null
}

STEP 3 — Route response:
Return: { reportType, data, extractionScore, missingFields[] }
extractionScore = count of non-null fields / total fields × 100

STEP 4 — Frontend handling:
/app/(app)/area/upload/page.tsx (new unified upload page):
  - Upload PDF drag-and-drop
  - Show spinner: "Detecting report type..."
  - Show spinner: "Extracting data..."
  - Show detected type badge: "📊 Property Valuation Report" or "🏘️ Investor Report"
  - Show extraction score: "XX% of fields extracted"
  - Route to appropriate review form:
    VALUATION → deal property valuation review form (in /deals/[id]/edit/acquisition)
    INVESTOR → suburb profile review form (/suburbs/[id]/edit)
  
  If called from a deal context (via ?dealId=[id]):
    VALUATION → auto-link to that deal
    INVESTOR → prompt: "Link this suburb to deal [name]?" [Yes/No]
```

---

## PROMPT AA-8 — Suburb Profile Dashboard (Tier 2 + Tier 3 Display)

```
Build the Suburb Profile detail page for AssetVerdict.

ROUTE: /app/(app)/suburbs/[id]/page.tsx

Read: /types/index.ts | /lib/suburb-scoring.ts (from original plan)

HEADER ROW:
  Suburb name (DM Serif Display, large)
  Province badge | Report Date | Source: "TPN Investor Report"
  "Edit" button | "Use in Deal ▼" dropdown | "Compare ▼" button

--- TIER INDICATOR ---
If province benchmarks are filled:
  Show: "📊 Data: Suburb + Province context"
Else:
  Show: "📊 Data: Suburb only"

SECTION 1 — Market Snapshot (4 gauges)
  ST Gross Yield % | FH Gross Yield % | GoodStanding % | Demand (Rented %)

SECTION 2 — Rental Price Reference Table (updated for 2026 format)
Property Type | Low | Average | High | Trend

Rows:
  Sectional Title <2Bed  | R x | R x | R x | ↑/↓/→
  Sectional Title 2Bed   | R x | R x | R x | ↑/↓/→
  Sectional Title >2Bed  | R x | R x | R x | ↑/↓/→
  Freehold <3Bed         | R x | R x | R x | ↑/↓/→
  Freehold 3Bed          | R x | R x | R x | ↑/↓/→
  Freehold >3Bed         | R x | R x | R x | ↑/↓/→  ← NEW (2026 reports)

If province data available, show a second sub-row for each:
  "Province avg: R [province figure]"
  Variance chip: "+XX% above province" or "-XX% below province"

SECTION 3 — Payment Risk Panel (same as original plan)

SECTION 4 — Strategy Suitability Matrix (NEW)
Title: "Strategy Signals for this Suburb"

Table showing each strategy and the suburb's fit indicators:

| Strategy | Key Signal | Rating | Notes |
|---|---|---|---|
| 🏢 Commercial | FH Gross Yield vs national | 🟢/🟡/🔴 | [yield]% vs national [x]% |
| 🏠 Buy to Let | GoodStanding + formal employment | 🟢/🟡/🔴 | [gs]% goodstanding |
| 🏘️ HMO | Single HH% + rented% + flatlet% | 🟢/🟡/🔴 | [x]% single households |
| 🎓 Student | Age 17-25% + rented% | 🟢/🟡/🔴 | [x]% young renters |
| 🔨 Fix & Flip | Price trend + investment% | 🟢/🟡/🔴 | Prices [trending up/flat/down] |
| 🌴 STR | Investment% + area income | 🟢/🟡/🔴 | [x]% investors in area |
| 📄 ISA | Formal employment + income | 🟢/🟡/🔴 | [x]% formal sector |

Rating logic:
  Green = strong positive signal for that strategy
  Orange = mixed / neutral
  Red = weak or negative signal

Note below table:
  "⚠ These are demand signals only, not recommendations.
   Always verify strategy suitability with local market knowledge."

SECTION 5 — Tenant Quality Index (same as original plan, include age 17-25 now)

SECTION 6 — Linked Deals (same as original)
```

---

## PROMPT AA-9 — Three-Tier Context on Summary Page & PDF

```
Integrate all three tiers of area data into the deal Summary page and PDF export.

Read:
  /app/(app)/deals/[id]/summary/page.tsx
  /lib/pdf/DealSummaryPDF.tsx
  /lib/area-suggestions.ts

TASK: Add a comprehensive "Area Intelligence" section to the Summary page.

SECTION: "Area Intelligence" (collapsible, after Scenarios, before Returns)

--- IF NO AREA DATA LINKED ---
"🗺 No area data linked. Add a TPN report to benchmark this deal."
Buttons: [Upload TPN Valuation Report] [Add Suburb Profile]

--- IF ONLY VALUATION REPORT (Tier 1) ---
Show PropertyValuationCard:
  AVM: R [low] — R [estimated] — R [high] (confidence [x]/5)
  Market Value entered: R [deal.marketValue]
  Variance: "[deal.marketValue] is [x]% [above/below] TPN estimate"
  Comparable sales: n sales, median R [x], most recent R [x] on [date]
  Area scatter: rentals R [floor] – R [ceiling]
  
  Fallback Analysis Card (if non-BTL strategy)

--- IF SUBURB PROFILE (Tier 2) ---
Show SuburbSnapshotCard:
  Rent comparison: deal rent vs market average
  Yield comparison: deal yield vs suburb yield
  Goodstanding context
  Occupancy/Bad debts validation
  Strategy Fallback Analysis

--- IF BOTH (full picture) ---
Show both cards stacked, connected by a "→" or data flow arrow
PropertyValuationCard feeds into SuburbSnapshotCard:
  "AVM estimate R [x] | Comparable sales: R [x] avg"
  ↓
  "Suburb conventional rent: R [x] | Yield: [x]%"
  ↓
  "Province benchmark yield: [x]%"

--- PDF UPDATES ---

In /lib/pdf/DealSummaryPDF.tsx, the area pages now become:

PAGE 6 (existing): Property Details — unchanged

PAGE 7: Property Valuation & Comparables (NEW — only if Valuation Report linked)
  Left half:
    AVM table: Low | Estimated | High | Confidence
    Transaction history (last 3 events)
    Bond information
  Right half:
    Comparable Sales table (up to 10 most relevant)
    Columns: Address | Size | Date | Price | R/sqm
  
  Footer row:
    "Comparable sales median: R [x] | Area rental scatter: R [floor]–R [ceiling]"

PAGE 8: Suburb Area Analysis (only if suburb linked)
  Same as original AA-7 plan, but now includes:
  - Province benchmark comparison row
  - Strategy Suitability Matrix (condensed)
  - Fallback Analysis summary

PAGE 9 (if both linked): Market Intelligence Summary
  Title: "Three-Tier Market Intelligence"
  Compact table showing all three tiers side by side:
  
  Metric              | This Property | [Suburb] | Eastern Cape Province
  ---|---|---|---
  Estimated Value     | R [AVM]       | N/A      | N/A
  Gross Yield         | [deal yield]% | [x]%     | [x]%
  Avg Comparable Sale | R [x]         | R [x]    | R [x]
  GoodStanding        | N/A           | [x]%     | [x]%
  2Bed Avg Rent       | N/A           | R [x]    | R [x]
  Rental Trend        | N/A           | [↑/↓/→] | [↑/↓/→]
  
  Fallback Analysis (one paragraph):
  "If [strategy] fails, conventional BTL rent for this property 
   is approximately R [fallbackAvg]/mo (TPN [suburb] data).
   At this rent, the deal's DSCR would be [x], which [is/is not]
   sufficient to service the debt."
```

---

## PROMPT AA-10 — Navigation, Library & Final Integration

```
Final integration of the full Area Analysis module into AssetVerdict.

Read: /components/Sidebar.tsx | /app/(app)/layout.tsx | /app/(app)/page.tsx

STEP 1 — Sidebar navigation:
Add "🗺 Area Research" between "My Deals" and the bottom of the nav.
Sub-items (on hover or expand):
  → Suburb Profiles
  → Upload Report
  → Compare Suburbs

STEP 2 — Deal Introduction tab quick-link:
In the Property Details section of the Introduction tab, add:
  "Property Valuation: [Upload TPN Valuation Report]" (if none linked)
  OR "[AVM: R xxx,xxx | Confidence x/5] — [View] [Re-upload]" (if linked)
  
  Below that:
  "Area Research: [Add Suburb Profile]" (if none linked)
  OR "[SuburbName] — GS: xx% | Yield: xx% [View] [Change]" (if linked)

STEP 3 — Unified upload entry point:
/app/(app)/area/upload/page.tsx
Accessible from: deal introduction tab, suburb list, sidebar
Auto-detects report type (VALUATION vs INVESTOR)
Routes extracted data to correct destination

STEP 4 — Home page area widget:
In /app/(app)/page.tsx, add below deals section:
  "📊 Area Intelligence"
  [x] suburb profiles saved
  [x] property valuations
  Show 2 most recently updated suburb cards
  [+ Upload TPN Report] quick action button

STEP 5 — Deal card area indicator:
In /components/DealCard.tsx, add below strategy badge:
  If propertyValuation exists:
    "📋 AVM: R [estimatedValue]" chip
  If suburb linked:
    "📍 [suburbName] | GS: [goodstandingPct]%"

STEP 6 — Staleness warning:
In SuburbSnapshotCard and PropertyValuationCard:
  If reportDate is > 18 months ago:
    Show: "⚠ Area data is [x] months old. Consider refreshing with a new TPN report."
  If reportYear < current year - 1:
    Same warning

STEP 7 — TypeScript final check:
Run: `npx tsc --noEmit`
Ensure all area types flow correctly through:
  DealWithRelations → calcRentSuggestion → RentSuggestion → components

STEP 8 — End-to-end test scenarios:

TEST 1 — BTL deal with full suburb data:
  Upload TPN Investor Report → suburb profile created
  Link to BTL deal → Cashflow tab shows rent suggestions
  Apply average rent → check it flows to calculations
  View Summary → Area Intelligence shows yield comparison
  Export PDF → Page 7 shows suburb data

TEST 2 — Student accommodation with both report types:
  Upload TPN Valuation Report → linked to deal
  Upload TPN Investor Report → suburb profile linked
  Cashflow tab → shows "Not directly comparable" + fallback R [x]/mo
  Summary → Fallback Analysis Card shows DSCR at conventional rent
  PDF → all three tiers shown in Market Intelligence page

TEST 3 — Fix & Flip with Valuation Report only:
  Upload TPN Valuation Report for the property
  Cashflow tab → shows comparable sales, median exit price suggestion
  [Use Median Comparable as Expected Sale Price] → sets expectedSalePrice
  Exit Analysis Card on Summary shows price position vs comparables

TEST 4 — Province-level data as fallback:
  No suburb profile, but province-level Investor Report uploaded
  Cashflow tab → shows "Province data used (no suburb profile available)"
  Province Eastern Cape: 2-bed ST avg R6,962/mo, FH 3-bed R9,443/mo (2026)
  These are used as suggestions until a suburb-level report is added
```

---

# PART 6 — EXTRACTION PROMPT NOTES FOR 2026 REPORT FORMAT

The 2026 TPN Investor Reports introduced two changes the extraction prompt must handle:

## Change 1: >3Bed Freehold Category
2026 reports now show three freehold bedroom categories:
  <3Bed | 3Bed | >3Bed (previously only <3Bed and 3Bed)
The extraction prompt must capture fhLargeBedLow/Avg/High for the >3Bed row.

## Change 2: Province column in Payment Table
2026 Investor Reports show:
  Payment Trend | Province % | National %
(no longer showing Suburb / Province / National — for province-level reports,
the "Province" column IS the suburb-level data)

The extraction prompt must handle both formats:
  - 3-column (Suburb, Province, National): standard suburb report
  - 2-column (Province, National): province-level report

## Change 3: Updated Date Ranges
2024/2025/2026 rental price data now available.
The `reportYear` field on SuburbProfile stores which year's data was entered.
When province data is from 2026 and suburb data from 2023:
  Show: "Province data: 2026 | Suburb data: 2023 — suburb data may be stale"

---

# PART 7 — STRATEGY × REPORT TYPE COMPATIBILITY MATRIX

```
Strategy         | Valuation Report | Suburb Investor | Province Investor
-----------------|------------------|-----------------|------------------
Commercial       | AVM + comps      | Yield benchmark | Upper bound yield
Buy to Let       | AVM + comps      | Direct rent use | Fallback if no suburb
Multi-Let / HMO  | Scatter floor    | BTL fallback    | BTL fallback
Student Accom    | Scatter floor    | BTL fallback    | BTL fallback
Fix & Flip       | PRIMARY (comps)  | Capital growth  | Macro trend
STR / Airbnb     | Scatter floor    | BTL fallback    | BTL fallback
Instalment Sale  | AVM (security)   | Market rent ref | Province reference
```

---

# PART 8 — MONETISATION & DATA TIERS

The three-tier area intelligence creates a natural product ladder:

**Free:**
  Manual data entry only, 1 suburb profile, no PDF extraction

**Pro (R299/mo):**
  Unlimited suburb profiles
  PDF extraction (both report types) — 10 uploads/mo
  Suburb comparison (3-way)
  Fallback Analysis on Summary
  Area data in PDF export

**Pro+ (R599/mo):**
  Unlimited PDF extractions
  Province-level benchmarking
  Three-tier Market Intelligence PDF page
  Strategy Suitability Matrix
  Comparable sales comparable analysis
  
**Enterprise (custom):**
  TPN API direct integration
  Bulk deal upload with area matching
  White-label reports
  Team suburb profile sharing

---

*AssetVerdict Area Intelligence — Property. Suburb. Province. Know Before You Commit.*
