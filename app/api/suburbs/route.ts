import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listSuburbProfiles, createSuburbProfile } from "@/lib/db/area";
import { suburbProfileSchema } from "@/lib/validation/suburbProfile";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profiles = await listSuburbProfiles(session.user.id);
  return NextResponse.json(profiles);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = suburbProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { reportDate, ...rest } = parsed.data;
  const profile = await createSuburbProfile(session.user.id, {
    ...rest,
    reportDate: reportDate ? new Date(reportDate) : null,
  });
  return NextResponse.json(profile, { status: 201 });
}
