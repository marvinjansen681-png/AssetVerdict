# AssetVerdict — Full Product Build Plan
> A commercial property deal analysis platform. Branding: **AssetVerdict**

---

## 1. Product Overview

AssetVerdict is a web application that allows real-estate investors and property professionals to model, analyse, and score commercial (and residential) property deals. A user inputs acquisition data, financing terms, cashflow assumptions, and escalation parameters, and the platform outputs a rich set of financial metrics, colour-coded gauges, charts, and scenario comparisons — giving a clear "verdict" on whether the deal is worth pursuing.

---

## 2. Core Pages / Sections

### 2.1 Navigation Structure

```
Top nav tabs (per Deal):
  Deal Introduction | Acquisition Costs | Finance Costs | Cashflow | Other Inputs | Summary
```

Left sidebar (or top-level):
```
  Home
  My Deals (Advanced)
  [User avatar / account menu — top-right]
```

---

## 3. Data Input Modules

### 3.1 Acquisition Costs Tab

Fields:
| Field | Type | Example |
|---|---|---|
| Asking Price | Currency (R) | R 6,900,000 |
| Purchase Price | Currency (R) | R 5,055,000 |
| Market Value | Currency (R) | R 5,500,000 |
| Discount to Asking Price | % (auto-calculated) | 26.74% |
| Discount to Market Value | % (auto-calculated, highlighted orange if tight) | 8.09% |
| Transfer & Bond Cost | Currency (R) | R 309,072 |
| Renovation & Inspections Costs | Currency (R) | R 200,000 |
| Sourcing Fee | Currency (R) | R 505,500 |
| Estate Agent Commission | % | 0.00% |
| "Do you want to sell?" | Checkbox | ☐ |

Special:
- "Show Proposed Transfer Cost" button → expands transfer cost breakdown
- Green highlight on fields within acceptable range; orange/red when outside benchmarks

---

### 3.2 Finance Costs Tab

Supports **multiple finance sources** (Bank Finance, Bridging, Commercial, Creative Finance, DCSR, Private).

Per financing block:
| Field | Type | Example |
|---|---|---|
| Source of Finance | Dropdown | Bank Finance / DCSR / Commercial / Bridging / Creative Finance / Private |
| LTV / Amount | Toggle: % or R | 70% or R value |
| Loan Amount | Currency (auto-calc) | R 4,900,000 |
| Interest Rate | % | 15.00% |
| Term (years) | Years | 15 |
| Repayment Amount | Currency (auto-calc) | R 68,579.77/mo |

- **"+ Add New Finance"** button adds additional finance blocks
- **Delete** button per block
- Stacked finance blocks (e.g., Bank Finance + DCSR as second mortgage)

Bottom summary:
- Finance Cost (total monthly) 
- Deposit Required (auto-calculated)

---

### 3.3 Cashflow Tab

**Revenue (monthly)**
| Field | Type | Example |
|---|---|---|
| Monthly Rent | Currency (R) | R 200,000 |
| Occupancy Rate | % | 88% |
| Additional Income | Currency | R 0 |
| Recoveries | Currency | R 0 |

**Expenses (monthly)**
| Field | Type | Example |
|---|---|---|
| Management Fees | % or R toggle | 15% |
| Maintenance Cost | % or R toggle | 5% |
| Levies | Currency | R 0 |
| Rates and Taxes | Currency | R 19,000 |
| Insurance | Currency | R 6,500 |
| Water, Refuse & Sewerage | Currency | R 2,000 |
| Security and Cleaning | Currency | R 17,500 |
| Electricity | Currency | R 2,000 |
| Finance Cost | Currency (auto-pulled) | R 105,415.26 |

---

### 3.4 Other Inputs Tab

**Enterprise Details**
| Field | Type | Example |
|---|---|---|
| Effective Income Tax | % | 27% |
| Effective Capital Gains Tax | % | 22% |

**Escalations**
| Field | Type | Example |
|---|---|---|
| Capital Growth Rate | % | 3% |
| Rental Growth Rate | % | 8% |
| Cost Inflation | % | 5% |
| Sustainable Growth Rate | % | 5% |
| Discount Rate | % | 10% |

Total Costs (auto-calc): R 8,040,000

**Sensitivity Levels**
| Field | Type | Example |
|---|---|---|
| Real Growth Factor | % | 10% |
| Occupation Factor | % | 10% |

Bear / Base / Bull scenario grid (table)

---

## 4. Output / Results Dashboard

### 4.1 Summary Page — Returns Section

**Top KPI cards (gauge dials):**

