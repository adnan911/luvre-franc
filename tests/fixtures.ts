import { randomUUID } from 'node:crypto';
import { trustedOrder, sha256 } from '../lib/trusted-order';
import type { Order, PaymentEvent } from '../lib/payment-model';
export const config = { marketplaceId: 'test-market', sellerId: 'test-seller', merchantAccountId: 'ma_test',
  receivingAddress: `0x${'a'.repeat(40)}`, apiUrl: 'https://druto.example', apiKey: 'synthetic-key', shopUrl: 'https://shop.example' };
export const input = () => ({ items: [{ productId: 'atelier-overcoat', quantity: 1 }], buyerEmail: 'synthetic@example.invalid',
  shippingAddress: { name: 'Synthetic', line1: 'Test', city: 'Test', postalCode: '0000', country: 'Test' } });
export const draft = () => trustedOrder(input(), randomUUID(), config);
export function order(): Order { return { ...draft(), id: `lf_${'a'.repeat(32)}`, status: 'PENDING', paymentIntentId: 'pi_test',
  transactionHash: null, checkoutUrl: 'https://druto.example/checkout/pi_test', paymentExpiresAt: new Date(Date.now() + 60000),
  attemptToken: null, attemptLeaseUntil: null, createdAt: new Date(), paidAt: null }; }
export function event(saved: Order = order()): PaymentEvent { return { id: `evt_${randomUUID().replaceAll('-', '')}`, type: 'payment.verified', version: '2026-08-23', data: {
  externalOrderId: saved.id, paymentIntentId: saved.paymentIntentId || 'pi_unbound', marketplaceId: saved.marketplaceId, sellerId: saved.sellerId,
  merchantAccountId: saved.merchantAccountId, merchantAddress: saved.receivingAddress, amountAtomic: saved.amountAtomic,
  asset: 'USDC', network: 'arc-testnet', status: 'succeeded', transactionHash: `0x${sha256(randomUUID())}`,
} }; }
