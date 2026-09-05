import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { orderId, amount, itemName, buyerEmail, returnUrl: customReturnUrl } = body;

    if (!orderId) {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 });
    }

    const drutoBaseUrl = (process.env.DRUTO_API_URL || "https://druto-final.vercel.app").replace(/\/$/, "");
    const apiKey = process.env.DRUTO_API_KEY;

    const returnUrl = customReturnUrl || `https://luvrefranc.vercel.app/orders/${encodeURIComponent(orderId)}/paid`;
    const formattedAmount = typeof amount === "number" ? amount.toFixed(2) : String(amount || "0.00");

    const payload = {
      json: {
        externalOrderId: orderId,
        itemName: itemName || "Luvre Franc Order",
        amount: formattedAmount,
        buyerLabel: buyerEmail || "",
        returnUrl,
        seller: {
          marketplaceId: process.env.NEXT_PUBLIC_DRUTO_MARKETPLACE_ID || "luvre-franc",
          sellerId: process.env.NEXT_PUBLIC_DRUTO_SELLER_ID || "luvre-main"
        }
      }
    };

    // Try tRPC endpoint first as specified by user instructions
    const trpcUrl = `${drutoBaseUrl}/api/trpc/payments.createIntent`;
    let response = await fetch(trpcUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    let data: any = null;
    if (response.ok) {
      data = await response.json().catch(() => null);
    } else {
      // Fallback to REST endpoint if tRPC is 404 or fails
      const restUrl = `${drutoBaseUrl}/api/v1/payment-intents`;
      response = await fetch(restUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload.json),
        cache: "no-store",
      });
      if (response.ok) {
        data = await response.json().catch(() => null);
      }
    }

    const session = data?.result?.data?.json || data?.result?.data || data?.data || data;
    const checkoutPath = session?.checkoutUrl;

    if (!checkoutPath) {
      return NextResponse.json(
        { error: data?.error?.message || "Failed to create Druto payment intent" },
        { status: 400 }
      );
    }

    const redirectUrl = checkoutPath.startsWith("http")
      ? checkoutPath
      : `${drutoBaseUrl}${checkoutPath.startsWith("/") ? "" : "/"}${checkoutPath}`;

    return NextResponse.json({
      redirectUrl,
      checkoutUrl: redirectUrl,
      session
    });
  } catch (error: any) {
    console.error("[Create Payment Error]", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create Druto payment intent" },
      { status: 500 }
    );
  }
}
