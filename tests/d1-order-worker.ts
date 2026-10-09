import { createHmac } from 'node:crypto';
import { createD1OrderStore, type D1OrderDatabase } from '../lib/orders.d1';
import { webhookCore } from '../lib/webhook-core';
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
    const secret = 'isolated-d1-webhook-recovery-test';
    const signed = (payload: object, signingSecret = secret) => {
      const raw = JSON.stringify(payload);
      const timestamp = Math.floor(Date.now() / 1000);
      const digest = createHmac('sha256', signingSecret).update(`${timestamp}.${raw}`).digest('hex');
      return new Request('https://shop.example/api/webhooks/druto', { method: 'POST',
        headers: { 'x-druto-event-id': event.id, 'druto-signature': `t=${timestamp},v1=${digest}` }, body: raw });
    };
    const unavailable = await webhookCore(signed(event), { settle: async () => { throw new Error('isolated database outage'); } }, secret);
    if (unavailable.status !== 503 || (await store.get(first.id))?.status !== 'PENDING') throw new Error('storage outage was acknowledged or settled');
    const [initial, concurrentDuplicate] = await Promise.all([
      webhookCore(signed(event), store, secret), webhookCore(signed(event), store, secret),
    ]);
    if (initial.status !== 200 || concurrentDuplicate.status !== 200) throw new Error('concurrent delivery was not acknowledged');
    const outcomes = [await initial.json(), await concurrentDuplicate.json()];
    if (outcomes.filter(value => value.duplicate === false).length !== 1 ||
        outcomes.filter(value => value.duplicate === true).length !== 1) throw new Error('concurrent duplicate was not deduplicated');
    const replay = await webhookCore(signed(event), store, secret);
    if (replay.status !== 200 || !(await replay.json()).duplicate) throw new Error('later replay was not deduplicated');
    if ((await webhookCore(signed(event, 'incorrect-secret'), store, secret)).status !== 401) throw new Error('bad signature was accepted');
    if ((await webhookCore(signed({ ...event, extra: 'changed-payload' }), store, secret)).status !== 409) throw new Error('changed event payload was accepted');
    if ((await webhookCore(signed({ ...event, data: { ...event.data, amountAtomic: '2000000' } }), store, secret)).status !== 409) throw new Error('wrong amount was accepted');
    const paid = await store.get(first.id);
    if (paid?.status !== 'PAID' || paid.transactionHash !== transactionHash) throw new Error('settlement failed');
    const events = await env.LUVRE_ORDERS_DB.prepare('SELECT COUNT(*) AS count FROM processedEvents WHERE orderId=?')
      .bind(first.id).first<{ count: number }>();
    const outbox = await env.LUVRE_ORDERS_DB.prepare('SELECT COUNT(*) AS count FROM fulfillmentOutbox WHERE orderId=?')
      .bind(first.id).first<{ count: number }>();
    if (events?.count !== 1 || outbox?.count !== 1) throw new Error('payment or fulfillment was recorded more than once');
    return Response.json({ ok: true, orderId: first.id, checks: 13 });
  },
};
