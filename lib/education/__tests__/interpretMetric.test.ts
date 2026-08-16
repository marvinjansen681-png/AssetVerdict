import { describe, it, expect } from "vitest";
import { interpretMetricValue } from "../interpretMetric";

// Phase 4.4, sections 8-10 & 28: a no-planned-sale deal must never be
// described as if the user plans to sell in Year 20 — it's AssetVerdict's
// own analysis-horizon default, not the user's stated plan.
describe("interpretMetricValue — IRR hold-period wording", () => {
  it("no planned sale: describes a 20-year analysis horizon, never a sale prediction", () => {
    const sentence = interpretMetricValue("irr", 12.5, { holdPeriodYears: 20, isPlannedSale: false })!;
    expect(sentence).toContain("20-year analysis horizon");
    expect(sentence.toLowerCase()).not.toContain("sale in year 20");
    expect(sentence.toLowerCase()).not.toMatch(/you (will )?sell in year/);
  });

  it("planned sale: names the user's own assumed year explicitly", () => {
    const sentence = interpretMetricValue("irr", 9.3, { holdPeriodYears: 7, isPlannedSale: true })!;
    expect(sentence).toContain("Year 7");
    expect(sentence).toContain("your assumed 7-year hold");
  });

  it("planned sale at year 12 names year 12, not the 20-year default", () => {
    const sentence = interpretMetricValue("irr", 9.5, { holdPeriodYears: 12, isPlannedSale: true })!;
    expect(sentence).toContain("Year 12");
    expect(sentence).not.toContain("20-year");
  });

  it("defaults to the 20-year analysis-horizon wording when no context is supplied", () => {
    const sentence = interpretMetricValue("irr", 10)!;
    expect(sentence).toContain("20-year analysis horizon");
  });
});
