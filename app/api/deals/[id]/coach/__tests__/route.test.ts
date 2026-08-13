import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db/deals", () => ({ getDeal: vi.fn() }));
vi.mock("@/lib/ai/anthropicClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/anthropicClient")>();
  return { ...actual, callAnthropicMessages: vi.fn() };
});

import { auth } from "@/lib/auth";
import { getDeal } from "@/lib/db/deals";
import { callAnthropicMessages, type AnthropicCallResult } from "@/lib/ai/anthropicClient";
import { POST } from "../route";

const mockedAuth = vi.mocked(auth);
const mockedGetDeal = vi.mocked(getDeal);
const mockedCallAnthropic = vi.mocked(callAnthropicMessages);

const FAKE_SESSION = { user: { id: "user-1", email: "test@example.com", name: "Test User" } };

function makeFakeDeal(overrides: Record<string, unknown> = {}) {
  return {
    id: "deal-1",
    userId: "user-1",
    name: "Test Deal",
    investmentStrategy: "commercial",
    address: "1 Test St",
    currency: "ZAR",
    purchasePrice: 5_055_000,
    marketValue: 5_500_000,
    askingPrice: 6_900_000,
    transferBondCost: 309_072,
    renovationCost: 200_000,
    sourcingFee: 505_500,
    agentCommission: 0,
    wantToSell: false,
    saleYear: null,
    isSectionalTitle: false,
    incomeTaxRate: 27,
    capitalGainsTaxRate: 22,
    capitalGrowthRate: 3,
    rentalGrowthRate: 8,
    costInflation: 5,
    discountRate: 10,
    marketCapRate: 10,
    realGrowthFactor: 10,
    occupationFactor: 10,
    numUnits: 1,
    financeSources: [
      {
        id: "fs-1",
        dealId: "deal-1",
        sourceType: "bank",
        ltvMode: "amount",
        ltvValue: null,
        loanAmount: 4_900_000,
        interestRate: 15,
        termYears: 15,
        repaymentAmount: 68_579.77,
        order: 0,
      },
    ],
    cashflowInputs: {
      id: "cf-1",
      dealId: "deal-1",
      monthlyRent: 200_000,
      occupancyRate: 88,
      additionalIncome: 0,
      recoveries: 0,
      managementFeeMode: "percent",
      managementFeeValue: 15,
      maintenanceCostMode: "percent",
      maintenanceCostValue: 5,
      levies: 0,
      ratesAndTaxes: 19_000,
      insurance: 6_500,
      waterSewerage: 2_000,
      securityCleaning: 17_500,
      electricity: 2_000,
      badDebtsPct: 5,
      nightlyRate: 0,
      avgOccupiedNights: 0,
      platformFeesPct: 0,
      billsIncluded: false,
      academicYearWeeks: 42,
      pricePerRoom: 0,
      singleRoomCount: 0,
      singleRoomRent: 0,
      singleRoomNsfasBeds: 0,
      sharingRoomCount: 0,
      sharingBedsPerRoom: 2,
      sharingRoomRent: 0,
      sharingRoomNsfasBeds: 0,
      nsfasCycleMonths: 10,
      privateCycleMonths: 12,
      houseParentCost: 0,
      internetCost: 0,
      netflixCost: 0,
      gasRefillCost: 0,
      wasteRemovalCost: 0,
      holdingPeriodMonths: 6,
      expectedSalePrice: 0,
      holdingCostPerMonth: 0,
      instalmentAmount: 0,
      instalmentTerm: 240,
      instalmentRate: 0,
    },
    capexItems: [],
    renovationItems: [],
    propertyValuation: null,
    dealSuburbs: [],
    ...overrides,
  };
}

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/deals/deal-1/coach", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function callRoute(body: unknown, dealId = "deal-1") {
  return POST(makeRequest(body), { params: { id: dealId } });
}

function toolResult(input: Record<string, unknown>): AnthropicCallResult {
  return { ok: true, textBlocks: [], toolUse: { name: "deal_coach_response", input } };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ANTHROPIC_API_KEY = "test-key";
  mockedAuth.mockResolvedValue(FAKE_SESSION as never);
  mockedGetDeal.mockResolvedValue(makeFakeDeal() as never);
  mockedCallAnthropic.mockResolvedValue(
    toolResult({ answer: "Your DSCR is healthy.", referencedMetrics: ["dscr"], suggestedFollowUps: ["What drives my NOI?"] })
  );
});

