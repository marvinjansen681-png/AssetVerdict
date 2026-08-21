import { describe, it, expect } from "vitest";
import { calcAllMetrics, type DealInputs } from "../index";
import { deriveDealVerdict, deriveTargetState, checkStructuralSafetyFailure, type DealVerdictResult } from "../verdict";
import { classifyMetricForDeal, applicabilityContextFromInputs } from "../applicability";
import {
  analyzeNegotiation,
  buildNegotiatedInputs,
  deriveNegotiationOpportunity,
  type NegotiationAnalysis,
  type NegotiationTargetResult,
} from "../negotiation";

// Same fixture convention as verdict.test.ts — a fully-populated baseline
// DealInputs, overridden per test via spread.
const baseInputs: DealInputs = {
  purchasePrice: 0,
  marketValue: 0,
  askingPrice: 0,
  transferBondCost: 0,
  renovationCost: 0,
  sourcingFee: 0,
  agentCommission: 0,
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
  strategy: "commercial",
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
  expectedSalePrice: 0,
  holdingCostPerMonth: 0,
  instalmentAmount: 0,
  instalmentTerm: 240,
  instalmentRate: 0,
};

function analyzeFor(inputs: DealInputs, strategyId: string = inputs.strategy): NegotiationAnalysis {
  return analyzeNegotiation(inputs, strategyId);
}

function expectSolvableOrAlreadyMeets(result: NegotiationTargetResult) {
  expect(["solvable", "already_meets"]).toContain(result.status);
}

// ---------------------------------------------------------------------------
// Deal fixtures (mirrors the "Deal A..H" manual-verification set from the
// Phase 4.15 brief, section 88) — each constructed to unambiguously land in
// the regime it's meant to test, verified below rather than hand-calculated.
//
// IMPORTANT (Phase 4.15.1 report reconciliation): these A-H letters are
// SYNTHETIC fixtures private to this file — they are NOT the same records as
// the pre-existing seeded database deals that happen to share similar names
// (e.g. "Deal C - High Risk (DSCR)", "Deal E - Does Not Meet Target"), which
// were seeded independently for Phase 4.14 verdict-engine manual testing and
// use a different, coincidental lettering. The two schemes were conflated in
// one sentence of Phase 4.15's live-verification narration ("Deal E's
// high-LTV blocker scenario" while inspecting the real seeded "Deal C"),
// which is the root cause of the apparent report contradiction — see the
// Phase 4.15.1 report, section N. Never cross-reference a letter here
// against the live seeded database or vice versa.
// ---------------------------------------------------------------------------

/** Deal A: cash purchase, zero opex, cheap relative to rent — should already exceed Required Return and already be Strong. */
const dealA_alreadyMeets: DealInputs = {
  ...baseInputs,
  purchasePrice: 1_000_000,
  marketValue: 1_000_000,
  financeSources: [],
  monthlyRent: 15_000,
  occupancyRate: 95,
  managementFeeValue: 0,
  maintenanceCostValue: 0,
  badDebtsPct: 0,
  discountRate: 10,
};

/** Deal B: cash purchase, price high relative to rent — modest cash-on-cash, IRR below Required Return; no debt so safety stays strong throughout — a clean "does_not_meet_target" case whose only lever is price. */
const dealB_doesNotMeetTarget: DealInputs = {
  ...baseInputs,
  purchasePrice: 3_000_000,
  marketValue: 3_000_000,
  financeSources: [],
  monthlyRent: 15_000,
  occupancyRate: 95,
  managementFeeValue: 0,
  maintenanceCostValue: 0,
  badDebtsPct: 0,
  discountRate: 10,
};

/** Deal C: 90% LTV loan sized to fail DSCR at the asking price, but operating costs excl. finance are a small share of revenue — so scaling debt down via fixed-LTV negotiation should clear the structural failure well before price reaches zero. */
const dealC_structuralFailure: DealInputs = {
  ...baseInputs,
  purchasePrice: 2_000_000,
  marketValue: 2_000_000,
  financeSources: [{ loanAmount: 1_800_000, interestRate: 12, termYears: 20 }],
  monthlyRent: 15_000,
  occupancyRate: 90,
  managementFeeValue: 8,
  maintenanceCostValue: 3,
  badDebtsPct: 1,
  ratesAndTaxes: 500,
  insurance: 300,
  discountRate: 10,
};

/** Deal D: cash purchase with a deliberately high opex ratio (Weak OER), which is entirely price-independent — Strong must remain unreachable at every price, while Required Return remains achievable since equity/cashflow both move with price. */
const dealD_weakOER: DealInputs = {
  ...baseInputs,
  purchasePrice: 900_000,
  marketValue: 900_000,
  financeSources: [],
  monthlyRent: 20_000,
  occupancyRate: 95,
  managementFeeValue: 30,
  maintenanceCostValue: 25,
  badDebtsPct: 5,
  ratesAndTaxes: 1_000,
  insurance: 500,
  discountRate: 10,
};

/** Deal E: 80% LTV (red, commercial LTV > 75%) but DSCR/Break-Even both comfortably green — the ONLY Strong blocker is the LTV modifier, which is mathematically invariant to price under the fixed-LTV negotiation policy. */
const dealE_highLTV: DealInputs = {
  ...baseInputs,
  purchasePrice: 1_000_000,
  marketValue: 1_000_000,
  financeSources: [{ loanAmount: 800_000, interestRate: 10, termYears: 20 }],
  monthlyRent: 25_000,
  occupancyRate: 95,
  managementFeeValue: 8,
  maintenanceCostValue: 3,
  badDebtsPct: 1,
  ratesAndTaxes: 500,
  insurance: 300,
  discountRate: 12,
};

