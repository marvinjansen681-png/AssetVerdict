import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDeal } from "@/lib/db/deals";
import { calcAllMetrics, calc20YearProjection } from "@/lib/calculations";
import { calcScenarios } from "@/lib/calculations/scenarios";
import { assembleInputs, getMissingFields } from "@/lib/calculations/assembleInputs";
import { calcMonthlyRepayment } from "@/lib/calculations/amortisation";
import { deriveDealVerdict } from "@/lib/calculations/verdict";
import { calcFlipExitValueAnalysis, type FlipExitValuationInput } from "@/lib/calculations/fixFlipExitValue";
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
  // Phase 4.14: derived fresh on every request from server-recomputed
  // metrics (never persisted, never client-supplied — see verdict.ts's own
  // doc comment). Base case only (Phase 4.14 section 97) — deliberately
  // uses `metrics`/`inputs` above, not any scenario variant.
  const strategyId = deal.investmentStrategy ?? "commercial";

  // Phase 4.19/4.20 — server-authoritative exit-value evidence/scenario
  // model, Fix & Flip only. Deliberately mapped onto the narrow
  // FlipExitValuationInput shape here (see fixFlipExitValue.ts's own doc
  // comment) rather than passed as the full Prisma-hydrated relation,
  // keeping lib/calculations decoupled from the DB schema. Computed ONCE
  // and fed to both the verdict (below) and the API response — never
  // recomputed for each consumer (Phase 4.20 section 48).
  const propertyValuation = dealWithRelations.propertyValuation;
  const flipValuationInput: FlipExitValuationInput | null = propertyValuation
    ? {
        estimatedValue: propertyValuation.estimatedValue ?? null,
        valueConfidenceLow: propertyValuation.valueConfidenceLow ?? null,
        valueConfidenceHigh: propertyValuation.valueConfidenceHigh ?? null,
        valuationConfidence: propertyValuation.valuationConfidence ?? null,
        valuationBasis: (propertyValuation.valuationBasis as FlipExitValuationInput["valuationBasis"]) ?? "unknown",
        reportSource: propertyValuation.reportSource ?? null,
        reportDate: propertyValuation.reportDate ?? null,
        comparableCount: propertyValuation.comparables?.length ?? 0,
      }
    : null;
  const fixFlipExitValueAnalysis =
    strategyId === "fix_and_flip" ? calcFlipExitValueAnalysis({ inputs, valuation: flipValuationInput }) : undefined;

  const verdict = deriveDealVerdict({ strategyId, inputs, metrics, flipExitValueAnalysis: fixFlipExitValueAnalysis });

  const primaryDealSuburb =
    dealWithRelations.dealSuburbs.find((ds) => ds.isPrimary) ?? dealWithRelations.dealSuburbs[0] ?? null;

  return NextResponse.json({
    propertyValuation: dealWithRelations.propertyValuation,
    fixFlipExitValueAnalysis,
    suburbProfile: primaryDealSuburb?.suburbProfile ?? null,
    metrics,
    verdict,
    projection,
    scenarios,
    dealName: deal.name,
    address: deal.address,
    currency: deal.currency,
    investmentStrategy: strategyId,
    rentalGrowthRate: inputs.rentalGrowthRate,
    costInflation: inputs.costInflation,
    discountRate: inputs.discountRate,
    capexItems: deal.capexItems,
    renovationItems: deal.renovationItems,
    dealSummary: {
      askingPrice: deal.askingPrice,
      purchasePrice: deal.purchasePrice,
      marketValue: deal.marketValue,
      transferBondCost: deal.transferBondCost,
      renovationCost: deal.renovationCost,
      sourcingFee: deal.sourcingFee,
      // repaymentAmount is recomputed here rather than read from storage
      // (Phase 4.11) so PDF/UI display is correct even for rows saved
      // before the server-authoritative write path shipped.
      financeSources: deal.financeSources.map((f) => ({
        sourceType: f.sourceType,
        loanAmount: f.loanAmount,
        interestRate: f.interestRate,
        termYears: f.termYears,
        repaymentAmount: calcMonthlyRepayment(f.loanAmount ?? 0, f.interestRate ?? 0, f.termYears ?? 0),
      })),
      monthlyRent: deal.cashflowInputs?.monthlyRent ?? null,
      occupancyRate: deal.cashflowInputs?.occupancyRate ?? null,
      leaseTermMonths: deal.cashflowInputs?.leaseTermMonths ?? null,
      singleRoomCount: deal.cashflowInputs?.singleRoomCount ?? null,
      sharingRoomCount: deal.cashflowInputs?.sharingRoomCount ?? null,
      sharingBedsPerRoom: deal.cashflowInputs?.sharingBedsPerRoom ?? null,
      erfNumber: deal.erfNumber,
      erfSize: deal.erfSize,
      floorSize: deal.floorSize,
      yearBuilt: deal.yearBuilt,
      propertyZoning: deal.propertyZoning,
      titleDeedNumber: deal.titleDeedNumber,
      ratesAccountNumber: deal.ratesAccountNumber,
      bedrooms: deal.bedrooms,
      bathrooms: deal.bathrooms,
      garages: deal.garages,
      numUnits: deal.numUnits,
      isSectionalTitle: deal.isSectionalTitle,
      unitNumber: deal.unitNumber,
      schemeName: deal.schemeName,
      schemeLevy: deal.schemeLevy,
      capitalGrowthRate: deal.capitalGrowthRate,
      saleYear: deal.saleYear,
      wantToSell: deal.wantToSell,
    },
  });
}
