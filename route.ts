import { getDruto } from "../../../../lib/druto";
import { calculateCartTotal, getProduct } from "../../../../lib/catalog";

export const runtime = "nodejs";

function isValidEmail(value: unknown): value is string {
  return typeof value === "string" && /^\S+@\S+\.\S+$/.test(value);
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      orderId?: string;
      itemName?: string;
      amount?: number;
      buyerEmail?: string;
      marketplaceId?: string;
      sellerId?: string;
      returnUrl?: string;
      items?: Array<{ productId?: string; quantity?: number }>;
      shippingAddress?: { name?: string; line1?: string; city?: string; postalCode?: string; country?: string };
    };

    if (!body.orderId || !/^lf-[a-z0-9-]{8,80}$/.test(body.orderId)) {
      return Response.json({ error: "A valid Luvre Franc order reference is required" }, { status: 400 });
    }
    if (!body.buyerEmail || !isValidEmail(body.buyerEmail)) {
      return Response.json({ error: "A valid buyer email is required" }, { status: 400 });
    }
    if (body.marketplaceId !== (process.env.NEXT_PUBLIC_DRUTO_MARKETPLACE_ID ?? "luvre-franc") || body.sellerId !== (process.env.NEXT_PUBLIC_DRUTO_SELLER_ID ?? "luvre-main")) {
      return Response.json({ error: "Invalid seller routing" }, { status: 400 });
    }
    if (!body.returnUrl || !/^https:\/\//.test(body.returnUrl)) {
      return Response.json({ error: "A secure return URL is required" }, { status: 400 });
    }
    if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 12) {
      return Response.json({ error: "At least one cart line is required" }, { status: 400 });
    }

    const lines = body.items.map((line) => ({
      productId: String(line.productId ?? ""),
      quantity: Number(line.quantity ?? 0),
    }));
    if (lines.some((line) => !getProduct(line.productId) || !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 10)) {
      return Response.json({ error: "Cart contains an invalid product or quantity" }, { status: 400 });
    }

    const trustedTotal = calculateCartTotal(lines);
    if (!Number.isFinite(body.amount) || Math.abs(Number(body.amount) - trustedTotal) > 0.000001) {
      return Response.json({ error: "Order total does not match the current catalog" }, { status: 409 });
    }

    const productLines = lines.map((line) => {
      const product = getProduct(line.productId)!;
      return { productId: product.id, name: product.name, seller: body.sellerId!, unitPrice: product.price, quantity: line.quantity };
    });

    const session = await getDruto().createPayment({
      orderId: body.orderId,
      itemName: body.itemName || productLines.map((line) => line.name).join(" + "),
      amount: trustedTotal,
      buyerEmail: body.buyerEmail,
      seller: { marketplaceId: body.marketplaceId, sellerId: body.sellerId },
      returnUrl: body.returnUrl,
      idempotencyKey: `luvre-order-${body.orderId}`,
      orderContext: {
        items: productLines,
        delivery: "Standard delivery",
        shippingAddress: {
          name: body.shippingAddress?.name ?? "",
          line1: body.shippingAddress?.line1 ?? "",
          city: body.shippingAddress?.city ?? "",
          postalCode: body.shippingAddress?.postalCode ?? "",
          country: body.shippingAddress?.country ?? "",
        },
        buyerEmail: body.buyerEmail,
      },
    });

    return Response.json(session, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("[Luvre Franc] Druto create payment failed", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "Unable to create Druto payment. Check the seller configuration and try again." }, { status: 502 });
  }
}