/** Deal F: debt-free — financeSources stays [] at every negotiated price. */
const dealF_debtFree: DealInputs = {
  ...baseInputs,
  purchasePrice: 1_500_000,
  marketValue: 1_500_000,
  financeSources: [],
  monthlyRent: 12_000,
  occupancyRate: 90,
  discountRate: 10,
};

/** Deal G: two finance sources with an 80/20 split, for proportional-scaling verification. */
const dealG_multiFinance: DealInputs = {
  ...baseInputs,
  purchasePrice: 2_000_000,
  marketValue: 2_000_000,
  financeSources: [
    { loanAmount: 800_000, interestRate: 11, termYears: 20 },
    { loanAmount: 200_000, interestRate: 14, termYears: 10 },
  ],
  monthlyRent: 20_000,
  occupancyRate: 92,
  discountRate: 10,
};

/** Deal H (Phase 4.15.1): original acquisition finance exceeds purchase price — outside the negotiation solver's validated domain; every objective must resolve to unavailable/unsupported_financing_structure. */
const dealH_over100LTV: DealInputs = {
  ...baseInputs,
  purchasePrice: 1_000_000,
  marketValue: 1_000_000,
  financeSources: [{ loanAmount: 1_100_000, interestRate: 11, termYears: 20 }],
  monthlyRent: 15_000,
  occupancyRate: 90,
  discountRate: 10,
};

/**
 * Deal I (Phase 4.16): current verdict "promising" driven ONLY by a safety
 * CAUTION (DSCR/Break-Even orange, not red — no raw structural failure),
 * with LTV comfortably green (53%, so the LTV modifier never confounds this
 * fixture) and OER/target already fine. Lowering price should push DSCR/
 * Break-Even into their green bands, making Strong reachable by price alone
 * — the "promising -> strong reachable" case sections 12/38 require, kept
 * structurally distinct from dealE_highLTV (promising -> NOT reachable).
 */
const dealI_promisingSafetyCaution: DealInputs = {
  ...baseInputs,
  purchasePrice: 1_500_000,
  marketValue: 1_500_000,
  financeSources: [{ loanAmount: 800_000, interestRate: 13, termYears: 20 }],
  monthlyRent: 15_000,
  occupancyRate: 90,
  managementFeeValue: 8,
  maintenanceCostValue: 3,
  badDebtsPct: 1,
  ratesAndTaxes: 500,
  insurance: 300,
  discountRate: 6,
};

describe("buildNegotiatedInputs (sections 4-16)", () => {
  it("replaces only purchasePrice + financeSources; every other field is byte-identical", () => {
    const negotiated = buildNegotiatedInputs(dealG_multiFinance, 1_500_000);
    expect(negotiated.purchasePrice).toBe(1_500_000);
    expect(negotiated.marketValue).toBe(dealG_multiFinance.marketValue);
    expect(negotiated.transferBondCost).toBe(dealG_multiFinance.transferBondCost);
    expect(negotiated.renovationCost).toBe(dealG_multiFinance.renovationCost);
    expect(negotiated.monthlyRent).toBe(dealG_multiFinance.monthlyRent);
    expect(negotiated.occupancyRate).toBe(dealG_multiFinance.occupancyRate);
    expect(negotiated.capitalGrowthRate).toBe(dealG_multiFinance.capitalGrowthRate);
    expect(negotiated.rentalGrowthRate).toBe(dealG_multiFinance.rentalGrowthRate);
    expect(negotiated.discountRate).toBe(dealG_multiFinance.discountRate);
  });

  it("never mutates the original inputs or its financeSources array (section 79)", () => {
    const originalSnapshot = JSON.parse(JSON.stringify(dealG_multiFinance));
    buildNegotiatedInputs(dealG_multiFinance, 1_000_000);
    expect(dealG_multiFinance).toEqual(originalSnapshot);
  });

  it("preserves original LTV exactly at any proposed price (section 6, 45)", () => {
    const originalLTV = 1_800_000 / 2_000_000;
    for (const price of [2_000_000, 1_500_000, 1_000_000, 500_000, 1]) {
      const negotiated = buildNegotiatedInputs(dealC_structuralFailure, price);
      const totalLoan = negotiated.financeSources.reduce((s, f) => s + f.loanAmount, 0);
      expect(totalLoan / price).toBeCloseTo(originalLTV, 9);
    }
  });

  it("preserves each finance source's proportional share, rate, and term (section 7, 46)", () => {
    const negotiated = buildNegotiatedInputs(dealG_multiFinance, 1_000_000);
    expect(negotiated.financeSources).toHaveLength(2);
    // Original shares: 800k/1M = 80%, 200k/1M = 20%.
    const totalLoan = negotiated.financeSources.reduce((s, f) => s + f.loanAmount, 0);
    expect(negotiated.financeSources[0].loanAmount / totalLoan).toBeCloseTo(0.8, 6);
    expect(negotiated.financeSources[1].loanAmount / totalLoan).toBeCloseTo(0.2, 6);
    expect(negotiated.financeSources[0].interestRate).toBe(11);
    expect(negotiated.financeSources[0].termYears).toBe(20);
    expect(negotiated.financeSources[1].interestRate).toBe(14);
    expect(negotiated.financeSources[1].termYears).toBe(10);
  });

  it("debt-free deals stay debt-free at every negotiated price (section 8, 77)", () => {
    for (const price of [1_500_000, 750_000, 1]) {
      expect(buildNegotiatedInputs(dealF_debtFree, price).financeSources).toEqual([]);
    }
  });

  it("a zero-total-loan finance array collapses to [] rather than dividing by zero", () => {
    const inputs: DealInputs = { ...dealF_debtFree, financeSources: [{ loanAmount: 0, interestRate: 10, termYears: 20 }] };
    const negotiated = buildNegotiatedInputs(inputs, 1_000_000);
    expect(negotiated.financeSources).toEqual([]);
  });
});

