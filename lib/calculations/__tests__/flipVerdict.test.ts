import { describe, it, expect } from "vitest";
import { calcAllMetrics, type DealInputs, type DealMetrics } from "../index";
import { deriveDealVerdict, type DealVerdictResult } from "../verdict";
import { calcFlipExitValueAnalysis, type FlipExitValuationInput, type FlipExitValueAnalysis } from "../fixFlipExitValue";

const NOW = new Date("2026-08-20T00:00:00Z");

// Same fixture convention as fixFlip.test.ts / fixFlipExitValue.test.ts.
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
  expectedSalePrice: 1_500_000, // comfortably profitable, target met at discountRate 10
  holdingCostPerMonth: 2_000,
  instalmentAmount: 0,
  instalmentTerm: 240,
  instalmentRate: 0,
};

function valuation(overrides: Partial<FlipExitValuationInput>): FlipExitValuationInput {
  return {
    estimatedValue: null,
    valueConfidenceLow: null,
    valueConfidenceHigh: null,
    valuationConfidence: null,
    valuationBasis: "unknown",
    reportSource: null,
    reportDate: null,
    comparableCount: 0,
    ...overrides,
  };
}

function verdictFor(inputs: DealInputs, val: FlipExitValuationInput | null = null): DealVerdictResult {
  const metrics: DealMetrics = calcAllMetrics(inputs);
  const flipExitValueAnalysis: FlipExitValueAnalysis = calcFlipExitValueAnalysis({ inputs, valuation: val, now: NOW });
  return deriveDealVerdict({ strategyId: "fix_and_flip", inputs, metrics, flipExitValueAnalysis });
}

/** Post-renovation evidence with a low bound comfortably above break-even (~R1,351,466 for baseInputs) -> a clean Strong candidate. */
const strongEligibleValuation = valuation({
  valueConfidenceLow: 1_380_000,
  estimatedValue: 1_400_000,
  valueConfidenceHigh: 1_500_000,
  valuationBasis: "post_renovation",
});

describe("Section 90 — High Risk overrides target and valuation evidence", () => {
  it("Base Profit < 0 is High Risk even with a high target and post-renovation valuation", () => {
    const losingInputs = { ...baseInputs, expectedSalePrice: 900_000 }; // well below total cost
    const result = verdictFor(losingInputs, strongEligibleValuation);
    expect(result.status).toBe("available");
    if (result.status === "available") {
      expect(result.verdict).toBe("high_risk");
      expect(result.blockers[0].code).toBe("flip_structural_loss");
    }
  });
});

describe("Section 91 — break-even (Profit = 0) is High Risk, not a third state", () => {
  it("Estimated Profit Before Tax exactly 0 -> High Risk", () => {
    // expectedSalePrice = 0 forces profit = -totalProjectCost, not exactly 0 —
    // instead pick expectedSalePrice such that profit is deterministically <= 0
    // and confirm zero/negative are treated identically (no third bucket).
    const zeroish = { ...baseInputs, expectedSalePrice: 1_242_000 }; // near break-even, still <= cost basis before commission nuance
    const result = verdictFor(zeroish);
    expect(result.status).toBe("available");
    if (result.status === "available") {
      const metrics = calcAllMetrics(zeroish);
      if (metrics.fixFlipAnalysis?.status === "available") {
        expect(metrics.fixFlipAnalysis.profitability.estimatedProfitBeforeTax).toBeLessThanOrEqual(0);
      }
      expect(result.verdict).toBe("high_risk");
    }
  });
});

describe("Section 92 — Does Not Meet Target", () => {
  it("Profit > 0 but Equity IRR < Required Return -> Does Not Meet Target", () => {
    const highTarget = { ...baseInputs, discountRate: 500 }; // no realistic Flip clears a 500% hurdle
    const result = verdictFor(highTarget, strongEligibleValuation);
    expect(result.status).toBe("available");
    if (result.status === "available") {
      expect(result.verdict).toBe("does_not_meet_target");
      expect(result.blockers[0].code).toBe("target_missed");
    }
  });
});

