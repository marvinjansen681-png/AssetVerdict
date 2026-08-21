import { describe, it, expect } from "vitest";
import type { DealInputs } from "../index";
import { calcFixFlipAnalysis } from "../fixFlip";
import {
  calcFlipExitValueAnalysis,
  buildFlipSalePriceScenarioInputs,
  normalizePropertyValuationBasis,
  type FlipExitValuationInput,
  type FlipExitValueAnalysisAvailable,
} from "../fixFlipExitValue";
import { hasMeaningfulPropertyValuation } from "../../propertyValuation";
import { deriveDealVerdict } from "../verdict";
import { analyzeNegotiation, deriveNegotiationOpportunity } from "../negotiation";

const NOW = new Date("2026-08-20T00:00:00Z");

// Same fixture convention as fixFlip.test.ts.
const baseInputs: DealInputs = {
  purchasePrice: 1_000_000,
  marketValue: 0,
  askingPrice: 0,
  transferBondCost: 30_000,
  renovationCost: 200_000,
  sourcingFee: 0,
  agentCommission: 5,
  financeSources: [],
  monthlyRent: 0,
  occupancyRate: 88,
  additionalIncome: 0,
  recoveries: 0,
  managementFeeValue: 10,
  managementFeeMode: "percent",
  maintenanceCostValue: 5,
  maintenanceCostMode: "percent",
  levies: 0,
  ratesAndTaxes: 0,
  insurance: 0,
  waterSewerage: 0,
  securityCleaning: 0,
  electricity: 0,
  badDebtsPct: 2,
  incomeTaxRate: 27,
  capitalGainsTaxRate: 22,
  capitalGrowthRate: 5,
  rentalGrowthRate: 5,
  costInflation: 5,
  discountRate: 10,
  marketCapRate: 10,
  strategy: "fix_and_flip",
  numUnits: 1,
  nightlyRate: 0,
  avgOccupiedNights: 200,
  platformFeesPct: 15,
  billsIncluded: false,
  billsIncludedAmount: null,
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
  expectedSalePrice: 1_500_000,
  holdingCostPerMonth: 2_000,
  instalmentAmount: 0,
  instalmentTerm: 240,
  instalmentRate: 0,
};

const financedInputs: DealInputs = {
  ...baseInputs,
  financeSources: [{ loanAmount: 700_000, interestRate: 12, termYears: 20 }],
};

function valuation(overrides: Partial<FlipExitValuationInput>): FlipExitValuationInput {
  return {
    estimatedValue: null,
    valueConfidenceLow: null,
    valueConfidenceHigh: null,
    valuationConfidence: null,
    reportSource: null,
    reportDate: null,
    comparableCount: 0,
    ...overrides,
  };
}

function available(inputs: DealInputs, val: FlipExitValuationInput | null, now: Date = NOW): FlipExitValueAnalysisAvailable {
  const result = calcFlipExitValueAnalysis({ inputs, valuation: val, now });
  expect(result.status).toBe("available");
  return result as FlipExitValueAnalysisAvailable;
}

describe("Section 64 — no valuation", () => {
  it("Base case available; evidence no_numeric_valuation; Point/Conservative absent", () => {
    const a = available(baseInputs, null);
    expect(a.baseCase.salePrice).toBe(1_500_000);
    expect(a.evidence.status).toBe("no_numeric_valuation");
    expect(a.valuationPointCase).toBeUndefined();
    expect(a.conservativeCase).toBeUndefined();
  });

  it("also no_numeric_valuation for an all-fields-null valuation record", () => {
    const a = available(baseInputs, valuation({}));
    expect(a.evidence.status).toBe("no_numeric_valuation");
  });
});

