import { describe, it, expect } from "vitest";
import { calcAllMetrics, calcMonthlyRepayment, type DealInputs } from "../../calculations";
import { getMetricBreakdown, getMetricRawValue, type AcquisitionSummary } from "../metricBreakdowns";
import { interpretMetricValue } from "../interpretMetric";
import { formatMetricValue } from "../format";

const bankRepayment = calcMonthlyRepayment(4_900_000, 15, 15);

const rentalInputs: DealInputs = {
  purchasePrice: 5_055_000,
  marketValue: 5_500_000,
  askingPrice: 6_900_000,
  transferBondCost: 309_072,
  renovationCost: 200_000,
  sourcingFee: 505_500,
  agentCommission: 0,
  financeSources: [
    { loanAmount: 4_900_000, interestRate: 15, termYears: 15, repaymentAmount: bankRepayment },
  ],
  monthlyRent: 200_000,
  occupancyRate: 88,
  additionalIncome: 0,
  recoveries: 0,
  managementFeeValue: 15,
  managementFeeMode: "percent",
  maintenanceCostValue: 5,
  maintenanceCostMode: "percent",
  levies: 0,
  ratesAndTaxes: 19_000,
  insurance: 6_500,
  waterSewerage: 2_000,
  securityCleaning: 17_500,
  electricity: 2_000,
  badDebtsPct: 5,
  incomeTaxRate: 27,
  capitalGainsTaxRate: 22,
  capitalGrowthRate: 3,
  rentalGrowthRate: 8,
  costInflation: 5,
  discountRate: 10,
  marketCapRate: 10,
  strategy: "commercial",
  numUnits: 1,
  nightlyRate: 0,
  avgOccupiedNights: 200,
  platformFeesPct: 15,
  billsIncluded: false,
  academicYearWeeks: 42,
  pricePerRoom: 0,
  singleRoomCount: 0,
  singleRoomRent: 0,
  singleRoomNsfasBeds: 0,
  sharingRoomCount: 0,
  sharingBedsPerRoom: 2,
  sharingRoomRent: 0,
  sharingRoomNsfasBeds: 0,
  nsfasCycleMonths: 10,
  privateCycleMonths: 12,
  houseParentCost: 0,
  internetCost: 0,
  netflixCost: 0,
  gasRefillCost: 0,
  wasteRemovalCost: 0,
  holdingPeriodMonths: 6,
  expectedSalePrice: 0,
  holdingCostPerMonth: 0,
  instalmentAmount: 0,
  instalmentTerm: 240,
  instalmentRate: 0,
};

const flipInputs: DealInputs = {
  ...rentalInputs,
  strategy: "fix_and_flip",
  financeSources: [],
  renovationCost: 300_000,
  expectedSalePrice: 6_500_000,
  holdingPeriodMonths: 6,
  holdingCostPerMonth: 15_000,
  agentCommission: 5,
};

const dealSummary: AcquisitionSummary = {
  purchasePrice: rentalInputs.purchasePrice,
  marketValue: rentalInputs.marketValue,
};

