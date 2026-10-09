import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createHmac, randomUUID } from 'node:crypto';
import { config, input, order, event } from '../tests/fixtures';
import { PaymentError } from './payment-model';
const store = vi.hoisted(() => ({ reserve: vi.fn(), claim: vi.fn(), bind: vi.fn(), fail: vi.fn(), settle: vi.fn() }));
vi.mock('./orders', () => ({ orderStore: () => store }));
import { POST as checkout } from '../app/api/druto/create-payment/route';
import { POST as alternate } from '../app/api/checkout/route';
import { POST as webhook } from '../app/api/webhooks/druto/route';
beforeEach(() => {
  vi.resetAllMocks();
  for (const [key, value] of Object.entries({ LUVRE_DRUTO_MARKETPLACE_ID: config.marketplaceId, LUVRE_DRUTO_SELLER_ID: config.sellerId,
    LUVRE_DRUTO_MERCHANT_ACCOUNT_ID: config.merchantAccountId, LUVRE_DRUTO_RECEIVING_ADDRESS: config.receivingAddress,
    DRUTO_API_KEY: config.apiKey, DRUTO_API_URL: config.apiUrl, LUVRE_SHOP_URL: config.shopUrl, DRUTO_WEBHOOK_SECRET: 'synthetic-secret' })) vi.stubEnv(key, value);
  store.fail.mockResolvedValue(undefined);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const request = () => new Request(config.shopUrl + '/api/checkout', { method: 'POST', headers: { 'Idempotency-Key': randomUUID() }, body: JSON.stringify(input()) });
it.each([checkout, alternate])('saves before remote create and binds before returning checkout', async handler => {
  const saved = { ...order(), paymentIntentId: null }; const sequence: string[] = [];
  store.reserve.mockImplementation(async () => { sequence.push('saved'); return saved; });
  store.claim.mockResolvedValue({ order: saved, token: 'token', idempotencyKey: `luvre:${saved.id}` });
  store.bind.mockImplementation(async () => { sequence.push('bound'); });
  const http = vi.fn(async (_url, options) => { sequence.push('remote'); const body = JSON.parse(options.body).json;
    expect(options.headers.Authorization).toBe(`Bearer ${config.apiKey}`);
    expect(options.redirect).toBe('manual');
    expect(body.amount).toBe('168.000000'); expect(body.idempotencyKey).toBe(`luvre:${saved.id}`);
    expect(body.buyerLabel).toBeUndefined(); expect(body.orderContext).toBeUndefined();
    return Response.json({ result: { data: { json: { ...event(saved).data, id: 'pi_test', displayAmount: '168.000000', expiresAt: new Date(Date.now() + 60000), checkoutUrl: '/checkout/pi_test', platformFeeBps: 0, platformFeeAmount: '0', merchantPayoutAmount: saved.amountAtomic, splitContractAddress: null } } } }); });
  vi.stubGlobal('fetch', http);
  const response = await handler(request()); expect(response.status).toBe(200);
  expect(sequence).toEqual(['saved', 'remote', 'bound']); expect((await response.json()).orderId).toBe(saved.id); expect(http).toHaveBeenCalledTimes(1);
});
it('handles provider timeout without trying an alternate endpoint', async () => {
  const saved = order(); store.reserve.mockResolvedValue(saved); store.claim.mockResolvedValue({ order: saved, token: 'token', idempotencyKey: 'stable' });
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout with private information')));
  const response = await checkout(request()); expect(response.status).toBe(503); expect(await response.text()).not.toContain('private information');
  expect(fetch).toHaveBeenCalledTimes(1); expect(store.fail).toHaveBeenCalledWith(saved.id, 'token');
});
it('does not contact provider when order storage fails', async () => {
  store.reserve.mockRejectedValue(new Error('database unavailable')); const http = vi.fn(); vi.stubGlobal('fetch', http);
  expect((await checkout(request())).status).toBe(503); expect(http).not.toHaveBeenCalled();
});
it('does not release a checkout URL if database binding fails', async () => {
  const saved = { ...order(), paymentIntentId: null };
  store.reserve.mockResolvedValue(saved); store.claim.mockResolvedValue({ order: saved, token: 'token', idempotencyKey: 'stable' });
  store.bind.mockRejectedValue(new Error('private DB bind failure'));
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ result: { data: { json: { ...event(saved).data, id: 'pi_test', displayAmount: '168', expiresAt: new Date(Date.now() + 60000), checkoutUrl: '/checkout/pi_test', platformFeeBps: 0, platformFeeAmount: '0', merchantPayoutAmount: saved.amountAtomic, splitContractAddress: null } } } })));
  const response = await checkout(request()); expect(response.status).toBe(503);
  expect((await response.json()).checkoutUrl).toBeUndefined(); expect(store.fail).toHaveBeenCalledWith(saved.id, 'token');
});
it('rejects cross-origin browser checkout before reserving an order', async () => {
  const req = request(); req.headers.set('origin', 'https://attacker.example');
  expect((await checkout(req)).status).toBe(403); expect(store.reserve).not.toHaveBeenCalled();
});
it('reuses a saved checkout without another provider call', async () => {
  const saved = order(); store.reserve.mockResolvedValue(saved); store.claim.mockResolvedValue({ order: saved, idempotencyKey: 'stable' });
  const http = vi.fn(); vi.stubGlobal('fetch', http);
  const response = await checkout(request()); expect(response.status).toBe(200); expect((await response.json()).checkoutUrl).toBe(saved.checkoutUrl); expect(http).not.toHaveBeenCalled();
});
function signedRequest(message = event()) {
  const raw = JSON.stringify(message); const t = Math.floor(Date.now() / 1000);
  return new Request(config.shopUrl, { method: 'POST', headers: { 'x-druto-event-id': message.id,
    'druto-signature': `t=${t},v1=${createHmac('sha256', 'synthetic-secret').update(`${t}.${raw}`).digest('hex')}` }, body: raw });
}
it.each([409, 503])('does not acknowledge webhook on settlement failure %s', async status => {
  store.settle.mockRejectedValue(status === 409 ? new PaymentError(409, 'Order unavailable') : new Error('DB private error'));
  expect((await webhook(signedRequest())).status).toBe(status);
});
it('acknowledges committed duplicates; rejects unsigned requests before storage', async () => {
  store.settle.mockResolvedValue({ duplicate: true }); expect((await webhook(signedRequest())).status).toBe(200);
  store.settle.mockClear(); expect((await webhook(new Request(config.shopUrl, { method: 'POST', body: '{}' }))).status).toBe(401);
  expect(store.settle).not.toHaveBeenCalled();
});