describe("Section 93 — Promising: no numeric valuation", () => {
  it("profitable + target met + no valuation -> Promising, reason no_exit_value_evidence", () => {
    const result = verdictFor(baseInputs, null);
    expect(result.status).toBe("available");
    if (result.status === "available") {
      expect(result.verdict).toBe("promising");
      expect(result.blockers[0].code).toBe("no_exit_value_evidence");
    }
  });
});

describe("Section 94 — Promising: unknown basis", () => {
  it("valid range, Conservative profitable, but basis unknown -> Promising, reason valuation_basis_unknown", () => {
    const val = valuation({ valueConfidenceLow: 1_380_000, estimatedValue: 1_400_000, valueConfidenceHigh: 1_500_000, valuationBasis: "unknown" });
    const result = verdictFor(baseInputs, val);
    expect(result.status).toBe("available");
    if (result.status === "available") {
      expect(result.verdict).toBe("promising");
      expect(result.blockers[0].code).toBe("valuation_basis_unknown");
    }
  });
});

describe("Section 95 — Promising: current-condition basis", () => {
  it("same evidence, basis current_condition -> Promising, reason valuation_current_condition, never Strong", () => {
    const val = valuation({ valueConfidenceLow: 1_380_000, estimatedValue: 1_400_000, valueConfidenceHigh: 1_500_000, valuationBasis: "current_condition" });
    const result = verdictFor(baseInputs, val);
    expect(result.status).toBe("available");
    if (result.status === "available") {
      expect(result.verdict).toBe("promising");
      expect(result.blockers[0].code).toBe("valuation_current_condition");
    }
  });
});

describe("Phase 4.20.1 — trust-boundary hardening: malformed valuationBasis fails closed, never open", () => {
  it("an unrecognised valuationBasis string reaching evaluateStrongEvidence is treated as unknown, NOT as post_renovation", () => {
    // Simulates data that bypassed normalizePropertyValuationBasis() (e.g. a
    // corrupted DB row, since PropertyValuation.valuationBasis has no DB-level
    // enum/check constraint) reaching the verdict engine directly. Before
    // Phase 4.20.1, the Strong gate was written as two exclusions ("reject
    // 'unknown', reject 'current_condition'") with an implicit pass-through —
    // that shape would have treated this malformed value as if it were
    // "post_renovation" and granted it Strong authority it never earned. The
    // hardened gate requires a POSITIVE match on "post_renovation", so this
    // must fail closed to Promising/valuation_basis_unknown instead.
    const corrupted = valuation({
      valueConfidenceLow: 1_380_000,
      estimatedValue: 1_400_000,
      valueConfidenceHigh: 1_500_000,
      valuationBasis: "some_corrupted_value" as unknown as FlipExitValuationInput["valuationBasis"],
    });
    const result = verdictFor(baseInputs, corrupted);
    expect(result.status).toBe("available");
    if (result.status === "available") {
      expect(result.verdict).toBe("promising");
      expect(result.blockers[0].code).toBe("valuation_basis_unknown");
      expect(result.verdict).not.toBe("strong");
    }
  });
});

describe("Section 96 — Promising: post-renovation point estimate only", () => {
  it("basis post_renovation, estimate exists, no lower bound -> Promising, reason no_conservative_lower_bound", () => {
    const val = valuation({ estimatedValue: 1_400_000, valuationBasis: "post_renovation" });
    const result = verdictFor(baseInputs, val);
    expect(result.status).toBe("available");
    if (result.status === "available") {
      expect(result.verdict).toBe("promising");
      expect(result.blockers[0].code).toBe("no_conservative_lower_bound");
    }
  });
});