describe("analyzeNegotiation — strategy eligibility (section 20, 67)", () => {
  it("fix_and_flip: all four objectives unavailable/strategy_not_supported", () => {
    const result = analyzeFor({ ...dealA_alreadyMeets, strategy: "fix_and_flip" }, "fix_and_flip");
    for (const objective of [result.meetRequiredReturn, result.clearStructuralSafety, result.reachPromising, result.reachStrong]) {
      expect(objective.status).toBe("unavailable");
      expect((objective as { reason: string }).reason).toBe("strategy_not_supported");
    }
  });

  it("instalment_sale: all four objectives unavailable/strategy_not_supported", () => {
    const result = analyzeFor({ ...dealA_alreadyMeets, strategy: "instalment_sale" }, "instalment_sale");
    for (const objective of [result.meetRequiredReturn, result.clearStructuralSafety, result.reachPromising, result.reachStrong]) {
      expect(objective.status).toBe("unavailable");
    }
  });

  it("commercial/buy_to_let/multi_let/student/str are all eligible", () => {
    for (const strategyId of ["commercial", "buy_to_let", "multi_let", "student", "str"]) {
      const result = analyzeFor({ ...dealA_alreadyMeets, strategy: strategyId }, strategyId);
      expect(result.meetRequiredReturn.status).not.toBe("unavailable");
    }
  });
});

describe("analyzeNegotiation — invalid purchase price (section 9)", () => {
  it("purchasePrice = 0 → all four objectives unavailable/invalid_purchase_price, no crash", () => {
    const result = analyzeFor({ ...dealA_alreadyMeets, purchasePrice: 0 });
    for (const objective of [result.meetRequiredReturn, result.clearStructuralSafety, result.reachPromising, result.reachStrong]) {
      expect(objective.status).toBe("unavailable");
      expect((objective as { reason: string }).reason).toBe("invalid_purchase_price");
    }
  });

  it("negative purchasePrice → invalid_purchase_price, no crash", () => {
    const result = analyzeFor({ ...dealA_alreadyMeets, purchasePrice: -100 });
    expect(result.meetRequiredReturn.status).toBe("unavailable");
  });
});

// ---------------------------------------------------------------------------
// Phase 4.15.1 — original LTV > 100% is excluded from the negotiation
// solver's validated domain (sections 1-13 of the 4.15.1 brief). These
// fixtures share a base shape with dealC_structuralFailure so only the
// financing changes are exercised.
// ---------------------------------------------------------------------------
const ltvGuardBase: DealInputs = {
  ...baseInputs,
  purchasePrice: 1_000_000,
  marketValue: 1_000_000,
  monthlyRent: 15_000,
  occupancyRate: 90,
  managementFeeValue: 8,
  maintenanceCostValue: 3,
  badDebtsPct: 1,
  ratesAndTaxes: 500,
  insurance: 300,
  discountRate: 10,
};

