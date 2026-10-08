import { useEffect, useState } from 'react';
import { PaidReceiptCard } from '../components/PaidReceiptCard';

type OrderView = { id: string; amountAtomic: string; status: 'PENDING' | 'PAID';
  paymentIntentId: string | null; transactionHash: string | null; createdAt: string };

export function PaidPage({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<OrderView | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'unavailable'>('loading');

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = async () => {
      try {
        const response = await fetch(`/api/orders/${orderId}`, { cache: 'no-store' });
        if (!active) return;
        if (response.status === 404) { setState('missing'); return; }
        if (!response.ok) throw new Error('Order lookup unavailable');
        const current = await response.json() as OrderView;
        if (!active) return;
        setOrder(current); setState('ready');
        if (current.status !== 'PAID') timer = setTimeout(refresh, 5000);
      } catch {
        if (!active) return;
        setState('unavailable');
        timer = setTimeout(refresh, 10000);
      }
    };
    void refresh();
    return () => { active = false; if (timer) clearTimeout(timer); };
  }, [orderId]);

  const paid = order?.status === 'PAID';
  return <main className="return-page">
    <div className="return-mark no-print">L / F</div>
    <span className="eyebrow no-print">Luvre Franc / Druto settlement</span>
    <h1 className="display no-print">{state === 'unavailable' ? 'Payment status temporarily unavailable.'
      : state === 'missing' ? 'Order not found.' : paid ? 'Payment Verified on Arc Testnet.'
        : 'Your payment is being verified.'}</h1>
    <p className="no-print">Order <span className="mono">{orderId}</span> returned from hosted checkout.{' '}
      {state === 'unavailable' ? 'Please check again shortly. Do not send another payment while status is unavailable.'
        : state === 'missing' ? 'This reference has no saved order. Contact the store if you have already paid.'
          : paid ? 'Druto has verified the onchain USDC transaction and the order has been marked as PAID.'
            : 'The store will confirm fulfillment after Druto verifies the Arc Testnet transfer and the signed webhook arrives.'}</p>
    {order && <PaidReceiptCard orderId={orderId} order={{ id: order.id,
      amount: Number(BigInt(order.amountAtomic)) / 1_000_000, status: order.status,
      paymentIntentId: order.paymentIntentId ?? undefined, transactionHash: order.transactionHash ?? undefined,
      createdAt: order.createdAt }} marketplaceUrl="/" marketplaceName="Return to Marketplace" />}
    <div className="return-note no-print"><strong>Settlement lifecycle</strong><span>
      A payment is confirmed here only after its signed Druto event matches the saved order. Delivery is handled separately by the store.
    </span></div>
  </main>;
}
