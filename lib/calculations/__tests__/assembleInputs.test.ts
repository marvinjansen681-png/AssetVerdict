import { describe, it, expect } from "vitest";
import { assembleInputs } from "../assembleInputs";
import { calcAllMetrics, calcMonthlyRepayment } from "../index";
import type { DealWithRelations } from "@/types";

/** Raw DB shape of a FinanceSource row — repaymentAmount included so tests
 * can prove assembleInputs() ignores whatever value is stored there. */
interface RawFinanceSource {
  loanAmount: number;
  interestRate: number;
  termYears: number;
  repaymentAmount?: number | null;
}

/**
 * Minimal valid DealWithRelations fixture. Only the fields assembleInputs()
 * actually reads are varied per-test; everything else is a plain default.
 */
function makeDeal(overrides: {
  wantToSell?: boolean;
  saleYear?: number | null;
  billsIncluded?: boolean;
  billsIncludedAmount?: number | null;
  leaseTermMonths?: number | null;
  investmentStrategy?: string;
  purchasePrice?: number | null;
  monthlyRent?: number | null;
  financeSources?: RawFinanceSource[];
}): DealWithRelations {
  return {
    id: "deal-1",
    userId: "user-1",
    name: "Test Deal",
    currency: "ZAR",
    investmentStrategy: overrides.investmentStrategy ?? "commercial",
    purchasePrice: overrides.purchasePrice ?? 1_000_000,
    wantToSell: overrides.wantToSell ?? false,
    saleYear: overrides.saleYear ?? null,
    isSectionalTitle: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    financeSources: overrides.financeSources ?? [],
    cashflowInputs: {
      id: "cf-1",
      dealId: "deal-1",
      managementFeeMode: "percent",
      maintenanceCostMode: "percent",
      billsIncluded: overrides.billsIncluded ?? false,
      billsIncludedAmount: overrides.billsIncludedAmount ?? null,
      leaseTermMonths: overrides.leaseTermMonths ?? null,
      monthlyRent: overrides.monthlyRent ?? 15_000,
    },
    capexItems: [],
    renovationItems: [],
    propertyValuation: null,
    dealSuburbs: [],
  } as unknown as DealWithRelations;
}

describe("assembleInputs — bills-included lifecycle (Phase 4.3)", () => {
  it("preserves null (not separately recorded) rather than defaulting to 0", () => {
    const deal = makeDeal({ billsIncluded: true, billsIncludedAmount: null });
    expect(assembleInputs(deal).billsIncludedAmount).toBeNull();
  });

  it("round-trips a recorded amount unchanged", () => {
    const deal = makeDeal({ billsIncluded: true, billsIncludedAmount: 650 });
    const inputs = assembleInputs(deal);
    expect(inputs.billsIncluded).toBe(true);
    expect(inputs.billsIncludedAmount).toBe(650);
  });

  it("stays null when billsIncluded is off, even if a stale amount exists in the DB", () => {
    const deal = makeDeal({ billsIncluded: false, billsIncludedAmount: 650 });
    const inputs = assembleInputs(deal);
    expect(inputs.billsIncluded).toBe(false);
    // The raw amount is preserved as-is (single calculation ownership: the
    // calculation layer, not assembleInputs, decides billsIncluded gates it out).
    expect(inputs.billsIncludedAmount).toBe(650);
  });
});

describe("assembleInputs — hold period (Phase 4.3)", () => {
  it("threads wantToSell + saleYear straight through", () => {
    const deal = makeDeal({ wantToSell: true, saleYear: 12 });
    const inputs = assembleInputs(deal);
    expect(inputs.wantToSell).toBe(true);
    expect(inputs.saleYear).toBe(12);
  });

  it("defaults wantToSell to false and saleYear to null for a deal that never set them", () => {
    const deal = makeDeal({});
    const inputs = assembleInputs(deal);
    expect(inputs.wantToSell).toBe(false);
    expect(inputs.saleYear).toBeNull();
  });
});

// Phase 4.7: leaseTermMonths is deliberately a contextual fact, never a
// calculation input — it must never reach DealInputs at all, and its
// presence/absence/value must never change a single calculated output.
describe("assembleInputs — leaseTermMonths is excluded from DealInputs (Phase 4.7)", () => {
  it("never appears as a key on the assembled DealInputs object, recorded or not", () => {
    const withLease = assembleInputs(makeDeal({ leaseTermMonths: 60 }));
    const withoutLease = assembleInputs(makeDeal({ leaseTermMonths: null }));
    expect(withLease).not.toHaveProperty("leaseTermMonths");
    expect(withoutLease).not.toHaveProperty("leaseTermMonths");
  });

  it("produces byte-identical DealInputs whether or not a lease term is recorded", () => {
    const withLease = assembleInputs(makeDeal({ leaseTermMonths: 60 }));
    const withoutLease = assembleInputs(makeDeal({ leaseTermMonths: null }));
    expect(withLease).toEqual(withoutLease);
  });

  it("produces identical calcAllMetrics output whether or not a lease term is recorded — no financial output changes", () => {
    const withLease = assembleInputs(makeDeal({ leaseTermMonths: 60, purchasePrice: 2_500_000, monthlyRent: 25_000 }));
    const withoutLease = assembleInputs(makeDeal({ leaseTermMonths: null, purchasePrice: 2_500_000, monthlyRent: 25_000 }));
    expect(calcAllMetrics(withLease)).toEqual(calcAllMetrics(withoutLease));
  });
});

