export const INVESTMENT_STRATEGIES = [
  {
    id: "commercial",
    label: "Commercial",
    icon: "🏢",
    description:
      "Office, retail, or industrial property. NOI-driven, cap rate focus, long leases.",
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
    description:
      "Multiple rooms let individually. Higher yield, higher management intensity.",
    defaultOccupancy: 85,
    defaultManagementFee: 15,
    defaultBadDebt: 5,
    cashflowMode: "per_room",
  },
  {
    id: "student",
    label: "Student Accommodation",
    icon: "🎓",
    description:
      "Single and sharing rooms. NSFAS-funded beds (10-month cycle) alongside private/bursary beds (12-month cycle).",
    defaultOccupancy: 95,
    defaultManagementFee: 12,
    defaultBadDebt: 4,
    cashflowMode: "student",
  },
  {
    id: "fix_and_flip",
    label: "Fix & Flip",
    icon: "🔨",
    description:
      "Buy, renovate, and resell for profit. Short holding period — no long-term cashflow.",
    defaultOccupancy: 0,
    defaultManagementFee: 0,
    defaultBadDebt: 0,
    cashflowMode: "flip",
  },
  {
    id: "str",
    label: "Short-Term Rental (STR)",
    icon: "🌴",
    description:
      "Airbnb / holiday rental. Nightly rate-based income with platform fees.",
    defaultOccupancy: 70,
    defaultManagementFee: 20,
    defaultBadDebt: 1,
    cashflowMode: "nightly",
  },
  {
    id: "instalment_sale",
    label: "Instalment Sale Agreement",
    icon: "📄",
    description:
      "Seller-financed deal. You receive monthly instalments from the buyer.",
    defaultOccupancy: 100,
    defaultManagementFee: 0,
    defaultBadDebt: 2,
    cashflowMode: "instalment",
  },
] as const;

export type StrategyId = (typeof INVESTMENT_STRATEGIES)[number]["id"];
export type Strategy = (typeof INVESTMENT_STRATEGIES)[number];
export type CashflowMode = Strategy["cashflowMode"];

export function getStrategy(id: string | null | undefined): Strategy {
  return (
    INVESTMENT_STRATEGIES.find((s) => s.id === id) ?? INVESTMENT_STRATEGIES[0]
  );
}
