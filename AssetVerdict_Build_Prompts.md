# AssetVerdict — Developer Build Prompts
> Paste each prompt into Claude Code (or your AI coding assistant) in sequence.
> Each prompt is self-contained and references prior outputs where needed.

---

## HOW TO USE THESE PROMPTS

1. Work through prompts **in order** — each builds on the last.
2. Before pasting a prompt, append any file paths or outputs the previous step produced (e.g. schema files, component files).
3. Prompts marked 🔁 can be re-run to add more items of the same type.
4. Keep a `/docs/decisions.md` file and paste any important architectural choices there as you go.

---

---

# PHASE 1 — FOUNDATION

---

## PROMPT 1 — Project Scaffolding

```
You are building AssetVerdict, a commercial property deal analysis web app.
Tagline: "Know Before You Commit."

Scaffold a full-stack Next.js 14 project with the following setup:

TECH STACK:
- Next.js 14 (App Router)
- TypeScript (strict mode)
- Tailwind CSS
- Prisma ORM
- PostgreSQL (use DATABASE_URL env var)
- NextAuth.js v5 for authentication
- React Hook Form + Zod for form validation
- Recharts for charts
- Lucide React for icons

FOLDER STRUCTURE:
/app               - Next.js App Router pages
/app/api           - API route handlers
/components        - Shared UI components
/components/ui     - Base primitives (Button, Input, Card, etc.)
/components/gauges - GaugeDial and related components
/components/charts - Chart components
/components/forms  - Form section components
/lib               - Utilities and helpers
/lib/calculations  - Financial calculation engine (pure functions)
/lib/db            - Prisma client singleton
/prisma            - Schema and migrations
/styles            - Global CSS
/types             - Shared TypeScript types

BRANDING TOKENS (add to tailwind.config.ts and globals.css):
--av-navy:       #0F1F3D   (primary dark, nav)
--av-gold:       #C9A84C   (accent, CTAs)
--av-white:      #F8F9FA   (page background)
--av-slate:      #4A5568   (body text)
--av-green:      #27AE60   (good/positive gauge state)
--av-orange:     #E67E22   (warning gauge state)
--av-red:        #E74C3C   (danger gauge state)
--av-light-grey: #EDF2F7   (card backgrounds, dividers)

FONTS (via next/font or Google Fonts):
- DM Serif Display → headings (h1–h3)
- Inter             → body, UI labels, form fields
- Roboto Mono       → financial numbers, gauge values

TASKS:
1. Create the project structure above
2. Set up tailwind.config.ts with the brand colour tokens as custom colours (e.g. colors.av.navy)
3. Add globals.css with CSS variables for the brand tokens
4. Set up next.config.ts
5. Create /lib/db.ts (Prisma singleton)
6. Create /types/index.ts with empty type stubs (Deal, FinanceSource, CashflowInputs, User)
7. Create a root layout.tsx with: nav sidebar, top bar with logo and user avatar, main content area
8. Create a simple home page (/) with a hero: AssetVerdict logo, tagline "Know Before You Commit.", and a "Start a New Deal" CTA button in gold

The logo should be an SVG shield icon next to the wordmark "AssetVerdict" in DM Serif Display, navy and gold.

Do not scaffold auth or database yet — just the UI shell and config.
```

---

## PROMPT 2 — Database Schema & Prisma Setup

```
We are building AssetVerdict. Set up the Prisma schema and database.

Create /prisma/schema.prisma with the following models:

MODEL: User
- id           String   @id @default(cuid())
- email        String   @unique
- name         String?
- passwordHash String
- createdAt    DateTime @default(now())
- deals        Deal[]

MODEL: Deal
- id              String   @id @default(cuid())
- userId          String
- user            User     @relation(fields: [userId], references: [id])
- name            String
- propertyType    String?  (e.g. "Commercial", "Residential", "Industrial")
- address         String?
- notes           String?
- currency        String   @default("ZAR")

  // Acquisition
- askingPrice     Float?
- purchasePrice   Float?
- marketValue     Float?
- transferBondCost      Float?
- renovationCost        Float?
- sourcingFee           Float?
- agentCommission       Float?   (percentage)
- wantToSell            Boolean  @default(false)

  // Other Inputs / Enterprise
- incomeTaxRate         Float?   @default(27)
- capitalGainsTaxRate   Float?   @default(22)
- capitalGrowthRate     Float?   @default(3)
- rentalGrowthRate      Float?   @default(8)
- costInflation         Float?   @default(5)
- sustainableGrowthRate Float?   @default(5)
- discountRate          Float?   @default(10)
- realGrowthFactor      Float?   @default(10)
- occupationFactor      Float?   @default(10)
- marketCapRate         Float?   @default(10)  (for Cap Rate Spread calc)

- createdAt      DateTime @default(now())
- updatedAt      DateTime @updatedAt

- financeSources  FinanceSource[]
- cashflowInputs  CashflowInputs?
- capexItems      CapexItem[]

MODEL: FinanceSource
- id              String  @id @default(cuid())
- dealId          String
- deal            Deal    @relation(fields: [dealId], references: [id], onDelete: Cascade)
- sourceType      String  (Bank Finance | Bridging | Commercial | Creative Finance | DCSR | Private)
- ltvMode         String  @default("percent")  ("percent" or "amount")
- ltvValue        Float?
- loanAmount      Float?
- interestRate    Float?
- termYears       Int?    @default(15)
- repaymentAmount Float?  (auto-calculated, stored for display)
- order           Int     @default(0)

MODEL: CashflowInputs
- id                  String  @id @default(cuid())
- dealId              String  @unique
- deal                Deal    @relation(fields: [dealId], references: [id], onDelete: Cascade)
  // Revenue (monthly)
- monthlyRent         Float?
- occupancyRate       Float?  @default(88)
- additionalIncome    Float?  @default(0)
- recoveries          Float?  @default(0)
  // Expenses (monthly)
- managementFeeMode   String  @default("percent")
- managementFeeValue  Float?  @default(15)
- maintenanceCostMode String  @default("percent")
- maintenanceCostValue Float? @default(5)
- levies              Float?  @default(0)
- ratesAndTaxes       Float?
- insurance           Float?
- waterSewerage       Float?
- securityCleaning    Float?
- electricity         Float?

MODEL: CapexItem
- id          String  @id @default(cuid())
- dealId      String
- deal        Deal    @relation(fields: [dealId], references: [id], onDelete: Cascade)
- label       String
- amount      Float
- color       String?

TASKS:
1. Write the full schema.prisma above
2. Create /lib/db.ts as a Prisma client singleton (handle dev hot-reload)
3. Write the initial migration SQL (or run `prisma migrate dev --name init`)
4. Create /types/index.ts exporting TypeScript interfaces matching each model
5. Create /lib/db/deals.ts with CRUD helper functions:
   - createDeal(userId, data)
   - getDeal(dealId, userId)
   - listDeals(userId)
   - updateDeal(dealId, userId, data)
   - deleteDeal(dealId, userId)
   - upsertCashflowInputs(dealId, data)
   - upsertFinanceSources(dealId, sources[])
```

