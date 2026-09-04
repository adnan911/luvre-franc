import { NextResponse } from "next/server";
import { calculateCartTotal, getProduct } from "../../../lib/catalog";
import { createOrder } from "../../../lib/orders";

export const runtime = "nodejs";

function isValidEmail(value: unknown): value is string {
  return typeof value === "string" && /^\S+@\S+\.\S+$/.test(value);
}

function isPlaceholderKey(key?: string): boolean {
  if (!key) return true;
  return key.includes("replace") || key.includes("test_replace") || key === "druto_sk_live_..." || key.length < 10;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      orderId?: string;
      items?: Array<{ productId?: string; id?: string; name?: string; quantity?: number; unitPrice?: number; price?: number }>;
      amount?: number;
      totalAmount?: number;
      customerEmail?: string;
      buyerEmail?: string;
      shippingAddress?: { name?: string; line1?: string; city?: string; postalCode?: string; country?: string };
      returnUrl?: string;
      marketplaceId?: string;
      sellerId?: string;
      itemName?: string;
    };

    const orderId = body.orderId || `lf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const email = body.customerEmail || body.buyerEmail || "";
    if (email && !isValidEmail(email)) {
      return NextResponse.json({ error: "A valid customer email is required" }, { status: 400 });
    }

    const items = body.items || [];
    let trustedTotal = 0;
    const formattedOrderItems = [];

    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        const prodId = item.productId || item.id || "";
        const catalogProduct = getProduct(prodId);
        const qty = Number(item.quantity) || 1;
        const unitPrice = catalogProduct ? catalogProduct.price : (Number(item.unitPrice || item.price) || 0);
        const name = catalogProduct ? catalogProduct.name : (item.name || "Product");

        trustedTotal += unitPrice * qty;
        formattedOrderItems.push({
          productId: prodId,
          name,
          seller: body.sellerId || process.env.NEXT_PUBLIC_DRUTO_SELLER_ID || "luvre-main",
          unitPrice,
          quantity: qty,
        });
      }
    } else if (typeof body.amount === "number" || typeof body.totalAmount === "number") {
      trustedTotal = Number(body.amount ?? body.totalAmount);
    } else {
      return NextResponse.json({ error: "Items or valid total amount required" }, { status: 400 });
    }

    const marketplaceId = body.marketplaceId || process.env.NEXT_PUBLIC_DRUTO_MARKETPLACE_ID || "luvre-franc";
    const sellerId = body.sellerId || process.env.NEXT_PUBLIC_DRUTO_SELLER_ID || "luvre-main";
    const shopUrl = process.env.NEXT_PUBLIC_SHOP_URL || "http://localhost:3000";
    const returnUrl = body.returnUrl || `${shopUrl}/orders/${encodeURIComponent(orderId)}/paid`;
    const itemName = body.itemName || (formattedOrderItems.length > 0 
      ? formattedOrderItems.map((i) => `${i.name} (x${i.quantity})`).join(", ") 
      : "Luvre Franc Order");

    // Record pending order in store state
    createOrder({
      id: orderId,
      amount: trustedTotal,
      items: formattedOrderItems,
      customerEmail: email,
      shippingAddress: body.shippingAddress as any,
    });

    const apiKey = process.env.DRUTO_API_KEY;
    const apiBaseUrl = (process.env.DRUTO_API_URL || process.env.DRUTO_CHECKOUT_BASE_URL || "https://druto.xyz").replace(/\/$/, "");
    const drutoEndpoint = `${apiBaseUrl}/api/v1/payment-intents`;

    const drutoPayload = {
      externalOrderId: orderId,
      idempotencyKey: `order-${orderId}`,
      amount: trustedTotal.toFixed(2),
      itemName,
      buyerLabel: email,
      returnUrl,
      seller: {
        marketplaceId,
        sellerId,
      },
      orderContext: {
        items: formattedOrderItems,
        delivery: "Standard Delivery",
        shippingAddress: body.shippingAddress || {},
        buyerEmail: email,
      },
    };

    let checkoutUrl: string | null = null;
    let paymentIntentId: string = `pi_${orderId.replace(/^lf-/, "")}`;
    let displayAmount = `${trustedTotal.toFixed(2)} USDC`;

    // If live API key is configured and not placeholder, call remote Druto API
    if (!isPlaceholderKey(apiKey)) {
      try {
        const response = await fetch(drutoEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify(drutoPayload),
          cache: "no-store",
        });

        let data: any = null;
        try {
          data = await response.json();
        } catch {
          // ignore non-json
        }

        // Support fallback to tRPC endpoint if Druto instance uses tRPC
        if (!response.ok && response.status === 404) {
          const trpcEndpoint = `${apiBaseUrl}/api/trpc/payments.createIntent`;
          const trpcResponse = await fetch(trpcEndpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${apiKey}`,
            },
            body: JSON.stringify({ json: drutoPayload }),
            cache: "no-store",
          });
          data = await trpcResponse.json().catch(() => null);
        }

        const session = data?.result?.data?.json || data?.result?.data || data?.data || data;
        if (session?.checkoutUrl) {
          checkoutUrl = session.checkoutUrl;
          paymentIntentId = session.id || session.paymentIntentId || paymentIntentId;
          displayAmount = session.displayAmount || displayAmount;
        } else if (session?.id) {
          checkoutUrl = `${apiBaseUrl}/checkout/${session.id}`;
          paymentIntentId = session.id;
        }
      } catch (remoteError) {
        console.warn("[Druto Intent] Remote Druto API unavailable, falling back to local gateway:", remoteError);
      }
    }

    // Seamless fallback to local/embedded Druto checkout gateway if remote session is not available
    if (!checkoutUrl) {
      const checkoutParams = new URLSearchParams({
        orderId,
        amount: trustedTotal.toFixed(2),
        itemName,
        buyerEmail: email,
        marketplaceId,
        sellerId,
        returnUrl,
      });
      checkoutUrl = `/druto-checkout?${checkoutParams.toString()}`;
    }

    return NextResponse.json({
      checkoutUrl,
      paymentIntentId,
      orderId,
      amount: trustedTotal.toFixed(2),
      displayAmount,
      asset: "USDC",
      network: "arc-testnet",
    });
  } catch (error: any) {
    console.error("[Checkout API Error]", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error starting checkout" },
      { status: 500 }
    );
  }
}