describe("Section 65 — point estimate only", () => {
  it("expected 1.5m, estimate 1.4m: comparison +100k, point case 1.4m, no conservative", () => {
    const a = available(baseInputs, valuation({ estimatedValue: 1_400_000 }));
    expect(a.evidence.status).toBe("point_estimate_only");
    expect(a.evidence.expectedVsEstimateRand).toBeCloseTo(100_000, 6);
    expect(a.evidence.expectedVsEstimatePercent).toBeCloseTo((100_000 / 1_400_000) * 100, 6);
    expect(a.valuationPointCase?.salePrice).toBe(1_400_000);
    expect(a.valuationPointCase?.sameAsBase).toBe(false);
    expect(a.conservativeCase).toBeUndefined();
  });
});

describe("Section 66 — expected below point estimate", () => {
  it("expected 1.3m, estimate 1.4m: point case = 1.3m (never raises the user's price), sameAsBase true", () => {
    const inputs = { ...baseInputs, expectedSalePrice: 1_300_000 };
    const a = available(inputs, valuation({ estimatedValue: 1_400_000 }));
    expect(a.valuationPointCase?.salePrice).toBe(1_300_000);
    expect(a.valuationPointCase?.sameAsBase).toBe(true);
  });
});

describe("Section 67 — valid range, expected within range", () => {
  it("low 1.3m / estimate 1.4m / high 1.5m, expected 1.45m: within_range, point 1.4m, conservative 1.3m", () => {
    const inputs = { ...baseInputs, expectedSalePrice: 1_450_000 };
    const a = available(inputs, valuation({ valueConfidenceLow: 1_300_000, estimatedValue: 1_400_000, valueConfidenceHigh: 1_500_000 }));
    expect(a.evidence.status).toBe("valuation_range_available");
    expect(a.evidence.rangePosition).toBe("within_range");
    expect(a.valuationPointCase?.salePrice).toBe(1_400_000);
    expect(a.conservativeCase?.salePrice).toBe(1_300_000);
    expect(a.evidence.rangeWidthRand).toBeCloseTo(200_000, 6);
  });
});

describe("Section 68 — expected above range", () => {
  it("expected 1.7m vs range 1.3-1.5m: above_range, point 1.4m, conservative 1.3m", () => {
    const inputs = { ...baseInputs, expectedSalePrice: 1_700_000 };
    const a = available(inputs, valuation({ valueConfidenceLow: 1_300_000, estimatedValue: 1_400_000, valueConfidenceHigh: 1_500_000 }));
    expect(a.evidence.rangePosition).toBe("above_range");
    expect(a.valuationPointCase?.salePrice).toBe(1_400_000);
    expect(a.conservativeCase?.salePrice).toBe(1_300_000);
    expect(a.baseCase.salePrice).toBe(1_700_000);
  });
});

describe("Section 69 — expected below range", () => {
  it("expected 1.2m vs range 1.3-1.5m: below_range, conservative = expected, sameAsBase true", () => {
    const inputs = { ...baseInputs, expectedSalePrice: 1_200_000 };
    const a = available(inputs, valuation({ valueConfidenceLow: 1_300_000, estimatedValue: 1_400_000, valueConfidenceHigh: 1_500_000 }));
    expect(a.evidence.rangePosition).toBe("below_range");
    expect(a.conservativeCase?.salePrice).toBe(1_200_000);
    expect(a.conservativeCase?.sameAsBase).toBe(true);
  });
});

