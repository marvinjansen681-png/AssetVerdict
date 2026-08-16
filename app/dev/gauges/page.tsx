import { notFound } from "next/navigation";
import GaugeDial from "@/components/gauges/GaugeDial";
import MetricCard from "@/components/gauges/MetricCard";

export default function GaugeDevPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div className="p-8 bg-av-white min-h-screen">
      <h1 className="font-display text-2xl text-av-navy mb-6">
        Gauge Dial States
      </h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <GaugeDial
          value={27}
          unit="%"
          label="IRR"
          tooltipText="Equity IRR — the annualised return on the cash YOU invest in the deal, after financing and tax, over 20 years. Classified against your required return (discountRate)."
          metricKey="irr"
          max={40}
          discountRate={15}
        />
        <GaugeDial
          value={47.39}
          unit="%"
          label="Operating Expense Ratio"
          tooltipText="Operating expenses (excl. debt repayments) as a % of gross revenue. Lower is better."
          metricKey="operatingExpenseRatio"
          max={100}
        />
        <GaugeDial
          value={0.88}
          unit="x"
          label="DSCR"
          tooltipText="Debt Service Coverage Ratio — how many times your NOI covers your annual debt repayments."
          metricKey="dscr"
          max={3}
        />
        <GaugeDial
          value={null}
          unit="%"
          label="No Data"
          tooltipText="This metric has no data yet."
          metricKey="irr"
          max={40}
        />
        <MetricCard
          label="NPV"
          value="R 17,629,878.74"
          tooltipText="Net Present Value — the total value created by this deal in today's money."
          trend="positive"
        />
        <MetricCard
          label="NPV"
          value="-R 1,204,000.00"
          tooltipText="Net Present Value — the total value created by this deal in today's money."
          trend="negative"
        />
      </div>
    </div>
  );
}
