import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parsePaymentVerifiedEvent, verifyWebhookSignature } from "@druto/sdk";

const event = {
  id: "evt_lf_001",
  type: "payment.verified",
  version: "2026-01",
  createdAt: "2026-08-25T00:00:00.000Z",
  data: {
    paymentIntentId: "pi_lf_001",
    externalOrderId: "lf-12345678",
    marketplaceId: "luvre-franc",
    sellerId: "luvre-main",
    merchantAccountId: "merchant_lf",
    status: "succeeded",
    amount: "168.00",
    amountAtomic: "168000000",
    asset: "USDC",
    network: "arc-testnet",
    buyerAddress: "0x0000000000000000000000000000000000000001",
    merchantAddress: "0xA32c7bbB2fb634bED4DfC812c15AF87a0C727217",
    transactionHash: "0xabc",
    orderContext: {},
  },
};

describe("Luvre Franc Druto webhook contract", () => {
  it("accepts a fresh HMAC signature within tolerance", async () => {
    const secret = "test_webhook_secret";
    const payload = JSON.stringify(event);
    const timestamp = 1_700_000_000;
    const signature = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
    await expect(verifyWebhookSignature(secret, payload, `t=${timestamp},v1=${signature}`, timestamp)).resolves.toBe(true);
  });

  it("rejects a tampered payload and parses only succeeded payment events", async () => {
    const secret = "test_webhook_secret";
    const payload = JSON.stringify(event);
    const timestamp = 1_700_000_000;
    const signature = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
    await expect(verifyWebhookSignature(secret, `${payload} `, `t=${timestamp},v1=${signature}`, timestamp)).resolves.toBe(false);
    expect(parsePaymentVerifiedEvent(payload)?.data.externalOrderId).toBe("lf-12345678");
    expect(parsePaymentVerifiedEvent(JSON.stringify({ ...event, type: "payment.pending" }))).toBeNull();
  });
});
