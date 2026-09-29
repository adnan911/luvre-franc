import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";

beforeEach(() => { vi.resetModules(); vi.stubEnv("NODE_ENV", "production"); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("disables public synthetic signing even with a configured secret", async () => {
  vi.stubEnv("DRUTO_WEBHOOK_SECRET", "synthetic-test-secret");
  const http = vi.fn(); vi.stubGlobal("fetch", http);
  const { POST } = await import("../app/api/druto/simulate-webhook/route");
  const result = await POST(new Request("https://shop.example/api/druto/simulate-webhook", {
    method: "POST", body: JSON.stringify({ orderId: "unpaid", amount: "1" }),
  }));
  expect(result.status).toBe(410); expect(http).not.toHaveBeenCalled();
});

it("does not fabricate missing orders or overwrite an existing settlement", async () => {
  const { createOrder, markOrderPaid, getOrder } = await import("./orders");
  expect(markOrderPaid("missing", { transactionHash: "0xfake" })).toBeUndefined();
  expect(getOrder("missing")).toBeUndefined();
  createOrder({ id: "existing", amount: 1, items: [], customerEmail: "" });
  markOrderPaid("existing", { paymentIntentId: "pi_1", transactionHash: "0xfirst", paidAt: "first" });
  expect(markOrderPaid("existing", { paymentIntentId: "pi_1", transactionHash: "0xfirst", paidAt: "later" })?.paidAt).toBe("first");
  expect(() => markOrderPaid("existing", { paymentIntentId: "pi_1", transactionHash: "0xother" })).toThrow("already paid");
  expect(() => createOrder({ id: "existing", amount: 1, items: [], customerEmail: "" })).toThrow("already exists");
});

it.each([
  { name: "failed payment", data: { status: "failed", externalOrderId: "missing", paymentIntentId: "pi_1" }, header: "evt_1", expected: 400 },
  { name: "missing order", data: { status: "succeeded", paymentIntentId: "pi_1" }, header: "evt_1", expected: 400 },
  { name: "missing header", data: { status: "succeeded", externalOrderId: "missing", paymentIntentId: "pi_1" }, header: "", expected: 400 },
  { name: "unknown order", data: { status: "succeeded", externalOrderId: "missing", paymentIntentId: "pi_1" }, header: "evt_1", expected: 409 },
])("does not acknowledge $name as paid", async ({ data, header, expected }) => {
  const secret = "synthetic-test-secret"; vi.stubEnv("DRUTO_WEBHOOK_SECRET", secret);
  const { POST } = await import("../app/api/webhooks/druto/route");
  const rawBody = JSON.stringify({ id: "evt_1", type: "payment.verified", data });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const response = await POST(new Request("https://shop.example/api/webhooks/druto", { method: "POST", headers: {
    "druto-signature": `t=${timestamp},v1=${signature}`, "x-druto-event-id": header,
  }, body: rawBody }));
  expect(response.status).toBe(expected);
  expect((await response.json()).verified).not.toBe(true);
});