---

## PROMPT 3 — Authentication

```
Set up authentication for AssetVerdict using NextAuth.js v5 (Auth.js).

REQUIREMENTS:
- Credentials provider (email + password)
- Passwords hashed with bcryptjs
- JWT sessions (not database sessions)
- Protect all /deals/** routes — redirect to /login if unauthenticated
- User id available in server components via auth() helper

TASKS:
1. Install and configure NextAuth v5 with Credentials provider
2. Create /app/api/auth/[...nextauth]/route.ts
3. Create /lib/auth.ts exporting the auth() helper and signIn/signOut
4. Create /app/(auth)/login/page.tsx:
   - AssetVerdict logo centred at top
   - Email + password fields (Inter font, styled with brand tokens)
   - "Sign in" button in av-gold
   - Link to /register
   - Error message display
5. Create /app/(auth)/register/page.tsx:
   - Name, email, password, confirm password
   - Calls POST /api/auth/register to create user
   - Redirects to /login on success
6. Create /app/api/auth/register/route.ts:
   - Validate inputs with Zod
   - Hash password with bcryptjs
   - Create user via Prisma
   - Return 201 on success, 400 on duplicate email
7. Add middleware.ts to protect /deals/** routes
8. Update the nav sidebar to show: user name, avatar initials, sign out button

Style the auth pages with the AssetVerdict brand: navy background, white card, gold CTA button.
```

---

## PROMPT 4 — My Deals List Page

```
Build the "My Deals" list page for AssetVerdict.

ROUTE: /deals

TASKS:
1. Create /app/deals/page.tsx (server component, requires auth)
   - Fetch all deals for the current user via getDeal helpers
   - Page header: "My Deals" in DM Serif Display, with "+ New Deal" button in av-gold top right
   - If no deals: empty state with shield icon, "No deals yet" message, and "Analyse your first deal" CTA

2. Deal card component /components/DealCard.tsx:
   - Property name (bold, DM Serif Display)
   - Address (if set)
   - Property type badge (pill)
   - Created date
   - Three quick-stat chips showing: IRR%, Gross Yield%, Cashflow (if calculated; else "--")
   - "View" button → /deals/[id]/summary
   - "Edit" button → /deals/[id]/edit
   - Delete button (with confirmation modal)
   - Hover: subtle gold left border accent

3. Create /app/deals/new/page.tsx:
   - Simple form: Deal Name (required), Property Type (dropdown: Commercial / Residential / Industrial / Mixed Use), Address, Notes
   - On submit → POST /api/deals → redirect to /deals/[id]/edit?tab=acquisition

4. Create API route POST /api/deals:
   - Create deal in DB for current user
   - Return { id }

5. Create API route DELETE /api/deals/[id]:
   - Verify ownership, delete deal and cascade

Layout: two-column card grid on desktop, single column on mobile.
Use av-light-grey card backgrounds with av-navy text and av-gold accents.
```

---

---

# PHASE 2 — INPUT FORMS

---

## PROMPT 5 — Deal Edit Shell & Tab Navigation

```
Build the deal edit page shell with tab navigation for AssetVerdict.

ROUTE: /deals/[id]/edit

The page has a horizontal tab bar at the top with 6 tabs:
  Deal Introduction | Acquisition Costs | Finance Costs | Cashflow | Other Inputs | Summary

TASKS:
1. Create /app/deals/[id]/edit/layout.tsx:
   - Fetch deal by id (verify ownership)
   - Render TabNav component + {children}
   - Pass deal data down via context or props

2. Create /components/TabNav.tsx:
   - Horizontal nav with the 6 tabs above
   - Active tab underlined in av-gold, text av-navy
   - Inactive tabs: av-slate text
   - On mobile: horizontally scrollable
   - Each tab links to /deals/[id]/edit/[tab-slug]

3. Create tab route pages (empty shells for now):
   - /app/deals/[id]/edit/introduction/page.tsx
   - /app/deals/[id]/edit/acquisition/page.tsx
   - /app/deals/[id]/edit/finance/page.tsx
   - /app/deals/[id]/edit/cashflow/page.tsx
   - /app/deals/[id]/edit/other/page.tsx
   - /app/deals/[id]/edit/summary/page.tsx (redirect to /deals/[id]/summary)
   - Default /app/deals/[id]/edit/page.tsx → redirect to introduction tab

4. Create a shared /components/forms/SaveBar.tsx:
   - Fixed bottom bar: "Unsaved changes" text + "Save" button (av-gold) + "Saving..." spinner state
   - Appears when form is dirty

5. Create shared form styling:
   - /components/ui/FormField.tsx: label + input wrapper with optional highlight (green/orange/red border)
   - /components/ui/CurrencyInput.tsx: prefixed with currency symbol (default "R"), right-aligned number
   - /components/ui/PercentInput.tsx: suffixed with %
   - /components/ui/ToggleInput.tsx: % ↔ R toggle button pair (used for Management Fees, Maintenance, LTV)
```

---

## PROMPT 6 — Deal Introduction Tab

```
Build the Deal Introduction tab for AssetVerdict deal editing.

ROUTE: /deals/[id]/edit/introduction

FORM FIELDS:
- Deal Name (text, required)
- Property Type (select: Commercial / Residential / Industrial / Mixed Use / Retail / Office)
- Property Address (text)
- City / Town (text)
- Deal Notes (textarea, 4 rows)
- Currency (select: ZAR / USD / EUR / GBP / AUD — default ZAR, symbol auto-updates throughout app)

TASKS:
1. Build the form using React Hook Form + Zod validation
2. Pre-populate fields from existing deal data
3. On save: PATCH /api/deals/[id] with the introduction fields
4. Create /app/api/deals/[id]/route.ts:
   - GET: return full deal with finance sources + cashflow inputs
   - PATCH: partial update of deal fields (verify ownership)
5. Show success toast on save ("Deal updated")
6. Show the deal name in the page <title> and in the top breadcrumb: Home / My Deals / {deal name}

Style: clean two-column form layout on desktop. Labels in Inter 14px av-slate. 
Input borders: av-light-grey default, av-gold on focus.
```

---

## PROMPT 7 — Acquisition Costs Tab