describe("getMetricBreakdown — deterministic formula breakdowns reconcile with the engine", () => {
  const metrics = calcAllMetrics(rentalInputs);

  it("DSCR: NOI ÷ Annual Debt Payments reconciles to metrics.dscr", () => {
    const b = getMetricBreakdown({ metricKey: "dscr", metrics, dealSummary })!;
    expect(b.lines).toHaveLength(2);
    expect(b.lines[0].value).toBe(metrics.noiAnnual);
    expect(b.lines[1].value).toBe(metrics.annualDebtService);
    expect(b.result).toBeCloseTo(metrics.dscr, 6);
    expect(b.lines[0].value / b.lines[1].value).toBeCloseTo(b.result, 6);
  });

  it("LTV: Total Loan Amount ÷ Purchase Price reconciles to metrics.ltv", () => {
    const b = getMetricBreakdown({ metricKey: "ltv", metrics, dealSummary })!;
    expect((b.lines[0].value / b.lines[1].value) * 100).toBeCloseTo(metrics.ltv, 6);
    expect(b.result).toBeCloseTo(metrics.ltv, 6);
  });

  it("Cap Rate PP: Annual NOI ÷ Purchase Price reconciles to metrics.capRatePP", () => {
    const b = getMetricBreakdown({ metricKey: "capRatePP", metrics, dealSummary })!;
    expect((b.lines[0].value / b.lines[1].value) * 100).toBeCloseTo(metrics.capRatePP, 6);
  });

  it("Cap Rate MV: Annual NOI ÷ Market Value reconciles to metrics.capRateMV", () => {
    const b = getMetricBreakdown({ metricKey: "capRateMV", metrics, dealSummary })!;
    expect((b.lines[0].value / b.lines[1].value) * 100).toBeCloseTo(metrics.capRateMV, 6);
  });

  it("Gross Yield: Annual Gross Revenue ÷ Purchase Price reconciles to metrics.grossYield", () => {
    const b = getMetricBreakdown({ metricKey: "grossYield", metrics, dealSummary })!;
    expect((b.lines[0].value / b.lines[1].value) * 100).toBeCloseTo(metrics.grossYield, 6);
  });

  it("Cash-on-Cash Return (netYieldPreTax): Annual Pre-Tax Cash Flow ÷ Initial Equity Investment", () => {
    const b = getMetricBreakdown({ metricKey: "netYieldPreTax", metrics, dealSummary })!;
    expect(b.lines[0].value).toBe(metrics.cashflowAnnualPreTax);
    expect(b.lines[1].value).toBe(metrics.depositRequired);
    expect((b.lines[0].value / b.lines[1].value) * 100).toBeCloseTo(metrics.netYieldPreTax, 6);
  });

  it("Operating Expense Ratio: Operating Expenses ÷ Gross Revenue reconciles", () => {
    const b = getMetricBreakdown({ metricKey: "operatingExpenseRatio", metrics, dealSummary })!;
    expect(b.lines[0].value).toBe(metrics.operatingExpensesAnnual);
    expect((b.lines[0].value / b.lines[1].value) * 100).toBeCloseTo(metrics.operatingExpenseRatio, 6);
  });

  it("NOI Margin: Annual NOI ÷ Gross Revenue reconciles", () => {
    const b = getMetricBreakdown({ metricKey: "noiMargin", metrics, dealSummary })!;
    expect((b.lines[0].value / b.lines[1].value) * 100).toBeCloseTo(metrics.noiMargin, 6);
  });

  it("Equity IRR summary exposes initial equity, total projected cashflow, and terminal value — no Newton-Raphson details", () => {
    const b = getMetricBreakdown({ metricKey: "irr", metrics, dealSummary })!;
    expect(b.lines.map((l) => l.label)).toEqual([
      "Initial Equity Invested",
      "Total Projected Cash Flow (20 yrs)",
      "Projected Equity at Sale (Yr 20)",
    ]);
    expect(b.result).toBeCloseTo(metrics.irr, 6);
  });

  it("Equity NPV summary exposes initial equity, PV of cashflows, and PV of sale proceeds", () => {
    const b = getMetricBreakdown({ metricKey: "npv", metrics, dealSummary })!;
    expect(b.lines[0].value).toBeCloseTo(metrics.npvBreakdown.initialEquityInvestment, 6);
    expect(b.lines[1].value).toBeCloseTo(metrics.npvBreakdown.presentValueOfOperatingCashflows, 6);
    expect(b.lines[2].value).toBeCloseTo(metrics.npvBreakdown.presentValueOfTerminalValue, 6);
    expect(b.result).toBeCloseTo(metrics.npv, 4);
  });

  it("returns undefined for a flip-only metric on a rental deal (no flipMetrics present)", () => {
    expect(getMetricBreakdown({ metricKey: "roi", metrics, dealSummary })).toBeUndefined();
  });
});

