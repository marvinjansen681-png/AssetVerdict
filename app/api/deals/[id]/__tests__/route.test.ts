import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db/deals", () => ({ updateDeal: vi.fn() }));

import { auth } from "@/lib/auth";
import { updateDeal } from "@/lib/db/deals";
import { PATCH } from "../route";
import { DERIVED_FINANCIAL_FIELD_NAMES, DEAL_PATCH_PROTECTED_FIELDS } from "@/lib/dealFieldPolicy";

const mockedAuth = vi.mocked(auth);
const mockedUpdateDeal = vi.mocked(updateDeal);

const FAKE_SESSION = { user: { id: "user-1", email: "test@example.com", name: "Test User" } };

function makeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/deals/deal-1", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedAuth.mockResolvedValue(FAKE_SESSION as never);
  mockedUpdateDeal.mockResolvedValue({ id: "deal-1" } as never);
});

describe("PATCH /api/deals/[id] — explicit allowlist (Phase 4.22.1)", () => {
  it("the exact brief scenario: legitimate purchasePrice saves; renovationCost/totalInvestment/monthlyCashflow/irr/verdict are all dropped", async () => {
    await PATCH(
      makeRequest({
        purchasePrice: 2_000_000,
        renovationCost: 1,
        totalInvestment: 1,
        monthlyCashflow: 999_999,
        irr: 999,
        verdict: "strong",
      }),
      { params: { id: "deal-1" } }
    );

    expect(mockedUpdateDeal).toHaveBeenCalledTimes(1);
    const dataArg = mockedUpdateDeal.mock.calls[0][2] as Record<string, unknown>;
    expect(dataArg).toEqual({ purchasePrice: 2_000_000 });
    expect(dataArg).not.toHaveProperty("renovationCost");
    expect(dataArg).not.toHaveProperty("totalInvestment");
    expect(dataArg).not.toHaveProperty("monthlyCashflow");
    expect(dataArg).not.toHaveProperty("irr");
    expect(dataArg).not.toHaveProperty("verdict");
  });

  it("strips a client-supplied renovationCost even alongside other legitimate fields", async () => {
    await PATCH(makeRequest({ purchasePrice: 2_000_000, renovationCost: 99_999_999 }), {
      params: { id: "deal-1" },
    });

    const dataArg = mockedUpdateDeal.mock.calls[0][2] as Record<string, unknown>;
    expect(dataArg).not.toHaveProperty("renovationCost");
    expect(dataArg.purchasePrice).toBe(2_000_000);
  });

  it.each(DERIVED_FINANCIAL_FIELD_NAMES)("rejects the derived/calculated field '%s' even when it is the only field sent", async (field) => {
    await PATCH(makeRequest({ [field]: 12_345 }), { params: { id: "deal-1" } });
    const dataArg = mockedUpdateDeal.mock.calls[0][2] as Record<string, unknown>;
    expect(dataArg).not.toHaveProperty(field);
    expect(Object.keys(dataArg)).toHaveLength(0);
  });

  it.each(DEAL_PATCH_PROTECTED_FIELDS)("rejects the protected field '%s' even when it is the only field sent", async (field) => {
    await PATCH(makeRequest({ [field]: 999_999 }), { params: { id: "deal-1" } });
    const dataArg = mockedUpdateDeal.mock.calls[0][2] as Record<string, unknown>;
    expect(dataArg).not.toHaveProperty(field);
    expect(Object.keys(dataArg)).toHaveLength(0);
  });

  it("an unknown/nonsense field name is silently dropped, never applied and never errors the request", async () => {
    await PATCH(makeRequest({ purchasePrice: 1_000_000, notARealField: "hacked" }), {
      params: { id: "deal-1" },
    });
    const dataArg = mockedUpdateDeal.mock.calls[0][2] as Record<string, unknown>;
    expect(dataArg).toEqual({ purchasePrice: 1_000_000 });
  });

  it("ordinary acquisition fields still pass through and are numerically coerced", async () => {
    await PATCH(makeRequest({ purchasePrice: "1500000", transferBondCost: "50000" }), {
      params: { id: "deal-1" },
    });
    const dataArg = mockedUpdateDeal.mock.calls[0][2] as Record<string, unknown>;
    expect(dataArg.purchasePrice).toBe(1_500_000);
    expect(dataArg.transferBondCost).toBe(50_000);
  });

  it("legitimate non-numeric (string/boolean) fields still pass through", async () => {
    await PATCH(
      makeRequest({ name: "New Deal Name", investmentStrategy: "buy_to_let", wantToSell: true }),
      { params: { id: "deal-1" } }
    );
    const dataArg = mockedUpdateDeal.mock.calls[0][2] as Record<string, unknown>;
    expect(dataArg).toEqual({ name: "New Deal Name", investmentStrategy: "buy_to_let", wantToSell: true });
  });

  it("a single illegitimate field alongside a legitimate one never blocks the legitimate save", async () => {
    await PATCH(makeRequest({ purchasePrice: 3_000_000, npv: 500_000 }), { params: { id: "deal-1" } });
    expect(mockedUpdateDeal).toHaveBeenCalledTimes(1);
    const dataArg = mockedUpdateDeal.mock.calls[0][2] as Record<string, unknown>;
    expect(dataArg.purchasePrice).toBe(3_000_000);
    expect(dataArg).not.toHaveProperty("npv");
  });
});