```
Build the Acquisition Costs tab for AssetVerdict.

ROUTE: /deals/[id]/edit/acquisition

SECTION: Valuation
Fields:
- Asking Price (CurrencyInput, R)
- Purchase Price (CurrencyInput, R)
- Market Value (CurrencyInput, R)
- Discount to Asking Price (PercentInput, READ ONLY, auto-calc: (AskingPrice - PurchasePrice) / AskingPrice × 100)
- Discount to Market Value (PercentInput, READ ONLY, auto-calc: (MarketValue - PurchasePrice) / MarketValue × 100)
  → Border: green if > 15%, orange if 5–15%, red if < 5%

SECTION: Buying Costs
Fields:
- "Show Proposed Transfer Cost" button → when clicked, shows a read-only breakdown of estimated transfer duty based on purchase price (use South African transfer duty table: 0% up to R1.1m, 3% R1.1m–R1.512m, 6% R1.512m–R2.117m, 8% R2.117m–R2.722m, 11% R2.722m–R12.375m, 13% above R12.375m)
- Transfer & Bond Cost (CurrencyInput, R — editable override)
- Renovation & Inspections Costs (CurrencyInput, R)
- Sourcing Fee (CurrencyInput, R)

SECTION: Selling Costs
Fields:
- Estate Agent Commission (PercentInput, %)
- Do you want to sell? (Checkbox) → if checked, reveal: Projected Sale Year (number, 1–20), Sale Price at Exit (CurrencyInput, auto-calc using capital growth rate from Other Inputs)

TASKS:
1. Build the full form with React Hook Form
2. Auto-calculate and display Discount to Asking Price and Discount to Market Value in real time as user types
3. Implement the transfer duty calculator button
4. On save: PATCH /api/deals/[id] with all acquisition fields
5. Show total "All-In Cost" summary at bottom of form:
   All-In Cost = Purchase Price + Transfer & Bond Cost + Renovation + Sourcing Fee
   Display in large Roboto Mono font with label "Total Investment Cost"
```

---

## PROMPT 8 — Finance Costs Tab

```
Build the Finance Costs tab for AssetVerdict.

ROUTE: /deals/[id]/edit/finance

This tab supports multiple finance blocks. Each block represents one loan/finance source.

FINANCE BLOCK FIELDS (per source):
- Source of Finance (select dropdown): Bank Finance | Bridging | Commercial | Creative Finance | DCSR | Private
- LTV / Amount (ToggleInput — toggle between % mode and R mode):
  - % mode: enter LTV percentage, Loan Amount auto-calculates as LTV% × Purchase Price
  - R mode: enter Loan Amount directly, LTV% auto-calculates
- Loan Amount (CurrencyInput, read-only if in % mode)
- Interest Rate (PercentInput, %)
- Term (years) (number input, suffix "Y")
- Repayment Amount (CurrencyInput, READ ONLY, auto-calc using standard amortisation formula:
    P × (r(1+r)^n) / ((1+r)^n - 1)
    where P = loanAmount, r = interestRate/12/100, n = termYears × 12)
- Delete button (red, removes this block)

CONTROLS:
- "+ Add New Finance" button at top right → appends a new empty finance block
- Finance blocks are ordered and stacked vertically

SUMMARY (below all blocks):
- Total Finance Cost (monthly) = sum of all repayment amounts
- Total Loan Amount = sum of all loan amounts
- Deposit Required = Purchase Price + Buying Costs - Total Loan Amount
  (display in bold with label "Deposit Required")

TASKS:
1. Build dynamic form: array of finance sources using useFieldArray (React Hook Form)
2. Auto-calculate Repayment Amount whenever Interest Rate, Term, or LTV changes
3. Auto-calculate LTV% ↔ Loan Amount as user switches toggle mode
4. On save: PUT /api/deals/[id]/finance with the full array of finance sources
5. Create /app/api/deals/[id]/finance/route.ts:
   - PUT: delete existing finance sources for deal, insert new array
   - GET: return finance sources for deal
6. Show running summary totals updating in real-time as user edits

Style each finance block as a card with a subtle left border in the source type's accent colour.
```

---

## PROMPT 9 — Cashflow Tab

```
Build the Cashflow tab for AssetVerdict.

ROUTE: /deals/[id]/edit/cashflow

SECTION: Revenue (monthly)
Fields:
- Monthly Rent (CurrencyInput, R)
- Occupancy Rate (PercentInput, %, default 88%)
- Additional Income (CurrencyInput, R, default 0)
- Recoveries (CurrencyInput, R, default 0)

Effective Monthly Revenue (read-only display):
= (MonthlyRent × OccupancyRate/100) + AdditionalIncome + Recoveries

SECTION: Expenses (monthly)
Fields:
- Management Fees (ToggleInput % ↔ R, default 15%):
  - % mode: calculated as % of Effective Monthly Revenue
  - R mode: fixed amount
- Maintenance Cost (ToggleInput % ↔ R, default 5%):
  - % mode: calculated as % of Effective Monthly Revenue
- Levies (CurrencyInput, R, default 0)
- Rates and Taxes (CurrencyInput, R)
- Insurance (CurrencyInput, R)
- Water, Refuse & Sewerage (CurrencyInput, R)
- Security and Cleaning (CurrencyInput, R)
- Electricity (CurrencyInput, R)
- Finance Cost (CurrencyInput, READ ONLY — auto-pulled from Finance tab total repayment)
- Bad Debts provision (PercentInput, % of Gross Revenue, default 5%)

LIVE SUMMARY (updates as user types):
Display a 3-column summary panel at bottom of form:
| Gross Revenue | Operating Costs | Provisions        |
| R xxx         | R xxx           | R xxx             |
| Rental: R xx  | Finance: R xx   | Management: R xx  |
| Additional: Rxx| Utilities: Rxx | Maintenance: R xx |
| Recoveries: Rxx| Rates/Ins/Other| Bad Debts: R xx   |
|               |                |                   |
| Tax: R xx     |                | Cashflow: R xx    |

Where:
- Gross Revenue = EffectiveRevenue × 12 (annual) or monthly
- Operating Costs = Finance + Utilities + Rates/Insurance/Other
- Provisions = Management + Maintenance + Bad Debts
- NOI = Gross Revenue - Utilities - Rates/Insurance/Other - Provisions (excl. Finance)
- Tax = NOI × incomeTaxRate/100 (simplified pre-finance tax)
- Cashflow = Gross Revenue - Operating Costs - Provisions - Tax

TASKS:
1. Build the full form with React Hook Form + live recalculation
2. Pull finance cost from deal's finance sources (auto-filled, locked field)
3. On save: PUT /api/deals/[id]/cashflow
4. Create /app/api/deals/[id]/cashflow/route.ts (GET + PUT)
5. The live summary panel should show both monthly and annual views (add toggle)
```

---

## PROMPT 10 — Other Inputs Tab