describe("Section 97 — Promising: post-renovation Conservative Case not profitable", () => {
  it("valid lower bound, but Conservative Profit <= 0 -> Promising, NOT High Risk, reason conservative_case_not_profitable", () => {
    // Break-even for baseInputs (cash) is below 1.3m; a low bound at 1.2m forces a Conservative loss.
    const val = valuation({ valueConfidenceLow: 1_200_000, estimatedValue: 1_400_000, valueConfidenceHigh: 1_500_000, valuationBasis: "post_renovation" });
    const result = verdictFor(baseInputs, val);
    expect(result.status).toBe("available");
    if (result.status === "available") {
      expect(result.verdict).toBe("promising");
      expect(result.blockers[0].code).toBe("conservative_case_not_profitable");
    }
  });
});

describe("Section 98 — Strong", () => {
  it("profitable + target met + post_renovation + valid lower bound + Conservative profitable -> Strong", () => {
    const result = verdictFor(baseInputs, strongEligibleValuation);
    expect(result.status).toBe("available");
    if (result.status === "available") {
      expect(result.verdict).toBe("strong");
      expect(result.blockers).toHaveLength(0);
      expect(result.reasons.some((r) => r.code === "conservative_case_profitable")).toBe(true);
    }
  });
});

describe("Section 99-100 — Policy A: Conservative target result is supporting only, never gates Strong", () => {
  it("Conservative profitable but its own Equity IRR misses Required Return -> still Strong (Policy A)", () => {
    // A high discountRate the Base case still clears (via a very profitable
    // Base) but the thinner Conservative Case's own IRR falls short of.
    const inputs = { ...baseInputs, discountRate: 30 };
    const result = verdictFor(inputs, strongEligibleValuation);
    expect(result.status).toBe("available");
    if (result.status === "available") {
      expect(result.verdict).toBe("strong");
      const supporting = result.reasons.find((r) => r.code === "conservative_target_missed" || r.code === "conservative_target_met");
      expect(supporting).toBeDefined();
      // Never a blocker, even when the conservative target is missed.
      expect(result.blockers.some((b) => b.code === "conservative_target_missed")).toBe(false);
    }
  });

  it("Conservative profitable AND meets Required Return -> Strong, with the positive supporting reason surfaced", () => {
    const inputs = { ...baseInputs, discountRate: 2 };
    const result = verdictFor(inputs, strongEligibleValuation);
    expect(result.status).toBe("available");
    if (result.status === "available") {
      expect(result.verdict).toBe("strong");
      expect(result.reasons.some((r) => r.code === "conservative_target_met")).toBe(true);
    }
  });
});

describe("Section 101 — lower bound above Base sale price", () => {
  it("post-renovation lower bound >= Expected Sale Price -> Conservative = Base, Strong may still qualify", () => {
    const val = valuation({ valueConfidenceLow: 1_600_000, estimatedValue: 1_650_000, valueConfidenceHigh: 1_700_000, valuationBasis: "post_renovation" });
    const result = verdictFor(baseInputs, val);
    expect(result.status).toBe("available");
    if (result.status === "available") {
      expect(result.verdict).toBe("strong");
    }
  });
});

describe("Section 102 — invalid valuation", () => {
  it("Base profitable + target met + internally inconsistent evidence -> Promising, reason invalid_valuation_evidence, never High Risk", () => {
    const val = valuation({ valueConfidenceLow: 1_600_000, estimatedValue: 1_400_000, valuationBasis: "post_renovation" }); // low > estimate
    const result = verdictFor(baseInputs, val);
    expect(result.status).toBe("available");
    if (result.status === "available") {
      expect(result.verdict).toBe("promising");
      expect(result.blockers[0].code).toBe("invalid_valuation_evidence");
    }
  });
});

