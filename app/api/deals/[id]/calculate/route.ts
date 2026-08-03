import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDeal } from "@/lib/db/deals";
import { calcAllMetrics, calc20YearProjection } from "@/lib/calculations";
import { calcScenarios } from "@/lib/calculations/scenarios";
import { assembleInputs, getMissingFields } from "@/lib/calculations/assembleInputs";
import type { DealWithRelations } from "@/types";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const deal = await getDeal(params.id, session.user.id);
  if (!deal) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  }

  const dealWithRelations = deal as unknown as DealWithRelations;
  const missingFields = getMissingFields(dealWithRelations);
  if (missingFields.length > 0) {
    return NextResponse.json(
      { error: "Missing required fields", missingFields },
      { status: 400 }
    );
  }

  const inputs = assembleInputs(dealWithRelations);
  const metrics = calcAllMetrics(inputs);
  const projection = calc20YearProjection(inputs);
  const scenarios = calcScenarios(inputs, {
    realGrowthFactor: deal.realGrowthFactor ?? 10,
    occupationFactor: deal.occupationFactor ?? 10,
  });

  return NextResponse.json({
    metrics,
    projection,
    scenarios,
    dealName: deal.name,
    address: deal.address,
    currency: deal.currency,
    investmentStrategy: deal.investmentStrategy ?? "commercial",
    rentalGrowthRate: inputs.rentalGrowthRate,
    costInflation: inputs.costInflation,
    capexItems: deal.capexItems,
    dealSummary: {
      askingPrice: deal.askingPrice,
      purchasePrice: deal.purchasePrice,
      marketValue: deal.marketValue,
      transferBondCost: deal.transferBondCost,
      renovationCost: deal.renovationCost,
      sourcingFee: deal.sourcingFee,
      financeSources: deal.financeSources.map((f) => ({
        sourceType: f.sourceType,
        loanAmount: f.loanAmount,
        interestRate: f.interestRate,
        termYears: f.termYears,
        repaymentAmount: f.repaymentAmount,
      })),
      monthlyRent: deal.cashflowInputs?.monthlyRent ?? null,
      occupancyRate: deal.cashflowInputs?.occupancyRate ?? null,
    },
  });
}