describe("getMetricBreakdown — Fix & Flip", () => {
  const metrics = calcAllMetrics(flipInputs);

  it("ROI breakdown reconciles to flipMetrics.roi", () => {
    const b = getMetricBreakdown({ metricKey: "roi", metrics, dealSummary })!;
    expect(b.lines[0].value).toBe(metrics.flipMetrics!.netProfit);
    expect(b.lines[1].value).toBe(metrics.flipMetrics!.totalCost);
    expect((b.lines[0].value / b.lines[1].value) * 100).toBeCloseTo(metrics.flipMetrics!.roi, 6);
  });

  it("Total Cost breakdown sums to flipMetrics.totalCost", () => {
    const b = getMetricBreakdown({ metricKey: "totalCost", metrics, dealSummary })!;
    const sum = b.lines.reduce((s, l) => s + l.value, 0);
    expect(sum).toBeCloseTo(metrics.flipMetrics!.totalCost, 6);
  });
});

describe("getMetricRawValue", () => {
  const metrics = calcAllMetrics(rentalInputs);

  it("resolves initialEquityInvestment to depositRequired", () => {
    expect(getMetricRawValue("initialEquityInvestment", metrics)).toBe(metrics.depositRequired);
  });

  it("returns null for equity (no single-year scalar)", () => {
    expect(getMetricRawValue("equity", metrics)).toBeNull();
  });

  it("resolves top-level DealMetrics fields directly", () => {
    expect(getMetricRawValue("dscr", metrics)).toBe(metrics.dscr);
    expect(getMetricRawValue("npv", metrics)).toBe(metrics.npv);
  });

  it("resolves flip fields from metrics.flipMetrics", () => {
    const flipMetrics = calcAllMetrics(flipInputs);
    expect(getMetricRawValue("roi", flipMetrics)).toBe(flipMetrics.flipMetrics!.roi);
  });

  it("returns null for a flip field when the deal has no flipMetrics", () => {
    expect(getMetricRawValue("roi", metrics)).toBeNull();
  });
});

describe("formatMetricValue", () => {
  it("formats N/A for non-finite values regardless of requested format", () => {
    expect(formatMetricValue(Infinity, "multiple")).toBe("N/A");
    expect(formatMetricValue(null, "currency")).toBe("N/A");
    expect(formatMetricValue(undefined, "percent")).toBe("N/A");
  });

  it("formats currency, percent, multiple, years, number distinctly", () => {
    expect(formatMetricValue(1234, "currency")).toBe("R 1,234");
    expect(formatMetricValue(-1234, "currency")).toBe("-R 1,234");
    expect(formatMetricValue(12.345, "percent")).toBe("12.3%");
    expect(formatMetricValue(1.3149, "multiple")).toBe("1.31x");
    expect(formatMetricValue(8.16, "years")).toBe("8.2 Yrs");
    expect(formatMetricValue(3.14159, "number")).toBe("3.14");
  });
});

describe("interpretMetricValue — deterministic, template-driven (no AI)", () => {
  it("produces a sentence for every metric that has a formula breakdown", () => {
    const metrics = calcAllMetrics(rentalInputs);
    const breakdownKeys = ["dscr", "ltv", "capRatePP", "capRateMV", "grossYield", "netYieldPreTax", "operatingExpenseRatio", "noiMargin", "irr", "npv", "paybackPeriod", "breakEvenRatio", "utilitiesRatio"];
    for (const key of breakdownKeys) {
      const value = getMetricRawValue(key, metrics);
      expect(value, key).not.toBeNull();
      expect(interpretMetricValue(key, value as number), key).toBeTruthy();
    }
  });

  it("is undefined for a metric with no template", () => {
    expect(interpretMetricValue("totalInvestment", 1_000_000)).toBeUndefined();
  });

  it("embeds the actual formatted value in the sentence (not a placeholder)", () => {
    const sentence = interpretMetricValue("dscr", 1.31);
    expect(sentence).toContain("1.31");
  });
});