describe("Section 70 — malformed range", () => {
  it("low > estimate: invalid_valuation, no rangePosition, no Point/Conservative case, Base unaffected", () => {
    const a = available(baseInputs, valuation({ valueConfidenceLow: 1_600_000, estimatedValue: 1_400_000, valueConfidenceHigh: 1_500_000 }));
    expect(a.evidence.status).toBe("invalid_valuation");
    expect(a.evidence.rangePosition).toBeUndefined();
    expect(a.valuationPointCase).toBeUndefined();
    expect(a.conservativeCase).toBeUndefined();
    expect(a.baseCase.salePrice).toBe(1_500_000);
    expect(a.baseCase.summary.estimatedProfitBeforeTax).toBeGreaterThan(0);
  });

  it("estimate > high: also invalid_valuation", () => {
    const a = available(baseInputs, valuation({ valueConfidenceLow: 1_300_000, estimatedValue: 1_600_000, valueConfidenceHigh: 1_500_000 }));
    expect(a.evidence.status).toBe("invalid_valuation");
  });

  it("values are never silently reordered — the raw numbers are not swapped into a valid-looking range", () => {
    const a = available(baseInputs, valuation({ valueConfidenceLow: 1_600_000, estimatedValue: 1_400_000, valueConfidenceHigh: 1_500_000 }));
    expect(a.evidence.valueConfidenceLow).toBe(1_600_000);
    expect(a.evidence.estimatedValue).toBe(1_400_000);
    expect(a.evidence.valueConfidenceHigh).toBe(1_500_000);
  });
});

// ---------------------------------------------------------------------------
// Phase 4.19.1 — partial-pair ordering contradictions (sections 1, 5-9, 43-45).
// The Phase 4.19 validator only checked the full triple and the low/high
// pair; low>estimate (high missing) and estimate>high (low missing) slipped
// through undetected. Every pairwise relationship that CAN be tested must
// now be validated, and only that relationship — never a missing value,
// never an inferred one.
// ---------------------------------------------------------------------------
describe("Phase 4.19.1 — complete partial-pair ordering policy", () => {
  it("section 5 / 43A: low > estimate, high missing -> invalid_valuation, no Point/Conservative case", () => {
    const a = available(baseInputs, valuation({ valueConfidenceLow: 1_600_000, estimatedValue: 1_400_000 }));
    expect(a.evidence.status).toBe("invalid_valuation");
    expect(a.evidence.rangePosition).toBeUndefined();
    expect(a.valuationPointCase).toBeUndefined();
    expect(a.conservativeCase).toBeUndefined();
    expect(a.baseCase.salePrice).toBe(1_500_000);
  });

  it("section 6 / 43B: estimate > high, low missing -> invalid_valuation, no Point/Conservative case", () => {
    const a = available(baseInputs, valuation({ estimatedValue: 1_600_000, valueConfidenceHigh: 1_500_000 }));
    expect(a.evidence.status).toBe("invalid_valuation");
    expect(a.valuationPointCase).toBeUndefined();
    expect(a.conservativeCase).toBeUndefined();
  });

  it("section 43C: low > high, estimate missing -> invalid_valuation, no Conservative case", () => {
    const a = available(baseInputs, valuation({ valueConfidenceLow: 1_600_000, valueConfidenceHigh: 1_500_000 }));
    expect(a.evidence.status).toBe("invalid_valuation");
    expect(a.valuationPointCase).toBeUndefined();
    expect(a.conservativeCase).toBeUndefined();
  });

  it("section 45: raw values are preserved exactly for every malformed partial pair, never reordered", () => {
    const a = available(baseInputs, valuation({ valueConfidenceLow: 1_600_000, estimatedValue: 1_400_000 }));
    expect(a.evidence.valueConfidenceLow).toBe(1_600_000);
    expect(a.evidence.estimatedValue).toBe(1_400_000);
    expect(a.evidence.valueConfidenceHigh).toBeUndefined();
  });

  it("section 7 / 44: valid low + estimate (high missing) is NOT falsely invalidated — both Point and Conservative available, no rangePosition", () => {
    const a = available(baseInputs, valuation({ valueConfidenceLow: 1_300_000, estimatedValue: 1_400_000 }));
    expect(a.evidence.status).not.toBe("invalid_valuation");
    expect(a.valuationPointCase?.salePrice).toBe(1_400_000);
    expect(a.conservativeCase?.salePrice).toBe(1_300_000);
    expect(a.evidence.rangePosition).toBeUndefined();
    expect(a.evidence.rangeWidthRand).toBeUndefined();
  });

  it("section 8 / 44: valid estimate + high (low missing) is NOT falsely invalidated — Point available, Conservative absent, no rangePosition", () => {
    const a = available(baseInputs, valuation({ estimatedValue: 1_400_000, valueConfidenceHigh: 1_500_000 }));
    expect(a.evidence.status).not.toBe("invalid_valuation");
    expect(a.valuationPointCase?.salePrice).toBe(1_400_000);
    expect(a.conservativeCase).toBeUndefined();
    expect(a.evidence.rangePosition).toBeUndefined();
  });

  it("section 9: valid low + high, no estimate -> Conservative uses low, Point absent, no fabricated estimate, no expected-vs-estimate comparison", () => {
    const a = available(baseInputs, valuation({ valueConfidenceLow: 1_300_000, valueConfidenceHigh: 1_500_000 }));
    expect(a.evidence.status).not.toBe("invalid_valuation");
    expect(a.evidence.estimatedValue).toBeUndefined();
    expect(a.valuationPointCase).toBeUndefined();
    expect(a.conservativeCase?.salePrice).toBe(1_300_000);
    expect(a.evidence.expectedVsEstimateRand).toBeUndefined();
    expect(a.evidence.expectedVsEstimatePercent).toBeUndefined();
    expect(a.evidence.rangePosition).toBeUndefined();
  });
});

