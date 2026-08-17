import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDeal, upsertFinanceSources } from "@/lib/db/deals";
import { coerceNumericFields } from "@/lib/coerceNumeric";
import { calcMonthlyRepayment } from "@/lib/calculations/amortisation";

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

  // Phase 4.11: repaymentAmount is never trusted from the request body — the
  // server recomputes and overwrites it here using the same amortisation
  // formula the calculation engine uses, so the persisted row can never
  // diverge from the standard fully amortising truth for its own loan
  // terms. Accepted on the wire (see FINANCE_NUMERIC_FIELDS) purely for
  // backward-compatible request shapes; ignored as an input.
  const authoritativeSources = coercedSources.map((s: Record<string, unknown>) => ({
    ...s,
    repaymentAmount: calcMonthlyRepayment(
      typeof s.loanAmount === "number" ? s.loanAmount : 0,
      typeof s.interestRate === "number" ? s.interestRate : 0,
      typeof s.termYears === "number" ? s.termYears : 0
    ),
  }));

  const updated = await upsertFinanceSources(params.id, authoritativeSources);
  return NextResponse.json(updated);
}