describe("POST /api/deals/[id]/coach — authentication & ownership", () => {
  it("returns 401 when there is no session", async () => {
    mockedAuth.mockResolvedValue(null as never);
    const res = await callRoute({ message: "Explain this deal." });
    expect(res.status).toBe(401);
    expect(mockedGetDeal).not.toHaveBeenCalled();
  });

  it("looks up the deal scoped to the authenticated user's id", async () => {
    await callRoute({ message: "Explain this deal." });
    expect(mockedGetDeal).toHaveBeenCalledWith("deal-1", "user-1");
  });

  it("returns 404 (not 403) when getDeal finds nothing — never confirms whether another user's deal exists", async () => {
    mockedGetDeal.mockResolvedValue(null as never);
    const res = await callRoute({ message: "Explain this deal." });
    expect(res.status).toBe(404);
    expect(mockedCallAnthropic).not.toHaveBeenCalled();
  });
});

describe("POST /api/deals/[id]/coach — client cannot supply financial truth", () => {
  it("ignores client-supplied financial fields entirely (schema has no such field, extras are dropped) and uses server-recomputed values", async () => {
    // Deliberately sending fields the request schema doesn't declare, to
    // prove the server ignores them entirely rather than trusting them.
    await callRoute({
      message: "What is my DSCR?",
      selectedMetric: "dscr",
      dscr: 999,
      cashflowMonthly: 50000,
    });
    expect(mockedCallAnthropic).toHaveBeenCalledTimes(1);
    const [[call]] = mockedCallAnthropic.mock.calls;
    // The real, server-computed DSCR for this fixture is well under 2x — 999 must never appear.
    expect(call.system).not.toContain("999");
    expect(call.system).toContain("[dscr]");
  });

  it("recomputes metrics from the database deal, not from anything in the request body", async () => {
    await callRoute({ message: "Explain this deal simply.", intent: "explain_deal_simple" });
    const [[call]] = mockedCallAnthropic.mock.calls;
    // R2,112,000 is this fixture's real annual gross revenue (200,000 * 0.88 * 12) — proves the
    // context came from the mocked deal record, not from the request.
    expect(call.system).toContain("2,112,000");
  });
});

describe("POST /api/deals/[id]/coach — request validation", () => {
  it("rejects an unknown selectedMetric", async () => {
    const res = await callRoute({ message: "Explain this.", selectedMetric: "totallyFakeMetric" });
    expect(res.status).toBe(400);
    expect(mockedCallAnthropic).not.toHaveBeenCalled();
  });

  it("rejects an invalid scenario key", async () => {
    const res = await callRoute({ message: "Explain this.", activeScenario: "extreme" });
    expect(res.status).toBe(400);
  });

  it("rejects an oversized message", async () => {
    const res = await callRoute({ message: "a".repeat(2001) });
    expect(res.status).toBe(400);
  });

  it("rejects an oversized conversation array", async () => {
    const conversation = Array.from({ length: 31 }, (_, i) => ({ role: "user" as const, content: `msg ${i}` }));
    const res = await callRoute({ message: "Hello", conversation });
    expect(res.status).toBe(400);
  });

  it("rejects intent 'explain_metric' without a selectedMetric", async () => {
    const res = await callRoute({ message: "Explain.", intent: "explain_metric" });
    expect(res.status).toBe(400);
  });

  it("rejects a malformed JSON body", async () => {
    const req = new Request("http://localhost/api/deals/deal-1/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not json",
    });
    const res = await POST(req, { params: { id: "deal-1" } });
    expect(res.status).toBe(400);
  });

  it("rejects a deal with missing required inputs before ever calling the AI", async () => {
    mockedGetDeal.mockResolvedValue(makeFakeDeal({ purchasePrice: null }) as never);
    const res = await callRoute({ message: "Explain this deal." });
    expect(res.status).toBe(400);
    expect(mockedCallAnthropic).not.toHaveBeenCalled();
  });
});

describe("POST /api/deals/[id]/coach — provider/config error handling", () => {
  it("returns 503 and never calls the provider when ANTHROPIC_API_KEY is missing", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const res = await callRoute({ message: "Explain this deal." });
    expect(res.status).toBe(503);
    expect(mockedCallAnthropic).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body.error.toLowerCase()).not.toContain("stack");
  });

  it("returns 504 on provider timeout, with a reassuring message", async () => {
    mockedCallAnthropic.mockResolvedValue({ ok: false, kind: "timeout" });
    const res = await callRoute({ message: "Explain this deal." });
    expect(res.status).toBe(504);
    const body = await res.json();
    expect(body.error.toLowerCase()).toContain("unaffected");
  });

  it("returns 429 on provider rate limiting", async () => {
    mockedCallAnthropic.mockResolvedValue({ ok: false, kind: "provider_error", status: 429 });
    const res = await callRoute({ message: "Explain this deal." });
    expect(res.status).toBe(429);
  });

  it("returns 502 on a generic provider error", async () => {
    mockedCallAnthropic.mockResolvedValue({ ok: false, kind: "provider_error", status: 500, detail: "boom" });
    const res = await callRoute({ message: "Explain this deal." });
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).not.toContain("boom"); // never leak raw provider detail to the client
  });

  it("returns 502 when the model doesn't call the expected tool", async () => {
    mockedCallAnthropic.mockResolvedValue({ ok: true, textBlocks: ["some plain text instead"] });
    const res = await callRoute({ message: "Explain this deal." });
    expect(res.status).toBe(502);
  });

  it("returns 502 when the tool output is malformed (missing required 'answer')", async () => {
    mockedCallAnthropic.mockResolvedValue(toolResult({ referencedMetrics: ["dscr"] }));
    const res = await callRoute({ message: "Explain this deal." });
    expect(res.status).toBe(502);
  });

  it("still returns a valid answer when only suggestedFollowUps is malformed, dropping that field instead of failing the whole response", async () => {
    // Observed live: the model occasionally emits a malformed string for
    // suggestedFollowUps (e.g. stray tool-call-syntax leakage) while answer
    // itself is perfectly valid. That shouldn't cost the user a good answer.
    mockedCallAnthropic.mockResolvedValue(
      toolResult({ answer: "You're currently viewing the Bear case.", suggestedFollowUps: "not-an-array" })
    );
    const res = await callRoute({ message: "Which scenario am I viewing?" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.answer).toBe("You're currently viewing the Bear case.");
    expect(body.suggestedFollowUps).toBeUndefined();
  });
});

