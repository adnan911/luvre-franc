import { randomBytes } from 'node:crypto';
import { assertEventMatches } from './payment-event';
import { PaymentError, type Order, type OrderDraft, type PaymentEvent, type PaymentSession } from './payment-model';

type Value = string | number | null;
type Result<T> = { results: T[]; meta?: { changes?: number } };
export type D1OrderDatabase = {
  prepare(sql: string): {
    bind(...values: Value[]): {
      first<T>(): Promise<T | null>;
      run<T>(): Promise<Result<T>>;
    };
  };
};
type RawOrder = Omit<Order, 'paymentExpiresAt' | 'attemptLeaseUntil' | 'createdAt' | 'paidAt'> & {
  paymentExpiresAt: number | null; attemptLeaseUntil: number | null;
  createdAt: number; paidAt: number | null;
};
const date = (value: number | null) => value == null ? null : new Date(value);
function order(row: RawOrder): Order {
  return { ...row, paymentExpiresAt: date(row.paymentExpiresAt),
    attemptLeaseUntil: date(row.attemptLeaseUntil), createdAt: new Date(row.createdAt), paidAt: date(row.paidAt) };
}
const conflict = () => new PaymentError(409, 'Payment identity is already assigned; retry the original order');

export function createD1OrderStore(database: D1OrderDatabase) {
  const find = async (id: string) => {
    const row = await database.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first<RawOrder>();
    return row ? order(row) : undefined;
  };
  return {
    async reserve(draft: OrderDraft): Promise<Order> {
      const id = `lf_${randomBytes(16).toString('hex')}`;
      await database.prepare(`INSERT OR IGNORE INTO orders
        (id,checkoutKeyHash,requestHash,amountAtomic,itemsJson,customerEmail,shippingJson,
         marketplaceId,sellerId,merchantAccountId,receivingAddress,asset,network)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id, draft.checkoutKeyHash, draft.requestHash,
        draft.amountAtomic, draft.itemsJson, draft.customerEmail, draft.shippingJson,
        draft.marketplaceId, draft.sellerId, draft.merchantAccountId, draft.receivingAddress,
        draft.asset, draft.network).run();
      const row = await database.prepare('SELECT * FROM orders WHERE checkoutKeyHash = ?')
        .bind(draft.checkoutKeyHash).first<RawOrder>();
      if (!row || row.requestHash !== draft.requestHash) throw new PaymentError(409, 'Checkout details changed; start a new checkout');
      return order(row);
    },
    async get(id: string): Promise<Order | undefined> {
      if (!/^lf_[a-f0-9]{32}$/.test(id)) return undefined;
      return find(id);
    },
    async claim(id: string): Promise<{ order: Order; token?: string; idempotencyKey: string }> {
      const current = await find(id);
      if (!current) throw conflict();
      const idempotencyKey = `luvre:${id}`;
      if (current.paymentIntentId) return { order: current, idempotencyKey };
      const token = randomBytes(16).toString('hex');
      const now = Date.now();
      const claimed = await database.prepare(`UPDATE orders SET attemptToken=?,attemptLeaseUntil=?
        WHERE id=? AND paymentIntentId IS NULL AND
          (attemptLeaseUntil IS NULL OR attemptLeaseUntil <= ?)
        RETURNING id`).bind(token, now + 45_000, id, now).first<{ id: string }>();
      if (!claimed) {
        const latest = await find(id);
        if (latest?.paymentIntentId) return { order: latest, idempotencyKey };
        throw new PaymentError(409, 'Checkout is being prepared; retry shortly with the same checkout');
      }
      return { order: current, token, idempotencyKey };
    },
    async bind(id: string, token: string, session: PaymentSession) {
      const updated = await database.prepare(`UPDATE orders SET paymentIntentId=?,checkoutUrl=?,paymentExpiresAt=?,
        attemptToken=NULL,attemptLeaseUntil=NULL WHERE id=? AND attemptToken=? AND paymentIntentId IS NULL
        RETURNING id`).bind(session.id, session.checkoutUrl, session.expiresAt.getTime(), id, token)
        .first<{ id: string }>();
      if (!updated) throw new PaymentError(409, 'Checkout preparation changed; retry the original checkout');
    },
    async fail(id: string, token: string) {
      await database.prepare(`UPDATE orders SET attemptToken=NULL,attemptLeaseUntil=NULL
        WHERE id=? AND attemptToken=? AND paymentIntentId IS NULL`).bind(id, token).run();
    },
    async settle(event: PaymentEvent, payloadHash: string) {
      const current = await find(event.data.externalOrderId);
      if (!current) throw conflict();
      assertEventMatches(current, event);
      const hash = event.data.transactionHash.toLowerCase();
      let changed = 0;
      try {
        const inserted = await database.prepare(`INSERT OR IGNORE INTO processedEvents
          (eventId,orderId,payloadHash,transactionHash,paymentIntentId,amountAtomic,merchantAccountId)
          VALUES(?,?,?,?,?,?,?)`).bind(event.id, current.id, payloadHash, hash,
          event.data.paymentIntentId, event.data.amountAtomic, event.data.merchantAccountId).run();
        changed = Number(inserted.meta?.changes ?? 0);
      } catch { throw conflict(); }
      const stored = await database.prepare('SELECT orderId,payloadHash,transactionHash FROM processedEvents WHERE eventId=?')
        .bind(event.id).first<{ orderId: string; payloadHash: string; transactionHash: string }>();
      if (!stored || stored.orderId !== current.id || stored.payloadHash !== payloadHash ||
        stored.transactionHash.toLowerCase() !== hash) throw new PaymentError(409, 'Event identity conflicts with previous delivery');
      const settled = await find(current.id);
      if (settled?.status !== 'PAID' || settled.transactionHash?.toLowerCase() !== hash) throw conflict();
      return { duplicate: changed === 0 };
    },
  };
}
