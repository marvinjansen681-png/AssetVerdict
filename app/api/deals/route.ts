import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { createDeal } from "@/lib/db/deals";

const createDealSchema = z.object({
  name: z.string().min(1),
  propertyType: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createDealSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const deal = await createDeal(session.user.id, parsed.data);
  return NextResponse.json({ id: deal.id }, { status: 201 });
}
