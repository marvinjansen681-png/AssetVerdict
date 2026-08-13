/**
 * NSFAS Student Accommodation Grading Levels — Annexure B V1.1, as at
 * 21 February 2025. Monthly rent payable per bed, over the NSFAS 10-month
 * academic-year funding cycle.
 */
export interface NsfasGradeRates {
  grade: "A" | "B" | "C" | "D" | "E";
  single: { metro: number; nonMetro: number };
  sharing: { metro: number; nonMetro: number };
}

export const NSFAS_GRADES: NsfasGradeRates[] = [
  { grade: "A", single: { metro: 4940.0, nonMetro: 4050.8 }, sharing: { metro: 4693.0, nonMetro: 3848.26 } },
  { grade: "B", single: { metro: 4693.0, nonMetro: 3848.26 }, sharing: { metro: 4458.35, nonMetro: 3655.85 } },
  { grade: "C", single: { metro: 4458.35, nonMetro: 3655.85 }, sharing: { metro: 4235.43, nonMetro: 3473.05 } },
  { grade: "D", single: { metro: 4235.43, nonMetro: 3473.05 }, sharing: { metro: 4023.66, nonMetro: 3299.4 } },
  { grade: "E", single: { metro: 4023.66, nonMetro: 3299.4 }, sharing: { metro: 3822.48, nonMetro: 3134.43 } },
];

export const NSFAS_METRO_MUNICIPALITIES = [
  "Buffalo City Metropolitan Municipality",
  "City of Cape Town",
  "City of eThekwini",
  "City of Johannesburg",
  "City of Tshwane",
  "Ekurhuleni Metropolitan Municipality",
  "Mangaung Municipality",
  "Nelson Mandela Bay Metropolitan Municipality",
];

export function getNsfasRate(
  grade: NsfasGradeRates["grade"],
  roomType: "single" | "sharing",
  area: "metro" | "nonMetro"
): number | null {
  const row = NSFAS_GRADES.find((g) => g.grade === grade);
  if (!row) return null;
  return row[roomType][area];
}
