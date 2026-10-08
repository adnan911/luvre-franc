import { parsePaymentEvent, verifyEventSignature } from './payment-event';
import { PaymentError } from './payment-model';
import { readBody, paymentFailure } from './payment-http';
import { sha256 } from './trusted-order';
import type { createD1OrderStore } from './orders.d1';

type Store = Pick<ReturnType<typeof createD1OrderStore>, 'settle'>;

export async function webhookCore(request: Request, source: Store | (() => Promise<Store>), secret: string | undefined) {
  try {
    if (!secret || /replace|placeholder/i.test(secret)) throw new PaymentError(503, 'Webhook verification is not configured');
    const raw = await readBody(request, 65536);
    if (!verifyEventSignature(raw, request.headers.get('druto-signature') || '', secret)) throw new PaymentError(401, 'Invalid Druto webhook signature');
    const event = parsePaymentEvent(raw, request.headers.get('x-druto-event-id'));
    const store = typeof source === 'function' ? await source() : source;
    const result = await store.settle(event, sha256(raw));
    return Response.json({ received: true, eventId: event.id, ...result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return paymentFailure(error); }
}
