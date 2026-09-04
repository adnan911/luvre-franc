import { getOrder } from "../../../../lib/orders";

export default async function PaidPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const order = getOrder(orderId);
  const isPaid = order?.status === "PAID";

  return (
    <main className="return-page">
      <div className="return-mark">L / F</div>
      <span className="eyebrow">Luvre Franc / Druto settlement</span>
      <h1 className="display">
        {isPaid ? "Payment Verified on Arc Testnet." : "Your payment is being verified."}
      </h1>
      <p>
        Order <span className="mono">{orderId}</span> returned from hosted checkout.{" "}
        {isPaid
          ? "Druto has verified the onchain USDC transaction and the order has been marked as PAID."
          : "The store will confirm fulfillment as soon as Druto verifies the Arc Testnet USDC transfer and the signed webhook reaches the seller backend."}
      </p>

      {order && (
        <div className="status-box success" style={{ margin: "1.5rem auto", maxWidth: "480px", textAlign: "left" }}>
          <p style={{ margin: 0 }}>
            <strong>Status: {order.status}</strong>
            {order.amount > 0 && <><br />Amount: {order.amount.toFixed(2)} USDC</>}
            {order.paymentIntentId && <><br />Payment Intent: <span className="mono">{order.paymentIntentId}</span></>}
            {order.transactionHash && (
              <>
                <br />
                Tx Hash:{" "}
                <a
                  href={`https://explorer.testnet.arc.io/tx/${order.transactionHash}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ textDecoration: "underline" }}
                >
                  <span className="mono">{order.transactionHash.slice(0, 10)}…{order.transactionHash.slice(-8)}</span> ↗
                </a>
              </>
            )}
          </p>
        </div>
      )}

      <div className="return-note">
        <strong>Settlement lifecycle</strong>
        <span>
          Buyer USDC transfers settle directly to the seller wallet on Arc Testnet. The seller dashboard updates gross volume and ledger entries in real time.
        </span>
      </div>
      <a href="/" className="primary-button">Return to Luvre Franc</a>
    </main>
  );
}
