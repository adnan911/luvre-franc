export type PaymentVerifiedEvent = {
  id: string;
  type: "payment.verified";
  version: string;
  createdAt: string;
  data: {
    paymentIntentId: string;
    externalOrderId: string;
    marketplaceId: string | null;
    sellerId: string | null;
    merchantAccountId: string | null;
    status: "succeeded";
    amount: string;
    amountAtomic: string;
    asset: "USDC";
    network: "arc-testnet";
    buyerAddress: string | null;
    merchantAddress: string;
    transactionHash: string;
    orderContext: unknown;
  };
};

function hex(bytes: ArrayBuffer) { return Array.from(new Uint8Array(bytes)).map(value => value.toString(16).padStart(2, "0")).join(""); }

export async function verifyWebhookSignature(secret: string, payload: string, header: string, now = Math.floor(Date.now() / 1000), toleranceSeconds = 300) {
  const timestamp = Number(header.match(/(?:^|,)t=(\d+)/)?.[1]);
  const received = header.match(/(?:^|,)v1=([a-f0-9]+)/)?.[1];
  if (!Number.isFinite(timestamp) || !received || Math.abs(now - timestamp) > toleranceSeconds) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${payload}`)));
  return expected === received;
}

export function parsePaymentVerifiedEvent(payload: string): PaymentVerifiedEvent | null {
  try {
    const event = JSON.parse(payload) as PaymentVerifiedEvent;
    return event.type === "payment.verified" && event.data?.status === "succeeded" ? event : null;
  } catch { return null; }
}

export type WebhookEventStore = { has(eventId: string): Promise<boolean>; markProcessed(eventId: string): Promise<void> };

export async function acceptPaymentVerifiedEvent(rawBody: string, signature: string, secret: string, store: WebhookEventStore, fulfill: (event: PaymentVerifiedEvent) => Promise<void>) {
  if (!(await verifyWebhookSignature(secret, rawBody, signature))) return { accepted: false, status: 401 } as const;
  const event = parsePaymentVerifiedEvent(rawBody);
  if (!event) return { accepted: false, status: 400 } as const;
  if (await store.has(event.id)) return { accepted: true, duplicate: true, status: 200 } as const;
  await fulfill(event);
  await store.markProcessed(event.id);
  return { accepted: true, duplicate: false, status: 200 } as const;
}