```
Build the Other Inputs tab for AssetVerdict.

ROUTE: /deals/[id]/edit/other

SECTION: Enterprise Details
Fields:
- Effective Income Tax (PercentInput, %, default 27)
- Effective Capital Gains Tax (PercentInput, %, default 22)

SECTION: Escalations
Fields:
- Capital Growth Rate (PercentInput, %, default 3) — annual property value growth
- Rental Growth Rate (PercentInput, %, default 8) — annual rent increase
- Cost Inflation (PercentInput, %, default 5) — annual expense growth
- Sustainable Growth Rate (PercentInput, %, default 5)
- Discount Rate (PercentInput, %, default 10) — for NPV calculation
- Market Cap Rate (PercentInput, %, default 10) — for Cap Rate Spread calculation

SECTION: Sensitivity Levels
Fields:
- Real Growth Factor (PercentInput, %, default 10) — upside/downside variance
- Occupation Factor (PercentInput, %, default 10) — occupancy variance

SECTION: Scenarios (read-only display, auto-generated)
Three-column table showing Bear / Base / Bull scenarios:
| Category         | Bear         | Base         | Bull         |
|-----------------|--------------|--------------|--------------|
| Rental Growth   | Base - RGF%  | 8%           | Base + RGF%  |
| Occupancy       | 88 - OF%     | 88%          | 88 + OF%     |
| Capital Growth  | 3 - RGF%     | 3%           | 3 + RGF%     |

SUMMARY:
- Total Costs (read-only): auto-calculated as Purchase Price + All Buying Costs
  Display: "Total Costs: R x,xxx,xxx" in large Roboto Mono

TASKS:
1. Build form with React Hook Form, pre-populate from deal data
2. Auto-calculate and display Bear/Base/Bull scenario table in real time
3. On save: PATCH /api/deals/[id] with all other-inputs fields
4. Add helpful helper text under each escalation field explaining what it affects
5. Style the scenario table with av-light-grey rows, av-navy headers, 
   red for Bear / av-gold for Base / av-green for Bull column accents
```

---

---

# PHASE 3 — CALCULATION ENGINE

---

## PROMPT 11 — Core Financial Calculations

```
Build the AssetVerdict financial calculation engine as pure TypeScript functions.

Create /lib/calculations/index.ts exporting all functions below.
All inputs are annual figures unless noted. All monetary values in the deal's currency.

INPUTS TYPE (create as DealInputs interface):
{
  // Acquisition
  purchasePrice: number
  marketValue: number
  askingPrice: number
  transferBondCost: number
  renovationCost: number
  sourcingFee: number
  agentCommission: number  // %

  // Finance (array)
  financeSources: Array<{
    loanAmount: number
    interestRate: number  // %
    termYears: number
    repaymentAmount: number  // monthly
  }>

  // Cashflow (monthly inputs)
  monthlyRent: number
  occupancyRate: number       // %
  additionalIncome: number
  recoveries: number
  managementFeeValue: number  // % or R
  managementFeeMode: 'percent' | 'amount'
  maintenanceCostValue: number
  maintenanceCostMode: 'percent' | 'amount'
  levies: number
  ratesAndTaxes: number
  insurance: number
  waterSewerage: number
  securityCleaning: number
  electricity: number
  badDebtsPct: number         // % of gross revenue

  // Other inputs
  incomeTaxRate: number       // %
  capitalGainsTaxRate: number // %
  capitalGrowthRate: number   // % per year
  rentalGrowthRate: number    // % per year
  costInflation: number       // % per year
  discountRate: number        // % for NPV
  marketCapRate: number       // % for Cap Rate Spread
}

FUNCTIONS TO IMPLEMENT:

1. calcTotalInvestment(inputs) → number
   = purchasePrice + transferBondCost + renovationCost + sourcingFee

2. calcTotalLoanAmount(inputs) → number
   = sum of all financeSources.loanAmount

3. calcDepositRequired(inputs) → number
   = calcTotalInvestment(inputs) - calcTotalLoanAmount(inputs)

4. calcMonthlyRepayment(loanAmount, interestRatePct, termYears) → number
   Standard amortisation: P × (r(1+r)^n) / ((1+r)^n - 1)
   where r = interestRatePct/12/100, n = termYears×12

5. calcEffectiveMonthlyRevenue(inputs) → number
   = (monthlyRent × occupancyRate/100) + additionalIncome + recoveries

6. calcGrossRevenueAnnual(inputs) → number
   = calcEffectiveMonthlyRevenue(inputs) × 12

7. calcManagementFeeMonthly(inputs) → number
   if mode='percent': = calcEffectiveMonthlyRevenue × managementFeeValue/100
   if mode='amount':  = managementFeeValue

8. calcMaintenanceCostMonthly(inputs) → number
   (same toggle logic as management fee)

9. calcBadDebtsMonthly(inputs) → number
   = calcGrossRevenueAnnual / 12 × badDebtsPct/100

10. calcTotalFinanceCostMonthly(inputs) → number
    = sum of all financeSources.repaymentAmount

11. calcOperatingCostsMonthly(inputs) → { finance, utilities, ratesInsuranceOther, total }
    - finance = calcTotalFinanceCostMonthly
    - utilities = waterSewerage + electricity + securityCleaning
    - ratesInsuranceOther = ratesAndTaxes + insurance + levies
    - total = finance + utilities + ratesInsuranceOther

12. calcProvisionsMonthly(inputs) → { management, maintenance, badDebts, total }

13. calcNOIAnnual(inputs) → number
    NOI = GrossRevenueAnnual - (OperatingCosts excl Finance - Provisions)
    = GrossRevenue - Utilities×12 - RatesInsurance×12 - Provisions×12

14. calcCapRatePP(inputs) → number
    = calcNOIAnnual / purchasePrice × 100

15. calcCapRateMV(inputs) → number
    = calcNOIAnnual / marketValue × 100

16. calcGrossYield(inputs) → number
    = calcGrossRevenueAnnual / purchasePrice × 100

17. calcNetYieldPreTax(inputs) → number
    = calcCashflowAnnual(inputs, beforeTax=true) / calcTotalInvestment × 100

18. calcNetYieldPostTax(inputs) → number
    = calcCashflowAnnual(inputs, beforeTax=false) / calcTotalInvestment × 100

19. calcCashflowAnnual(inputs, beforeTax: boolean) → number
    = GrossRevenue - OperatingCosts×12 - Provisions×12 - (if !beforeTax: Tax)
    Tax = max(0, (NOI - FinanceCost×12) × incomeTaxRate/100)

20. calcDSCR(inputs) → number
    = calcNOIAnnual / (calcTotalFinanceCostMonthly × 12)

21. calcLTV(inputs) → number
    = calcTotalLoanAmount / purchasePrice × 100

22. calcBreakEvenRatio(inputs) → number
    = (OperatingCosts×12 excl provisions + FinanceCost×12) / GrossRevenueAnnual × 100

23. calcOperatingExpenseRatio(inputs) → number
    = (OperatingCosts×12 + Provisions×12) / GrossRevenueAnnual × 100

24. calcUtilitiesRatio(inputs) → number
    = Utilities×12 / GrossRevenueAnnual × 100

25. calcNOIMargin(inputs) → number
    = calcNOIAnnual / calcGrossRevenueAnnual × 100

26. calcCapRateSpread(inputs) → number
    = calcCapRateMV - marketCapRate

27. calcPaybackPeriod(inputs) → number
    = calcTotalInvestment / calcCashflowAnnual (if positive; else Infinity)

28. calc20YearProjection(inputs) → Array<YearlyProjection>
    Returns array of 20 objects, one per year:
    {
      year: number
      grossRevenue: number       (grows at rentalGrowthRate)
      operatingCosts: number     (grows at costInflation, excl finance)
      financeCost: number        (fixed — loan repayments don't change)
      provisions: number         (management % of revenue, grows with rent)
      noi: number
      taxAmount: number
      cashflowForPeriod: number  (annual net cashflow)
      cumulativeCashflow: number (running sum from Year 1, starting negative = -totalInvestment)
      propertyValue: number      (grows at capitalGrowthRate)
      yearlyROI: number          (cashflowForPeriod / totalInvestment × 100)
    }

29. calcIRR(inputs) → number
    Use the 20-year cashflows from calc20YearProjection.
    Year 0 cashflow = -calcTotalInvestment (initial outlay)
    Year 20 terminal cashflow += propertyValue in Year 20 - remaining loan balance
    Use Newton-Raphson method to solve for IRR (rate where NPV=0).
    Return as percentage.

30. calcNPV(inputs) → number
    Discount 20-year cashflows at discountRate.
    NPV = sum(cashflow_t / (1 + discountRate/100)^t) for t=1..20
    Add terminal value in year 20: (propertyValue - remainingLoanBalance - capitalGainsTax)

31. calcAllMetrics(inputs) → DealMetrics (full object with all above values)
    This is the main function called to populate the Summary dashboard.

Also create:
- /lib/calculations/scenarios.ts: calcScenarios(inputs) → { bear, base, bull }
  Each scenario modifies rentalGrowthRate, occupancyRate, capitalGrowthRate by ±realGrowthFactor/occupationFactor
  and returns calcAllMetrics for each variant.

- /lib/calculations/thresholds.ts: getGaugeColor(metric: string, value: number) → 'green' | 'orange' | 'red'
  Implement the full threshold reference table from the build plan.

Write thorough JSDoc comments on every function. Export a DealMetrics type.
```

