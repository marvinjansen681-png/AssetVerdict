import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDeal, updateDeal, deleteDeal } from "@/lib/db/deals";
import { coerceNumericFields } from "@/lib/coerceNumeric";
import {
  DEAL_PATCH_NUMERIC_FIELDS,
  pickAllowedDealFields,
  validateDealFieldValues,
} from "@/lib/dealFieldPolicy";

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
  // Phase 4.22.1 — explicit allowlist, not a denylist: ONLY the fields in
  // DEAL_PATCH_ALLOWED_FIELDS ever reach the database, regardless of what
  // else a request body contains. This is what actually closes the
  // class of bug Phase 4.22 only partially fixed (deleting `renovationCost`
  // one field at a time) — a derived financial output (totalInvestment,
  // dscr, irr, npv, verdict, negotiation, ...) or a protected field
  // (renovationCost) sent alongside a legitimate field like purchasePrice
  // is silently dropped, never applied, while purchasePrice still saves
  // normally. See lib/dealFieldPolicy.ts for the full classification.
  const picked = pickAllowedDealFields(body);
  const coerced = coerceNumericFields(picked, DEAL_PATCH_NUMERIC_FIELDS);

  // Phase 4.24 (Tasks 21/22) — reject an invalid Purchase Price or a
  // negative Estimated Current Market Value at the API boundary, not just
  // in the Acquisition form's client-side validation.
  const validationError = validateDealFieldValues(coerced);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

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
