import type { PropertyValuation } from "@/types";

/**
 * Whether a PropertyValuation record contains enough real evidence to justify
 * showing valuation-evidence UI (AVM card, confidence badge, comparables).
 *
 * A `PropertyValuation` row is created eagerly (see PropertyValuationPanel /
 * the valuation API route) the moment a user opens the panel, with every
 * field null and `reportSource` defaulted to a fixed string — so the row's
 * mere existence proves nothing. This is the one place that decides "real
 * evidence" vs. "empty stub"; nothing else should re-derive that decision
 * from individual field checks.
 *
 * `estimatedValue`/`pricePerSqm` use `> 0`, not just non-null: a stored 0
 * would never represent a real valuation (no property is worth R0), so
 * treating it as "confirmed zero" would be a worse bug than treating it as
 * absent. Every other field uses an explicit null/undefined check rather than
 * `Boolean(value)`, since 0 is not a meaningful concern there and blank
 * strings/empty arrays already read as falsy by construction.
 */
export function hasMeaningfulPropertyValuation(
  valuation: PropertyValuation | null | undefined
): boolean {
  if (!valuation) return false;

  const hasEstimatedValue = valuation.estimatedValue !== null && valuation.estimatedValue !== undefined && valuation.estimatedValue > 0;
  const hasConfidenceRange = valuation.valueConfidenceLow !== null && valuation.valueConfidenceLow !== undefined
    || (valuation.valueConfidenceHigh !== null && valuation.valueConfidenceHigh !== undefined);
  const hasConfidenceLabel = Boolean(valuation.valuationConfidence);
  const hasPricePerSqm = valuation.pricePerSqm !== null && valuation.pricePerSqm !== undefined && valuation.pricePerSqm > 0;
  const hasComparables = valuation.comparables.length > 0;
  const hasTransactions = valuation.transactions.length > 0;
  const hasBonds = valuation.bonds.length > 0;

  return (
    hasEstimatedValue ||
    hasConfidenceRange ||
    hasConfidenceLabel ||
    hasPricePerSqm ||
    hasComparables ||
    hasTransactions ||
    hasBonds
  );
}
