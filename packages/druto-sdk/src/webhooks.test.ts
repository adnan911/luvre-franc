import { describe, expect, it } from "vitest";
import { acceptPaymentVerifiedEvent, parsePaymentVerifiedEvent, verifyWebhookSignature } from "./webhooks.js";

async function sign(secret: string, payload: string, timestamp: number) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${payload}`)))).map(value => value.toString(16).padStart(2, "0")).join("");
  return `t=${timestamp},v1=${signature}`;
}

describe("SDK webhook helpers", () => {
  it("verifies signed payloads and rejects tampered or stale requests", async () => {
    const payload = JSON.stringify({ type: "payment.verified", data: { status: "succeeded" } });
    const header = await sign("secret", payload, 1_000);
    await expect(verifyWebhookSignature("secret", payload, header, 1_100)).resolves.toBe(true);
    await expect(verifyWebhookSignature("secret", payload + "x", header, 1_100)).resolves.toBe(false);
    await expect(verifyWebhookSignature("secret", payload, header, 1_301)).resolves.toBe(false);
  });

  it("deduplicates fulfillment through a durable event store", async () => {
    const payload = JSON.stringify({ id: "evt_1", type: "payment.verified", data: { status: "succeeded", externalOrderId: "order_1", transactionHash: "0x1" } });
    const header = await sign("secret", payload, Math.floor(Date.now() / 1000));
    const processed = new Set<string>(); let fulfillmentCount = 0;
    const store = { has: async (id: string) => processed.has(id), markProcessed: async (id: string) => { processed.add(id); } };
    await expect(acceptPaymentVerifiedEvent(payload, header, "secret", store, async () => { fulfillmentCount += 1; })).resolves.toMatchObject({ accepted: true, duplicate: false });
    await expect(acceptPaymentVerifiedEvent(payload, header, "secret", store, async () => { fulfillmentCount += 1; })).resolves.toMatchObject({ accepted: true, duplicate: true });
    expect(fulfillmentCount).toBe(1);
  });

  it("parses only successful payment.verified events", () => {
    expect(parsePaymentVerifiedEvent('{"type":"payment.verified","data":{"status":"succeeded"}}')).not.toBeNull();
    expect(parsePaymentVerifiedEvent('{"type":"payment.verified","data":{"status":"failed"}}')).toBeNull();
    expect(parsePaymentVerifiedEvent("not-json")).toBeNull();
  });
});
