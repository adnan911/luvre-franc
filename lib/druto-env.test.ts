import { describe, expect, it, vi } from "vitest";
import { getDruto } from "./druto";

describe("Druto server credential path", () => {
  it("sends the configured API key through the server-only create-intent request", async () => {
    process.env.DRUTO_API_KEY = process.env.DRUTO_API_KEY || "druto_sk_test_key_123";
    process.env.DRUTO_API_URL = process.env.DRUTO_API_URL || "https://druto.xyz";
    process.env.DRUTO_CHECKOUT_BASE_URL = process.env.DRUTO_CHECKOUT_BASE_URL || "https://druto.xyz";

    const apiKey = process.env.DRUTO_API_KEY;
    const baseUrl = process.env.DRUTO_API_URL || process.env.DRUTO_CHECKOUT_BASE_URL;

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ result: { data: { json: {
        id: "pi_smoke",
        checkoutUrl: `${baseUrl}/checkout/pi_smoke`,
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
      amount: 1.00,
      buyerEmail: "smoke@example.com",
      returnUrl: "https://shop.example/orders/smoke-order/paid",
      seller: { marketplaceId: "luvre-franc", sellerId: "luvre-main" },
    });

    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect((init?.headers as Record<string, string>).authorization).toBe(`Bearer ${apiKey}`);
    expect(JSON.stringify(init?.body)).not.toContain("NEXT_PUBLIC_DRUTO_API_KEY");
    fetchMock.mockRestore();
  });
});
