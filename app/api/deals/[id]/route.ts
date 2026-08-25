import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDeal, updateDeal, deleteDeal } from "@/lib/db/deals";
import { coerceNumericFields } from "@/lib/coerceNumeric";

const DEAL_NUMERIC_FIELDS = [
  "askingPrice",
  "purchasePrice",
  "marketValue",
  "transferBondCost",
  // renovationCost is deliberately EXCLUDED (Phase 4.22): it is
  // server-authoritative, derived from furniture/setup/renovation line
  // items via calcFurnitureCostSummary, and settable ONLY through
  // /api/deals/[id]/renovation. See the PATCH handler below, which
  // additionally strips it even if a request body includes it — the
  // browser must never be trusted to hand this endpoint a total directly.
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
  "erfSize",
  "floorSize",
  "bedrooms",
  "bathrooms",
  "garages",
  "numUnits",
  "yearBuilt",
  "schemeLevy",
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
  const coerced = coerceNumericFields(body, DEAL_NUMERIC_FIELDS) as Record<string, unknown>;
  // Phase 4.22 trust boundary: renovationCost must never be settable from
  // this general-purpose PATCH endpoint, no matter what a request body
  // happens to include — it is authoritative ONLY via
  // /api/deals/[id]/renovation (which recomputes it from furniture/setup
  // line items, never trusts a client-sent total).
  delete coerced.renovationCost;
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
