import { afterAll, afterEach, beforeAll, expect, it } from 'vitest';
import mysql, { type Pool, type Connection } from 'mysql2/promise';
import { randomBytes } from 'node:crypto';
import { createOrderStore } from '../lib/orders.mysql';
import { draft, event } from './fixtures';
import { sha256 } from '../lib/trusted-order';
import type { Order } from '../lib/payment-model';
let pool: Pool, admin: Connection;
let store: ReturnType<typeof createOrderStore>;
const ids = new Set<string>();
function options(value: string | undefined, root: boolean) {
  if (process.env.LUVRE_SQL_TEST !== '1') throw new Error('Explicit SQL integration opt-in required');
  const url = new URL(value || ''); const user = decodeURIComponent(url.username);
  if (url.protocol !== 'mysql:' || !url.hostname.endsWith('.tidbcloud.com') || url.pathname !== '/luvre_testnet' || !user.endsWith(root ? '.root' : '.luvre_app')) throw new Error('Invalid isolated integration target');
  return { host: url.hostname, port: Number(url.port || 4000), user, password: decodeURIComponent(url.password), database: 'luvre_testnet', timezone: 'Z', ssl: { minVersion: 'TLSv1.2' as const, rejectUnauthorized: true }, connectionLimit: 3 };
}
beforeAll(async () => {
  const appOptions = options(process.env.LUVRE_DATABASE_URL, false); const rootOptions = options(process.env.LUVRE_TEST_ADMIN_URL, true);
  expect(appOptions.host).toBe(rootOptions.host);
  pool = mysql.createPool(appOptions); admin = await mysql.createConnection(rootOptions); store = createOrderStore(pool);
});
afterEach(async () => {
  for (const id of ids) {
    if (!/^lf_[a-f0-9]{32}$/.test(id)) throw new Error('Refusing unexpected cleanup target');
    for (const table of ['fulfillmentOutbox', 'processedEvents', 'paymentAttempts']) await admin.execute(`DELETE FROM \`${table}\` WHERE orderId = ?`, [id]);
    await admin.execute('DELETE FROM orders WHERE id = ?', [id]);
  }
  ids.clear();
});
afterAll(async () => { if (pool) await pool.end(); if (admin) await admin.end(); });
async function saved(bound = true): Promise<Order> {
  const order = await store.reserve(draft()); ids.add(order.id);
  if (!bound) return order;
  const claim = await store.claim(order.id);
  const id = `pi_${randomBytes(10).toString('hex')}`;
  await store.bind(order.id, claim.token!, { id, checkoutUrl: `https://druto.example/checkout/${id}`, expiresAt: new Date(Date.now() + 60000) });
  return (await store.get(order.id))!;
}
async function counts(id: string) {
  const result: number[] = [];
  for (const table of ['processedEvents', 'fulfillmentOutbox']) {
    const [rows]: any = await admin.execute(`SELECT COUNT(*) AS n FROM \`${table}\` WHERE orderId = ?`, [id]); result.push(Number(rows[0].n));
  }
  return result;
}
it('concurrent reservation returns the same durable order and rejects changed request', async () => {
  const value = draft(); const orders = await Promise.all([store.reserve(value), store.reserve(value), store.reserve(value)]);
  orders.forEach(o => ids.add(o.id)); expect(ids.size).toBe(1);
  await expect(store.reserve({ ...value, requestHash: sha256('changed') })).rejects.toMatchObject({ status: 409 });
  const separate = mysql.createPool(options(process.env.LUVRE_DATABASE_URL, false));
  try { expect((await createOrderStore(separate).get(orders[0].id))?.amountAtomic).toBe(value.amountAtomic); } finally { await separate.end(); }
});
it('only one concurrent intent attempt holds the lease; recovery retains provider idempotency key', async () => {
  const order = await saved(false);
  const claims = await Promise.allSettled([store.claim(order.id), store.claim(order.id)]);
  expect(claims.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  const first = (claims.find(r => r.status === 'fulfilled') as PromiseFulfilledResult<Awaited<ReturnType<typeof store.claim>>>).value;
  await admin.execute('UPDATE orders SET attemptLeaseUntil = DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 1 SECOND) WHERE id = ?', [order.id]);
  const second = await store.claim(order.id); expect(second.idempotencyKey).toBe(first.idempotencyKey);
  await expect(store.bind(order.id, first.token!, { id: 'pi_stale', checkoutUrl: 'https://druto.example/checkout/pi_stale', expiresAt: new Date() })).rejects.toMatchObject({ status: 409 });
  await store.fail(order.id, first.token!); expect((await store.get(order.id))?.attemptToken).toBe(second.token);
});
it('underpayment and incorrect intent, seller, network, asset or recipient cannot mark an order paid', async () => {
  const order = await saved(); const valid = event(order);
  for (const [field, value] of Object.entries({ amountAtomic: '1000000', paymentIntentId: 'pi_wrong', sellerId: 'wrong', marketplaceId: 'wrong', merchantAccountId: 'ma_wrong', merchantAddress: `0x${'b'.repeat(40)}`, asset: 'ETH', network: 'mainnet' })) {
    await expect(store.settle({ ...valid, data: { ...valid.data, [field]: value } }, sha256(field))).rejects.toMatchObject({ status: 409 });
  }
  expect((await store.get(order.id))?.status).toBe('PENDING'); expect(await counts(order.id)).toEqual([0, 0]);
});
it('parallel duplicate webhooks produce one payment and fulfillment record, preserving paidAt', async () => {
  const order = await saved(); const message = event(order); const hash = sha256(JSON.stringify(message));
  const results = await Promise.all([store.settle(message, hash), store.settle(message, hash), store.settle(message, hash)]);
  expect(results.filter(r => !r.duplicate)).toHaveLength(1); expect(await counts(order.id)).toEqual([1, 1]);
  const paid = await store.get(order.id);
  await store.settle(message, hash); expect((await store.get(order.id))?.paidAt).toEqual(paid?.paidAt);
  const alternate = { ...message, id: `evt_${randomBytes(12).toString('hex')}` };
  expect((await store.settle(alternate, sha256(JSON.stringify(alternate)))).duplicate).toBe(true); expect(await counts(order.id)).toEqual([2, 1]);
});
it('rejects altered event bytes and a second settlement without changing the first', async () => {
  const order = await saved(); const message = event(order); const hash = sha256(JSON.stringify(message));
  await store.settle(message, hash);
  await expect(store.settle(message, sha256('altered bytes'))).rejects.toMatchObject({ status: 409 });
  await expect(store.settle(event(order), sha256('second payment'))).rejects.toMatchObject({ status: 409 });
  expect((await store.get(order.id))?.transactionHash).toBe(message.data.transactionHash); expect(await counts(order.id)).toEqual([1, 1]);
});
it('cannot reuse a blockchain transaction across orders', async () => {
  const first = await saved(); const second = await saved(); const one = event(first); const two = event(second); two.data.transactionHash = one.data.transactionHash;
  await store.settle(one, sha256(JSON.stringify(one)));
  await expect(store.settle(two, sha256(JSON.stringify(two)))).rejects.toMatchObject({ status: 409 });
  expect((await store.get(second.id))?.status).toBe('PENDING'); expect(await counts(second.id)).toEqual([0, 0]);
});
it('rolls payment and event back if fulfillment insert fails, then succeeds on retry', async () => {
  const order = await saved(); const message = event(order); const hash = sha256(JSON.stringify(message));
  await admin.execute('INSERT INTO fulfillmentOutbox (orderId, eventId, transactionHash) VALUES (?, ?, ?)', [order.id, 'synthetic-conflict', message.data.transactionHash]);
  await expect(store.settle(message, hash)).rejects.toMatchObject({ status: 409 });
  expect((await store.get(order.id))?.status).toBe('PENDING'); expect(await counts(order.id)).toEqual([0, 1]);
  await admin.execute('DELETE FROM fulfillmentOutbox WHERE orderId = ?', [order.id]);
  await store.settle(message, hash); expect(await counts(order.id)).toEqual([1, 1]);
});
it('webhook before intent binding remains retryable', async () => {
  const order = await saved(false); const message = event(order); const hash = sha256(JSON.stringify(message));
  await expect(store.settle(message, hash)).rejects.toMatchObject({ status: 409 });
  const claim = await store.claim(order.id);
  await store.bind(order.id, claim.token!, { id: message.data.paymentIntentId, checkoutUrl: 'https://druto.example/checkout/pi_unbound', expiresAt: new Date(Date.now() + 60000) });
  await store.settle(message, hash); expect((await store.get(order.id))?.status).toBe('PAID');
});
it('rejects unknown orders without creating them', async () => {
  const message = event(); await expect(store.settle(message, sha256('unknown'))).rejects.toMatchObject({ status: 409 });
  expect(await store.get(message.data.externalOrderId)).toBeUndefined();
});
