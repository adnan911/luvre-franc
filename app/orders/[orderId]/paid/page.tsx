import { PaidReceiptCard } from "../../../../components/PaidReceiptCard";
import { getOrder } from "../../../../lib/orders";
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function PaidPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  let order;
  let unavailable = false;
  try { order = await getOrder(orderId); } catch { unavailable = true; }
  const isPaid = order?.status === "PAID";

  return (
    <main className="return-page">
      <div className="return-mark no-print">L / F</div>
      <span className="eyebrow no-print">Luvre Franc / Druto settlement</span>
      <h1 className="display no-print">
        {unavailable ? "Payment status temporarily unavailable." : !order ? "Order not found." : isPaid ? "Payment Verified on Arc Testnet." : "Your payment is being verified."}
      </h1>
      <p className="no-print">
        Order <span className="mono">{orderId}</span> returned from hosted checkout.{" "}
        {unavailable ? "Please check again shortly. Do not send another payment while status is unavailable." : !order ? "This reference has no saved order. Contact the store if you have already paid." : isPaid
          ? "Druto has verified the onchain USDC transaction and the order has been marked as PAID."
          : "The store will confirm fulfillment as soon as Druto verifies the Arc Testnet USDC transfer and the signed webhook reaches the seller backend."}
      </p>

      {order && <PaidReceiptCard
        orderId={orderId}
        order={{ id: order.id, amount: Number(order.amountAtomic) / 1000000, status: order.status,
          paymentIntentId: order.paymentIntentId ?? undefined, transactionHash: order.transactionHash ?? undefined,
          createdAt: order.createdAt.toISOString() }}
        marketplaceUrl="/"
        marketplaceName="Return to Marketplace"
      />}

      <div className="return-note no-print">
        <strong>Settlement lifecycle</strong>
        <span>
          A payment is confirmed here only after its signed Druto event matches the saved order. Delivery is handled separately by the store.
        </span>
      </div>
    </main>
  );
}