describe("analyzeNegotiation — original LTV > 100% guard (Phase 4.15.1)", () => {
  it("exactly 100% LTV (loan === price) remains supported — section 9/H", () => {
    const deal: DealInputs = { ...ltvGuardBase, financeSources: [{ loanAmount: 1_000_000, interestRate: 11, termYears: 20 }] };
    const result = analyzeFor(deal);
    for (const objective of [result.meetRequiredReturn, result.clearStructuralSafety, result.reachPromising, result.reachStrong]) {
      if (objective.status === "unavailable") {
        expect(objective.reason).not.toBe("unsupported_financing_structure");
      }
    }
    // At least one objective actually executed (not merely "unavailable" across the board).
    expect(["already_meets", "solvable", "not_achievable_by_price"]).toContain(result.meetRequiredReturn.status);
  });

  it("100% + R1 (loan exceeds price by the smallest tested margin) → all four unavailable/unsupported_financing_structure — section 10/I", () => {
    const deal: DealInputs = { ...ltvGuardBase, financeSources: [{ loanAmount: 1_000_001, interestRate: 11, termYears: 20 }] };
    const result = analyzeFor(deal);
    for (const objective of [result.meetRequiredReturn, result.clearStructuralSafety, result.reachPromising, result.reachStrong]) {
      expect(objective.status).toBe("unavailable");
      expect((objective as { reason: string }).reason).toBe("unsupported_financing_structure");
    }
    // The deal's own verdict/metrics are entirely unaffected by the guard.
    expect(result.currentVerdict.status).toBe("available");
  });

  it("multi-source combined LTV > 100% (no single source individually exceeds price) → unavailable — section 6/11/J", () => {
    const deal: DealInputs = {
      ...ltvGuardBase,
      financeSources: [
        { loanAmount: 800_000, interestRate: 11, termYears: 20 },
        { loanAmount: 250_000, interestRate: 13, termYears: 15 },
      ],
    };
    const result = analyzeFor(deal);
    for (const objective of [result.meetRequiredReturn, result.clearStructuralSafety, result.reachPromising, result.reachStrong]) {
      expect(objective.status).toBe("unavailable");
      expect((objective as { reason: string }).reason).toBe("unsupported_financing_structure");
    }
  });

  it("a single source individually > price, combined with a second source, is still caught by the TOTAL check", () => {
    const deal: DealInputs = {
      ...ltvGuardBase,
      financeSources: [
        { loanAmount: 1_050_000, interestRate: 11, termYears: 20 },
        { loanAmount: 0, interestRate: 10, termYears: 10 },
      ],
    };
    const result = analyzeFor(deal);
    expect(result.meetRequiredReturn.status).toBe("unavailable");
  });

  it("cash deal (no finance) is never affected by the guard — section 12/K", () => {
    const result = analyzeFor(dealF_debtFree);
    for (const objective of [result.meetRequiredReturn, result.clearStructuralSafety, result.reachPromising, result.reachStrong]) {
      if (objective.status === "unavailable") {
        expect(objective.reason).not.toBe("unsupported_financing_structure");
      }
    }
    expect(result.clearStructuralSafety.status).toBe("already_meets");
  });

  it("ordinary <=100% LTV deals are byte-identical to pre-hardening behaviour — section 13/L", () => {
    // dealE_highLTV (80% LTV) and dealC_structuralFailure (90% LTV) are both
    // well inside the validated domain — re-assert their exact, previously-
    // established results are unchanged by this guard.
    const dealEResult = analyzeFor(dealE_highLTV);
    expect(dealEResult.clearStructuralSafety.status).toBe("already_meets");
    expect(dealEResult.reachStrong.status).toBe("not_achievable_by_price");
    if (dealEResult.reachStrong.status === "not_achievable_by_price") {
      expect(dealEResult.reachStrong.blockers.some((b) => b.code === "high_ltv")).toBe(true);
    }

    const dealCResult = analyzeFor(dealC_structuralFailure);
    expect(dealCResult.currentVerdict.status).toBe("available");
    if (dealCResult.currentVerdict.status === "available") {
      expect(dealCResult.currentVerdict.verdict).toBe("high_risk");
    }
    expect(dealCResult.clearStructuralSafety.status).toBe("solvable");
    if (dealCResult.clearStructuralSafety.status === "solvable") {
      expect(dealCResult.clearStructuralSafety.targetPrice).toBeLessThan(dealC_structuralFailure.purchasePrice);
    }
  });

  it("never invokes the binary search for a blocked financing structure (no resultingMetrics/resultingVerdict ever computed for it)", () => {
    const deal: DealInputs = { ...ltvGuardBase, financeSources: [{ loanAmount: 2_000_000, interestRate: 11, termYears: 20 }] };
    const result = analyzeFor(deal);
    // "unavailable" is structurally the only variant with no resultingMetrics
    // field at all — TypeScript already enforces this at the type level;
    // this assertion documents that guarantee at runtime too.
    for (const objective of [result.meetRequiredReturn, result.clearStructuralSafety, result.reachPromising, result.reachStrong]) {
      expect(objective).not.toHaveProperty("resultingMetrics");
      expect(objective).not.toHaveProperty("targetPrice");
    }
  });
});

describe("Deal A — already meets Required Return (section 71)", () => {
  it("meetRequiredReturn is already_meets with zero reduction", () => {
    const result = analyzeFor(dealA_alreadyMeets);
    expect(result.currentVerdict.status).toBe("available");
    const r = result.meetRequiredReturn;
    expect(r.status).toBe("already_meets");
    if (r.status === "already_meets") {
      expect(r.targetPrice).toBe(dealA_alreadyMeets.purchasePrice);
      expect(r.reductionRand).toBe(0);
      expect(r.reductionPercent).toBe(0);
    }
  });
});

describe("Deal B — does_not_meet_target, solvable via lower price (sections 33, 72)", () => {
  const result = analyzeFor(dealB_doesNotMeetTarget);

  it("current verdict actually misses target (sanity check on the fixture)", () => {
    expect(result.currentVerdict.status).toBe("available");
    if (result.currentVerdict.status === "available") {
      expect(result.currentVerdict.categoryStates.target).toBe("missed");
    }
  });

  it("meetRequiredReturn is solvable, with a lower target price than asking", () => {
    const r = result.meetRequiredReturn;
    expect(r.status).toBe("solvable");
    if (r.status === "solvable") {
      expect(r.targetPrice).toBeLessThan(dealB_doesNotMeetTarget.purchasePrice);
      expect(r.reductionRand).toBeGreaterThan(0);
      expect(r.reductionPercent).toBeGreaterThan(0);
    }
  });

  it("boundary: IRR >= required return at target price, and < required return at a higher price (sections 38-42)", () => {
    const r = result.meetRequiredReturn;
    expect(r.status).toBe("solvable");
    if (r.status !== "solvable") return;

    const atTarget = calcAllMetrics(buildNegotiatedInputs(dealB_doesNotMeetTarget, r.targetPrice));
    expect(atTarget.irr).toBeGreaterThanOrEqual(dealB_doesNotMeetTarget.discountRate - 0.05);

    const justAbove = r.targetPrice + 5_000; // comfortably past the R1 solver tolerance
    expect(justAbove).toBeLessThanOrEqual(dealB_doesNotMeetTarget.purchasePrice);
    const atAbove = calcAllMetrics(buildNegotiatedInputs(dealB_doesNotMeetTarget, justAbove));
    expect(atAbove.irr).toBeLessThan(dealB_doesNotMeetTarget.discountRate);
  });

  it("reachStrong's targetPrice (if solvable) truly produces verdict === 'strong' via deriveDealVerdict directly (section 81, exact verdict reuse)", () => {
    const r = result.reachStrong;
    if (r.status === "solvable") {
      const negotiated = buildNegotiatedInputs(dealB_doesNotMeetTarget, r.targetPrice);
      const metrics = calcAllMetrics(negotiated);
      const verdict = deriveDealVerdict({ strategyId: "commercial", inputs: negotiated, metrics });
      expect(verdict.status).toBe("available");
      if (verdict.status === "available") expect(verdict.verdict).toBe("strong");
    }
  });
});

