import { PaymentError } from './payment-model';
import { trustedOrder } from './trusted-order';
import { createPaymentSession } from './payment-session';
import { readBody, paymentFailure } from './payment-http';
import type { checkoutConfig } from './payment-config';
import type { createD1OrderStore } from './orders.d1';

type Store = Pick<ReturnType<typeof createD1OrderStore>, 'reserve' | 'claim' | 'bind' | 'fail'>;
type Config = ReturnType<typeof checkoutConfig>;

export async function checkoutCore(request: Request, source: Store | (() => Promise<Store>), config: Config, transport: typeof fetch = fetch) {
  try {
    const origin = request.headers.get('origin');
    if (origin && origin !== config.shopUrl) throw new PaymentError(403, 'Checkout origin is not allowed');
    const raw = await readBody(request, 32768);
    let input: unknown; try { input = JSON.parse(raw); } catch { throw new PaymentError(400, 'Invalid checkout JSON'); }
    const draft = trustedOrder(input, request.headers.get('idempotency-key'), config);
    const store = typeof source === 'function' ? await source() : source;
    const reserved = await store.reserve(draft);
    const claim = await store.claim(reserved.id);
    let url = claim.order.checkoutUrl;
    let intentId = claim.order.paymentIntentId;
    if (claim.token) {
      try {
        const session = await createPaymentSession(claim.order, claim.idempotencyKey, config, transport);
        await store.bind(reserved.id, claim.token, session);
        url = session.checkoutUrl; intentId = session.id;
      } catch (error) { await store.fail(reserved.id, claim.token).catch(() => undefined); throw error; }
    } else if (claim.order.status === 'PAID') {
      url = `${config.shopUrl}/orders/${reserved.id}/paid`;
    } else if (!claim.order.paymentExpiresAt || claim.order.paymentExpiresAt.getTime() <= Date.now()) {
      throw new PaymentError(409, 'Payment session expired; start a new checkout');
    }
    if (!url) throw new PaymentError(503, 'Checkout binding is unavailable; retry the same checkout');
    return Response.json({ orderId: reserved.id, paymentIntentId: intentId, checkoutUrl: url, redirectUrl: url }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return paymentFailure(error); }
}