describe("Section 71 — lower bound only", () => {
  it("no estimate, no high, valid low: lower_bound_only, conservative uses low, no fabricated estimate, no Point case", () => {
    const a = available(baseInputs, valuation({ valueConfidenceLow: 1_300_000 }));
    expect(a.evidence.status).toBe("lower_bound_only");
    expect(a.evidence.estimatedValue).toBeUndefined();
    expect(a.valuationPointCase).toBeUndefined();
    expect(a.conservativeCase?.salePrice).toBe(1_300_000);
  });
});

describe("Section 72 — upper bound only", () => {
  it("no estimate, no low, only high: no downside scenario, no Point case", () => {
    const a = available(baseInputs, valuation({ valueConfidenceHigh: 1_500_000 }));
    expect(a.evidence.status).toBe("no_numeric_valuation");
    expect(a.valuationPointCase).toBeUndefined();
    expect(a.conservativeCase).toBeUndefined();
  });
});

describe("Section 73 — zero/negative valuation values", () => {
  it("zero and negative estimatedValue/low/high are never treated as valid", () => {
    const zero = available(baseInputs, valuation({ estimatedValue: 0, valueConfidenceLow: 0, valueConfidenceHigh: 0 }));
    expect(zero.evidence.status).toBe("no_numeric_valuation");
    const negative = available(baseInputs, valuation({ estimatedValue: -100, valueConfidenceLow: -50 }));
    expect(negative.evidence.status).toBe("no_numeric_valuation");
  });
});

describe("Section 74 — immutability", () => {
  it("never mutates the original DealInputs or the valuation record", () => {
    const inputs = { ...baseInputs, financeSources: [{ loanAmount: 700_000, interestRate: 12, termYears: 20 }] };
    const val = valuation({ valueConfidenceLow: 1_300_000, estimatedValue: 1_400_000, valueConfidenceHigh: 1_500_000 });
    const inputsSnapshot = structuredClone(inputs);
    const valSnapshot = structuredClone(val);
    calcFlipExitValueAnalysis({ inputs, valuation: val, now: NOW });
    expect(inputs).toEqual(inputsSnapshot);
    expect(val).toEqual(valSnapshot);
  });

  it("buildFlipSalePriceScenarioInputs changes only expectedSalePrice, never mutates the original", () => {
    const snapshot = structuredClone(financedInputs);
    const scenario = buildFlipSalePriceScenarioInputs(financedInputs, 1_300_000);
    expect(financedInputs).toEqual(snapshot);
    expect(scenario.expectedSalePrice).toBe(1_300_000);
    expect(scenario.purchasePrice).toBe(financedInputs.purchasePrice);
    expect(scenario.renovationCost).toBe(financedInputs.renovationCost);
    expect(scenario.financeSources).toEqual(financedInputs.financeSources);
    expect(scenario.holdingPeriodMonths).toBe(financedInputs.holdingPeriodMonths);
    expect(scenario.agentCommission).toBe(financedInputs.agentCommission);
  });
});

