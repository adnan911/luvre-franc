import { createHmac, timingSafeEqual } from 'node:crypto';
import { PaymentError, type Order, type PaymentEvent } from './payment-model';
export function verifyEventSignature(raw: string, header: string, secret: string, now = Math.floor(Date.now() / 1000)) {
  const match = /^t=(\d{1,12}),v1=([a-f0-9]{64})$/.exec(header);
  if (!match || !secret) return false;
  const timestamp = Number(match[1]);
  if (!Number.isSafeInteger(timestamp) || Math.abs(now - timestamp) > 300) return false;
  return timingSafeEqual(Buffer.from(match[2], 'hex'), createHmac('sha256', secret).update(`${timestamp}.${raw}`).digest());
}
export function parsePaymentEvent(raw: string, headerId: string | null): PaymentEvent {
  let event: any; try { event = JSON.parse(raw); } catch { throw new PaymentError(400, 'Invalid webhook JSON'); }
  const d = event?.data;
  const id = (value: unknown, max: number) => typeof value === 'string' && new RegExp(`^[A-Za-z0-9_-]{1,${max}}$`).test(value);
  if (!id(event?.id, 64) || headerId !== event.id || event.type !== 'payment.verified' || event.version !== '2026-08-23' ||
    !d || d.status !== 'succeeded' || !id(d.externalOrderId, 48) || !id(d.paymentIntentId, 32) || !id(d.marketplaceId, 128) ||
    !id(d.sellerId, 128) || !id(d.merchantAccountId, 32) || d.asset !== 'USDC' || d.network !== 'arc-testnet' ||
    typeof d.amountAtomic !== 'string' || !/^[1-9]\d{0,12}$/.test(d.amountAtomic) ||
    typeof d.merchantAddress !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(d.merchantAddress) ||
    typeof d.transactionHash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(d.transactionHash)) throw new PaymentError(400, 'Invalid or unsupported payment event');
  return event as PaymentEvent;
}
export function assertEventMatches(order: Order, event: PaymentEvent) {
  const d = event.data;
  if (!order.paymentIntentId) throw new PaymentError(409, 'Order payment binding is not ready; retry later');
  if (order.id !== d.externalOrderId || order.paymentIntentId !== d.paymentIntentId || order.amountAtomic !== d.amountAtomic ||
    order.marketplaceId !== d.marketplaceId || order.sellerId !== d.sellerId || order.merchantAccountId !== d.merchantAccountId ||
    order.receivingAddress.toLowerCase() !== d.merchantAddress.toLowerCase() || order.asset !== d.asset || order.network !== d.network) {
    throw new PaymentError(409, 'Payment evidence does not match the saved order');
  }
  if (order.status === 'PAID' && order.transactionHash !== d.transactionHash.toLowerCase()) throw new PaymentError(409, 'Order already has a different settlement');
}