---

## PROMPT 12 — Calculation API Route & Caching

```
Wire the AssetVerdict calculation engine to an API route that the Summary page will call.

TASKS:
1. Create /app/api/deals/[id]/calculate/route.ts (GET):
   - Fetch deal + finance sources + cashflow inputs from DB
   - Assemble DealInputs object
   - Call calcAllMetrics(inputs) from /lib/calculations
   - Call calc20YearProjection(inputs)
   - Call calcScenarios(inputs)
   - Return JSON: { metrics: DealMetrics, projection: YearlyProjection[], scenarios: {...} }
   - Return 400 with { error, missingFields } if required inputs are missing

2. Create /lib/calculations/assembleInputs.ts:
   A helper that takes a raw Prisma deal object (with relations) and returns a DealInputs object,
   handling nulls with sensible defaults.

3. Create /hooks/useDealMetrics.ts (client hook):
   - Accepts dealId
   - Fetches /api/deals/[id]/calculate
   - Returns { metrics, projection, scenarios, isLoading, error }
   - Uses SWR or React Query for caching

4. Add error boundary for when metrics can't be calculated (missing required fields):
   - Show a friendly message: "Complete your deal inputs to see your verdict."
   - List which fields are still needed with links to the relevant tab
```

---

---

# PHASE 4 — OUTPUT DASHBOARD

---

## PROMPT 13 — GaugeDial Component

```
Build the core GaugeDial SVG component for AssetVerdict. This is the most important visual element.

Create /components/gauges/GaugeDial.tsx

PROPS:
interface GaugeDialProps {
  value: number | null
  unit: '%' | 'Yrs' | 'x' | ''
  label: string
  tooltipText: string
  thresholds: {
    green: [number, number]   // [min, max] inclusive
    orange: [number, number]
    red: [number, number]
  }
  min?: number   // arc min value (default 0)
  max?: number   // arc max value (default 30 for %, adjust per metric)
  benchmarkValue?: number  // position of grey benchmark marker on arc
  size?: 'sm' | 'md' | 'lg'  // default 'md'
}

VISUAL SPEC (SVG, semicircle, 180°):
- ViewBox: "0 0 160 90" for md size
- Arc: centred at (80, 85), radius 65, from 180° to 0° (left to right)
- Arc stroke-width: 14px, background arc colour: #EDF2F7 (av-light-grey)
- Filled arc: drawn from 180° to angle corresponding to value, colour = getGaugeColor(value)
  - Green: #27AE60
  - Orange: #E67E22
  - Red: #E74C3C
  - Grey (null/zero): #CBD5E0
- Pointer: small filled triangle (▲ or ▶) at the end of the filled arc, pointing outward
  - Same colour as the filled arc
- Benchmark marker: small white/grey inverted triangle (▽) at benchmarkValue position on arc
  - Stroke: #718096, fill: white
- Value display: centred below arc, large number in Roboto Mono bold
  - e.g. "24.39%" or "9Yrs" or "0.88x"
- If value is null: display "--"

INTERACTIONS:
- Tooltip: a TooltipIcon (ⓘ) to the right of the label, shows tooltipText on hover
  Use a simple CSS tooltip or Radix UI Tooltip
- The entire gauge card has a subtle hover shadow

LABEL:
- Above the arc, Inter 13px, av-slate colour
- ⓘ icon inline after the label text

WRAPPER:
- Each GaugeDial sits in a white card (/components/ui/Card.tsx) with padding
- Cards have a 1px border of av-light-grey and rounded-lg corners

ALSO CREATE:
- /components/gauges/MetricCard.tsx for NPV and other text-only metrics:
  - Same card size as GaugeDial
  - Shows label + large value (Roboto Mono, av-navy) + optional trend arrow

TEST IT:
- Create /app/dev/gauges/page.tsx showing all gauge states:
  green (IRR 27%), orange (OER 47%), red (DSCR 0.88), null (--)
  with correct labels and tooltips
```

---

## PROMPT 14 — Summary Page: Returns & Yields Sections

