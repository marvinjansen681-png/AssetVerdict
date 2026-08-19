/**
 * Deterministic compounding-equivalent return-annualisation (Phase 4.17.1).
 *
 * Before this phase, TWO independent implementations of "annualise a
 * holding-period return" existed: fixFlip.ts's inline compounding formula
 * (the correct one, adopted in Phase 4.17) and index.ts's calcFlipProfit,
 * which still used a linear approximation (ROI / holdingYears) left over
 * from before Phase 4.17. Both are replaced by this one function.
 *
 * Zero internal dependencies, deliberately: lib/calculations/index.ts and
 * lib/calculations/fixFlip.ts already have a circular relationship with
 * each other (fixFlip.ts imports primitives from index.ts; index.ts imports
 * calcFixFlipAnalysis from fixFlip.ts — see index.ts's own doc comment on
 * why that's safe). This module must not import from either, so both can
 * import it without adding a second circular edge.
 */

/**
 * annualised = (1 + roiPercent / 100) ^ (12 / holdingPeriodMonths) − 1
 *
 * Returns null — never 0, NaN, or Infinity — when the result isn't a real,
 * meaningful annualised rate:
 *   - holdingPeriodMonths <= 0 (or non-finite): an invalid/unknown duration
 *     has no annualised rate. This is NOT the same thing as a 0% return —
 *     a 0% return is a real economic outcome; an invalid duration is not
 *     calculable at all.
 *   - roiPercent <= -100%: 1 + roiFraction <= 0 makes the fractional power
 *     mathematically undefined (a non-positive base raised to a non-integer
 *     exponent), not merely "a very negative number."
 */
export function annualiseReturnOverMonths(roiPercent: number, holdingPeriodMonths: number): number | null {
  if (typeof roiPercent !== "number" || !isFinite(roiPercent)) return null;
  if (typeof holdingPeriodMonths !== "number" || !isFinite(holdingPeriodMonths) || holdingPeriodMonths <= 0) return null;

  const roiFraction = roiPercent / 100;
  if (roiFraction <= -1) return null;

  const annualised = (Math.pow(1 + roiFraction, 12 / holdingPeriodMonths) - 1) * 100;
  return isFinite(annualised) ? annualised : null;
}
