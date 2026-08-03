import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSuburbProfile, updateSuburbProfile, deleteSuburbProfile } from "@/lib/db/area";
import { suburbProfileSchema } from "@/lib/validation/suburbProfile";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await getSuburbProfile(params.id, session.user.id);
  if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(profile);
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = suburbProfileSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { reportDate, ...rest } = parsed.data;
  const data = {
    ...rest,
    ...(reportDate !== undefined ? { reportDate: reportDate ? new Date(reportDate) : null } : {}),
  };

  const updated = await updateSuburbProfile(params.id, session.user.id, data);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const deleted = await deleteSuburbProfile(params.id, session.user.id);
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
