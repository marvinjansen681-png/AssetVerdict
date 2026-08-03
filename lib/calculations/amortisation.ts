/**
 * Standard monthly amortisation payment.
 * Falls back to straight principal/term when rate is 0 to avoid division by zero.
 */
export function calcMonthlyRepayment(
  loanAmount: number,
  interestRatePct: number,
  termYears: number
): number {
  if (!loanAmount || loanAmount <= 0 || !termYears || termYears <= 0) return 0;

  const n = termYears * 12;
  const r = interestRatePct / 12 / 100;

  if (r === 0) return loanAmount / n;

  const factor = Math.pow(1 + r, n);
  return (loanAmount * (r * factor)) / (factor - 1);
}