describe("Phase 4.20.1 — normalizePropertyValuationBasis fails closed on any untrusted input", () => {
  it("passes through the two recognised non-default literals unchanged", () => {
    expect(normalizePropertyValuationBasis("current_condition")).toBe("current_condition");
    expect(normalizePropertyValuationBasis("post_renovation")).toBe("post_renovation");
  });

  it("passes through the literal default unchanged", () => {
    expect(normalizePropertyValuationBasis("unknown")).toBe("unknown");
  });

  it("normalizes null, undefined, and any unrecognised value to 'unknown' — never fails open", () => {
    expect(normalizePropertyValuationBasis(null)).toBe("unknown");
    expect(normalizePropertyValuationBasis(undefined)).toBe("unknown");
    expect(normalizePropertyValuationBasis("")).toBe("unknown");
    expect(normalizePropertyValuationBasis("Post_Renovation")).toBe("unknown"); // case-sensitive, no fuzzy matching
    expect(normalizePropertyValuationBasis("post-renovation")).toBe("unknown"); // hyphen typo
    expect(normalizePropertyValuationBasis("foo")).toBe("unknown");
    expect(normalizePropertyValuationBasis(123)).toBe("unknown");
    expect(normalizePropertyValuationBasis(true)).toBe("unknown");
    expect(normalizePropertyValuationBasis({})).toBe("unknown");
  });
});

describe("Section 75 — scenarios reuse the existing Flip engine exactly", () => {
  it("Point Case and Conservative Case summaries equal a direct calcFixFlipAnalysis call at the same sale price", () => {
    const inputs = { ...financedInputs, expectedSalePrice: 1_700_000 };
    const val = valuation({ valueConfidenceLow: 1_300_000, estimatedValue: 1_400_000, valueConfidenceHigh: 1_500_000 });
    const a = available(inputs, val);

    const directPoint = calcFixFlipAnalysis(buildFlipSalePriceScenarioInputs(inputs, 1_400_000));
    const directConservative = calcFixFlipAnalysis(buildFlipSalePriceScenarioInputs(inputs, 1_300_000));
    expect(directPoint.status).toBe("available");
    expect(directConservative.status).toBe("available");
    if (directPoint.status === "available" && directConservative.status === "available") {
      expect(a.valuationPointCase?.summary.estimatedProfitBeforeTax).toBeCloseTo(directPoint.profitability.estimatedProfitBeforeTax, 6);
      expect(a.valuationPointCase?.summary.equityIRR).toBeCloseTo(directPoint.profitability.equityIRR!, 6);
      expect(a.conservativeCase?.summary.estimatedProfitBeforeTax).toBeCloseTo(directConservative.profitability.estimatedProfitBeforeTax, 6);
      expect(a.conservativeCase?.summary.salePriceBufferPercent).toBeCloseTo(directConservative.breakEven.salePriceBufferPercent!, 6);
    }
  });
});