| Metric | Gauge Color | Example Value |
|---|---|---|
| IRR (Internal Rate of Return) | Green (good) | 27.5% |
| Net Yield Yr 1 | Grey/Red (bad if negative) | -5.64% |
| Cap Rate (PP) | Red (high risk) | 13.83% |
| NPV | Text display | R 17,629,878.74 |
| Cap Rate (MV) | Green | 8.8% |
| Debt Service Ratio | Red (below 1) | 0.88 |
| Operating Expense Ratio | Orange (mid) | 47.39% |
| Payback Period | Orange | 11 Yrs |

Each gauge uses a **semicircular dial** with:
- Colour coding: Green / Orange / Red based on benchmark thresholds
- A triangular pointer/arrow indicating current value
- A small benchmark marker on the arc
- Tooltip (ⓘ) explaining the metric on hover

---

### 4.2 Yields & Returns Section

| Metric | Gauge | Example |
|---|---|---|
| Gross Yield | Green | 31.18% |
| Net Yield Yr 1 (pre tax) | Orange | 12.16% |
| Net Yield Yr 1 (post tax) | Orange | 8.87% |
| IRR | Green | 17.15% |
| NOI Margin | Orange | 49.28% |
| NPV | Text | R 7,455,xxx |

---

### 4.3 Cashflow Summary Section

Toggle: **Annual Figures** | **Monthly Figures** (active tab highlighted blue)

Three-column layout:
| Gross Revenue | Operating Costs | Provisions |
|---|---|---|
| 131,325.00 ▲ | 84,518.47 ▲ | 28,183.33 ▲ |
| Rental Income: 118,000 | Finance: 42,642.60 | Management: 17,700 |
| Additional Income: 0 | Utilities: 24,345.76 | Maintenance: 4,583.33 |
| Recoveries: 13,325 | Rates, Insurance & Other: 17,530.11 | Bad Debts: 5,900 |

Bottom row:
- **Tax**: 8,952.48
- **Cashflow**: 9,670.72

---

### 4.4 Debt & Coverage Section

Gauge dials:
| Metric | Color | Example |
|---|---|---|
| Debt Service Ratio | Red | 0 (bad) |
| LTV | Grey | 0% |
| Break-even Ratio | Green | 50.72% |

---

### 4.5 Cost Ratios Section

| Metric | Color | Example |
|---|---|---|
| Utilities Ratio | Orange | 24.39% |
| Operating Expense Ratio | Orange | 50.72% |

---

### 4.6 Valuation Section

| Metric | Color | Example |
|---|---|---|
| Cap Rate Spread | Orange | 1.18% |
| Payback Period | Green (9 yrs) or Orange (11 yrs) | 9 Yrs |

Tooltip on Cap Rate Spread: *"How much better your deal is vs the market — more than 2% above market is strong, showing you bought below value."*

Tooltip on Payback Period: *"The Payback Period refers to the amount of time it takes to recover the cost of your investment."*

---

### 4.7 Capex Spend Section

**Pie chart** showing capital expenditure breakdown across multiple categories. Slices shown with percentage labels. Categories include multiple items (colours: red dominant, with blue, green, orange, yellow slices).

---

### 4.8 Project Cashflow (20 Years) Chart

**Multi-series bar + line combo chart:**

X-axis: Year 1 → Year 20  
Y-axis (left): Rands  
Y-axis (right): Yearly ROI %

Series:
- 🔵 **Total Cash Flow for Period** (blue bars — starts negative, grows positive)
- 🟢 **Cumulative Cash Flow** (green bars — starts deep negative, crosses to positive around Year 8–10)
- 🟠 **Yearly ROI** (orange line — steady upward trend, reaching ~30 by Year 20)

Hover tooltip on Year 1:
```
Total Cash Flow for Period: -R 530,604.66
Cumulative CashFlow: -R 5,530,967.34
Yearly ROI: 8.87
```

---

### 4.9 Other Collapsible Sections

The summary page also includes collapsible accordion sections:
- Equity / Debt Ratio
- Operating Profit
- Net Profit
- Project Cashflow (expanded by default or on click)
- Capex Spend

---

### 4.10 Scenarios

A **Scenarios** section (collapsible) sits between Overview and Returns on the summary page, for Bear / Base / Bull scenario switching.

---

## 5. Gauge Dial Component Spec

Each gauge is a reusable component:

```
Props:
  - value: number
  - unit: '%' | 'Yrs' | 'R' | number
  - label: string
  - benchmarkValue: number (position of grey target marker)
  - thresholds: { green: [min, max], orange: [min, max], red: [min, max] }
  - tooltipText: string

Visual:
  - SVG semicircle arc, ~180°
  - Coloured fill of arc up to pointer position
  - Small triangular pointer on arc edge
  - Small grey/white triangular benchmark marker
  - Value displayed centered below arc in bold
  - Label above, with ⓘ icon for tooltip
```

