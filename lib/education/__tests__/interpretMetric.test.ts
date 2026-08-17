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

// Phase 4.7: Commercial lease term is a contextual fact for Break-Even
// Ratio's interpretation — never a safety judgement, and never mentioned
// for a strategy other than Commercial (context.leaseTermMonths undefined).
describe("interpretMetricValue — Break-Even Ratio lease-term context (Phase 4.7)", () => {
  it("Commercial with a recorded lease term: states the fact as context, not a verdict", () => {
    const sentence = interpretMetricValue("breakEvenRatio", 72, { leaseTermMonths: 60 })!;
    expect(sentence).toContain("60 months remaining on the recorded commercial lease");
    expect(sentence.toLowerCase()).not.toContain("safe");
    expect(sentence.toLowerCase()).not.toContain("strong");
    expect(sentence.toLowerCase()).not.toContain("low risk");
  });

  it("Commercial with no lease term recorded: says so plainly, without implying extra risk", () => {
    const sentence = interpretMetricValue("breakEvenRatio", 72, { leaseTermMonths: null })!;
    expect(sentence).toContain("No commercial lease term is currently recorded");
    expect(sentence.toLowerCase()).not.toContain("risky");
  });

  it("non-Commercial (leaseTermMonths omitted): never mentions lease term at all", () => {
    const sentence = interpretMetricValue("breakEvenRatio", 72)!;
    expect(sentence.toLowerCase()).not.toContain("lease");
    expect(sentence.toLowerCase()).not.toContain("month");
  });
});

// Phase 4.7: Utilities Ratio must read as a gross-cost ratio, reference the
// deal's own bills-included amount (never called "reimbursement" or
// "recovery"), and — when recoveries are present — explicitly refuse to net
// them against utilities (false precision AssetVerdict can't support).
describe("interpretMetricValue — Utilities Ratio gross-cost wording (Phase 4.7)", () => {
  it("gross utilities only (no recoveries context): plain gross-cost sentence, nothing invented", () => {
    const sentence = interpretMetricValue("utilitiesRatio", 18)!;
    expect(sentence.toLowerCase()).toContain("gross utility cost");
    expect(sentence.toLowerCase()).not.toContain("recover");
    expect(sentence.toLowerCase()).not.toContain("net utility exposure");
  });

  it("utilities + recoveries: names the recoveries figure without calculating a net exposure", () => {
    const sentence = interpretMetricValue("utilitiesRatio", 18, {
      utilityContext: { billsIncludedMonthly: 0, recoveriesMonthly: 7_000 },
    })!;
    expect(sentence).toContain("R7,000/month");
    expect(sentence.toLowerCase()).toContain("doesn't assume it specifically reimburses");
    expect(sentence.toLowerCase()).not.toContain("true utility cost");
    expect(sentence).not.toMatch(/R\d[\d,]*\s*-\s*R\d/); // no "utilities - recoveries" subtraction ever appears
  });

  it("bills included: references the deterministic amount, never calls it reimbursement or recovery", () => {
    const sentence = interpretMetricValue("utilitiesRatio", 18, {
      utilityContext: { billsIncludedMonthly: 2_000, recoveriesMonthly: 0 },
    })!;
    expect(sentence).toContain("R2,000/month");
    expect(sentence.toLowerCase()).toContain("bills included in the rental arrangement");
    expect(sentence.toLowerCase()).not.toContain("reimbursement");
    expect(sentence.toLowerCase()).not.toContain("recovery");
  });
});
