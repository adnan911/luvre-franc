import { afterEach, expect, it, vi } from 'vitest';
import { createHmac, randomUUID } from 'node:crypto';
import { config, input, order, event } from '../tests/fixtures';
import { trustedOrder } from './trusted-order';
import { assertEventMatches, parsePaymentEvent, verifyEventSignature } from './payment-event';
import { validateSession } from './payment-session';
import { readBody } from './payment-http';
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it('ignores client pricing and routing', () => {
  const result = trustedOrder({ ...input(), amount: 1, merchantAccountId: 'attacker', items: [{ productId: 'atelier-overcoat', quantity: 2, unitPrice: 0.01 }] }, randomUUID(), config);
  expect(result.amountAtomic).toBe('336000000'); expect(result.merchantAccountId).toBe(config.merchantAccountId);
});
it.each([[], [{ productId: 'unknown', quantity: 1 }], [{ productId: 'atelier-overcoat', quantity: 0 }], [{ productId: 'atelier-overcoat', quantity: 1.5 }], [{ productId: 'atelier-overcoat', quantity: 11 }]].map(items => ({ items })))('rejects invalid catalog lines $items', ({ items }) => {
  expect(() => trustedOrder({ ...input(), items }, randomUUID(), config)).toThrow();
});
it('requires idempotency key and valid email', () => {
  expect(() => trustedOrder(input(), null, config)).toThrow('Idempotency-Key');
  expect(() => trustedOrder({ ...input(), buyerEmail: 'invalid' }, randomUUID(), config)).toThrow('email');
});
it.each(['externalOrderId', 'paymentIntentId', 'marketplaceId', 'sellerId', 'merchantAccountId', 'merchantAddress', 'amountAtomic', 'asset', 'network'] as const)('rejects mismatched %s on authentic events', field => {
  const saved = order(); const message = event(saved); (message.data as any)[field] = 'wrong';
  expect(() => assertEventMatches(saved, message)).toThrow('does not match');
});
it('rejects unbound orders and different second settlements', () => {
  const saved = order(); const message = event(saved);
  expect(() => assertEventMatches({ ...saved, paymentIntentId: null }, message)).toThrow('not ready');
  expect(() => assertEventMatches({ ...saved, status: 'PAID', transactionHash: `0x${'b'.repeat(64)}` }, message)).toThrow('different settlement');
});
it('requires exact version, routing, network and event header', () => {
  const message = event(); expect(parsePaymentEvent(JSON.stringify(message), message.id)).toEqual(message);
  for (const changed of [{ ...message, version: '2026-01' }, { ...message, data: { ...message.data, sellerId: undefined } }, { ...message, data: { ...message.data, network: 'mainnet' } }]) expect(() => parsePaymentEvent(JSON.stringify(changed), message.id)).toThrow();
  expect(() => parsePaymentEvent(JSON.stringify(message), 'other')).toThrow();
});
it('requires fresh exact signed bytes', () => {
  const raw = JSON.stringify(event()); const secret = 'synthetic-secret'; const now = 1800000000;
  const sign = (time: number) => `t=${time},v1=${createHmac('sha256', secret).update(`${time}.${raw}`).digest('hex')}`;
  expect(verifyEventSignature(raw, sign(now), secret, now)).toBe(true);
  expect(verifyEventSignature(raw + ' ', sign(now), secret, now)).toBe(false);
  expect(verifyEventSignature(raw, sign(now - 301), secret, now)).toBe(false);
  expect(verifyEventSignature(raw, sign(now + 301), secret, now)).toBe(false);
  expect(verifyEventSignature(raw, sign(now) + ',v1=00', secret, now)).toBe(false);
});
it('validates provider binding and disallows external redirect', () => {
  const saved = order(); const session = { ...event(saved).data, id: saved.paymentIntentId, displayAmount: '168.000000', expiresAt: new Date(Date.now() + 60000).toISOString(), checkoutUrl: `/checkout/${saved.paymentIntentId}`, platformFeeBps: 0, platformFeeAmount: '0', merchantPayoutAmount: saved.amountAtomic, splitContractAddress: null };
  expect(validateSession(session, saved, config.apiUrl).id).toBe(saved.paymentIntentId);
  expect(() => validateSession({ ...session, displayAmount: '1' }, saved, config.apiUrl)).toThrow();
  expect(() => validateSession({ ...session, checkoutUrl: 'https://attacker.example/checkout/pi_test' }, saved, config.apiUrl)).toThrow();
  expect(() => validateSession({ ...session, platformFeeBps: 200, platformFeeAmount: '3360000', merchantPayoutAmount: '164640000' }, saved, config.apiUrl)).toThrow();
  expect(() => validateSession({ ...session, splitContractAddress: `0x${'b'.repeat(40)}` }, saved, config.apiUrl)).toThrow();
});
it('bounds streamed request size', async () => {
  await expect(readBody(new Request('https://shop.example', { method: 'POST', body: '12345' }), 4)).rejects.toMatchObject({ status: 413 });
});
it('keeps public synthetic payment signing disabled', async () => {
  vi.stubEnv('DRUTO_WEBHOOK_SECRET', 'synthetic-secret'); const http = vi.fn(); vi.stubGlobal('fetch', http);
  const { POST } = await import('../app/api/druto/simulate-webhook/route');
  expect((await POST(new Request('https://shop.example', { method: 'POST' }))).status).toBe(410); expect(http).not.toHaveBeenCalled();
});