describe("Section 76-77 — conservative survival", () => {
  it("Base and Conservative both profitable: survivesConservativeCase = true", () => {
    // Break-even for baseInputs is ~R1,351,466 — a low bound of 1.38m stays above it.
    const a = available(baseInputs, valuation({ valueConfidenceLow: 1_380_000, estimatedValue: 1_400_000, valueConfidenceHigh: 1_500_000 }));
    expect(a.baseCase.summary.viability).toBe("profitable");
    expect(a.conservativeCase?.summary.viability).toBe("profitable");
    expect(a.conservativeCase?.survivesConservativeCase).toBe(true);
  });

  it("Base profitable but Conservative loses money: survivesConservativeCase = false", () => {
    // Total cost basis is well above 1.0m — a conservative sale price near cost forces a loss.
    const a = available(baseInputs, valuation({ valueConfidenceLow: 1_100_000, estimatedValue: 1_400_000, valueConfidenceHigh: 1_500_000 }));
    expect(a.baseCase.summary.viability).toBe("profitable");
    expect(a.conservativeCase?.summary.viability).toBe("break_even_or_loss");
    expect(a.conservativeCase?.survivesConservativeCase).toBe(false);
  });
});

describe("Section 78-79 — conservative target survival, kept distinct from profit survival", () => {
  it("Conservative profitable but Equity IRR below Required Return: survives=true, meetsRequiredReturn=false", () => {
    // A cash deal's Equity IRR at a thin conservative margin/short hold can
    // still clear 0% but fall short of a high Required Return.
    const inputs = { ...baseInputs, discountRate: 60 };
    const a = available(inputs, valuation({ valueConfidenceLow: 1_380_000, estimatedValue: 1_400_000, valueConfidenceHigh: 1_500_000 }));
    expect(a.conservativeCase?.survivesConservativeCase).toBe(true);
    expect(a.conservativeCase?.meetsRequiredReturnInConservativeCase).toBe(false);
  });

  it("Conservative profitable and target met: both true", () => {
    const inputs = { ...baseInputs, discountRate: 5 };
    const a = available(inputs, valuation({ valueConfidenceLow: 1_380_000, estimatedValue: 1_400_000, valueConfidenceHigh: 1_500_000 }));
    expect(a.conservativeCase?.survivesConservativeCase).toBe(true);
    expect(a.conservativeCase?.meetsRequiredReturnInConservativeCase).toBe(true);
  });
});

describe("Section 80 — base target miss has no effect elsewhere", () => {
  it("Base targetState missed does not block evidence/scenario computation", () => {
    const inputs = { ...baseInputs, discountRate: 500 };
    const a = available(inputs, valuation({ estimatedValue: 1_400_000 }));
    expect(a.baseCase.summary.targetState).toBe("missed");
    expect(a.evidence.status).toBe("point_estimate_only");
    expect(a.valuationPointCase).toBeDefined();
  });
});

describe("Section 81 — source/date carried through exactly", () => {
  it("reportSource and reportDate are exactly what was recorded, never invented", () => {
    const reportDate = new Date("2026-05-12T00:00:00Z");
    const a = available(baseInputs, valuation({ estimatedValue: 1_400_000, reportSource: "TPN Property Valuation Report", reportDate }));
    expect(a.evidence.reportSource).toBe("TPN Property Valuation Report");
    expect(a.evidence.reportDate).toBe(reportDate);
    expect(a.evidence.valuationAgeDays).toBe(100); // 12 May 2026 -> 20 Aug 2026
  });

  it("no source recorded stays null, never defaults to a named provider", () => {
    const a = available(baseInputs, valuation({ estimatedValue: 1_400_000 }));
    expect(a.evidence.reportSource).toBeNull();
  });
});

describe("Section 82 — confidence label never creates a numeric range", () => {
  it("valuationConfidence 'High' with no low/high: no Conservative Case, no invented numbers", () => {
    const a = available(baseInputs, valuation({ estimatedValue: 1_400_000, valuationConfidence: "High" }));
    expect(a.evidence.valuationConfidence).toBe("High");
    expect(a.conservativeCase).toBeUndefined();
    expect(a.evidence.status).toBe("point_estimate_only");
  });
});

describe("Section 83 — comparables alone create no numeric scenario", () => {
  it("comparableCount > 0 with no numeric fields: context only, no Point/Conservative case", () => {
    const a = available(baseInputs, valuation({ comparableCount: 4 }));
    expect(a.evidence.comparableCount).toBe(4);
    expect(a.evidence.status).toBe("no_numeric_valuation");
    expect(a.valuationPointCase).toBeUndefined();
    expect(a.conservativeCase).toBeUndefined();
  });
});