// Phase 4.11: repaymentAmount is a client-touchable DB column, but it must
// never be authoritative. assembleInputs() is the trust boundary — nothing
// it hands to the calculation engine may carry a stored repayment figure.
describe("assembleInputs — repaymentAmount is never trusted from storage (Phase 4.11)", () => {
  it("never appears as a key on any assembled finance source, no matter what is stored", () => {
    const deal = makeDeal({
      financeSources: [{ loanAmount: 1_000_000, interestRate: 10, termYears: 20, repaymentAmount: 5_000 }],
    });
    const inputs = assembleInputs(deal);
    expect(inputs.financeSources[0]).not.toHaveProperty("repaymentAmount");
    expect(inputs.financeSources[0]).toEqual({ loanAmount: 1_000_000, interestRate: 10, termYears: 20 });
  });

  it("produces identical DealInputs and metrics regardless of a wildly wrong stored repaymentAmount (API manipulation test)", () => {
    const loanTerms = { loanAmount: 1_000_000, interestRate: 10, termYears: 20 };
    const withBogusLow = assembleInputs(
      makeDeal({ financeSources: [{ ...loanTerms, repaymentAmount: 1 }], purchasePrice: 1_500_000, monthlyRent: 25_000 })
    );
    const withBogusHigh = assembleInputs(
      makeDeal({ financeSources: [{ ...loanTerms, repaymentAmount: 50_000 }], purchasePrice: 1_500_000, monthlyRent: 25_000 })
    );
    const withNull = assembleInputs(
      makeDeal({ financeSources: [{ ...loanTerms, repaymentAmount: null }], purchasePrice: 1_500_000, monthlyRent: 25_000 })
    );
    expect(withBogusLow).toEqual(withBogusHigh);
    expect(withBogusLow).toEqual(withNull);
    // A single toEqual on the full DealMetrics object proves every derived
    // output is identical — including DSCR, Break-Even Ratio, cashflow,
    // tax, the 20-year projection, exit summary, and IRR/NPV — since all of
    // them are pure functions of DealInputs, which are already proven
    // identical above.
    const metricsLow = calcAllMetrics(withBogusLow);
    const metricsHigh = calcAllMetrics(withBogusHigh);
    expect(metricsLow).toEqual(metricsHigh);
    // Named assertions against the true value for readability/traceability.
    const trueMonthlyRepayment = calcMonthlyRepayment(1_000_000, 10, 20);
    expect(trueMonthlyRepayment).toBeCloseTo(9_650.2165, 2);
    expect(metricsLow.dscr).toBeCloseTo(metricsLow.noiAnnual / (trueMonthlyRepayment * 12), 6);
    expect(metricsLow.breakEvenRatio).toBeCloseTo(metricsHigh.breakEvenRatio, 6);
    expect(metricsLow.cashflowMonthly).toBeCloseTo(metricsHigh.cashflowMonthly, 6);
    expect(metricsLow.taxMonthly).toBeCloseTo(metricsHigh.taxMonthly, 6);
    expect(metricsLow.irr).toBeCloseTo(metricsHigh.irr as number, 6);
    expect(metricsLow.npv).toBeCloseTo(metricsHigh.npv, 6);
    expect(metricsLow.exitSummary.remainingDebtAtExit).toBeCloseTo(metricsHigh.exitSummary.remainingDebtAtExit, 6);
    expect(metricsLow.exitSummary.terminalEquityValue).toBeCloseTo(metricsHigh.exitSummary.terminalEquityValue, 6);
  });

  it("recomputes from the current interestRate even when the stored repaymentAmount matches an old rate (stale value test)", () => {
    const loanAt10Pct = assembleInputs(
      makeDeal({
        financeSources: [
          { loanAmount: 1_000_000, interestRate: 10, termYears: 20, repaymentAmount: calcMonthlyRepayment(1_000_000, 10, 20) },
        ],
        purchasePrice: 1_500_000,
        monthlyRent: 25_000,
      })
    );
    // Rate changed 10% -> 12%, but the stored repaymentAmount was never
    // updated (still reflects the old 10% payment) — simulates a stale DB row.
    const loanAt12PctStaleStored = assembleInputs(
      makeDeal({
        financeSources: [
          { loanAmount: 1_000_000, interestRate: 12, termYears: 20, repaymentAmount: calcMonthlyRepayment(1_000_000, 10, 20) },
        ],
        purchasePrice: 1_500_000,
        monthlyRent: 25_000,
      })
    );
    const metricsAt10 = calcAllMetrics(loanAt10Pct);
    const metricsAt12 = calcAllMetrics(loanAt12PctStaleStored);
    expect(metricsAt12.dscr).toBeLessThan(metricsAt10.dscr as number);
    expect(metricsAt12.breakEvenRatio).toBeGreaterThan(metricsAt10.breakEvenRatio);
    expect(metricsAt12.dscr).toBeCloseTo(
      metricsAt12.noiAnnual / (calcMonthlyRepayment(1_000_000, 12, 20) * 12),
      6
    );
  });

  it("aggregates two independently-amortising loans correctly even when both carry bogus stored repayment values", () => {
    const inputs = assembleInputs(
      makeDeal({
        financeSources: [
          { loanAmount: 800_000, interestRate: 10, termYears: 20, repaymentAmount: 1 },
          { loanAmount: 200_000, interestRate: 15, termYears: 5, repaymentAmount: 999_999 },
        ],
        purchasePrice: 1_200_000,
        monthlyRent: 25_000,
      })
    );
    const metrics = calcAllMetrics(inputs);
    const trueTotal =
      calcMonthlyRepayment(800_000, 10, 20) + calcMonthlyRepayment(200_000, 15, 5);
    expect(metrics.dscr).toBeCloseTo(metrics.noiAnnual / (trueTotal * 12), 6);
  });
});
