import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { orderId, amount, itemName, buyerEmail, returnUrl: customReturnUrl } = body;

    if (!orderId) {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 });
    }

    const drutoBaseUrl = (process.env.DRUTO_API_URL || process.env.DRUTO_CHECKOUT_BASE_URL || "https://druto-final.vercel.app").replace(/\/$/, "");
    const apiKey = process.env.DRUTO_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "DRUTO_API_KEY environment variable is not configured on Vercel." },
        { status: 500 }
      );
    }

    const returnUrl = customReturnUrl || `https://luvrefranc.vercel.app/orders/${encodeURIComponent(orderId)}/paid`;
    const formattedAmount = typeof amount === "number" ? amount.toFixed(2) : String(amount || "0.00");

    const trpcPayload = {
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

    let session: any = null;
    let lastError: string | null = null;

    // 1. Try tRPC endpoint first
    try {
      const trpcUrl = `${drutoBaseUrl}/api/trpc/payments.createIntent`;
      const response = await fetch(trpcUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify(trpcPayload),
        cache: "no-store",
      });

      const responseText = await response.text();
      let resJson: any = null;
      try { resJson = JSON.parse(responseText); } catch {}

      if (response.ok) {
        session = resJson?.result?.data?.json || resJson?.result?.data || resJson?.data || resJson;
      } else {
        lastError = resJson?.error?.json?.message || resJson?.error?.message || `tRPC returned HTTP ${response.status}: ${responseText.slice(0, 150)}`;
      }
    } catch (e: any) {
      lastError = e?.message || "Failed to reach tRPC endpoint";
    }

    // 2. Fallback to REST endpoint if tRPC did not return a valid session
    if (!session?.checkoutUrl) {
      try {
        const restUrl = `${drutoBaseUrl}/api/v1/payment-intents`;
        const response = await fetch(restUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify(trpcPayload.json),
          cache: "no-store",
        });

        const responseText = await response.text();
        let resJson: any = null;
        try { resJson = JSON.parse(responseText); } catch {}

        if (response.ok) {
          session = resJson?.result?.data?.json || resJson?.result?.data || resJson?.data || resJson;
        } else {
          lastError = resJson?.error?.message || resJson?.message || lastError || `REST returned HTTP ${response.status}: ${responseText.slice(0, 150)}`;
        }
      } catch (e: any) {
        lastError = lastError || e?.message || "Failed to reach REST endpoint";
      }
    }

    const checkoutPath = session?.checkoutUrl;

    if (!checkoutPath) {
      return NextResponse.json(
        { error: lastError || "Failed to create Druto payment intent. Please check DRUTO_API_KEY and seller configuration." },
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
      { error: error?.message || "Internal server error creating payment intent" },
      { status: 500 }
    );
  }
}
