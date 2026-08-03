import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDeal, upsertFinanceSources } from "@/lib/db/deals";
import { coerceNumericFields } from "@/lib/coerceNumeric";

const FINANCE_NUMERIC_FIELDS = [
  "ltvValue",
  "loanAmount",
  "interestRate",
  "termYears",
  "repaymentAmount",
  "order",
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

  return NextResponse.json(deal.financeSources);
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
  const sources = Array.isArray(body.financeSources) ? body.financeSources : [];
  const coercedSources = sources.map((s: Record<string, unknown>) =>
    coerceNumericFields(s, FINANCE_NUMERIC_FIELDS)
  );

  const updated = await upsertFinanceSources(params.id, coercedSources);
  return NextResponse.json(updated);
}
