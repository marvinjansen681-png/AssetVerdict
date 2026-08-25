import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getDeal, upsertRenovationItems } from "@/lib/db/deals";
import { prisma } from "@/lib/db";
import { calcFurnitureItemBudgetCost, calcFurnitureCostSummary, CONTINGENCY_CATEGORY } from "@/lib/calculations/furnitureCosts";

const itemSchema = z.object({
  category: z.string().min(1),
  description: z.string(),
  budgeted: z.number().nonnegative(),
  quoted: z.number().nonnegative().nullable().optional(),
  status: z.string(),
  quantity: z.number().nonnegative().nullable().optional(),
  unitCost: z.number().nonnegative().nullable().optional(),
});

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

  return NextResponse.json(deal.renovationItems);
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
  const items = Array.isArray(body.items) ? body.items : [];
  const parsed = z.array(itemSchema).safeParse(items);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Server-side trust boundary (Phase 4.22, requirement 9): reject a
  // request carrying more than one Contingency-category item, regardless of
  // whether the UI's own single-control design should already prevent this.
  const contingencyCount = parsed.data.filter((i) => i.category === CONTINGENCY_CATEGORY).length;
  if (contingencyCount > 1) {
    return NextResponse.json(
      { error: "Only one Contingency item is allowed per deal." },
      { status: 400 }
    );
  }

  const updated = await upsertRenovationItems(params.id, parsed.data);
  return NextResponse.json(updated);
}

export async function POST(
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
  const parsed = itemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existingContingencyCount = deal.renovationItems.filter(
    (i) => i.category === CONTINGENCY_CATEGORY
  ).length;
  if (parsed.data.category === CONTINGENCY_CATEGORY && existingContingencyCount >= 1) {
    return NextResponse.json(
      { error: "Only one Contingency item is allowed per deal." },
      { status: 400 }
    );
  }

  // Server-authoritative recomputation (Phase 4.22, requirement 13) — a
  // conflicting client-sent `budgeted` is never trusted once
  // quantity/unitCost are present.
  const budgeted = calcFurnitureItemBudgetCost({
    quantity: parsed.data.quantity ?? null,
    unitCost: parsed.data.unitCost ?? null,
    budgeted: parsed.data.budgeted,
  }) ?? 0;

  const item = await prisma.renovationItem.create({
    data: { ...parsed.data, budgeted, dealId: params.id, order: deal.renovationItems.length },
  });

  // Deal.renovationCost = calcFurnitureCostSummary's own grandTotal (Cost
  // Used, quote-or-budget per item, plus dynamic contingency) — never a
  // naive sum of `budgeted` alone (Phase 4.22, requirement 17).
  const allNonContingency = [...deal.renovationItems, item].filter(
    (i) => i.category !== CONTINGENCY_CATEGORY
  );
  const contingencyItem = [...deal.renovationItems, item].find(
    (i) => i.category === CONTINGENCY_CATEGORY
  );
  const summary = calcFurnitureCostSummary(allNonContingency, contingencyItem?.unitCost ?? null);
  await prisma.deal.update({
    where: { id: params.id },
    data: { renovationCost: summary.grandTotal },
  });

  return NextResponse.json(item, { status: 201 });
}
