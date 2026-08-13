import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDeal } from "@/lib/db/deals";
import { calcAllMetrics } from "@/lib/calculations";
import { assembleInputs, getMissingFields } from "@/lib/calculations/assembleInputs";
import type { DealWithRelations } from "@/types";

export async function POST(
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
  if (getMissingFields(dealWithRelations).length > 0) {
    return NextResponse.json(
      { error: "Complete the deal inputs before requesting mentor comments" },
      { status: 400 }
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured on this server" },
      { status: 503 }
    );
  }

  const inputs = assembleInputs(dealWithRelations);
  const metrics = calcAllMetrics(inputs);
  const currencySymbol = deal.currency === "ZAR" ? "R" : deal.currency;

  const prompt = `You are a property investment mentor for the South African market. Given these metrics: ${JSON.stringify(
    metrics
  )}, provide a concise 2-3 paragraph commentary covering: (1) deal quality verdict, (2) main strengths, (3) main risks to watch. Be direct and specific. Avoid generic advice.

All monetary figures in the metrics are in South African Rand. When you quote any amount, format it with the "${currencySymbol}" symbol (e.g. "${currencySymbol}10,096"), never "$" or "USD" — this deal is not in US dollars. Do not convert or reinterpret the figures, just relabel the currency.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 700,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: "Failed to generate mentor comments" },
      { status: 502 }
    );
  }

  const data = await res.json();
  const commentary = data.content?.[0]?.text ?? "";

  return NextResponse.json({ commentary });
}