```
Build the Summary page Returns and Yields & Returns sections for AssetVerdict.

ROUTE: /deals/[id]/summary

This is a read-only results page.

TASKS:

1. Create /app/deals/[id]/summary/page.tsx (client component using useDealMetrics hook):
   - Show "Calculating your verdict..." skeleton while loading
   - If missing inputs: show completion prompt
   - Render all sections below

2. SECTION: Overview (collapsible, open by default)
   Quick text summary: property name, purchase price, total investment, scenario selected

3. SECTION: Scenarios (collapsible)
   <ScenarioSelector /> — three buttons: Bear / Base / Bull
   Selecting a scenario re-fetches metrics with that scenario's inputs and updates all gauges live.

4. SECTION: Returns (always visible, not collapsible)
   Header "Returns" with gold underline
   2×4 grid of GaugeDial + MetricCard:
   Row 1:
   - IRR: green >15%, orange 8-15%, red <8%, max=40, benchmark=15, unit='%'
     tooltip="Internal Rate of Return — the annualised return on your total investment over 20 years. Above 15% is strong."
   - Net Yield Yr 1 (pre-tax): green >8%, orange 3-8%, red <3%, max=20, benchmark=8, unit='%'
     tooltip="Your first-year net income as a % of total investment, before tax."
   - Cap Rate (PP): green 8-12%, orange 5-8% or >12%, red <5%, max=20, benchmark=10, unit='%'
     tooltip="Net Operating Income as a % of your purchase price. 8–12% is the typical commercial sweet spot."
   - NPV (MetricCard): display "R x,xxx,xxx" — green if positive, red if negative
     tooltip="Net Present Value — the total value created by this deal in today's money, discounted at your discount rate."
   Row 2:
   - Cap Rate (MV): green >8%, orange 5-8%, red <5%, max=20, benchmark=10, unit='%'
     tooltip="Net Operating Income as a % of market value. Helps assess if you bought below market."
   - Debt Service Ratio: green >1.25, orange 1.0-1.25, red <1.0, max=3, benchmark=1.25, unit='x'
     tooltip="How many times your NOI covers your debt repayments. Above 1.25 is safe; below 1 means the property can't service its debt."
   - Operating Expense Ratio: green <40%, orange 40-60%, red >60%, max=100, benchmark=40, unit='%'
     tooltip="Total expenses as a % of gross revenue. Lower is better — below 40% is excellent."
   - Payback Period: green <8, orange 8-12, red >12, max=30, benchmark=8, unit='Yrs'
     tooltip="How many years before you recover your total investment from cashflow alone."

5. SECTION: Yields & Returns (collapsible, open by default)
   3-column grid:
   - Gross Yield: green >10%, orange 7-10%, red <7%, unit='%'
   - Net Yield Yr 1 (pre-tax): same as above
   - Net Yield Yr 1 (post-tax): green >6%, orange 4-6%, red <4%, unit='%'
   - IRR: same as Returns section
   - NOI Margin: green >60%, orange 40-60%, red <40%, unit='%'
     tooltip="NOI as a % of gross revenue. Shows operational efficiency."
   - NPV: MetricCard

6. Style: page background av-white, section headers in DM Serif Display av-navy.
   Each section separated by a thin av-light-grey divider.
   Section header has a small expand/collapse chevron icon (Lucide ChevronDown).
```

---

## PROMPT 15 — Summary Page: Cashflow Table & Debt/Cost Sections

```
Continue building the AssetVerdict Summary page. Add the Cashflow, Debt & Coverage,
Cost Ratios, and Valuation sections.

FILE: /app/deals/[id]/summary/page.tsx (extend existing)

COMPONENT: CashflowTable (/components/charts/CashflowTable.tsx)

Props: { metrics: DealMetrics, view: 'monthly' | 'annual' }

Layout — toggle at top right: [Annual Figures] [Monthly Figures] (active = av-navy bg, white text; inactive = white bg)

3-column table:
COLUMN 1 — Gross Revenue (bold header + total, then line items):
- Total: boldest, largest
- Rental Income
- Additional Income
- Recoveries
Each with ▲ icon (av-green) if projected to grow (tied to rentalGrowthRate > 0)

COLUMN 2 — Operating Costs (bold header + total):
- Finance
- Utilities
- Rates, Insurance & Other
Each with ▲ icon if growing (tied to costInflation > 0)

COLUMN 3 — Provisions (bold header + total):
- Management
- Maintenance
- Bad Debts
Each with ▲

Bottom row (full-width, grey bg):
- Left cell: Tax
- Right cell: Cashflow — green text if positive, red if negative

All numbers in Roboto Mono. Monthly shows /mo figures. Annual shows ×12 figures.
Border: 1px av-light-grey between columns.

---

SECTION: Debt & Coverage
3 GaugeDials in a row:
- Debt Service Ratio: same spec as Returns section
- LTV: green <60%, orange 60-75%, red >75%, max=100, benchmark=60, unit='%'
  tooltip="Loan-to-Value ratio — your total debt as a % of purchase price."
- Break-even Ratio: green <75%, orange 75-90%, red >90%, max=100, benchmark=75, unit='%'
  tooltip="The occupancy rate needed to cover all costs including debt. Lower is safer."

---

SECTION: Cost Ratios
2 GaugeDials:
- Utilities Ratio: green <15%, orange 15-30%, red >30%, max=50, benchmark=15, unit='%'
  tooltip="Utility costs (water, electricity, security) as a % of gross revenue."
- Operating Expense Ratio: same as Returns section

---

SECTION: Valuation
2 GaugeDials:
- Cap Rate Spread: green >2%, orange 0-2%, red <0%, min=-5, max=10, benchmark=2, unit='%'
  tooltip="How much better your deal is vs the market — more than 2% above market is strong, showing you bought below value."
- Payback Period: same as Returns section

All sections collapsible with AccordionSection component.
```

---

## PROMPT 16 — Charts: Capex Pie & 20-Year Cashflow

```
Build the two chart components for the AssetVerdict Summary page.

COMPONENT 1: CapexPieChart (/components/charts/CapexPieChart.tsx)

Uses Recharts PieChart.

Props: { capexItems: Array<{ label: string, amount: number, color?: string }> }

- If no capex items: show empty state "No Capex items added yet"
- Pie chart with labelled slices showing percentage of total
- Colour palette: use a set of 8 colours cycling: [#E74C3C, #3498DB, #27AE60, #E67E22, #9B59B6, #F1C40F, #1ABC9C, #E91E63]
- Legend below chart: coloured dot + label + amount + percentage
- Title: "Capex Spend" in DM Serif Display
- Hover tooltip: label, amount, % of total
- Add "+ Add Capex Item" button below chart that opens a modal:
  - Fields: Label (text), Amount (CurrencyInput)
  - Saves to /api/deals/[id]/capex (POST)
  - Chart updates immediately

---

COMPONENT 2: ProjectCashflowChart (/components/charts/ProjectCashflowChart.tsx)

Uses Recharts ComposedChart (Bar + Line).

Props: { projection: YearlyProjection[] }

Layout:
- Title: "Project Cashflow (20 Years)" in DM Serif Display
- X-axis: Year 1 to Year 20 (label: "Year 1", "Year 2"... "Year 20")
- Y-axis LEFT: Rands (formatted as "R 5,000,000")
- Y-axis RIGHT: Yearly ROI % (0 to 35)
- Zero reference line at Y=0 (dashed, av-slate)

Series:
- Blue bars (Bar): Total Cash Flow for Period (cashflowForPeriod) — negative bars go below 0
  Fill: #3498DB, name: "Total Cash Flow for Period"
- Green bars (Bar): Cumulative Cash Flow (cumulativeCashflow) — also can be negative early years
  Fill: #27AE60, name: "Cumulative Cash Flow"
  Note: bars are GROUPED (side by side), not stacked
- Orange line (Line): Yearly ROI % (yearlyROI), yAxisId="right"
  Stroke: #E67E22, strokeWidth: 2, dot: false, name: "Yearly ROI"

Hover tooltip (custom):
  "Year N"
  🔵 Total Cash Flow for Period: R xxx,xxx
  🟢 Cumulative CashFlow: R xxx,xxx
  🟠 Yearly ROI: xx.xx%

Legend below chart with coloured indicators.

Toolbar icons top-right (just decorative for now): zoom, pan, download icons (Lucide).

---

SECTION: Collapsible accordion wrappers
Wrap both charts in <AccordionSection> components:
- "Capex Spend" section (collapsible, open by default)
- "Project Cashflow" section (collapsible, open by default)

Also wrap the following in AccordionSections (build the inner content as minimal tables):
- "Equity / Debt Ratio": table showing equity %, debt %, equity amount, LTV over time
- "Operating Profit": NOI per year for first 5 years + Year 10, Year 15, Year 20
- "Net Profit": Cashflow after tax per year for same years

Add to the bottom of the Summary page: a teal "Show Mentor's Comments" button.
On click: opens a side panel (drawer) that calls the Anthropic API to generate
a plain-English commentary on the deal's metrics. Prompt to the API:
"You are a property investment mentor. Given these metrics: [JSON], provide a concise
2-3 paragraph commentary covering: (1) deal quality verdict, (2) main strengths,
(3) main risks to watch. Be direct and specific. Avoid generic advice."
```

