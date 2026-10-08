import { createD1OrderStore, type D1OrderDatabase } from '../lib/orders.d1';
import type { OrderDraft, PaymentEvent } from '../lib/payment-model';

type Env = { LUVRE_ORDERS_DB: D1OrderDatabase };

export default {
  async fetch(_request: Request, env: Env): Promise<Response> {
    const store = createD1OrderStore(env.LUVRE_ORDERS_DB);
    const nonce = crypto.randomUUID().replaceAll('-', '');
    const draft: OrderDraft = {
      checkoutKeyHash: nonce, requestHash: `request_${nonce}`, amountAtomic: '1000000',
      itemsJson: '[]', customerEmail: 'test@example.invalid', shippingJson: '{}',
      marketplaceId: 'luvre-franc', sellerId: 'luvre-seller-1',
      merchantAccountId: 'ma_4uguzltzDSiU', receivingAddress: '0x49b1C6BE866396d6732a16A48D39e9fc305eF4fB',
      asset: 'USDC', network: 'arc-testnet',
    };
    const first = await store.reserve(draft);
    const repeated = await store.reserve(draft);
    if (first.id !== repeated.id) throw new Error('reserve idempotency failed');
    const claim = await store.claim(first.id);
    if (!claim.token) throw new Error('attempt was not claimed');
    try {
      await store.claim(first.id);
      throw new Error('concurrent claim was accepted');
    } catch (error) {
      if ((error as Error).message === 'concurrent claim was accepted') throw error;
    }
    const session = { id: `pi_${nonce.slice(0, 20)}`, checkoutUrl: `https://example.invalid/checkout/${nonce}`,
      expiresAt: new Date(Date.now() + 60000) };
    await store.bind(first.id, claim.token, session);
    const bound = await store.get(first.id);
    if (bound?.paymentIntentId !== session.id || bound.attemptToken !== null) throw new Error('attempt binding failed');
    const transactionHash = `0x${nonce}${'0'.repeat(32)}`;
    const event: PaymentEvent = { id: `evt_${nonce}`, type: 'payment.verified', version: '2026-08-23', data: {
      externalOrderId: first.id, paymentIntentId: session.id, marketplaceId: draft.marketplaceId,
      sellerId: draft.sellerId, merchantAccountId: draft.merchantAccountId,
      merchantAddress: draft.receivingAddress, amountAtomic: draft.amountAtomic,
      asset: 'USDC', network: 'arc-testnet', status: 'succeeded', transactionHash,
    } };
    const settled = await store.settle(event, `payload_${nonce}`);
    const duplicate = await store.settle(event, `payload_${nonce}`);
    if (settled.duplicate || !duplicate.duplicate) throw new Error('duplicate event handling failed');
    const paid = await store.get(first.id);
    if (paid?.status !== 'PAID' || paid.transactionHash !== transactionHash) throw new Error('settlement failed');
    const outbox = await env.LUVRE_ORDERS_DB.prepare('SELECT COUNT(*) AS count FROM fulfillmentOutbox WHERE orderId=?')
      .bind(first.id).first<{ count: number }>();
    if (outbox?.count !== 1) throw new Error('fulfillment outbox was not exactly once');
    let conflictRejected = false;
    try { await store.settle(event, `changed_${nonce}`); } catch { conflictRejected = true; }
    if (!conflictRejected) throw new Error('changed webhook payload was accepted');
    return Response.json({ ok: true, orderId: first.id, checks: 8 });
  },
};
