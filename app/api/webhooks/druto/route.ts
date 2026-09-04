import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { parsePaymentVerifiedEvent, verifyWebhookSignature } from "@druto/sdk";
import { markOrderPaid } from "../../../../lib/orders";

export const runtime = "nodejs";

function verifyHmacDirect(rawBody: string, signatureHeader: string, secret: string): boolean {
  try {
    const parts = Object.fromEntries(
      signatureHeader.split(",").map((part) => {
        const [k, v] = part.split("=");
        return [k.trim(), v.trim()];
      })
    );

    const timestamp = parts.t;
    const signature = parts.v1;
    if (!timestamp || !signature) return false;

    // Check tolerance (5 minutes)
    const ageSeconds = Math.abs(Date.now() / 1000 - parseInt(timestamp, 10));
    if (ageSeconds > 300) return false;

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(`${timestamp}.${rawBody}`)
      .digest("hex");

    if (expectedSignature.length !== signature.length) return false;

    return crypto.timingSafeEqual(
      Buffer.from(signature, "utf-8"),
      Buffer.from(expectedSignature, "utf-8")
    );
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("druto-signature") || request.headers.get("Druto-Signature") || "";
    const headerEventId = request.headers.get("x-druto-event-id") || request.headers.get("X-Druto-Event-Id");
    const secret = process.env.DRUTO_WEBHOOK_SECRET;

    if (!secret) {
      console.error("[Druto Webhook] DRUTO_WEBHOOK_SECRET is not configured");
      return NextResponse.json({ error: "Webhook secret is not configured" }, { status: 503 });
    }

    if (!signature) {
      return NextResponse.json({ error: "Missing Druto signature header" }, { status: 401 });
    }

    // Verify signature using SDK or timing-safe direct HMAC-SHA256
    const valid = (await verifyWebhookSignature(secret, rawBody, signature).catch(() => false)) ||
      verifyHmacDirect(rawBody, signature, secret);

    if (!valid) {
      console.warn("[Druto Webhook] Invalid signature detected");
      return NextResponse.json({ error: "Invalid Druto webhook signature" }, { status: 401 });
    }

    const event = parsePaymentVerifiedEvent(rawBody) || JSON.parse(rawBody);
    if (!event || event.type !== "payment.verified") {
      return NextResponse.json({ error: "Unsupported or invalid event type" }, { status: 400 });
    }

    const eventId = headerEventId || event.id || event.data?.paymentIntentId || "evt_unknown";
    if (headerEventId && event.id && headerEventId !== event.id) {
      return NextResponse.json({ error: "Event ID mismatch" }, { status: 400 });
    }

    const data = event.data || {};
    const {
      paymentIntentId,
      externalOrderId,
      amount,
      amountAtomic,
      transactionHash,
      buyerAddress,
      merchantAddress,
      marketplaceId,
      sellerId,
    } = data;

    // Optional routing verification if present
    const configuredMarketplace = process.env.NEXT_PUBLIC_DRUTO_MARKETPLACE_ID;
    const configuredSeller = process.env.NEXT_PUBLIC_DRUTO_SELLER_ID;

    if (configuredMarketplace && marketplaceId && marketplaceId !== configuredMarketplace) {
      return NextResponse.json({ error: "Marketplace ID mismatch" }, { status: 403 });
    }
    if (configuredSeller && sellerId && sellerId !== configuredSeller) {
      return NextResponse.json({ error: "Seller ID mismatch" }, { status: 403 });
    }

    // Mark the order as PAID in store database / state
    const orderId = externalOrderId || paymentIntentId;
    if (orderId) {
      const updatedOrder = markOrderPaid(orderId, {
        paymentIntentId,
        transactionHash,
        paidAt: new Date().toISOString(),
      });

      console.info(`[Druto Webhook] ✅ Verified Payment for Order ${orderId}:`, {
        eventId,
        paymentIntentId,
        orderId,
        usdcAmount: amount || (amountAtomic ? Number(amountAtomic) / 1_000_000 : undefined),
        transactionHash,
        buyerAddress,
        merchantAddress,
        orderStatus: updatedOrder?.status,
      });
    }

    return NextResponse.json({
      received: true,
      verified: true,
      eventId,
      orderId,
      status: "PAID",
    });
  } catch (error: any) {
    console.error("[Druto Webhook Error]", error);
    return NextResponse.json(
      { error: error?.message || "Internal webhook handler error" },
      { status: 500 }
    );
  }
}
