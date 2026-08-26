export default async function PaidPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return (
    <main className="return-page">
      <div className="return-mark">L / F</div>
      <span className="eyebrow">Luvre Franc / Druto return</span>
      <h1 className="display">Your payment is being verified.</h1>
      <p>Order <span className="mono">{orderId}</span> returned from hosted checkout. The store will confirm fulfillment only after Druto verifies the Arc Testnet USDC transfer and the signed webhook reaches the seller backend.</p>
      <div className="return-note"><strong>What happens next</strong><span>Druto verifies the onchain settlement, then the Luvre Franc order status is reconciled with the seller dashboard.</span></div>
      <a href="/" className="primary-button">Return to Luvre Franc</a>
    </main>
  );
}
