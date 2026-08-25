import { describe, it, expect } from "vitest";
import { calcTransferDuty } from "../transferDuty";

// South African transfer duty table, effective 1 April 2025 (Phase 4.21) —
// see transferDuty.ts's own doc comment for source. These tests pin the
// exact bracket boundaries and representative values so the old
// R1,100,000-threshold table can never silently return.

describe("calcTransferDuty — Phase 4.21 table (effective 1 April 2025)", () => {
  it("R0 purchase price returns zero duty", () => {
    expect(calcTransferDuty(0).dutyAmount).toBe(0);
  });

  describe("boundary values", () => {
    it("R1,210,000 (top of the 0% bracket) — R0 duty", () => {
      expect(calcTransferDuty(1_210_000).dutyAmount).toBeCloseTo(0, 2);
    });

    it("R1,210,001 (first Rand of the 3% bracket) — ~R0.03 duty", () => {
      expect(calcTransferDuty(1_210_001).dutyAmount).toBeCloseTo(0.03, 2);
    });

    it("R1,663,800 (top of the 3% bracket) — R13,614 duty", () => {
      expect(calcTransferDuty(1_663_800).dutyAmount).toBeCloseTo(13_614, 2);
    });

    it("R2,329,300 (top of the 6% bracket) — R53,544 duty", () => {
      expect(calcTransferDuty(2_329_300).dutyAmount).toBeCloseTo(53_544, 2);
    });

    it("R2,994,800 (top of the 8% bracket) — R106,784 duty", () => {
      expect(calcTransferDuty(2_994_800).dutyAmount).toBeCloseTo(106_784, 2);
    });

    it("R13,310,000 (top of the 11% bracket) — R1,241,456 duty", () => {
      expect(calcTransferDuty(13_310_000).dutyAmount).toBeCloseTo(1_241_456, 2);
    });

    it("R13,310,001 (first Rand of the 13% bracket) — ~R1,241,456.13 duty", () => {
      expect(calcTransferDuty(13_310_001).dutyAmount).toBeCloseTo(1_241_456.13, 2);
    });
  });

  describe("representative values", () => {
    it("R1,500,000 -> R8,700", () => {
      expect(calcTransferDuty(1_500_000).dutyAmount).toBeCloseTo(8_700, 2);
    });

    it("R2,000,000 -> R33,786", () => {
      expect(calcTransferDuty(2_000_000).dutyAmount).toBeCloseTo(33_786, 2);
    });

    it("R5,000,000 -> R327,356", () => {
      expect(calcTransferDuty(5_000_000).dutyAmount).toBeCloseTo(327_356, 2);
    });
  });

  it("bracket rate/label reflect the new R1,210,000 entry threshold, not the old R1,100,000 one", () => {
    const result = calcTransferDuty(1_150_000);
    expect(result.dutyAmount).toBe(0);
    expect(result.bracketRate).toBe(0);
    expect(result.bracketLabel.replace(/\s/g, "")).toContain("1210000");
    expect(result.bracketLabel.replace(/\s/g, "")).not.toContain("1100000");
  });

  it("marginal rate is monotonically non-decreasing across brackets", () => {
    const prices = [500_000, 1_400_000, 2_000_000, 2_700_000, 4_000_000, 15_000_000];
    const rates = prices.map((p) => calcTransferDuty(p).bracketRate);
    for (let i = 1; i < rates.length; i++) {
      expect(rates[i]).toBeGreaterThanOrEqual(rates[i - 1]);
    }
  });
});