Color logic:
- **Green** — value within ideal range
- **Orange** — acceptable but not ideal
- **Red** — outside acceptable range / bad deal indicator

---

## 6. Tech Stack Recommendation

### Frontend
- **React** (with TypeScript)
- **Tailwind CSS** for utility styling
- **Recharts** or **ApexCharts** for the 20-year cashflow combo chart
- **D3.js** or custom SVG for the semicircular gauge dials
- **React Hook Form** for all input tabs

### Backend
- **Node.js + Express** (or Next.js API routes)
- **PostgreSQL** for deal storage
- All financial calculations done server-side (or client-side with a calculation engine module)

### Auth
- JWT-based auth with user profiles
- "My Advanced Deals" linked to user account

### Calculation Engine (pure functions / module)
Core calculations needed:
```
- Gross Revenue = Monthly Rent × Occupancy Rate × 12 (+ Additional Income + Recoveries)
- Operating Costs = Finance + Utilities + Rates/Insurance/Other
- Provisions = Management + Maintenance + Bad Debts
- NOI = Gross Revenue - Operating Costs (excl. Finance)
- Cap Rate (PP) = NOI / Purchase Price
- Cap Rate (MV) = NOI / Market Value
- Gross Yield = Gross Revenue / Purchase Price
- Net Yield (pre-tax) = Cashflow before tax / Purchase Price
- Net Yield (post-tax) = Cashflow after tax / Purchase Price
- Debt Service Ratio (DSCR) = NOI / Annual Debt Service
- LTV = Loan Amount / Property Value
- Break-even Ratio = (Operating Expenses + Debt Service) / Gross Revenue
- Operating Expense Ratio = Total Operating Expenses / Gross Revenue
- Utilities Ratio = Utilities / Gross Revenue
- Payback Period = Total Investment Cost / Annual Net Cashflow
- Cap Rate Spread = Deal Cap Rate - Market Cap Rate
- IRR = over 20 years using projected cashflows + terminal value
- NPV = discounted cashflows at discount rate
- NOI Margin = NOI / Gross Revenue
- 20-year projection with escalations (rent growth, cost inflation, capital growth)
```

---

## 7. AssetVerdict Branding

### Name
**AssetVerdict**

### Tagline
*"Know Before You Commit."*

### Color Palette
| Token | Hex | Use |
|---|---|---|
| `--av-navy` | `#0F1F3D` | Primary dark, nav bg |
| `--av-gold` | `#C9A84C` | Accent, CTA buttons, highlights |
| `--av-white` | `#F8F9FA` | Page background |
| `--av-slate` | `#4A5568` | Body text |
| `--av-green` | `#27AE60` | Good gauge state |
| `--av-orange` | `#E67E22` | Warning gauge state |
| `--av-red` | `#E74C3C` | Danger gauge state |
| `--av-light-grey` | `#EDF2F7` | Card backgrounds, dividers |

### Typography
- **Display / Headings**: `DM Serif Display` — authoritative, financial weight
- **Body / UI**: `Inter` — clean, readable data tables and forms
- **Data / Numbers**: `JetBrains Mono` or `Roboto Mono` — for financial figures in gauge dials and tables

### Logo concept
Shield or checkmark icon + "AssetVerdict" wordmark in DM Serif Display, navy + gold accent.

---

## 8. Page-by-Page Build Sequence

### Phase 1 — Foundation
1. Project scaffolding (Next.js + Tailwind + TypeScript)
2. Auth system (login, register, JWT)
3. Database schema: Users, Deals, FinanceSources, CashflowInputs
4. "My Advanced Deals" list page

### Phase 2 — Input Forms
5. Deal Introduction tab (deal name, property type, location, notes)
6. Acquisition Costs tab (all fields + auto-calc discounts)
7. Finance Costs tab (multi-source finance blocks, add/delete, repayment calc)
8. Cashflow tab (revenue + expense fields)
9. Other Inputs tab (tax, escalations, sensitivity)
10. Save / auto-save per tab

### Phase 3 — Calculation Engine
11. Build pure calculation module (all formulas above)
12. 20-year projection engine (with escalations)
13. IRR / NPV solver
14. Scenario engine (Bear / Base / Bull)

### Phase 4 — Output Dashboard
15. Reusable Gauge Dial SVG component (with thresholds, tooltips)
16. Summary page — Returns section (8 gauges)
17. Yields & Returns section
18. Cashflow summary table (monthly/annual toggle)
19. Debt & Coverage section
20. Cost Ratios section
21. Valuation section
22. Capex Spend pie chart
23. Project Cashflow 20-year combo chart
24. Collapsible accordion sections

