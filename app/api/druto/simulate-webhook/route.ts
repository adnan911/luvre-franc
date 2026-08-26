import { createHmac } from "node:crypto";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      orderId: string;
      amount: string;
      marketplaceId?: string;
      sellerId?: string;
    };

    const secret = process.env.DRUTO_WEBHOOK_SECRET || "replace_after_registering_webhook";
    const eventId = `evt_lf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const paymentIntentId = `pi_${body.orderId.replace(/^lf-/, "")}`;
    const txHash = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`;
    const timestamp = Math.floor(Date.now() / 1000);

    const eventPayload = {
      id: eventId,
      type: "payment.verified",
      version: "2026-01",
      createdAt: new Date().toISOString(),
      data: {
        paymentIntentId,
        externalOrderId: body.orderId,
        marketplaceId: body.marketplaceId || process.env.NEXT_PUBLIC_DRUTO_MARKETPLACE_ID || "luvre-franc",
        sellerId: body.sellerId || process.env.NEXT_PUBLIC_DRUTO_SELLER_ID || "luvre-main",
        merchantAccountId: "merchant_lf_main",
        status: "succeeded",
        amount: body.amount,
        amountAtomic: (parseFloat(body.amount) * 1_000_000).toFixed(0),
        asset: "USDC",
        network: "arc-testnet",
        buyerAddress: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
        merchantAddress: "0xA32c7bbB2fb634bED4DfC812c15AF87a0C727217",
        transactionHash: txHash,
        orderContext: {
          store: "Luvre Franc",
        },
      },
    };

    const rawBody = JSON.stringify(eventPayload);
    const signature = createHmac("sha256", secret)
      .update(`${timestamp}.${rawBody}`)
      .digest("hex");

    const host = process.env.NEXT_PUBLIC_SHOP_URL || "http://localhost:3000";
    const webhookUrl = `${host}/api/webhooks/druto`;

    const webhookResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "druto-signature": `t=${timestamp},v1=${signature}`,
        "x-druto-event-id": eventId,
      },
      body: rawBody,
    });

    const webhookResult = await webhookResponse.json().catch(() => ({}));

    return Response.json({
      success: true,
      eventId,
      transactionHash: txHash,
      webhookStatus: webhookResponse.status,
      webhookResult,
    });
  } catch (error) {
    console.error("Simulation error:", error);
    return Response.json({ error: "Failed to simulate webhook settlement" }, { status: 500 });
  }
}