describe("Section 84-85 — dedicated evidence model is stricter than hasMeaningfulPropertyValuation()", () => {
  it("a bond/comparable-only record passes the old broad helper but yields no numeric Flip evidence here", () => {
    const broadRecord = {
      estimatedValue: null,
      valueConfidenceLow: null,
      valueConfidenceHigh: null,
      valuationConfidence: null,
      pricePerSqm: null,
      comparables: [{ id: "c1" }],
      transactions: [],
      bonds: [{ id: "b1" }],
    } as unknown as Parameters<typeof hasMeaningfulPropertyValuation>[0];

    expect(hasMeaningfulPropertyValuation(broadRecord)).toBe(true);

    const a = available(baseInputs, valuation({ comparableCount: 1 }));
    expect(a.evidence.status).toBe("no_numeric_valuation");
  });
});

describe("Section 86-87 (Phase 4.19) superseded by Phase 4.20 — Fix & Flip verdict is now active; Promising If Negotiated remains untouched", () => {
  it("deriveDealVerdict is now active for fix_and_flip, and DOES use exit-value evidence when supplied — see flipVerdict.test.ts for the full policy suite", async () => {
    const { calcAllMetrics } = await import("../index");
    const metrics = calcAllMetrics(baseInputs);
    // No flipExitValueAnalysis supplied -> Promising at best.
    const withoutEvidence = deriveDealVerdict({ strategyId: "fix_and_flip", inputs: baseInputs, metrics });
    expect(withoutEvidence.status).toBe("available");
    if (withoutEvidence.status === "available") expect(withoutEvidence.verdict).not.toBe("strong");

    // A valid post-renovation exit-value analysis with a profitable
    // Conservative Case unlocks Strong for this same deal.
    const flipExitValueAnalysis = available(
      baseInputs,
      valuation({ valueConfidenceLow: 1_380_000, estimatedValue: 1_400_000, valueConfidenceHigh: 1_500_000, valuationBasis: "post_renovation" })
    );
    const withEvidence = deriveDealVerdict({ strategyId: "fix_and_flip", inputs: baseInputs, metrics, flipExitValueAnalysis });
    expect(withEvidence.status).toBe("available");
    if (withEvidence.status === "available") expect(withEvidence.verdict).toBe("strong");
  });

  it("Negotiation Opportunity is still unavailable for fix_and_flip", async () => {
    const { calcAllMetrics } = await import("../index");
    const currentVerdict = deriveDealVerdict({ strategyId: "fix_and_flip", inputs: baseInputs, metrics: calcAllMetrics(baseInputs) });
    const negotiationAnalysis = analyzeNegotiation(baseInputs, "fix_and_flip");
    const opportunity = deriveNegotiationOpportunity(currentVerdict, negotiationAnalysis);
    expect(opportunity.status).not.toBe("promising_if_negotiated");
  });
});

describe("Section 90-91 — financing and break-even regression", () => {
  it("scenario sale-price substitution never alters loan amount, rate, term, or holding period", () => {
    const inputs = { ...financedInputs, expectedSalePrice: 1_700_000 };
    const scenario = buildFlipSalePriceScenarioInputs(inputs, 1_300_000);
    expect(scenario.financeSources).toEqual(inputs.financeSources);
    expect(scenario.holdingPeriodMonths).toBe(inputs.holdingPeriodMonths);
  });

  it("Break-Even Sale Price is identical across Base/Point/Conservative — it depends on fixed costs, not the substituted sale price", () => {
    const inputs = { ...financedInputs, expectedSalePrice: 1_700_000 };
    const a = available(inputs, valuation({ valueConfidenceLow: 1_300_000, estimatedValue: 1_400_000, valueConfidenceHigh: 1_500_000 }));
    // Compared within the break-even solver's own documented tolerance
    // (BREAK_EVEN_TOLERANCE = R1 in fixFlip.ts) rather than exact equality —
    // the binary search's final iteration can differ by up to that
    // tolerance depending on the search bound, which itself is seeded from
    // each scenario's own (different) sale price.
    const be = a.baseCase.summary.breakEvenSalePrice!;
    expect(Math.abs(a.valuationPointCase!.summary.breakEvenSalePrice! - be)).toBeLessThan(1);
    expect(Math.abs(a.conservativeCase!.summary.breakEvenSalePrice! - be)).toBeLessThan(1);
  });
});

