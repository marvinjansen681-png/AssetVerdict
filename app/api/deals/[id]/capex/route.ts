import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getDeal } from "@/lib/db/deals";
import { prisma } from "@/lib/db";

const capexSchema = z.object({
  label: z.string().min(1),
  amount: z.number().nonnegative(),
  color: z.string().optional(),
});

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
  const parsed = capexSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const item = await prisma.capexItem.create({
    data: { ...parsed.data, dealId: params.id },
  });

  return NextResponse.json(item, { status: 201 });
}