---

---

# PHASE 5 — POLISH & FEATURES

---

## PROMPT 17 — Scenario Switching & Live Updates

```
Implement Bear / Base / Bull scenario switching for AssetVerdict Summary page.

COMPONENT: /components/ScenarioSelector.tsx

Props: {
  currentScenario: 'bear' | 'base' | 'bull'
  scenarios: { bear: DealMetrics, base: DealMetrics, bull: DealMetrics }
  onSelect: (scenario: 'bear' | 'base' | 'bull') => void
}

UI:
- Three pill buttons: BEAR 🐻 | BASE ⚖️ | BULL 🐂
- BEAR: red pill (#E74C3C bg when active, red border when inactive)
- BASE: gold pill (#C9A84C bg when active)
- BULL: green pill (#27AE60 bg when active)
- Animate gauge dials when switching scenarios (CSS transition on stroke-dashoffset)

TASKS:
1. useDealMetrics hook already returns all 3 scenarios — wire up the selector
2. When user clicks Bear/Base/Bull, all GaugeDial values and the CashflowTable
   update immediately using the pre-calculated scenario data (no new API call)
3. Also switch the ProjectCashflowChart to use that scenario's projection data
4. Show which scenario is active in the page header: "Base Case" badge next to deal name
5. Persist selected scenario in URL param: /deals/[id]/summary?scenario=bear

Also implement: when any input form is saved, invalidate the metrics cache
so the Summary page auto-refreshes on next visit.
```

---

## PROMPT 18 — PDF Export

```
Implement PDF export of the deal summary for AssetVerdict.

Add an "Export PDF" button to the Summary page header (top right, secondary button style).

APPROACH: Use @react-pdf/renderer to generate a PDF client-side.

Create /lib/pdf/DealSummaryPDF.tsx:

PDF CONTENTS (A4 portrait):

PAGE 1 — Cover:
- AssetVerdict logo (nav + gold shield SVG)
- Deal name in DM Serif Display, large
- Property address
- Report date
- "Prepared by AssetVerdict — Know Before You Commit."
- Scenario: Base Case (or whichever is selected)

PAGE 2 — Key Metrics:
- 2×4 grid of metric boxes (no gauge SVG — use coloured rectangles):
  Each box: metric name, large value, colour bar (green/orange/red) at top
  Metrics: IRR, Net Yield (pre-tax), Cap Rate PP, NPV, Cap Rate MV, DSCR, OER, Payback Period

PAGE 3 — Cashflow Summary:
- Annual cashflow table (3 columns: Revenue / Operating Costs / Provisions)
- Tax and Net Cashflow row
- 20-year cashflow projection as a simple table (Year | Revenue | Costs | Cashflow | ROI%)

PAGE 4 — Deal Inputs Summary:
- Acquisition: prices, discounts, buying costs
- Finance: each finance source with terms
- Cashflow: monthly revenue, key expense lines

TASKS:
1. Install @react-pdf/renderer
2. Build the PDF component
3. Add export button that calls pdf(DealSummaryPDF).toBlob() and triggers download
4. Filename: "AssetVerdict_{DealName}_{Date}.pdf"
```

---

## PROMPT 19 — Responsive Design & Mobile Polish

```
Make AssetVerdict fully responsive and polished for mobile use.

BREAKPOINTS (Tailwind defaults are fine):
- Mobile: < 640px
- Tablet: 640–1024px
- Desktop: > 1024px

TASKS:

1. Navigation:
   - Desktop: left sidebar (fixed, 220px wide)
   - Mobile: hamburger menu → slide-in drawer
   - Tab nav (deal edit): horizontal scroll on mobile, no wrapping

2. Forms (all input tabs):
   - Desktop: 2-column layout (label left, input right)
   - Mobile: stacked single-column
   - Finance blocks: full-width on mobile
   - Save bar: sticks to bottom, full-width

3. Summary page:
   - Gauge grid: 2×4 on desktop → 2×2 on tablet → 1×8 stacked on mobile
   - CashflowTable: horizontal scroll on mobile (sticky first column)
   - Charts: full-width on all sizes, reduce height on mobile to 250px
   - Capex pie: smaller radius on mobile

4. My Deals list:
   - Desktop: 3-column card grid
   - Tablet: 2-column
   - Mobile: 1-column

5. General:
   - Minimum tap target: 44px for all interactive elements
   - Font sizes: reduce heading sizes by one step on mobile
   - Remove hover-only tooltips on mobile (show tooltip on tap instead)
   - Test with viewport 375px width (iPhone SE)

6. Add a PWA manifest (/public/manifest.json) so the app can be "Add to Home Screen":
   - name: "AssetVerdict"
   - short_name: "AssetVerdict"
   - theme_color: "#0F1F3D"
   - background_color: "#F8F9FA"
   - icons: 192×192 and 512×512 (shield logo)
```

---

## PROMPT 20 — Empty States, Error Handling & Onboarding

