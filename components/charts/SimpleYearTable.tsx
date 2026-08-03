import type { YearlyProjection } from "@/lib/calculations";

interface SimpleYearTableProps {
  projection: YearlyProjection[];
  rows: { label: string; get: (p: YearlyProjection) => number }[];
}

const HIGHLIGHT_YEARS = [1, 2, 3, 4, 5, 10, 15, 20];

export default function SimpleYearTable({ projection, rows }: SimpleYearTableProps) {
  const years = projection.filter((p) => HIGHLIGHT_YEARS.includes(p.year));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm font-body min-w-[600px]">
        <thead>
          <tr className="bg-av-light-grey text-av-navy">
            <th className="text-left px-3 py-2 font-semibold">Metric</th>
            {years.map((y) => (
              <th key={y.year} className="text-right px-3 py-2 font-semibold">
                Year {y.year}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-av-light-grey">
              <td className="px-3 py-2 text-av-navy">{row.label}</td>
              {years.map((y) => (
                <td key={y.year} className="text-right px-3 py-2 font-mono text-av-slate">
                  R {row.get(y).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
