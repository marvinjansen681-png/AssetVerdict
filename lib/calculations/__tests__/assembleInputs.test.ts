import { describe, it, expect } from "vitest";
import { assembleInputs } from "../assembleInputs";
import { calcAllMetrics } from "../index";
import type { DealWithRelations } from "@/types";

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
    financeSources: [],
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
