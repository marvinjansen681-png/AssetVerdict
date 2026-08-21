import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getDeal } from "@/lib/db/deals";
import { calcScenarios } from "@/lib/calculations/scenarios";
import { assembleInputs, getMissingFields } from "@/lib/calculations/assembleInputs";
import { getMetricDefinition } from "@/lib/education/metricDefinitions";
import { buildDealCoachContext } from "@/lib/ai/buildDealCoachContext";
import type { FlipExitValuationInput } from "@/lib/calculations/fixFlipExitValue";
import { buildDealCoachSystemPrompt, DEAL_COACH_RESPONSE_TOOL } from "@/lib/ai/dealCoachPrompt";
import { callAnthropicMessages, DEAL_COACH_MODEL, type AnthropicMessage } from "@/lib/ai/anthropicClient";
import type { DealCoachIntent, DealCoachResponse, DealCoachSelection, ScenarioKey } from "@/lib/ai/dealCoachTypes";
import type { AcquisitionSummary } from "@/lib/education/metricBreakdowns";
import type { DealWithRelations } from "@/types";

// Keep the request small (section 24/34): a Deal Coach message is a chat
// turn, not a document, and the conversation is a short back-and-forth, not
// a transcript archive.
const MAX_CONVERSATION_TURNS = 12;

const ScenarioKeySchema = z.enum(["bear", "base", "bull"]);

const IntentSchema = z.enum([
  "explain_metric",
  "explain_deal_simple",
  "identify_risks",
  "identify_strengths",
  "list_assumptions_to_verify",
  "identify_failure_modes",
  "compare_scenarios",
  "due_diligence",
  "teach_deal",
  "general_question",
]);

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

const CoachRequestSchema = z.object({
  message: z.string().min(1).max(2000),
  intent: IntentSchema.optional(),
  selectedMetric: z.string().min(1).max(64).optional(),
  activeScenario: ScenarioKeySchema.optional(),
  conversation: z.array(MessageSchema).max(30).optional(),
});