describe("PATCH /api/deals/[id] — Purchase Price / Estimated Market Value guards (Phase 4.24/4.24.1, Tasks 21/22)", () => {
  it("rejects purchasePrice of 0 with a 400 and never calls updateDeal", async () => {
    const res = await PATCH(makeRequest({ purchasePrice: 0 }), { params: { id: "deal-1" } });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Purchase Price must be greater than R0");
    expect(mockedUpdateDeal).not.toHaveBeenCalled();
  });

  it("rejects a negative purchasePrice", async () => {
    const res = await PATCH(makeRequest({ purchasePrice: -100 }), { params: { id: "deal-1" } });
    expect(res.status).toBe(400);
    expect(mockedUpdateDeal).not.toHaveBeenCalled();
  });

  it("rejects a stringified non-positive purchasePrice after numeric coercion", async () => {
    const res = await PATCH(makeRequest({ purchasePrice: "0" }), { params: { id: "deal-1" } });
    expect(res.status).toBe(400);
    expect(mockedUpdateDeal).not.toHaveBeenCalled();
  });

  it("accepts a positive purchasePrice", async () => {
    const res = await PATCH(makeRequest({ purchasePrice: 1_000_000 }), { params: { id: "deal-1" } });
    expect(res.status).toBe(200);
    expect(mockedUpdateDeal).toHaveBeenCalledTimes(1);
  });

  it("rejects a negative marketValue", async () => {
    const res = await PATCH(makeRequest({ marketValue: -1 }), { params: { id: "deal-1" } });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Estimated Current Market Value must be greater than R0");
    expect(mockedUpdateDeal).not.toHaveBeenCalled();
  });

  it("rejects marketValue of exactly 0 (Phase 4.24.1 — explicit 0 is no longer 'blank')", async () => {
    const res = await PATCH(makeRequest({ marketValue: 0 }), { params: { id: "deal-1" } });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Estimated Current Market Value must be greater than R0");
    expect(mockedUpdateDeal).not.toHaveBeenCalled();
  });

  it("allows marketValue to be cleared to blank (empty string -> null)", async () => {
    const res = await PATCH(makeRequest({ marketValue: "" }), { params: { id: "deal-1" } });
    expect(res.status).toBe(200);
    const dataArg = mockedUpdateDeal.mock.calls[0][2] as Record<string, unknown>;
    expect(dataArg.marketValue).toBeNull();
  });

  it("allows a positive marketValue", async () => {
    const res = await PATCH(makeRequest({ marketValue: 2_500_000 }), { params: { id: "deal-1" } });
    expect(res.status).toBe(200);
    expect(mockedUpdateDeal).toHaveBeenCalledTimes(1);
  });

  it("a PATCH that touches neither field is unaffected by these guards", async () => {
    const res = await PATCH(makeRequest({ name: "New Deal Name" }), { params: { id: "deal-1" } });
    expect(res.status).toBe(200);
    expect(mockedUpdateDeal).toHaveBeenCalledTimes(1);
  });

  it("purchasePrice=0 alongside an otherwise-legitimate field blocks the whole save (fail closed, not partial)", async () => {
    const res = await PATCH(
      makeRequest({ purchasePrice: 0, name: "New Deal Name" }),
      { params: { id: "deal-1" } }
    );
    expect(res.status).toBe(400);
    expect(mockedUpdateDeal).not.toHaveBeenCalled();
  });
});