describe("Deal C — structural safety failure, solvable via lower price (sections 73, 40)", () => {
  const result = analyzeFor(dealC_structuralFailure);

  it("current verdict is high_risk (sanity check on the fixture)", () => {
    expect(result.currentVerdict.status).toBe("available");
    if (result.currentVerdict.status === "available") {
      expect(result.currentVerdict.verdict).toBe("high_risk");
    }
  });

  it("clearStructuralSafety is solvable at a lower price", () => {
    const r = result.clearStructuralSafety;
    expect(r.status).toBe("solvable");
    if (r.status === "solvable") {
      expect(r.targetPrice).toBeLessThan(dealC_structuralFailure.purchasePrice);
    }
  });

  it("boundary: DSCR >= 1.00 and Break-Even <= 100% at target; fails again just above (sections 39-41)", () => {
    const r = result.clearStructuralSafety;
    expect(r.status).toBe("solvable");
    if (r.status !== "solvable") return;

    const atTarget = calcAllMetrics(buildNegotiatedInputs(dealC_structuralFailure, r.targetPrice));
    expect(atTarget.dscr).toBeGreaterThanOrEqual(0.999);
    expect(atTarget.breakEvenRatio).toBeLessThanOrEqual(100.01);

    const justAbove = r.targetPrice + 5_000;
    if (justAbove <= dealC_structuralFailure.purchasePrice) {
      const atAbove = calcAllMetrics(buildNegotiatedInputs(dealC_structuralFailure, justAbove));
      const hasDebt = atAbove.annualDebtService > 0;
      const check = checkStructuralSafetyFailure({
        dscr: atAbove.dscr,
        hasDebt,
        breakEvenRatio: atAbove.breakEvenRatio,
        cashflowAnnualPreTax: atAbove.cashflowAnnualPreTax,
      });
      expect(check.failed).toBe(true);
    }
  });
});

describe("Deal D — Weak OER: Strong not achievable by price, Required Return still is (sections 43, 57, 75 — mandatory)", () => {
  const result = analyzeFor(dealD_weakOER);

  it("current OER is genuinely Weak (sanity check on the fixture)", () => {
    const metrics = calcAllMetrics(dealD_weakOER);
    expect(metrics.operatingExpenseRatio).toBeGreaterThan(60);
  });

  it("OER is identical at every negotiated price — price-independent by construction", () => {
    const oerAtFull = calcAllMetrics(buildNegotiatedInputs(dealD_weakOER, dealD_weakOER.purchasePrice)).operatingExpenseRatio;
    const oerAtLow = calcAllMetrics(buildNegotiatedInputs(dealD_weakOER, 1_000)).operatingExpenseRatio;
    expect(oerAtLow).toBeCloseTo(oerAtFull, 6);
  });

  it("reachStrong is not_achievable_by_price, citing the OER blocker", () => {
    const r = result.reachStrong;
    expect(r.status).toBe("not_achievable_by_price");
    if (r.status === "not_achievable_by_price") {
      expect(r.blockers.some((b) => b.code === "high_oer")).toBe(true);
    }
  });

  it("meetRequiredReturn is NOT blocked by the same OER problem (price is a real lever for target, not for OER)", () => {
    expectSolvableOrAlreadyMeets(result.meetRequiredReturn);
  });
});

describe("Deal E — High LTV: fixed-LTV policy means Strong stays blocked regardless of price (sections 44-45, 76 — mandatory)", () => {
  const result = analyzeFor(dealE_highLTV);

  it("current LTV is genuinely red/high (sanity check on the fixture)", () => {
    const metrics = calcAllMetrics(dealE_highLTV);
    expect(metrics.ltv).toBeGreaterThan(75);
    expect(metrics.dscr).toBeGreaterThanOrEqual(1.25); // green, not the active blocker
    expect(metrics.breakEvenRatio).toBeLessThanOrEqual(75); // green, not the active blocker
  });

  it("LTV% is invariant to negotiated price (mathematical identity of the fixed-LTV policy)", () => {
    const ltvAtFull = calcAllMetrics(buildNegotiatedInputs(dealE_highLTV, dealE_highLTV.purchasePrice)).ltv;
    const ltvAtLow = calcAllMetrics(buildNegotiatedInputs(dealE_highLTV, 100_000)).ltv;
    expect(ltvAtLow).toBeCloseTo(ltvAtFull, 6);
  });

  it("reachStrong is not_achievable_by_price, citing the high_ltv blocker", () => {
    const r = result.reachStrong;
    expect(r.status).toBe("not_achievable_by_price");
    if (r.status === "not_achievable_by_price") {
      expect(r.blockers.some((b) => b.code === "high_ltv")).toBe(true);
    }
  });

  it("clearStructuralSafety already_meets (no raw DSCR/Break-Even failure at asking price)", () => {
    expect(result.clearStructuralSafety.status).toBe("already_meets");
  });
});