// referencedMetrics/suggestedFollowUps are cosmetic (UI chips, not the
// answer itself) — if the model's tool call is malformed on just one of
// these, degrade gracefully to "absent" instead of discarding a valid
// answer over it.
const ToolOutputSchema = z.object({
  answer: z.string().min(1),
  referencedMetrics: z.array(z.string()).optional().catch(undefined),
  suggestedFollowUps: z.array(z.string()).optional().catch(undefined),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = CoachRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", detail: parsed.error.issues[0]?.message },
      { status: 400 }
    );
  }
  const body = parsed.data;

  // SECURITY (section 25): the request schema above has no field for any
  // financial value — dscr, irr, cashflow, etc. Even if a client sent them
  // anyway, zod's default parse silently drops unknown keys. Everything
  // financial is recomputed from the database below; the client only ever
  // supplies which deal/metric/scenario it's asking about, never what the
  // answer should be.

  // Ownership is enforced by getDeal's own query (deal scoped to userId),
  // matching every other deal-scoped route in this codebase — a 404 either
  // way avoids revealing whether a deal ID exists for another user.
  const deal = await getDeal(params.id, session.user.id);
  if (!deal) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  }

  const dealWithRelations = deal as unknown as DealWithRelations;
  if (getMissingFields(dealWithRelations).length > 0) {
    return NextResponse.json(
      { error: "Complete the deal inputs before asking Deal Coach about this deal" },
      { status: 400 }
    );
  }

  if (body.selectedMetric && !getMetricDefinition(body.selectedMetric)) {
    return NextResponse.json({ error: "Unknown metric" }, { status: 400 });
  }

  const intent: DealCoachIntent = body.intent ?? (body.selectedMetric ? "explain_metric" : "general_question");
  if (intent === "explain_metric" && !body.selectedMetric) {
    return NextResponse.json({ error: "selectedMetric is required for intent 'explain_metric'" }, { status: 400 });
  }

  const strategyId = deal.investmentStrategy ?? "commercial";
  const activeScenario: ScenarioKey = body.activeScenario ?? "base";

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Deal Coach isn't configured on this server yet. Your deal calculations are unaffected." },
      { status: 503 }
    );
  }

  // Authoritative recompute — never trust anything the client says about the
  // deal's numbers. This is the exact same inputs->metrics path /calculate
  // and /coach's predecessor (/mentor) use.
  const inputs = assembleInputs(dealWithRelations);
  const scenarios = calcScenarios(inputs, {
    realGrowthFactor: deal.realGrowthFactor ?? 10,
    occupationFactor: deal.occupationFactor ?? 10,
  });
  const activeMetrics = scenarios[activeScenario].metrics;

  const dealSummary: AcquisitionSummary = {
    purchasePrice: deal.purchasePrice ?? null,
    marketValue: deal.marketValue ?? null,
  };

  // Same primary-suburb resolution as /calculate — first profile flagged
  // isPrimary, else the first linked profile, else none.
  const primaryDealSuburb =
    dealWithRelations.dealSuburbs.find((ds) => ds.isPrimary) ?? dealWithRelations.dealSuburbs[0] ?? null;

  const selection: DealCoachSelection = body.selectedMetric
    ? { type: "metric", metricKey: body.selectedMetric }
    : { type: "deal" };

  // Phase 4.19 — same narrow mapping /calculate uses, so Deal Coach's
  // exit-value evidence is built from exactly the same server-authoritative
  // record the Summary UI/PDF read, never a client-supplied figure.
  const propertyValuationRecord = dealWithRelations.propertyValuation;
  const flipValuationInput: FlipExitValuationInput | null = propertyValuationRecord
    ? {
        estimatedValue: propertyValuationRecord.estimatedValue ?? null,
        valueConfidenceLow: propertyValuationRecord.valueConfidenceLow ?? null,
        valueConfidenceHigh: propertyValuationRecord.valueConfidenceHigh ?? null,
        valuationConfidence: propertyValuationRecord.valuationConfidence ?? null,
        valuationBasis: (propertyValuationRecord.valuationBasis as FlipExitValuationInput["valuationBasis"]) ?? "unknown",
        reportSource: propertyValuationRecord.reportSource ?? null,
        reportDate: propertyValuationRecord.reportDate ?? null,
        comparableCount: propertyValuationRecord.comparables?.length ?? 0,
      }
    : null;

  const context = buildDealCoachContext({
    inputs,
    metrics: activeMetrics,
    dealName: deal.name,
    address: deal.address,
    currency: deal.currency === "ZAR" ? "R" : deal.currency,
    strategyId,
    activeScenario,
    selection,
    intent,
    dealSummary,
    // Phase 4.14: verdict is always derived from the Base case (section 97),
    // regardless of activeScenario — buildDealCoachContext computes it from
    // this, not from `metrics` above.
    baseMetrics: scenarios.base.metrics,
    scenarios: intent === "compare_scenarios" ? scenarios : undefined,
    areaSuggestionInputs: {
      suburbProfile: primaryDealSuburb?.suburbProfile ?? null,
      isSectionalTitle: deal.isSectionalTitle,
      bedrooms: deal.bedrooms ?? null,
      numUnits: deal.numUnits ?? null,
    },
    leaseTermMonths: dealWithRelations.cashflowInputs?.leaseTermMonths ?? null,
    propertyValuation: flipValuationInput,
  });

  const system = buildDealCoachSystemPrompt(context);

  const conversation = (body.conversation ?? []).slice(-MAX_CONVERSATION_TURNS);
  const messages: AnthropicMessage[] = [
    ...conversation.map((m) => ({ role: m.role, content: m.content })),
    { role: "user" as const, content: body.message },
  ];

  const result = await callAnthropicMessages({
    model: DEAL_COACH_MODEL,
    system,
    messages,
    maxTokens: 1200,
    tools: [DEAL_COACH_RESPONSE_TOOL],
    toolChoice: { type: "tool", name: DEAL_COACH_RESPONSE_TOOL.name },
  });

  if (!result.ok) {
    if (result.kind === "timeout") {
      return NextResponse.json(
        { error: "Deal Coach took too long to respond. Your deal calculations are unaffected." },
        { status: 504 }
      );
    }
    if (result.status === 429) {
      return NextResponse.json(
        { error: "Deal Coach is busy right now. Please try again in a moment." },
        { status: 429 }
      );
    }
    console.error("Deal Coach: provider call failed", result.kind, result.status, result.detail);
    return NextResponse.json(
      { error: "Deal Coach couldn't respond right now. Your deal calculations are unaffected." },
      { status: 502 }
    );
  }

  if (!result.toolUse || result.toolUse.name !== DEAL_COACH_RESPONSE_TOOL.name) {
    console.error("Deal Coach: no matching tool_use block", JSON.stringify(result.toolUse), result.textBlocks);
    return NextResponse.json(
      { error: "Deal Coach returned an unexpected response. Your deal calculations are unaffected." },
      { status: 502 }
    );
  }

  const parsedOutput = ToolOutputSchema.safeParse(result.toolUse.input);
  if (!parsedOutput.success) {
    console.error(
      "Deal Coach: tool_use input failed schema validation",
      parsedOutput.error.issues,
      JSON.stringify(result.toolUse.input)
    );
    return NextResponse.json(
      { error: "Deal Coach returned an unexpected response. Your deal calculations are unaffected." },
      { status: 502 }
    );
  }

  // Defensive: only pass through referenced-metric keys that were actually
  // in the context we supplied, in case the model names one that wasn't.
  const validKeys = new Set(context.metrics.map((m) => m.key));
  const referencedMetrics = (parsedOutput.data.referencedMetrics ?? []).filter((k) => validKeys.has(k));

  const response: DealCoachResponse = {
    answer: parsedOutput.data.answer,
    referencedMetrics: referencedMetrics.length > 0 ? referencedMetrics : undefined,
    suggestedFollowUps: parsedOutput.data.suggestedFollowUps?.slice(0, 4),
  };

  return NextResponse.json(response);
}