### Phase 5 — Polish
25. Scenario selector (Bear / Base / Bull)
26. "Show Mentor's Comments" feature
27. PDF export of deal summary
28. Responsive / mobile layout
29. Onboarding / empty state

---

## 9. Database Schema (Key Tables)

```sql
-- Users
users (id, email, name, password_hash, created_at)

-- Deals
deals (
  id, user_id, name, property_type, address,
  -- Acquisition
  asking_price, purchase_price, market_value,
  transfer_bond_cost, renovation_cost, sourcing_fee, agent_commission,
  -- Other Inputs
  income_tax_rate, capital_gains_tax_rate,
  capital_growth_rate, rental_growth_rate, cost_inflation,
  sustainable_growth_rate, discount_rate,
  real_growth_factor, occupation_factor,
  created_at, updated_at
)

-- Finance Sources (one-to-many per deal)
finance_sources (
  id, deal_id, source_type, ltv_percent, loan_amount,
  interest_rate, term_years, repayment_amount
)

-- Cashflow Inputs
cashflow_inputs (
  id, deal_id,
  monthly_rent, occupancy_rate, additional_income, recoveries,
  management_fee_pct, maintenance_cost_pct,
  levies, rates_taxes, insurance, water_sewerage,
  security_cleaning, electricity
)
```

---

## 10. Component Library Checklist

| Component | Description |
|---|---|
| `<GaugeDial />` | SVG semicircle gauge with colour zones, pointer, benchmark marker, tooltip |
| `<CashflowTable />` | 3-column revenue/costs/provisions table with toggle |
| `<ProjectCashflowChart />` | 20-year bar+line combo (Recharts) |
| `<CapexPieChart />` | Recharts PieChart with labelled slices |
| `<FinanceBlock />` | Repeatable finance source form block |
| `<MetricCard />` | Plain text metric card (for NPV etc.) |
| `<TabNav />` | Deal input tab navigation |
| `<AccordionSection />` | Collapsible result sections |
| `<ScenarioSelector />` | Bear / Base / Bull switcher |
| `<TooltipIcon />` | ⓘ hover tooltip |
| `<ToggleSwitch />` | Monthly / Annual or % / R toggle |

---

## 11. Gauge Threshold Reference

| Metric | Green | Orange | Red |
|---|---|---|---|
| IRR | > 15% | 8–15% | < 8% |
| Gross Yield | > 10% | 7–10% | < 7% |
| Net Yield (pre-tax) | > 8% | 5–8% | < 5% |
| Cap Rate Spread | > 2% | 0–2% | < 0% |
| Debt Service Ratio | > 1.25 | 1.0–1.25 | < 1.0 |
| Operating Expense Ratio | < 40% | 40–60% | > 60% |
| Utilities Ratio | < 15% | 15–30% | > 30% |
| Payback Period | < 8 Yrs | 8–12 Yrs | > 12 Yrs |
| LTV | < 60% | 60–75% | > 75% |
| Break-even Ratio | < 75% | 75–90% | > 90% |
| NOI Margin | > 60% | 40–60% | < 40% |

---

## 12. Key UX Details Observed

1. **Tooltip on hover for every metric gauge** (ⓘ icon) — plain-English explanation of what the metric means and what constitutes a good result.
2. **"Show Mentor's Comments"** button at bottom of Summary page — suggests an AI or expert commentary feature that can be toggled.
3. **Upward arrows (▲)** next to key figures in cashflow table indicate the figure is projected to grow (linked to escalation settings).
4. **Finance field highlighted blue** when active/selected.
5. **Discount to Market Value** field turns orange/red when the discount is thin (e.g., 8.09% highlighted orange).
6. **Multiple scenarios** visible in overview — the summary page shows both a "worse" scenario (Debt Service = 0, LTV = 0%) and a "better" scenario (Payback = 9 Yrs in green) in different screenshots, suggesting scenario switching updates all gauges live.
7. **Annual figures** show full-year numbers (R 1,575,900 gross revenue vs R 131,325 monthly).
8. **"Show Proposed Transfer Cost"** button reveals a transfer cost breakdown.
9. **All currency in South African Rand (R)** — app is ZA-market focused but should be currency-configurable.

---

## 13. Estimated Build Effort

| Phase | Effort |
|---|---|
| Foundation + Auth | 1–2 weeks |
| Input Forms (all tabs) | 2–3 weeks |
| Calculation Engine | 1–2 weeks |
| Output Dashboard + Charts | 3–4 weeks |
| Polish, Export, Scenarios | 1–2 weeks |
| **Total** | **~8–13 weeks (1–2 devs)** |

---

*AssetVerdict — Know Before You Commit.*
