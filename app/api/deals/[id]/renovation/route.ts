import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getDeal, upsertRenovationItems } from "@/lib/db/deals";
import { prisma } from "@/lib/db";

const itemSchema = z.object({
  category: z.string().min(1),
  description: z.string(),
  budgeted: z.number().nonnegative(),
  quoted: z.number().nonnegative().nullable().optional(),
  status: z.string(),
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

  const item = await prisma.renovationItem.create({
    data: { ...parsed.data, dealId: params.id, order: deal.renovationItems.length },
  });

  const total =
    deal.renovationItems.reduce((sum, i) => sum + i.budgeted, 0) + item.budgeted;
  await prisma.deal.update({
    where: { id: params.id },
    data: { renovationCost: total },
  });

  return NextResponse.json(item, { status: 201 });
}
