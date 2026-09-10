import { PaidReceiptCard } from "../../../../components/PaidReceiptCard";
import { getOrder } from "../../../../lib/orders";

export default async function PaidPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const order = getOrder(orderId);
  const isPaid = order?.status === "PAID";

  return (
    <main className="return-page">
      <div className="return-mark no-print">L / F</div>
      <span className="eyebrow no-print">Luvre Franc / Druto settlement</span>
      <h1 className="display no-print">
        {isPaid ? "Payment Verified on Arc Testnet." : "Your payment is being verified."}
      </h1>
      <p className="no-print">
        Order <span className="mono">{orderId}</span> returned from hosted checkout.{" "}
        {isPaid
          ? "Druto has verified the onchain USDC transaction and the order has been marked as PAID."
          : "The store will confirm fulfillment as soon as Druto verifies the Arc Testnet USDC transfer and the signed webhook reaches the seller backend."}
      </p>

      <PaidReceiptCard
        orderId={orderId}
        order={order || { id: orderId, amount: 0, status: "PAID" }}
        marketplaceUrl="/"
        marketplaceName="Return to Marketplace"
      />

      <div className="return-note no-print">
        <strong>Settlement lifecycle</strong>
        <span>
          Buyer USDC transfers settle directly to the seller wallet on Arc Testnet. The seller dashboard updates gross volume and ledger entries in real time.
        </span>
      </div>
    </main>
  );
}

