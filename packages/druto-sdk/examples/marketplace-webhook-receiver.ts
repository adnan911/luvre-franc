import { parsePaymentVerifiedEvent, verifyWebhookSignature } from "../src/index.js";

type RequestLike = { text(): Promise<string>; headers: { get(name: string): string | null } };
type ResponseLike = { status: number; body: string };

export async function receiveDrutoWebhook(request: RequestLike, fulfillOnce: (orderId: string, transactionHash: string) => Promise<void>): Promise<ResponseLike> {
  const rawBody = await request.text();
  const signature = request.headers.get("druto-signature") ?? "";
  const valid = await verifyWebhookSignature(process.env.DRUTO_WEBHOOK_SECRET ?? "", rawBody, signature);
  if (!valid) return { status: 401, body: "invalid signature" };
  const event = parsePaymentVerifiedEvent(rawBody);
  if (!event) return { status: 400, body: "unsupported event" };
  await fulfillOnce(event.data.externalOrderId, event.data.transactionHash);
  return { status: 200, body: "ok" };
}

declare const process: { env: Record<string, string | undefined> };
