interface DutyBracket {
  upTo: number;
  rate: number;
  base: number;
}

// South African transfer duty brackets (individuals), 2023+.
const BRACKETS: DutyBracket[] = [
  { upTo: 1_100_000, rate: 0, base: 0 },
  { upTo: 1_512_500, rate: 0.03, base: 0 },
  { upTo: 2_117_500, rate: 0.06, base: 12_375 },
  { upTo: 2_722_500, rate: 0.08, base: 48_675 },
  { upTo: 12_375_000, rate: 0.11, base: 97_075 },
  { upTo: Infinity, rate: 0.13, base: 1_158_850 },
];

export interface TransferDutyBreakdown {
  purchasePrice: number;
  bracketRate: number;
  dutyAmount: number;
  bracketLabel: string;
}

export function calcTransferDuty(purchasePrice: number): TransferDutyBreakdown {
  if (!purchasePrice || purchasePrice <= 0) {
    return {
      purchasePrice: 0,
      bracketRate: 0,
      dutyAmount: 0,
      bracketLabel: "R0 – R1,100,000",
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
