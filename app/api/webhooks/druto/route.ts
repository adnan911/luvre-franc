import { parsePaymentVerifiedEvent, verifyWebhookSignature } from "@druto/sdk";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("druto-signature") ?? "";
  const eventId = request.headers.get("x-druto-event-id") ?? "";
  const secret = process.env.DRUTO_WEBHOOK_SECRET ?? "";

  if (!secret) return new Response("webhook is not configured", { status: 503 });
  if (!eventId || eventId.length > 200) return new Response("missing event id", { status: 400 });

  const valid = await verifyWebhookSignature(secret, rawBody, signature);
  if (!valid) return new Response("invalid signature", { status: 401 });

  const event = parsePaymentVerifiedEvent(rawBody);
  if (!event) return new Response("invalid event", { status: 400 });
  if (event.id !== eventId) return new Response("event id mismatch", { status: 400 });
  if (event.data.marketplaceId !== (process.env.NEXT_PUBLIC_DRUTO_MARKETPLACE_ID ?? "luvre-franc")) return new Response("wrong marketplace", { status: 403 });
  if (event.data.sellerId !== (process.env.NEXT_PUBLIC_DRUTO_SELLER_ID ?? "luvre-main")) return new Response("wrong seller", { status: 403 });
  if (event.data.asset !== "USDC" || event.data.network !== "arc-testnet") return new Response("unsupported payment rail", { status: 422 });

  // Production boundary: connect this verified event to Luvre Franc's durable order
  // and webhook-event tables before enabling automated fulfillment. Never fulfill
  // from the browser return page. Druto's seller dashboard remains the source of
  // truth for the seller payment ledger until the store database is connected.
  console.info("[Luvre Franc] verified Druto payment", {
    eventId,
    paymentIntentId: event.data.paymentIntentId,
    externalOrderId: event.data.externalOrderId,
    transactionHash: event.data.transactionHash,
    amount: event.data.amount,
  });

  return Response.json({ received: true, verified: true, eventId });
}