describe("Unavailable propagation", () => {
  it("mirrors calcFixFlipAnalysis's own unavailable reason when holding period is invalid", () => {
    const inputs = { ...baseInputs, holdingPeriodMonths: 0 };
    const result = calcFlipExitValueAnalysis({ inputs, valuation: valuation({ estimatedValue: 1_400_000 }), now: NOW });
    expect(result).toEqual({ status: "unavailable", reason: "invalid_holding_period" });
  });
});

// ---------------------------------------------------------------------------
// Phase 4.19.1 — valuation basis (sections 11-13, 40-42, 46-47). The current
// PropertyValuation model has no field recording whether a valuation
// reflects current condition or post-renovation condition, so this must
// always read "unknown" — never inferred from source, strategy, or any
// other field — and unknown basis must never block a scenario or change a
// financial figure.
// ---------------------------------------------------------------------------
describe("Phase 4.19.1 — valuation basis is always 'unknown', never inferred", () => {
  it("section 40: basis is 'unknown' for a full valid range", () => {
    const a = available(baseInputs, valuation({ valueConfidenceLow: 1_300_000, estimatedValue: 1_400_000, valueConfidenceHigh: 1_500_000 }));
    expect(a.evidence.valuationBasis).toBe("unknown");
  });

  it("section 46: basis is 'unknown' even with no valuation recorded at all", () => {
    const a = available(baseInputs, null);
    expect(a.evidence.status).toBe("no_numeric_valuation");
    expect(a.evidence.valuationBasis).toBe("unknown");
  });

  it("section 47: basis is 'unknown' for a comparables/bonds-only record with no numeric evidence", () => {
    const a = available(baseInputs, valuation({ comparableCount: 3 }));
    expect(a.evidence.status).toBe("no_numeric_valuation");
    expect(a.evidence.valuationBasis).toBe("unknown");
  });

  it("basis is 'unknown' regardless of reportSource — never inferred from a named provider (e.g. TPN)", () => {
    const a = available(baseInputs, valuation({ estimatedValue: 1_400_000, reportSource: "TPN Property Valuation Report" }));
    expect(a.evidence.valuationBasis).toBe("unknown");
  });

  it("section 41: unknown basis does not block the Point or Conservative scenarios", () => {
    const a = available(baseInputs, valuation({ valueConfidenceLow: 1_380_000, estimatedValue: 1_400_000, valueConfidenceHigh: 1_500_000 }));
    expect(a.evidence.valuationBasis).toBe("unknown");
    expect(a.valuationPointCase).toBeDefined();
    expect(a.conservativeCase).toBeDefined();
  });

  it("section 42: unknown basis does not change any scenario financial result versus an identical valuation with basis unspecified", () => {
    const val = valuation({ valueConfidenceLow: 1_380_000, estimatedValue: 1_400_000, valueConfidenceHigh: 1_500_000 });
    const a1 = available(baseInputs, val);
    const a2 = available(baseInputs, val);
    expect(a1.conservativeCase?.summary).toEqual(a2.conservativeCase?.summary);
    expect(a1.valuationPointCase?.summary).toEqual(a2.valuationPointCase?.summary);
    expect(a1.baseCase.summary).toEqual(a2.baseCase.summary);
  });
});