describe("Deal F — debt-free deal (section 77)", () => {
  const result = analyzeFor(dealF_debtFree);

  it("clearStructuralSafety is already_meets (no debt, nothing to fail)", () => {
    expect(result.clearStructuralSafety.status).toBe("already_meets");
  });

  it("resulting metrics at any solved target price still show zero debt", () => {
    const r = result.meetRequiredReturn;
    if (r.status === "solvable") {
      expect(r.resultingMetrics.totalLoanAmount).toBe(0);
      expect(r.resultingMetrics.dscr).toBe(Infinity);
    }
  });
});

describe("Deal G — multi-finance proportional scaling end-to-end (section 78)", () => {
  it("solved target price (if any) preserves each source's proportional share, rate, and term", () => {
    const result = analyzeFor(dealG_multiFinance);
    const r = result.meetRequiredReturn;
    if (r.status !== "solvable") return; // fixture may already meet target; scaling is still verified in buildNegotiatedInputs tests above
    const negotiated = buildNegotiatedInputs(dealG_multiFinance, r.targetPrice);
    const totalLoan = negotiated.financeSources.reduce((s, f) => s + f.loanAmount, 0);
    expect(negotiated.financeSources[0].loanAmount / totalLoan).toBeCloseTo(0.8, 6);
    expect(negotiated.financeSources[0].interestRate).toBe(11);
    expect(negotiated.financeSources[0].termYears).toBe(20);
    expect(negotiated.financeSources[1].interestRate).toBe(14);
    expect(negotiated.financeSources[1].termYears).toBe(10);
  });
});

describe("Original inputs are never mutated by a full analysis (section 79)", () => {
  it("dealC_structuralFailure is byte-identical after analyzeNegotiation", () => {
    const snapshot = JSON.parse(JSON.stringify(dealC_structuralFailure));
    analyzeFor(dealC_structuralFailure);
    expect(dealC_structuralFailure).toEqual(snapshot);
  });
});

describe("promising_if_negotiated is never produced (section 82, mandatory)", () => {
  const allDeals = [dealA_alreadyMeets, dealB_doesNotMeetTarget, dealC_structuralFailure, dealD_weakOER, dealE_highLTV, dealF_debtFree, dealG_multiFinance, dealH_over100LTV];

  it("no resultingVerdict, currentVerdict, or blocker across any fixture ever carries the label promising_if_negotiated", () => {
    for (const deal of allDeals) {
      const result = analyzeFor(deal);
      const verdicts: (DealVerdictResult | undefined)[] = [
        result.currentVerdict,
        (result.meetRequiredReturn as { resultingVerdict?: DealVerdictResult }).resultingVerdict,
        (result.clearStructuralSafety as { resultingVerdict?: DealVerdictResult }).resultingVerdict,
        (result.reachPromising as { resultingVerdict?: DealVerdictResult }).resultingVerdict,
        (result.reachStrong as { resultingVerdict?: DealVerdictResult }).resultingVerdict,
      ];
      for (const v of verdicts) {
        if (v?.status === "available") {
          expect(v.verdict).not.toBe("promising_if_negotiated");
        }
      }
    }
  });
});

describe("Monotonicity spot-checks (sections 22-23) — empirical, not assumed", () => {
  function countFlips(currentPrice: number, qualifies: (price: number) => boolean, samples = 40): number {
    const values: boolean[] = [];
    for (let i = 0; i <= samples; i++) {
      const price = Math.max(1, (currentPrice * i) / samples);
      values.push(qualifies(price));
    }
    let flips = 0;
    for (let i = 1; i < values.length; i++) {
      if (values[i] !== values[i - 1]) flips++;
    }
    return flips;
  }

  it("Deal B: meet_required_return crosses at most once as price rises from ~0 to asking", () => {
    const qualifies = (price: number) => {
      const negotiated = buildNegotiatedInputs(dealB_doesNotMeetTarget, price);
      const metrics = calcAllMetrics(negotiated);
      const ctx = applicabilityContextFromInputs(negotiated);
      const irrClassification = classifyMetricForDeal("irr", metrics.irr, ctx, "commercial");
      return deriveTargetState({ irrClassification, irr: metrics.irr, discountRate: negotiated.discountRate }).state === "met";
    };
    expect(countFlips(dealB_doesNotMeetTarget.purchasePrice, qualifies)).toBeLessThanOrEqual(1);
  });

  it("Deal C: clear_structural_safety crosses at most once as price rises from ~0 to asking", () => {
    const qualifies = (price: number) => {
      const negotiated = buildNegotiatedInputs(dealC_structuralFailure, price);
      const metrics = calcAllMetrics(negotiated);
      const hasDebt = metrics.annualDebtService > 0;
      return !checkStructuralSafetyFailure({
        dscr: metrics.dscr,
        hasDebt,
        breakEvenRatio: metrics.breakEvenRatio,
        cashflowAnnualPreTax: metrics.cashflowAnnualPreTax,
      }).failed;
    };
    expect(countFlips(dealC_structuralFailure.purchasePrice, qualifies)).toBeLessThanOrEqual(1);
  });

  it("Deal E: reach_strong never becomes true at any price (0 flips) — LTV blocker is price-invariant", () => {
    const qualifies = (price: number) => {
      const negotiated = buildNegotiatedInputs(dealE_highLTV, price);
      const metrics = calcAllMetrics(negotiated);
      const verdict = deriveDealVerdict({ strategyId: "commercial", inputs: negotiated, metrics });
      return verdict.status === "available" && verdict.verdict === "strong";
    };
    expect(countFlips(dealE_highLTV.purchasePrice, qualifies)).toBe(0);
  });
});

