import { describe, it, expect } from "vitest";
import { calcRentSuggestion } from "../area-suggestions";
import type { SuburbProfile } from "../../types";

function makeProfile(overrides: Partial<SuburbProfile> = {}): SuburbProfile {
  return {
    id: "sp1",
    userId: "u1",
    suburbName: "Bethelsdorp",
    city: "Gqeberha",
    province: "Eastern Cape",
    reportType: "suburb",
    reportDate: new Date().toISOString(),
    reportYear: new Date().getFullYear(),
    reportSource: "TPN Investor Report",
    notes: null,
    fh3BedLow: 4500,
    fh3BedAvg: 5800,
    fh3BedHigh: 7200,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as SuburbProfile;
}

describe("calcRentSuggestion", () => {
  it("returns unavailable when no suburb profile is linked", () => {
    const result = calcRentSuggestion({
      strategy: "buy_to_let",
      isSectionalTitle: false,
      bedrooms: 3,
      numUnits: 1,
      suburbProfile: null,
    });
    expect(result.available).toBe(false);
  });

  it("uses the FH 3Bed band for a buy-to-let deal with 3 bedrooms", () => {
    const result = calcRentSuggestion({
      strategy: "buy_to_let",
      isSectionalTitle: false,
      bedrooms: 3,
      numUnits: 1,
      suburbProfile: makeProfile(),
    });
    expect(result.available).toBe(true);
    expect(result.primaryEstimate).toBe(5800);
    expect(result.fallbackEstimate).toBe(5800);
    expect(result.confidence).toBe("high");
  });

  it("applies a per-room premium for multi-let strategies", () => {
    const result = calcRentSuggestion({
      strategy: "multi_let",
      isSectionalTitle: false,
      bedrooms: 3,
      numUnits: 4,
      suburbProfile: makeProfile(),
    });
    expect(result.primaryEstimate).not.toBeNull();
    expect(result.primaryEstimate!).toBeGreaterThan(result.fallbackEstimate!);
  });

  it("has no strategy-specific primary estimate for STR (no nightly data in suburb reports)", () => {
    const result = calcRentSuggestion({
      strategy: "str",
      isSectionalTitle: false,
      bedrooms: 3,
      numUnits: 1,
      suburbProfile: makeProfile(),
    });
    expect(result.primaryEstimate).toBeNull();
    expect(result.fallbackEstimate).toBe(5800);
  });

  it("downgrades confidence when the report is stale", () => {
    const staleDate = new Date();
    staleDate.setFullYear(staleDate.getFullYear() - 3);
    const result = calcRentSuggestion({
      strategy: "buy_to_let",
      isSectionalTitle: false,
      bedrooms: 3,
      numUnits: 1,
      suburbProfile: makeProfile({ reportDate: staleDate.toISOString() }),
    });
    expect(result.confidence).toBe("low");
  });

  it("computes delta vs current rent", () => {
    const result = calcRentSuggestion({
      strategy: "buy_to_let",
      isSectionalTitle: false,
      bedrooms: 3,
      numUnits: 1,
      suburbProfile: makeProfile(),
      currentMonthlyRent: 5000,
    });
    expect(result.deltaVsCurrentPct).toBeCloseTo(16, 0);
  });

  // Phase 4.4: Student's real capacity is its own room/bed structure, not
  // numUnits — a field with no defined meaning for that strategy.
  describe("student capacity", () => {
    it("uses bed capacity (calcStudentCapacity), not numUnits, for the primary estimate", () => {
      const withRealCapacity = calcRentSuggestion({
        strategy: "student",
        isSectionalTitle: false,
        bedrooms: 3,
        numUnits: 999, // deliberately unrelated — must be ignored
        studentRoomMix: { singleRoomCount: 4, sharingRoomCount: 3, sharingBedsPerRoom: 2 },
        suburbProfile: makeProfile(),
      });
      const withOnlyNumUnits = calcRentSuggestion({
        strategy: "student",
        isSectionalTitle: false,
        bedrooms: 3,
        numUnits: 999,
        suburbProfile: makeProfile(),
      });
      // 10 real beds vs. the 1-unit fallback used when no room mix is supplied.
      expect(withRealCapacity.primaryEstimate).not.toBeNull();
      expect(withOnlyNumUnits.primaryEstimate).not.toBeNull();
      expect(withRealCapacity.primaryEstimate!).toBeGreaterThan(withOnlyNumUnits.primaryEstimate!);
    });

    it("labels the estimate as bed-based, not room-based", () => {
      const result = calcRentSuggestion({
        strategy: "student",
        isSectionalTitle: false,
        bedrooms: 3,
        numUnits: 1,
        studentRoomMix: { singleRoomCount: 4, sharingRoomCount: 3, sharingBedsPerRoom: 2 },
        suburbProfile: makeProfile(),
      });
      expect(result.primaryLabel).toBe("Per-Bed Aggregate Estimate");
    });

    it("multi_let keeps using numUnits (its real per-room capacity) unaffected by the student fix", () => {
      const result = calcRentSuggestion({
        strategy: "multi_let",
        isSectionalTitle: false,
        bedrooms: 3,
        numUnits: 4,
        suburbProfile: makeProfile(),
      });
      expect(result.primaryLabel).toBe("Per-Room Aggregate Estimate");
    });
  });
});
