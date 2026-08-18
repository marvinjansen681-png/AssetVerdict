import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDeal } from "@/lib/db/deals";
import { assembleInputs, getMissingFields } from "@/lib/calculations/assembleInputs";
import { analyzeNegotiation } from "@/lib/calculations/negotiation";
import type { DealWithRelations } from "@/types";

/**
 * Read-only negotiation/target-purchase-price analysis (Phase 4.15).
 *
 * Server-authoritative (section 53, 80): the request carries no body — a GET
 * with only the deal id — so there is no field for a client to submit a
 * target price, reduction, or negotiated verdict as truth. Every number is
 * recomputed here from the deal's own stored inputs via the same
 * assembleInputs() path /calculate uses, then handed to the one deterministic
 * negotiation engine (lib/calculations/negotiation.ts), which itself only
 * ever calls the existing calcAllMetrics/deriveDealVerdict engines — no
 * second copy of any financial formula exists in this route.
 */
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
  const strategyId = deal.investmentStrategy ?? "commercial";
  const negotiation = analyzeNegotiation(inputs, strategyId);

  // Same normalization as /coach — the Summary page's own currency-formatted
  // surfaces (VerdictCard, dashboard) all render "R", never the raw ISO code.
  const currency = deal.currency === "ZAR" ? "R" : deal.currency;

  return NextResponse.json({ negotiation, currency });
}
