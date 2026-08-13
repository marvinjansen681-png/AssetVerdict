import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDeal, upsertCashflowInputs } from "@/lib/db/deals";
import { coerceNumericFields } from "@/lib/coerceNumeric";

const CASHFLOW_NUMERIC_FIELDS = [
  "monthlyRent",
  "occupancyRate",
  "additionalIncome",
  "recoveries",
  "managementFeeValue",
  "maintenanceCostValue",
  "levies",
  "ratesAndTaxes",
  "insurance",
  "waterSewerage",
  "securityCleaning",
  "electricity",
  "badDebtsPct",
  "nightlyRate",
  "avgOccupiedNights",
  "platformFeesPct",
  "academicYearWeeks",
  "pricePerRoom",
  "singleRoomCount",
  "singleRoomRent",
  "singleRoomNsfasBeds",
  "sharingRoomCount",
  "sharingBedsPerRoom",
  "sharingRoomRent",
  "sharingRoomNsfasBeds",
  "nsfasCycleMonths",
  "privateCycleMonths",
  "houseParentCost",
  "internetCost",
  "netflixCost",
  "gasRefillCost",
  "wasteRemovalCost",
  "holdingPeriodMonths",
  "expectedSalePrice",
  "holdingCostPerMonth",
  "instalmentAmount",
  "instalmentTerm",
  "instalmentRate",
] as const;

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

  return NextResponse.json(deal.cashflowInputs);
}

export async function PUT(
  req: Request,
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

  const body = await req.json();
  const coerced = coerceNumericFields(body, CASHFLOW_NUMERIC_FIELDS);
  const updated = await upsertCashflowInputs(params.id, coerced);
  return NextResponse.json(updated);
}
