import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db/deals", () => ({ getDeal: vi.fn(), upsertFinanceSources: vi.fn() }));

import { auth } from "@/lib/auth";
import { getDeal, upsertFinanceSources } from "@/lib/db/deals";
import { calcMonthlyRepayment } from "@/lib/calculations/amortisation";
import { PUT } from "../route";

const mockedAuth = vi.mocked(auth);
const mockedGetDeal = vi.mocked(getDeal);
const mockedUpsert = vi.mocked(upsertFinanceSources);

const FAKE_SESSION = { user: { id: "user-1", email: "test@example.com", name: "Test User" } };

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/deals/deal-1/finance", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function callRoute(body: unknown, dealId = "deal-1") {
  return PUT(makeRequest(body), { params: { id: dealId } });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedAuth.mockResolvedValue(FAKE_SESSION as never);
  mockedGetDeal.mockResolvedValue({ id: "deal-1", userId: "user-1" } as never);
  mockedUpsert.mockImplementation(async (_dealId, sources) =>
    sources.map((s, i) => ({ id: `fs-${i}`, dealId: "deal-1", ...s })) as never
  );
});

// Phase 4.11: the server must never persist or act on a client-submitted
// repaymentAmount — only loanAmount/interestRate/termYears are trusted user
// input; repaymentAmount is always recomputed server-side before it is
// written to the database.
describe("PUT /api/deals/[id]/finance — server-authoritative repayment (Phase 4.11)", () => {
  it("recomputes the exact standard-amortisation repayment for R1,000,000 / 10% / 20 years", async () => {
    await callRoute({
      financeSources: [{ sourceType: "Bank Finance", loanAmount: 1_000_000, interestRate: 10, termYears: 20 }],
    });
    const [, persistedSources] = mockedUpsert.mock.calls[0];
    expect(persistedSources[0].repaymentAmount).toBeCloseTo(9_650.2165, 2);
  });

  it("ignores a maliciously low submitted repaymentAmount (=1) and persists the true amortised value", async () => {
    await callRoute({
      financeSources: [
        { sourceType: "Bank Finance", loanAmount: 1_000_000, interestRate: 10, termYears: 20, repaymentAmount: 1 },
      ],
    });
    const [, persistedSources] = mockedUpsert.mock.calls[0];
    expect(persistedSources[0].repaymentAmount).toBeCloseTo(9_650.2165, 2);
    expect(persistedSources[0].repaymentAmount).not.toBe(1);
  });

  it("ignores a maliciously high submitted repaymentAmount (=50,000) and persists the true amortised value", async () => {
    await callRoute({
      financeSources: [
        { sourceType: "Bank Finance", loanAmount: 1_000_000, interestRate: 10, termYears: 20, repaymentAmount: 50_000 },
      ],
    });
    const [, persistedSources] = mockedUpsert.mock.calls[0];
    expect(persistedSources[0].repaymentAmount).toBeCloseTo(9_650.2165, 2);
    expect(persistedSources[0].repaymentAmount).not.toBe(50_000);
  });

  it("recomputes correctly for each of two finance sources independently, ignoring bogus submitted values for both", async () => {
    await callRoute({
      financeSources: [
        { sourceType: "Bank Finance", loanAmount: 800_000, interestRate: 10, termYears: 20, repaymentAmount: 1 },
        { sourceType: "Bridging", loanAmount: 200_000, interestRate: 15, termYears: 5, repaymentAmount: 999_999 },
      ],
    });
    const [, persistedSources] = mockedUpsert.mock.calls[0];
    expect(persistedSources[0].repaymentAmount).toBeCloseTo(calcMonthlyRepayment(800_000, 10, 20), 4);
    expect(persistedSources[1].repaymentAmount).toBeCloseTo(calcMonthlyRepayment(200_000, 15, 5), 4);
  });

  it("still recomputes the correct repayment for a source labelled Bridging — the label never changes the mathematics", async () => {
    await callRoute({
      financeSources: [
        { sourceType: "Bridging", loanAmount: 1_000_000, interestRate: 10, termYears: 20, repaymentAmount: 1 },
      ],
    });
    const [, persistedSources] = mockedUpsert.mock.calls[0];
    expect(persistedSources[0].sourceType).toBe("Bridging");
    expect(persistedSources[0].repaymentAmount).toBeCloseTo(9_650.2165, 2);
  });

  it("returns 401 when there is no session", async () => {
    mockedAuth.mockResolvedValue(null as never);
    const res = await callRoute({ financeSources: [] });
    expect(res.status).toBe(401);
    expect(mockedUpsert).not.toHaveBeenCalled();
  });

  it("returns 404 when the deal does not belong to the authenticated user", async () => {
    mockedGetDeal.mockResolvedValue(null as never);
    const res = await callRoute({ financeSources: [] });
    expect(res.status).toBe(404);
    expect(mockedUpsert).not.toHaveBeenCalled();
  });
});
