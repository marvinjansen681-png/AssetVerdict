import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db/deals", () => ({ updateDeal: vi.fn() }));

import { auth } from "@/lib/auth";
import { updateDeal } from "@/lib/db/deals";
import { PATCH } from "../route";

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

describe("PATCH /api/deals/[id] — renovationCost trust boundary (Phase 4.22)", () => {
  it("strips a client-supplied renovationCost even though the request body includes it", async () => {
    await PATCH(makeRequest({ purchasePrice: 2_000_000, renovationCost: 99_999_999 }), {
      params: { id: "deal-1" },
    });

    expect(mockedUpdateDeal).toHaveBeenCalledTimes(1);
    const dataArg = mockedUpdateDeal.mock.calls[0][2] as Record<string, unknown>;
    expect(dataArg).not.toHaveProperty("renovationCost");
    expect(dataArg.purchasePrice).toBe(2_000_000);
  });

  it("ordinary acquisition fields still pass through and are numerically coerced", async () => {
    await PATCH(makeRequest({ purchasePrice: "1500000", transferBondCost: "50000" }), {
      params: { id: "deal-1" },
    });
    const dataArg = mockedUpdateDeal.mock.calls[0][2] as Record<string, unknown>;
    expect(dataArg.purchasePrice).toBe(1_500_000);
    expect(dataArg.transferBondCost).toBe(50_000);
  });
});
