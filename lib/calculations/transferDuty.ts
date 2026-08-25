interface DutyBracket {
  upTo: number;
  rate: number;
  base: number;
}

/**
 * South African transfer duty brackets, effective 1 April 2025 and carried
 * forward unchanged into the 1 April 2026 tax year (National Treasury /
 * SARS transfer duty table: https://www.sars.gov.za/tax-rates/transfer-duty/) —
 * Phase 4.21. These rates apply to BOTH natural and non-natural persons
 * (companies, close corporations, trusts): SARS has used a single unified
 * table since the 2020 tax year, so no separate entity-type table is
 * required here.
 *
 * Superseded the previous R1,100,000-threshold table (labelled "2023+"),
 * which was already two rate updates out of date.
 *
 * Transfer duty applies only to property acquisitions that are NOT subject
 * to VAT (a VAT vendor selling a VAT-able commercial property, for example,
 * falls outside this table entirely) — this module does not model VAT
 * status; see calcTransferDuty's own doc comment and the UI limitation
 * notice in the Acquisition tab.
 */
const BRACKETS: DutyBracket[] = [
  { upTo: 1_210_000, rate: 0, base: 0 },
  { upTo: 1_663_800, rate: 0.03, base: 0 },
  { upTo: 2_329_300, rate: 0.06, base: 13_614 },
  { upTo: 2_994_800, rate: 0.08, base: 53_544 },
  { upTo: 13_310_000, rate: 0.11, base: 106_784 },
  { upTo: Infinity, rate: 0.13, base: 1_241_456 },
];

export interface TransferDutyBreakdown {
  purchasePrice: number;
  bracketRate: number;
  dutyAmount: number;
  bracketLabel: string;
}

/**
 * Estimated South African transfer duty on `purchasePrice` (see BRACKETS'
 * own doc comment for the effective-date/source and the natural/non-natural
 * persons scope). This is a transfer-duty estimate ONLY — it does not
 * determine whether the transaction is even subject to transfer duty in the
 * first place. Transfer duty and VAT are mutually exclusive on a South
 * African property transaction: a sale by a VAT vendor in the course of an
 * enterprise is typically subject to VAT instead of transfer duty. AssetVerdict
 * does not currently model VAT status/registration, so this figure should
 * not be presented as universally applicable — see the Acquisition tab's own
 * limitation notice, shown alongside this estimate.
 */
export function calcTransferDuty(purchasePrice: number): TransferDutyBreakdown {
  if (!purchasePrice || purchasePrice <= 0) {
    return {
      purchasePrice: 0,
      bracketRate: 0,
      dutyAmount: 0,
      bracketLabel: "R0 – R1,210,000",
    };
  }

  let lowerBound = 0;
  for (const bracket of BRACKETS) {
    if (purchasePrice <= bracket.upTo) {
      const dutyAmount =
        bracket.base + (purchasePrice - lowerBound) * bracket.rate;
      return {
        purchasePrice,
        bracketRate: bracket.rate * 100,
        dutyAmount: Math.max(0, dutyAmount),
        bracketLabel:
          bracket.upTo === Infinity
            ? `Above R${lowerBound.toLocaleString()}`
            : `R${lowerBound.toLocaleString()} – R${bracket.upTo.toLocaleString()}`,
      };
    }
    lowerBound = bracket.upTo;
  }

  const last = BRACKETS[BRACKETS.length - 1];
  return {
    purchasePrice,
    bracketRate: last.rate * 100,
    dutyAmount: last.base + (purchasePrice - lowerBound) * last.rate,
    bracketLabel: `Above R${lowerBound.toLocaleString()}`,
  };
}
