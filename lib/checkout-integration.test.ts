import { describe, expect, it, vi } from "vitest";
import { POST as checkoutRoute } from "../app/api/checkout/route";
import { POST as webhookRoute } from "../app/api/webhooks/druto/route";
import { createHmac } from "node:crypto";
import { getOrder } from "./orders";

describe("Druto Checkout and Webhook Integration", () => {
  it("generates a payment intent and returns checkoutUrl", async () => {
    process.env.DRUTO_API_KEY = "druto_sk_live_test_123";
    process.env.DRUTO_API_URL = "https://druto.xyz";
    process.env.DRUTO_WEBHOOK_SECRET = "whsec_test_secret_456";

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "pi_test_intent_789",
          checkoutUrl: "https://druto.xyz/checkout/pi_test_intent_789",
          displayAmount: "168.00 USDC",
          asset: "USDC",
          network: "arc-testnet",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const req = new Request("http://localhost:3000/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: "lf-order-integration-1",
        items: [{ productId: "port-trouser", quantity: 1 }],
        customerEmail: "buyer@example.com",
        shippingAddress: {
          name: "John Doe",
          line1: "123 Fashion Ave",
          city: "New York",
          postalCode: "10001",
          country: "United States",
        },
      }),
    });

    const res = await checkoutRoute(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.checkoutUrl).toBe("https://druto.xyz/checkout/pi_test_intent_789");
    expect(body.paymentIntentId).toBe("pi_test_intent_789");

    fetchMock.mockRestore();
  });

  it("verifies webhook HMAC-SHA256 signature and marks order as PAID", async () => {
    const secret = "whsec_test_secret_456";
    process.env.DRUTO_WEBHOOK_SECRET = secret;

    const orderId = "lf-order-integration-1";
    const timestamp = Math.floor(Date.now() / 1000);
    const eventPayload = {
      id: "evt_test_verified_123",
      type: "payment.verified",
      version: "2026-01",
      createdAt: new Date().toISOString(),
      data: {
        paymentIntentId: "pi_test_intent_789",
        externalOrderId: orderId,
        marketplaceId: "luvre-franc",
        sellerId: "luvre-main",
        status: "succeeded",
        amount: "168.00",
        amountAtomic: "168000000",
        asset: "USDC",
        network: "arc-testnet",
        buyerAddress: "0x1234567890123456789012345678901234567890",
        merchantAddress: "0xA32c7bbB2fb634bED4DfC812c15AF87a0C727217",
        transactionHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      },
    };

    const rawBody = JSON.stringify(eventPayload);
    const signature = createHmac("sha256", secret)
      .update(`${timestamp}.${rawBody}`)
      .digest("hex");

    const webhookReq = new Request("http://localhost:3000/api/webhooks/druto", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "druto-signature": `t=${timestamp},v1=${signature}`,
        "x-druto-event-id": "evt_test_verified_123",
      },
      body: rawBody,
    });

    const res = await webhookRoute(webhookReq);
    expect(res.status).toBe(200);
    const resJson = await res.json();
    expect(resJson.received).toBe(true);
    expect(resJson.verified).toBe(true);

    const savedOrder = getOrder(orderId);
    expect(savedOrder?.status).toBe("PAID");
    expect(savedOrder?.transactionHash).toBe(eventPayload.data.transactionHash);
  });
});
