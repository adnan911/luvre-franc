import { DrutoCheckout, createTrpcPaymentAdapter, type PaymentIntentRequest } from "../src/index.js";

declare const process: { env: Record<string, string | undefined> };

const druto = new DrutoCheckout({
  environment: "testnet",
  network: "arc",
  asset: "USDC",
  checkoutBaseUrl: process.env.DRUTO_CHECKOUT_BASE_URL ?? "https://your-druto-host.example",
  createPayment: createTrpcPaymentAdapter(
    process.env.DRUTO_CREATE_INTENT_ENDPOINT ?? "/api/trpc/payments.createIntent",
  ),
});

export async function createSellerCheckout(order: {
  id: string;
  totalUsdc: string;
  itemName: string;
  buyerEmail: string;
  marketplaceId: string;
  sellerId: string;
}) {
  const request: PaymentIntentRequest = {
    externalOrderId: order.id,
    idempotencyKey: `${order.id}-${order.sellerId}-v1`,
    itemName: order.itemName,
    amount: order.totalUsdc,
    buyerLabel: order.buyerEmail,
    seller: { marketplaceId: order.marketplaceId, sellerId: order.sellerId },
    returnUrl: `${process.env.SHOP_URL ?? "https://shop.example"}/orders/${order.id}/paid`,
  };
  const session = await druto.createPayment({
    orderId: request.externalOrderId,
    amount: request.amount,
    itemName: request.itemName,
    buyerEmail: request.buyerLabel,
    seller: request.seller,
    returnUrl: request.returnUrl,
  });
  return session;
}