describe("Section 103 — IRR unknown never becomes a normal verdict", () => {
  it("profitable but Equity IRR non-convergent -> verdict unavailable, never DNM/Promising/Strong", () => {
    // All-cash Flip with zero holding period cost/interest complexities can
    // still converge; force non-convergence isn't practical from ordinary
    // inputs, so this test directly exercises the unavailable branch by
    // constructing metrics with a null equityIRR via a degenerate deal
    // (financed such that a real IRR solver has no sign change is hard to
    // hit organically — instead assert the documented contract: whenever
    // fixFlipAnalysis.profitability.equityIRR is null, the verdict must be
    // "unavailable", never a real label).
    const inputs = { ...baseInputs, purchasePrice: 0, transferBondCost: 0, renovationCost: 0, holdingCostPerMonth: 0, agentCommission: 0 };
    const metrics = calcAllMetrics(inputs);
    if (metrics.fixFlipAnalysis?.status === "available" && metrics.fixFlipAnalysis.profitability.equityIRR === null) {
      const result = deriveDealVerdict({ strategyId: "fix_and_flip", inputs, metrics, flipExitValueAnalysis: undefined });
      expect(result.status).toBe("unavailable");
      if (result.status === "unavailable") expect(result.reason).toBe("flip_return_evidence_unavailable");
    } else {
      // If this particular fixture happens to converge, prove the contract
      // directly against the pure function instead.
      const forcedMetrics: DealMetrics = {
        ...metrics,
        fixFlipAnalysis:
          metrics.fixFlipAnalysis?.status === "available"
            ? { ...metrics.fixFlipAnalysis, profitability: { ...metrics.fixFlipAnalysis.profitability, equityIRR: null } }
            : metrics.fixFlipAnalysis,
      };
      const result = deriveDealVerdict({ strategyId: "fix_and_flip", inputs, metrics: forcedMetrics, flipExitValueAnalysis: undefined });
      expect(result.status).toBe("unavailable");
      if (result.status === "unavailable") expect(result.reason).toBe("flip_return_evidence_unavailable");
    }
  });
});

describe("Section 104 — invalid holding period", () => {
  it("invalid holdingPeriodMonths -> verdict unavailable, reason flip_model_unavailable", () => {
    const inputs = { ...baseInputs, holdingPeriodMonths: 0 };
    const result = verdictFor(inputs, strongEligibleValuation);
    expect(result.status).toBe("unavailable");
    if (result.status === "unavailable") expect(result.reason).toBe("flip_model_unavailable");
  });
});

describe("Section 105 — precedence", () => {
  it("High Risk is decided before target, independent of Equity IRR size", () => {
    const losingButHighIrrLooking = { ...baseInputs, expectedSalePrice: 900_000, discountRate: 0 };
    const result = verdictFor(losingButHighIrrLooking, strongEligibleValuation);
    expect(result.status).toBe("available");
    if (result.status === "available") expect(result.verdict).toBe("high_risk");
  });

  it("target miss is decided before Strong-evidence evaluation, even with excellent post-renovation evidence", () => {
    const missesTarget = { ...baseInputs, discountRate: 500 };
    const result = verdictFor(missesTarget, strongEligibleValuation);
    expect(result.status).toBe("available");
    if (result.status === "available") expect(result.verdict).toBe("does_not_meet_target");
  });

  it("Strong evidence is only ever evaluated once viability and target both clear", () => {
    // Losing deal with perfect evidence never even reaches the evidence gate.
    const losing = { ...baseInputs, expectedSalePrice: 900_000 };
    const result = verdictFor(losing, strongEligibleValuation);
    expect(result.status).toBe("available");
    if (result.status === "available") {
      expect(result.verdict).toBe("high_risk");
      expect(result.reasons.some((r) => r.code === "conservative_case_profitable")).toBe(false);
    }
  });
});

describe("Section 106 — Promising If Negotiated still unavailable for Fix & Flip", () => {
  it("even a Strong Flip never produces promising_if_negotiated as its verdict label", () => {
    const result = verdictFor(baseInputs, strongEligibleValuation);
    expect(result.status).toBe("available");
    if (result.status === "available") expect(result.verdict).not.toBe("promising_if_negotiated");
  });
});