describe("POST /api/deals/[id]/coach — valid responses", () => {
  it("parses a valid tool response and returns answer/referencedMetrics/suggestedFollowUps", async () => {
    const res = await callRoute({ message: "What is my DSCR?", selectedMetric: "dscr" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.answer).toBe("Your DSCR is healthy.");
    expect(body.referencedMetrics).toEqual(["dscr"]);
    expect(body.suggestedFollowUps).toEqual(["What drives my NOI?"]);
  });

  it("filters out a referencedMetrics key the model invented that wasn't actually in the supplied context", async () => {
    mockedCallAnthropic.mockResolvedValue(
      toolResult({ answer: "...", referencedMetrics: ["dscr", "totallyMadeUpMetric"] })
    );
    const res = await callRoute({ message: "What is my DSCR?", selectedMetric: "dscr" });
    const body = await res.json();
    expect(body.referencedMetrics).toEqual(["dscr"]);
  });

  it("caps suggestedFollowUps to 4 even if the model returns more", async () => {
    mockedCallAnthropic.mockResolvedValue(
      toolResult({ answer: "...", suggestedFollowUps: ["a", "b", "c", "d", "e", "f"] })
    );
    const res = await callRoute({ message: "Explain this deal." });
    const body = await res.json();
    expect(body.suggestedFollowUps).toHaveLength(4);
  });

  it("caps the conversation forwarded to the model to the most recent turns, keeping the latest, not the oldest", async () => {
    const conversation = Array.from({ length: 20 }, (_, i) => ({ role: "user" as const, content: `turn-${i}` }));
    await callRoute({ message: "final message", conversation });
    const [[call]] = mockedCallAnthropic.mock.calls;
    // 12 capped history turns + the new user message.
    expect(call.messages).toHaveLength(13);
    expect(call.messages[0].content).toBe("turn-8"); // last 12 of 0..19 starts at turn-8
    expect(call.messages[call.messages.length - 1].content).toBe("final message");
  });

  it("passes the active scenario through to context (Bear vs Base produce different system prompts)", async () => {
    await callRoute({ message: "Explain this deal.", activeScenario: "bear" });
    const [[bearCall]] = mockedCallAnthropic.mock.calls;
    vi.clearAllMocks();
    mockedAuth.mockResolvedValue(FAKE_SESSION as never);
    mockedGetDeal.mockResolvedValue(makeFakeDeal() as never);
    mockedCallAnthropic.mockResolvedValue(toolResult({ answer: "ok" }));
    await callRoute({ message: "Explain this deal.", activeScenario: "bull" });
    const [[bullCall]] = mockedCallAnthropic.mock.calls;
    expect(bearCall.system).toContain("Active scenario: bear");
    expect(bullCall.system).toContain("Active scenario: bull");
    expect(bearCall.system).not.toBe(bullCall.system);
  });
});

describe("POST /api/deals/[id]/coach — Fix & Flip strategy", () => {
  it("builds flip-only context for a fix_and_flip deal, never DSCR/LTV", async () => {
    mockedGetDeal.mockResolvedValue(
      makeFakeDeal({
        investmentStrategy: "fix_and_flip",
        renovationCost: 300_000,
        financeSources: [],
        cashflowInputs: {
          ...makeFakeDeal().cashflowInputs,
          expectedSalePrice: 6_500_000,
          holdingCostPerMonth: 15_000,
          holdingPeriodMonths: 6,
        },
      }) as never
    );
    await callRoute({ message: "Explain this deal.", intent: "explain_deal_simple" });
    const [[call]] = mockedCallAnthropic.mock.calls;
    expect(call.system).toContain("[roi]");
    expect(call.system).not.toContain("[dscr]");
    expect(call.system).not.toContain("[ltv]");
  });
});