describe("Performance (section 52)", () => {
  it("a full four-objective analysis completes well within an interactive budget", () => {
    const start = Date.now();
    analyzeFor(dealC_structuralFailure);
    const elapsedMs = Date.now() - start;
    expect(elapsedMs).toBeLessThan(2_000);
  });
});

// ---------------------------------------------------------------------------
// Phase 4.16 — Conditional Negotiation Opportunity (deriveNegotiationOpportunity)
// ---------------------------------------------------------------------------

function opportunityFor(inputs: DealInputs, strategyId: string = inputs.strategy) {
  const negotiation = analyzeFor(inputs, strategyId);
  return { negotiation, opportunity: deriveNegotiationOpportunity(negotiation.currentVerdict, negotiation) };
}

describe("Deal B — does_not_meet_target -> strong reachable (section 37, required)", () => {
  it("current verdict remains does_not_meet_target; opportunity is promising_if_negotiated", () => {
    const { negotiation, opportunity } = opportunityFor(dealB_doesNotMeetTarget);
    expect(negotiation.currentVerdict.status).toBe("available");
    if (negotiation.currentVerdict.status === "available") {
      expect(negotiation.currentVerdict.verdict).toBe("does_not_meet_target");
    }
    expect(negotiation.reachStrong.status).toBe("solvable");
    expect(opportunity.status).toBe("promising_if_negotiated");
    if (opportunity.status === "promising_if_negotiated" && negotiation.reachStrong.status === "solvable") {
      expect(opportunity.currentVerdictLabel).toBe("does_not_meet_target");
      expect(opportunity.targetPrice).toBe(negotiation.reachStrong.targetPrice);
      expect(opportunity.reductionRand).toBe(negotiation.reachStrong.reductionRand);
      expect(opportunity.reductionPercent).toBe(negotiation.reachStrong.reductionPercent);
      expect(opportunity.resultingVerdict).toBe("strong");
    }
  });
});

describe("Deal I — promising -> strong reachable via safety caution (section 38, required)", () => {
  it("current verdict is promising (safety acceptable, not strong); opportunity is promising_if_negotiated", () => {
    const { negotiation, opportunity } = opportunityFor(dealI_promisingSafetyCaution);
    expect(negotiation.currentVerdict.status).toBe("available");
    if (negotiation.currentVerdict.status === "available") {
      expect(negotiation.currentVerdict.verdict).toBe("promising");
      expect(negotiation.currentVerdict.categoryStates.safety).not.toBe("strong");
    }
    expect(negotiation.reachStrong.status).toBe("solvable");
    expect(opportunity.status).toBe("promising_if_negotiated");
    if (opportunity.status === "promising_if_negotiated") {
      expect(opportunity.currentVerdictLabel).toBe("promising");
    }
  });
});

describe("Deal C — high_risk current verdict never softened (section 9, 39, required)", () => {
  it("opportunity is never promising_if_negotiated regardless of what reachStrong says", () => {
    const { negotiation, opportunity } = opportunityFor(dealC_structuralFailure);
    expect(negotiation.currentVerdict.status).toBe("available");
    if (negotiation.currentVerdict.status === "available") {
      expect(negotiation.currentVerdict.verdict).toBe("high_risk");
    }
    expect(opportunity.status).not.toBe("promising_if_negotiated");
    expect(opportunity).toEqual({ status: "no_negotiation_opportunity", reasonCode: "current_high_risk" });
    // The negotiation target itself remains fully visible/computed, just not conditionally labelled.
    expect(["solvable", "already_meets", "not_achievable_by_price"]).toContain(negotiation.reachStrong.status);
  });
});

describe("Deal A — already strong (section 10, 40, required)", () => {
  it("opportunity is already_strong, never promising_if_negotiated", () => {
    const { negotiation, opportunity } = opportunityFor(dealA_alreadyMeets);
    expect(negotiation.currentVerdict.status).toBe("available");
    if (negotiation.currentVerdict.status === "available") {
      expect(negotiation.currentVerdict.verdict).toBe("strong");
    }
    expect(opportunity).toEqual({ status: "already_strong" });
  });
});

describe("Deal D — Weak OER: no conditional opportunity (section 13, 41, required)", () => {
  it("reasonCode is strong_not_reachable_by_price, citing the OER blocker", () => {
    const { negotiation, opportunity } = opportunityFor(dealD_weakOER);
    expect(negotiation.reachStrong.status).toBe("not_achievable_by_price");
    expect(opportunity.status).toBe("no_negotiation_opportunity");
    if (opportunity.status === "no_negotiation_opportunity") {
      expect(opportunity.reasonCode).toBe("strong_not_reachable_by_price");
      expect(opportunity.blockers?.some((b) => b.code === "high_oer")).toBe(true);
    }
  });
});

describe("Deal E — High LTV: no conditional opportunity under fixed-LTV semantics (section 14, 42, required)", () => {
  it("reasonCode is strong_not_reachable_by_price, citing the LTV blocker", () => {
    const { negotiation, opportunity } = opportunityFor(dealE_highLTV);
    expect(negotiation.currentVerdict.status).toBe("available");
    if (negotiation.currentVerdict.status === "available") {
      expect(negotiation.currentVerdict.verdict).toBe("promising");
    }
    expect(negotiation.reachStrong.status).toBe("not_achievable_by_price");
    expect(opportunity.status).toBe("no_negotiation_opportunity");
    if (opportunity.status === "no_negotiation_opportunity") {
      expect(opportunity.reasonCode).toBe("strong_not_reachable_by_price");
      expect(opportunity.blockers?.some((b) => b.code === "high_ltv")).toBe(true);
    }
  });
});

