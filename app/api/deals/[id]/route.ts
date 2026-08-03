import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDeal, updateDeal, deleteDeal } from "@/lib/db/deals";
import { coerceNumericFields } from "@/lib/coerceNumeric";

const DEAL_NUMERIC_FIELDS = [
  "askingPrice",
  "purchasePrice",
  "marketValue",
  "transferBondCost",
  "renovationCost",
  "sourcingFee",
  "agentCommission",
  "saleYear",
  "incomeTaxRate",
  "capitalGainsTaxRate",
  "capitalGrowthRate",
  "rentalGrowthRate",
  "costInflation",
  "sustainableGrowthRate",
  "discountRate",
  "realGrowthFactor",
  "occupationFactor",
  "marketCapRate",
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

  return NextResponse.json(deal);
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const coerced = coerceNumericFields(body, DEAL_NUMERIC_FIELDS);
  const updated = await updateDeal(params.id, session.user.id, coerced);
  if (!updated) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const deleted = await deleteDeal(params.id, session.user.id);
  if (!deleted) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
