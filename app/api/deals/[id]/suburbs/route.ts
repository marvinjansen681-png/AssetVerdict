import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getDeal } from "@/lib/db/deals";
import { getDealSuburbs, linkSuburbToDeal, unlinkSuburbFromDeal } from "@/lib/db/area";

const linkSchema = z.object({
  suburbProfileId: z.string().min(1),
  isPrimary: z.boolean().optional(),
});

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const deal = await getDeal(params.id, session.user.id);
  if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

  const links = await getDealSuburbs(params.id);
  return NextResponse.json(links);
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const deal = await getDeal(params.id, session.user.id);
  if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

  const body = await req.json();
  const parsed = linkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.flatten() }, { status: 400 });
  }

  const link = await linkSuburbToDeal(params.id, parsed.data.suburbProfileId, parsed.data.isPrimary ?? true);
  return NextResponse.json(link, { status: 201 });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const deal = await getDeal(params.id, session.user.id);
  if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const suburbProfileId = searchParams.get("suburbProfileId");
  if (!suburbProfileId) {
    return NextResponse.json({ error: "suburbProfileId query param required" }, { status: 400 });
  }

  await unlinkSuburbFromDeal(params.id, suburbProfileId);
  return NextResponse.json({ ok: true });
}