```
Add empty states, error handling, and a first-time user onboarding flow to AssetVerdict.

TASKS:

1. Empty States:
   - /deals page with no deals: shield icon + "No deals yet" + "Analyse your first deal →" button
   - Summary page with incomplete inputs: checklist of missing fields with tab links
   - Charts with no data: placeholder with dashed border + "Enter your deal inputs to see projections"
   - Capex pie with no items: "Add your capex items to see the breakdown"

2. Error Handling:
   - API errors: toast notifications (top-right, auto-dismiss 4s):
     - Success: green with ✓ icon
     - Error: red with ✕ icon
     - Warning: orange with ⚠ icon
   - Create /components/ui/Toast.tsx and a useToast hook
   - Wrap all API calls in try/catch and show appropriate toasts
   - 404 page: /app/not-found.tsx — branded with "Deal not found" message
   - Error boundary: /app/error.tsx — branded with "Something went wrong" + retry button

3. Loading States:
   - Summary page skeleton: placeholder gauge dials (grey circles) while metrics load
   - Deal cards skeleton: grey placeholder cards on /deals page
   - Use Tailwind's animate-pulse for skeletons

4. Onboarding (first-time user, 0 deals):
   - After registration, redirect to /welcome
   - /app/welcome/page.tsx:
     Step 1 of 3: "Welcome to AssetVerdict" — what the app does (3 bullet points)
     Step 2 of 3: "Create your first deal" — mini form (just deal name + type)
     Step 3 of 3: "You're ready" — link to the deal's edit page
   - Progress dots at top (●●○)
   - Skip link to go straight to /deals

5. Calc validation:
   On the Summary page, if critical inputs are missing, show a yellow banner:
   "⚠ Your deal analysis is incomplete. The following fields are needed for accurate results:"
   List: [field name → tab name] as clickable links
   Required for basic output: monthlyRent, purchasePrice
   Required for full output: + financeSources (at least 1), occupancyRate
```

---

## PROMPT 21 — Final Integration, Testing & Launch Checklist

```
Final integration pass for AssetVerdict. Wire everything together and run a pre-launch checklist.

TASKS:

1. INTEGRATION:
   - Verify all API routes are protected by auth middleware
   - Verify deal ownership checks on all /api/deals/[id]/* routes
   - Ensure finance sources deletion cascade works (delete deal → all related data gone)
   - Confirm that saving any input tab invalidates cached metrics
   - Test the full user journey:
     Register → Create Deal → Fill all 4 input tabs → View Summary → Export PDF

2. CALCULATIONS VERIFICATION:
   Use this sample deal to verify calculation outputs:
   - Purchase Price: R 5,055,000
   - Market Value: R 5,500,000
   - Transfer & Bond: R 309,072
   - Renovation: R 200,000
   - Sourcing Fee: R 505,500
   - Finance: Bank Finance, 70% LTV, 15% interest, 15 years → repayment ≈ R 68,580/mo
   - Finance: DCSR, R 2,600,000, 15.25%, 15 years → repayment ≈ R 36,835/mo
   - Monthly Rent: R 200,000, Occupancy: 88%
   - Management: 15%, Maintenance: 5%
   - Rates & Taxes: R 19,000, Insurance: R 6,500, Water: R 2,000, Security: R 17,500, Electricity: R 2,000
   - Bad Debts: 5%
   - Income Tax: 27%, CGT: 22%
   - Rental Growth: 8%, Cost Inflation: 5%, Capital Growth: 3%, Discount Rate: 10%
   Expected outputs (approximately):
   - Gross Revenue (monthly): ≈ R 131,325
   - Net Cashflow (monthly): ≈ R 9,670 (with full finance)
   - Gross Yield: ≈ 31%
   - DSCR: should be near or below 1.0 with both loans
   Write a test file /lib/calculations/__tests__/index.test.ts verifying these

3. ENVIRONMENT:
   Create .env.example:
   DATABASE_URL=postgresql://...
   NEXTAUTH_SECRET=...
   NEXTAUTH_URL=http://localhost:3000
   ANTHROPIC_API_KEY=...  (for Mentor's Comments feature)

4. SEO & META:
   - /app/layout.tsx: title="AssetVerdict | Know Before You Commit", description meta
   - /app/deals/[id]/summary: title="{Deal Name} | AssetVerdict"
   - Open Graph tags for share preview

5. LAUNCH CHECKLIST (comment each as done):
   [ ] Auth (register, login, logout) working
   [ ] Deal CRUD (create, read, update, delete) working
   [ ] All 4 input tabs saving correctly
   [ ] Calculations producing expected outputs
   [ ] All 11 gauge dials rendering with correct colours
   [ ] 20-year chart rendering with hover tooltips
   [ ] Scenario switching (Bear/Base/Bull) updating all metrics
   [ ] PDF export downloading correctly
   [ ] Mobile responsive (test at 375px)
   [ ] Empty states showing correctly
   [ ] Error toasts working
   [ ] Mentor's Comments AI feature working
   [ ] No TypeScript errors (npm run type-check)
   [ ] No console errors in browser
   [ ] Environment variables documented in .env.example
```

---

---

# APPENDIX: QUICK REFERENCE PROMPTS

---

## 🔁 PROMPT A — Add a New Gauge Metric

```
Add a new gauge dial to the AssetVerdict Summary page.

Metric: [METRIC NAME]
Value source: metrics.[fieldName] from DealMetrics
Unit: [% / Yrs / x]
Thresholds: green [range], orange [range], red [range]
Max value on arc: [number]
Benchmark marker: [value]
Tooltip: "[explanation text]"
Section: [Returns / Yields & Returns / Debt & Coverage / Cost Ratios / Valuation]
Position: [row X, column Y in the grid]

Add the gauge to the appropriate section on the Summary page.
Also add the calculation to calcAllMetrics() in /lib/calculations/index.ts if not already present.
```

---

## 🔁 PROMPT B — Add a New Finance Source Type

```
Add a new finance source type to AssetVerdict Finance Costs tab.

New type name: [e.g. "Mezzanine Finance"]
Dropdown option label: "[label]"
Special behaviour: [e.g. "interest-only repayment — no principal, just rate × loanAmount / 12"]

Tasks:
1. Add to the Source of Finance dropdown in FinanceBlock component
2. Update calcMonthlyRepayment() to handle the special repayment logic if different from standard amortisation
3. Update the FinanceSource model sourceType enum (or just add to the string options)
```

---

## 🔁 PROMPT C — Add a New Input Field

```
Add a new input field to AssetVerdict.

Tab: [Acquisition Costs / Finance Costs / Cashflow / Other Inputs]
Field name: [display label]
Field key: [camelCase db column name]
Type: [CurrencyInput / PercentInput / text / select / checkbox]
Default value: [value]
Affects calculation: [yes/no — if yes, describe which formula it feeds into]

Tasks:
1. Add the field to the Prisma schema (new column on appropriate model)
2. Create and run migration
3. Add to the form in the appropriate tab component
4. Update assembleInputs.ts to include the new field in DealInputs
5. Update the affected calculation function(s)
6. Update the relevant API route to accept and save the new field
```

---

*AssetVerdict Build Prompts — © AssetVerdict. Know Before You Commit.*
