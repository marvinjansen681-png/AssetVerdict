import type { StrategyId } from "@/lib/strategies";
import type { SuburbProfile } from "@/types";
import { calcStudentCapacity } from "@/lib/calculations";

export type Confidence = "high" | "medium" | "low";

interface RentBand {
  low: number | null;
  avg: number | null;
  high: number | null;
  label: string;
}

export interface RentSuggestion {
  available: boolean;
  reason?: string;
  suburbName?: string;
  reportType?: string;
  reportAgeMonths?: number | null;

  /** Strategy-specific income estimate — e.g. per-room aggregate for Multi-Let, nightly-derived for STR. */
  primaryEstimate: number | null;
  primaryLabel: string;

  /** Conservative single-tenancy long-term market rent — the floor if the primary income model underperforms. */
  fallbackEstimate: number | null;
  fallbackLabel: string;

  band: RentBand | null;
  confidence: Confidence;

  /** % difference between primaryEstimate and the deal's current monthly rent input, if provided. */
  deltaVsCurrentPct: number | null;
}

const MULTI_LET_PREMIUM = 1.15; // aggregate per-room income typically exceeds single-let rent
const ROOM_COUNT_FALLBACK = 1;

function reportAgeMonths(profile: SuburbProfile): number | null {
  const date = profile.reportDate ?? (profile.reportYear ? new Date(profile.reportYear, 0, 1) : null);
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  return (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
}

function pickBand(profile: SuburbProfile, isSectionalTitle: boolean, bedrooms: number | null): RentBand {
  const beds = bedrooms ?? 0;

  if (isSectionalTitle) {
    if (beds <= 1) {
      return { low: profile.stSmallBedLow ?? null, avg: profile.stSmallBedAvg ?? null, high: profile.stSmallBedHigh ?? null, label: "<2Bed Sectional Title" };
    }
    if (beds === 2) {
      return { low: profile.st2BedLow ?? null, avg: profile.st2BedAvg ?? null, high: profile.st2BedHigh ?? null, label: "2Bed Sectional Title" };
    }
    return { low: profile.stLargeBedLow ?? null, avg: profile.stLargeBedAvg ?? null, high: profile.stLargeBedHigh ?? null, label: ">2Bed Sectional Title" };
  }

  if (beds <= 2) {
    return { low: profile.fhSmallBedLow ?? null, avg: profile.fhSmallBedAvg ?? null, high: profile.fhSmallBedHigh ?? null, label: "<3Bed Freehold" };
  }
  if (beds === 3) {
    return { low: profile.fh3BedLow ?? null, avg: profile.fh3BedAvg ?? null, high: profile.fh3BedHigh ?? null, label: "3Bed Freehold" };
  }
  return { low: profile.fhLargeBedLow ?? null, avg: profile.fhLargeBedAvg ?? null, high: profile.fhLargeBedHigh ?? null, label: ">3Bed Freehold" };
}

function computeConfidence(band: RentBand, ageMonths: number | null): Confidence {
  if (band.avg === null) return "low";
  if (ageMonths !== null && ageMonths > 24) return "low";
  if (ageMonths !== null && ageMonths > 12) return "medium";
  if (band.low === null || band.high === null) return "medium";
  return "high";
}

interface CalcRentSuggestionInput {
  strategy: StrategyId;
  isSectionalTitle: boolean;
  bedrooms: number | null;
  /** Multi-Let room count only — see calcStudentCapacity for Student, which has its own room/bed structure and must not fall back to this. */
  numUnits: number | null;
  /** Student's own room mix (single/sharing rooms and beds per sharing room) — the deterministic capacity source for Student deals. */
  studentRoomMix?: { singleRoomCount: number; sharingRoomCount: number; sharingBedsPerRoom: number } | null;
  suburbProfile: SuburbProfile | null;
  currentMonthlyRent?: number | null;
}

export function calcRentSuggestion({
  strategy,
  isSectionalTitle,
  bedrooms,
  numUnits,
  studentRoomMix,
  suburbProfile,
  currentMonthlyRent,
}: CalcRentSuggestionInput): RentSuggestion {
  if (!suburbProfile) {
    return {
      available: false,
      reason: "Link a suburb profile to this deal to see market rent suggestions.",
      primaryEstimate: null,
      primaryLabel: "Primary Income Estimate",
      fallbackEstimate: null,
      fallbackLabel: "Conventional Fallback Rent",
      band: null,
      confidence: "low",
      deltaVsCurrentPct: null,
    };
  }

  const band = pickBand(suburbProfile, isSectionalTitle, bedrooms);
  const ageMonths = reportAgeMonths(suburbProfile);
  const confidence = computeConfidence(band, ageMonths);

  const fallbackEstimate = band.avg;
  let primaryEstimate: number | null = null;
  let primaryLabel = "Primary Income Estimate";

  switch (strategy) {
    case "multi_let": {
      // Multi-Let rent is charged per room (pricePerRoom × numUnits in the
      // real revenue engine — see calcBaseMonthlyRevenue) — numUnits IS the
      // deterministic room count for this strategy.
      const rooms = Math.max(numUnits ?? ROOM_COUNT_FALLBACK, ROOM_COUNT_FALLBACK);
      primaryEstimate = band.avg !== null ? band.avg * MULTI_LET_PREMIUM * (rooms / Math.max(bedrooms ?? rooms, 1)) : null;
      primaryLabel = "Per-Room Aggregate Estimate";
      break;
    }
    case "student": {
      // Student rent is charged per BED, not per room (a sharing room holds
      // several separately-paying beds — see calcStudentAnnualRevenue).
      // numUnits has no defined meaning for Student and must never stand in
      // for its real room/bed structure.
      const capacity = studentRoomMix ? calcStudentCapacity(studentRoomMix) : null;
      const beds = Math.max(capacity?.bedCount ?? ROOM_COUNT_FALLBACK, ROOM_COUNT_FALLBACK);
      primaryEstimate = band.avg !== null ? band.avg * MULTI_LET_PREMIUM * (beds / Math.max(bedrooms ?? beds, 1)) : null;
      primaryLabel = "Per-Bed Aggregate Estimate";
      break;
    }
    case "str":
      // TPN reports don't carry nightly-rate data — no strategy-specific primary estimate available.
      primaryEstimate = null;
      primaryLabel = "Nightly Income Estimate (not covered by suburb data)";
      break;
    case "fix_and_flip":
      primaryEstimate = null;
      primaryLabel = "Not applicable — exit strategy is resale";
      break;
    case "instalment_sale":
      primaryEstimate = null;
      primaryLabel = "Not applicable — income is contractual instalments";
      break;
    default:
      primaryEstimate = band.avg;
      primaryLabel = "Standard Long-Term Rent Estimate";
  }

  const deltaVsCurrentPct =
    primaryEstimate !== null && currentMonthlyRent && currentMonthlyRent > 0
      ? ((primaryEstimate - currentMonthlyRent) / currentMonthlyRent) * 100
      : null;

  return {
    available: true,
    suburbName: suburbProfile.suburbName,
    reportType: suburbProfile.reportType,
    reportAgeMonths: ageMonths,
    primaryEstimate,
    primaryLabel,
    fallbackEstimate,
    fallbackLabel: "Conventional Single-Tenancy Fallback",
    band,
    confidence,
    deltaVsCurrentPct,
  };
}