describe("Negotiation-unavailable cases never produce a conditional label (section 43, required)", () => {
  it("Fix & Flip: opportunity still unavailable (Phase 4.20: verdict is now active, but the negotiation ANALYSIS layer still excludes fix_and_flip via VERDICT_ENABLED_STRATEGIES, so the reason changes but the outcome doesn't)", () => {
    const { opportunity } = opportunityFor({ ...dealA_alreadyMeets, strategy: "fix_and_flip" }, "fix_and_flip");
    expect(opportunity.status).toBe("unavailable");
    expect(opportunity).toEqual({ status: "unavailable", reason: "strategy_not_supported" });
  });

  it("Instalment Sale: opportunity unavailable/current_verdict_unavailable", () => {
    const { opportunity } = opportunityFor({ ...dealA_alreadyMeets, strategy: "instalment_sale" }, "instalment_sale");
    expect(opportunity).toEqual({ status: "unavailable", reason: "current_verdict_unavailable" });
  });

  it(">100% original LTV: opportunity unavailable/unsupported_financing_structure", () => {
    const { negotiation, opportunity } = opportunityFor(dealH_over100LTV);
    expect(negotiation.currentVerdict.status).toBe("available"); // the deal's own verdict is unaffected
    expect(opportunity).toEqual({ status: "unavailable", reason: "unsupported_financing_structure" });
  });

  it("invalid purchase price: opportunity unavailable/invalid_purchase_price", () => {
    const { opportunity } = opportunityFor({ ...dealA_alreadyMeets, purchasePrice: 0 });
    expect(opportunity.status).toBe("unavailable");
    if (opportunity.status === "unavailable") {
      expect(opportunity.reason).toBe("invalid_purchase_price");
    }
  });
});

describe("No seller-plausibility language anywhere in the domain model (section 44, mandatory)", () => {
  const forbiddenWords = ["realistic", "likely", "unlikely", "reasonable", "probability", "probable", "plausible"];

  it("scans every fixture's opportunity output for forbidden plausibility language", () => {
    const allDeals = [
      dealA_alreadyMeets,
      dealB_doesNotMeetTarget,
      dealC_structuralFailure,
      dealD_weakOER,
      dealE_highLTV,
      dealF_debtFree,
      dealG_multiFinance,
      dealH_over100LTV,
      dealI_promisingSafetyCaution,
    ];
    for (const deal of allDeals) {
      const { opportunity } = opportunityFor(deal);
      const serialized = JSON.stringify(opportunity).toLowerCase();
      for (const word of forbiddenWords) {
        expect(serialized).not.toContain(word);
      }
    }
  });
});

describe("Huge discount does not suppress promising_if_negotiated (section 45, Decision 16 = A, required)", () => {
  // Deliberately extreme: price is very high relative to rent (mirrors the
  // Phase 4.15 brief's own R5,000,000 -> R1,300,000 example), so the
  // required reduction to reach Strong is very large — no debt, so price is
  // the sole lever and nothing else confounds the result.
  const dealHugeDiscount: DealInputs = {
    ...baseInputs,
    purchasePrice: 5_000_000,
    marketValue: 5_000_000,
    financeSources: [],
    monthlyRent: 10_000,
    occupancyRate: 90,
    discountRate: 10,
  };

  it("a >50% required reduction still produces promising_if_negotiated with no magnitude cutoff", () => {
    const { negotiation, opportunity } = opportunityFor(dealHugeDiscount);
    expect(negotiation.reachStrong.status).toBe("solvable");
    if (negotiation.reachStrong.status === "solvable") {
      // Confirm this really is a "huge" discount before asserting it's still honoured.
      expect(negotiation.reachStrong.reductionPercent).toBeGreaterThan(50);
    }
    expect(opportunity.status).toBe("promising_if_negotiated");
  });
});

describe("Target price exactness — no independent recalculation (section 46, required)", () => {
  it("opportunity.targetPrice is bit-for-bit identical to negotiation.reachStrong.targetPrice", () => {
    const { negotiation, opportunity } = opportunityFor(dealB_doesNotMeetTarget);
    expect(negotiation.reachStrong.status).toBe("solvable");
    if (negotiation.reachStrong.status === "solvable" && opportunity.status === "promising_if_negotiated") {
      expect(Object.is(opportunity.targetPrice, negotiation.reachStrong.targetPrice)).toBe(true);
    }
  });
});

describe("deriveNegotiationOpportunity is pure (section 47, required)", () => {
  it("never mutates currentVerdict or negotiationAnalysis", () => {
    const negotiation = analyzeFor(dealB_doesNotMeetTarget);
    // structuredClone (unlike JSON.stringify/parse) faithfully preserves
    // Infinity/NaN — this fixture's dscr is Infinity (debt-free deal), which
    // JSON would lossily round-trip to null and produce a false mismatch.
    const verdictSnapshot = structuredClone(negotiation.currentVerdict);
    const negotiationSnapshot = structuredClone(negotiation);
    deriveNegotiationOpportunity(negotiation.currentVerdict, negotiation);
    expect(negotiation.currentVerdict).toEqual(verdictSnapshot);
    expect(negotiation).toEqual(negotiationSnapshot);
  });
});
