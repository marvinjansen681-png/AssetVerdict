import type { StrategyId } from "@/lib/strategies";
import type { SuburbProfile } from "@/types";

export type FitLabel = "Strong Fit" | "Moderate Fit" | "Weak Fit" | "Insufficient Data";

export interface StrategyFit {
  strategyId: StrategyId;
  score: number | null; // 0-100
  label: FitLabel;
  reasons: string[];
}

function avg(values: (number | null | undefined)[]): number | null {
  const present = values.filter((v): v is number => v !== null && v !== undefined);
  if (present.length === 0) return null;
  return present.reduce((sum, v) => sum + v, 0) / present.length;
}

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}

function scoreFromBand(value: number | null | undefined, low: number, high: number): number | null {
  if (value === null || value === undefined) return null;
  if (value <= low) return 0;
  if (value >= high) return 100;
  return ((value - low) / (high - low)) * 100;
}

function labelFor(score: number | null): FitLabel {
  if (score === null) return "Insufficient Data";
  if (score >= 65) return "Strong Fit";
  if (score >= 40) return "Moderate Fit";
  return "Weak Fit";
}

function finalize(strategyId: StrategyId, parts: { weight: number; score: number | null; reason: string }[]): StrategyFit {
  const weighted = parts.filter((p) => p.score !== null);
  const reasons = parts.filter((p) => p.score !== null).map((p) => p.reason);

  if (weighted.length === 0) {
    return { strategyId, score: null, label: "Insufficient Data", reasons: ["Not enough suburb data captured yet."] };
  }

  const totalWeight = weighted.reduce((sum, p) => sum + p.weight, 0);
  const score = clamp(weighted.reduce((sum, p) => sum + (p.score as number) * p.weight, 0) / totalWeight);

  return { strategyId, score: Math.round(score), label: labelFor(score), reasons };
}

export function scoreStrategyFit(strategyId: StrategyId, profile: SuburbProfile): StrategyFit {
  switch (strategyId) {
    case "buy_to_let": {
      const yieldScore = scoreFromBand(profile.fhGrossYield ?? profile.stGrossYield, 4, 12);
      const paymentScore = scoreFromBand(profile.goodStandingPct, 60, 95);
      const rentTrendScore =
        profile.fhRentalTrend || profile.stRentalTrend
          ? { ">10%Up": 100, Up: 75, None: 50, Down: 25, ">10%Down": 0 }[
              (profile.fhRentalTrend ?? profile.stRentalTrend) as string
            ] ?? null
          : null;
      return finalize(strategyId, [
        { weight: 2, score: yieldScore, reason: `Gross yield ${(profile.fhGrossYield ?? profile.stGrossYield ?? "--")}%` },
        { weight: 2, score: paymentScore, reason: `Good standing ${profile.goodStandingPct ?? "--"}%` },
        { weight: 1, score: rentTrendScore, reason: `Rental price trend: ${profile.fhRentalTrend ?? profile.stRentalTrend ?? "unknown"}` },
      ]);
    }

    case "multi_let":
    case "student": {
      const investorActivity = scoreFromBand(profile.investmentPropertyPct, 10, 40);
      const yieldScore = scoreFromBand(profile.stGrossYield ?? profile.fhGrossYield, 5, 14);
      const paymentScore = scoreFromBand(profile.goodStandingPct, 55, 90);
      const demographicScore =
        strategyId === "student" ? scoreFromBand(profile.age17to25Pct, 5, 25) : null;
      return finalize(strategyId, [
        { weight: 2, score: yieldScore, reason: `ST gross yield ${profile.stGrossYield ?? "--"}%` },
        { weight: 1, score: investorActivity, reason: `Investment property share ${profile.investmentPropertyPct ?? "--"}%` },
        { weight: 1, score: paymentScore, reason: `Good standing ${profile.goodStandingPct ?? "--"}%` },
        ...(demographicScore !== null
          ? [{ weight: 1, score: demographicScore, reason: `Age 17-25 population share ${profile.age17to25Pct}%` }]
          : []),
      ]);
    }

    case "fix_and_flip": {
      const trend =
        profile.fhRentalTrend || profile.stRentalTrend
          ? { ">10%Up": 100, Up: 80, None: 45, Down: 15, ">10%Down": 0 }[
              (profile.fhRentalTrend ?? profile.stRentalTrend) as string
            ] ?? null
          : null;
      const volumeScore = scoreFromBand(
        avg([profile.stTransactionVolume, profile.fhTransactionVolume]),
        5,
        50
      );
      return finalize(strategyId, [
        { weight: 2, score: trend, reason: `Rental/price trend: ${profile.fhRentalTrend ?? profile.stRentalTrend ?? "unknown"}` },
        { weight: 1, score: volumeScore, reason: `Transaction volume signals liquidity for resale` },
      ]);
    }

    case "str": {
      const incomeScore = scoreFromBand(profile.incomeHighBandPct, 5, 30);
      const investorActivity = scoreFromBand(profile.investmentPropertyPct, 10, 40);
      return finalize(strategyId, [
        { weight: 1, score: incomeScore, reason: `High-income household share ${profile.incomeHighBandPct ?? "--"}% (proxy for tourism/demand potential)` },
        { weight: 1, score: investorActivity, reason: `Investment property share ${profile.investmentPropertyPct ?? "--"}%` },
      ]);
    }

    case "instalment_sale": {
      const affordability = scoreFromBand(profile.incomeMiddleBandPct, 15, 45);
      const paymentScore = scoreFromBand(profile.goodStandingPct, 60, 95);
      const employmentScore = scoreFromBand(profile.formalSectorPct, 40, 85);
      return finalize(strategyId, [
        { weight: 1, score: affordability, reason: `Middle-income household share ${profile.incomeMiddleBandPct ?? "--"}%` },
        { weight: 2, score: paymentScore, reason: `Good standing ${profile.goodStandingPct ?? "--"}% (buyer reliability signal)` },
        { weight: 1, score: employmentScore, reason: `Formal sector employment ${profile.formalSectorPct ?? "--"}%` },
      ]);
    }

    case "commercial":
    default: {
      const paymentScore = scoreFromBand(profile.goodStandingPct, 55, 90);
      const employmentScore = scoreFromBand(profile.formalSectorPct, 40, 85);
      return finalize(strategyId, [
        { weight: 1, score: paymentScore, reason: `Good standing ${profile.goodStandingPct ?? "--"}% (general market health)` },
        { weight: 1, score: employmentScore, reason: `Formal sector employment ${profile.formalSectorPct ?? "--"}% (economic base)` },
      ]);
    }
  }
}

export function scoreAllStrategies(profile: SuburbProfile): StrategyFit[] {
  const strategies: StrategyId[] = [
    "commercial",
    "buy_to_let",
    "multi_let",
    "student",
    "fix_and_flip",
    "str",
    "instalment_sale",
  ];
  return strategies.map((s) => scoreStrategyFit(s, profile));
}
