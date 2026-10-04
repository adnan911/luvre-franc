import { orderStore } from '../../../../lib/orders';
import { parsePaymentEvent, verifyEventSignature } from '../../../../lib/payment-event';
import { PaymentError } from '../../../../lib/payment-model';
import { readBody, paymentFailure } from '../../../../lib/payment-http';
import { sha256 } from '../../../../lib/trusted-order';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const secret = process.env.DRUTO_WEBHOOK_SECRET;
    if (!secret || /replace|placeholder/i.test(secret)) throw new PaymentError(503, 'Webhook verification is not configured');
    const raw = await readBody(request, 65536);
    if (!verifyEventSignature(raw, request.headers.get('druto-signature') || '', secret)) throw new PaymentError(401, 'Invalid Druto webhook signature');
    const event = parsePaymentEvent(raw, request.headers.get('x-druto-event-id'));
    const result = await orderStore().settle(event, sha256(raw));
    return Response.json({ received: true, eventId: event.id, ...result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return paymentFailure(error); }
}
