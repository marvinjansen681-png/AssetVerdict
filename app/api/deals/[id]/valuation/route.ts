import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getDeal } from "@/lib/db/deals";
import { getPropertyValuation, upsertPropertyValuation, deletePropertyValuation } from "@/lib/db/area";

const transactionSchema = z.object({
  transferDate: z.string().nullable().optional(),
  purchasePrice: z.number().nullable().optional(),
  buyerName: z.string().nullable().optional(),
  sellerName: z.string().nullable().optional(),
});

const bondSchema = z.object({
  registrationDate: z.string().nullable().optional(),
  bondAmount: z.number().nullable().optional(),
  bondHolder: z.string().nullable().optional(),
  bondType: z.string().nullable().optional(),
});

const comparableSchema = z.object({
  address: z.string().nullable().optional(),
  sgCode: z.string().nullable().optional(),
  saleDate: z.string().nullable().optional(),
  salePrice: z.number().nullable().optional(),
  extentSqm: z.number().nullable().optional(),
  buildingSizeSqm: z.number().nullable().optional(),
  pricePerSqm: z.number().nullable().optional(),
  distanceKm: z.number().nullable().optional(),
});

const valuationSchema = z.object({
  reportDate: z.string().nullable().optional(),
  sgCode: z.string().nullable().optional(),
  reportSource: z.string().optional(),
  // Phase 4.20 — only these three; reject anything else rather than accept
  // an arbitrary string a future verdict phase might mistakenly trust.
  valuationBasis: z.enum(["unknown", "current_condition", "post_renovation"]).optional(),
  propertyDescription: z.string().nullable().optional(),
  extentSqm: z.number().nullable().optional(),
  zoning: z.string().nullable().optional(),
  buildingSizeSqm: z.number().nullable().optional(),
  bedroomsReported: z.number().int().nullable().optional(),
  bathroomsReported: z.number().int().nullable().optional(),
  garagesReported: z.number().int().nullable().optional(),
  yearBuiltReported: z.number().int().nullable().optional(),
  estimatedValue: z.number().nullable().optional(),
  valueConfidenceLow: z.number().nullable().optional(),
  valueConfidenceHigh: z.number().nullable().optional(),
  valuationConfidence: z.string().nullable().optional(),
  pricePerSqm: z.number().nullable().optional(),
  currentOwnerSince: z.string().nullable().optional(),
  ownerAgeBand: z.string().nullable().optional(),
  transactions: z.array(transactionSchema).default([]),
  bonds: z.array(bondSchema).default([]),
  comparables: z.array(comparableSchema).default([]),
});

function toDate(value: string | null | undefined) {
  return value ? new Date(value) : null;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const deal = await getDeal(params.id, session.user.id);
  if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

  const valuation = await getPropertyValuation(params.id);
  return NextResponse.json(valuation);
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const deal = await getDeal(params.id, session.user.id);
  if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

  const body = await req.json();
  const parsed = valuationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { transactions, bonds, comparables, reportDate, currentOwnerSince, ...rest } = parsed.data;

  const valuation = await upsertPropertyValuation(
    params.id,
    {
      ...rest,
      reportDate: toDate(reportDate),
      currentOwnerSince: toDate(currentOwnerSince),
    },
    transactions.map((t) => ({ ...t, transferDate: toDate(t.transferDate) })),
    bonds.map((b) => ({ ...b, registrationDate: toDate(b.registrationDate) })),
    comparables.map((c) => ({ ...c, saleDate: toDate(c.saleDate) }))
  );

  return NextResponse.json(valuation);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const deal = await getDeal(params.id, session.user.id);
  if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

  await deletePropertyValuation(params.id);
  return NextResponse.json({ ok: true });
}
