import { describe, expect, it, vi } from "vitest";
import { getDruto } from "./druto";

describe("Druto server credential path", () => {
  it("sends the configured API key through the server-only create-intent request", async () => {
    const apiKey = process.env.DRUTO_API_KEY;
    const baseUrl = process.env.DRUTO_CHECKOUT_BASE_URL;
    if (!apiKey || !baseUrl || !/^https?:\/\//.test(baseUrl)) {
      throw new Error("DRUTO_API_KEY and a valid DRUTO_CHECKOUT_BASE_URL must be configured for this smoke test");
    }

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ result: { data: { json: {
        id: "pi_smoke",
        checkoutUrl: "/checkout/pi_smoke",
        displayAmount: "1.00",
        asset: "USDC",
        network: "arc-testnet",
        merchantAddress: "0x1111111111111111111111111111111111111111",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      } } } }), { status: 200, headers: { "content-type": "application/json" } }),
    );

    await getDruto().createPayment({
      orderId: "smoke-order",
      itemName: "Credential smoke check",
      amount: "1.00",
      buyerEmail: "smoke@example.com",
      seller: { marketplaceId: "luvre-franc", sellerId: "luvre-main" },
    });

    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect((init?.headers as Record<string, string>).authorization).toBe(`Bearer ${apiKey}`);
    expect(JSON.stringify(init?.body)).not.toContain("NEXT_PUBLIC_DRUTO_API_KEY");
    fetchMock.mockRestore();
  });
});
