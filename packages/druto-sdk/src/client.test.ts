import { describe, expect, it, vi } from "vitest";
import { DrutoCheckout, buildPaymentIntentRequest, createTrpcPaymentAdapter } from "./index.js";

describe("Druto SDK", () => {
  it("builds an idempotent Payment Intent request", () => {
    expect(buildPaymentIntentRequest({ orderId: "order_123", itemName: "Starter kit", amount: 1 })).toMatchObject({
      externalOrderId: "order_123",
      idempotencyKey: "sdk-order_123",
      itemName: "Starter kit",
      amount: "1.00",
    });
  });

  it("rejects invalid amounts", () => {
    expect(() => buildPaymentIntentRequest({ orderId: "order_123", itemName: "Starter kit", amount: 0 })).toThrow(/positive USDC/);
  });

  it("creates a hosted session through a server adapter", async () => {
    const createPayment = vi.fn().mockResolvedValue({ id: "pi_123", checkoutUrl: "/checkout/pi_123" });
    const checkout = new DrutoCheckout({ environment: "testnet", network: "arc", asset: "USDC", checkoutBaseUrl: "https://merchant.example", createPayment });
    const session = await checkout.createPayment({ orderId: "order_123", itemName: "Starter kit", amount: "1.00" });
    expect(createPayment).toHaveBeenCalledWith(expect.objectContaining({ externalOrderId: "order_123", amount: "1.00" }));
    expect(session.checkoutUrl).toBe("https://merchant.example/checkout/pi_123");
  });

  it("formats the current tRPC adapter request", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ result: { data: { json: { id: "pi_1", checkoutUrl: "/checkout/pi_1" } } } }) });
    const adapter = createTrpcPaymentAdapter("/api/trpc/payments.createIntent", fetcher as unknown as typeof fetch);
    await adapter({ externalOrderId: "order_1", idempotencyKey: "sdk-order_1", itemName: "Item", amount: "1.00" });
    expect(fetcher).toHaveBeenCalledWith("/api/trpc/payments.createIntent", expect.objectContaining({ method: "POST", body: expect.stringContaining('"externalOrderId":"order_1"') }));
  });
});

  it("preserves seller routing without accepting a browser wallet address", () => {
    expect(buildPaymentIntentRequest({ orderId: "order_seller_1", itemName: "Seller item", amount: "2.50", seller: { marketplaceId: "market_1", sellerId: "seller_1" } })).toMatchObject({
      seller: { marketplaceId: "market_1", sellerId: "seller_1" },
      amount: "2.50",
    });
  });