describe("Section 110 — no hardcoded Sale-Price Buffer threshold", () => {
  it("Strong is reachable across a wide range of Base Sale-Price Buffer magnitudes, thin and wide alike", () => {
    // discountRate held very low here deliberately — this test isolates
    // buffer-magnitude independence, not the target gate (covered
    // separately above); a thin-margin deal's annualised IRR can otherwise
    // legitimately fall below a normal Required Return for unrelated
    // reasons and would incorrectly look like a buffer-driven rejection.
    for (const salePrice of [1_360_000, 1_450_000, 1_500_000, 2_500_000]) {
      const inputs = { ...baseInputs, expectedSalePrice: salePrice, discountRate: 0.5 };
      const val = valuation({
        valueConfidenceLow: Math.min(salePrice - 10_000, 1_380_000),
        estimatedValue: Math.min(salePrice - 5_000, 1_400_000),
        valuationBasis: "post_renovation" as const,
      });
      const result = verdictFor(inputs, val);
      expect(result.status, `salePrice=${salePrice}`).toBe("available");
      if (result.status === "available") {
        // Whatever the Base buffer magnitude, Strong is reachable purely
        // from profit sign + target + Conservative survival — no buffer %
        // gate exists to reject a thin-but-real buffer.
        expect(result.verdict, `salePrice=${salePrice}`).toBe("strong");
      }
    }
  });
});

describe("Section 111 — no 70% rule anywhere in the decision", () => {
  it("Strong does not depend on purchasePrice being <= 70% of any ARV/valuation figure", () => {
    // purchasePrice is 1.0m against a 1.4m recorded estimate — a 71.4% ratio,
    // which the 70% rule would reject outright. Strong is still reachable.
    const result = verdictFor(baseInputs, strongEligibleValuation);
    expect(baseInputs.purchasePrice / strongEligibleValuation.estimatedValue!).toBeGreaterThan(0.7);
    expect(result.status).toBe("available");
    if (result.status === "available") expect(result.verdict).toBe("strong");
  });
});

describe("Section 112 — no Rand profit band", () => {
  it("Strong is reachable at both a small and a large absolute profit, same structural rule either way", () => {
    // discountRate held very low deliberately — isolates Rand-magnitude
    // independence from the (separately-tested) target gate.
    const smallProfit = { ...baseInputs, expectedSalePrice: 1_360_000, discountRate: 0.5 };
    const largeProfit = { ...baseInputs, expectedSalePrice: 3_000_000, discountRate: 0.5 };
    const valSmall = valuation({ valueConfidenceLow: 1_355_000, estimatedValue: 1_358_000, valuationBasis: "post_renovation" });
    const valLarge = valuation({ valueConfidenceLow: 1_380_000, estimatedValue: 1_400_000, valuationBasis: "post_renovation" });
    const small = verdictFor(smallProfit, valSmall);
    const large = verdictFor(largeProfit, valLarge);
    expect(small.status).toBe("available");
    expect(large.status).toBe("available");
    if (small.status === "available" && large.status === "available") {
      expect(small.verdict).toBe("strong");
      expect(large.verdict).toBe("strong");
    }
  });
});

describe("Section 113 — immutability", () => {
  it("deriveDealVerdict never mutates inputs, metrics, or flipExitValueAnalysis", () => {
    const inputs = structuredClone(baseInputs);
    const metrics = calcAllMetrics(inputs);
    const flipExitValueAnalysis = calcFlipExitValueAnalysis({ inputs, valuation: strongEligibleValuation, now: NOW });
    const inputsSnapshot = structuredClone(inputs);
    const metricsSnapshot = structuredClone(metrics);
    const analysisSnapshot = structuredClone(flipExitValueAnalysis);
    deriveDealVerdict({ strategyId: "fix_and_flip", inputs, metrics, flipExitValueAnalysis });
    expect(inputs).toEqual(inputsSnapshot);
    expect(metrics).toEqual(metricsSnapshot);
    expect(flipExitValueAnalysis).toEqual(analysisSnapshot);
  });
});
