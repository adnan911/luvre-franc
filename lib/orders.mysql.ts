import { randomBytes } from 'node:crypto';
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { assertEventMatches } from './payment-event';
import { PaymentError, type Order, type OrderDraft, type PaymentEvent, type PaymentSession } from './payment-model';

export function createOrderStore(pool: Pool) {
  async function transaction<T>(run: (connection: PoolConnection) => Promise<T>): Promise<T> {
    const connection = await pool.getConnection();
    try {
      await connection.query("SET SESSION tidb_txn_mode = 'pessimistic'");
      await connection.query("SET SESSION time_zone = '+00:00'");
      await connection.beginTransaction();
      const value = await run(connection);
      await connection.commit();
      return value;
    } catch (error: any) {
      await connection.rollback();
      if (error?.code === 'ER_DUP_ENTRY') throw new PaymentError(409, 'Payment identity is already assigned; retry the original order');
      throw error;
    } finally { connection.release(); }
  }
  async function locked(connection: PoolConnection, id: string) {
    const [rows] = await connection.execute<RowDataPacket[]>('SELECT * FROM orders WHERE id = ? FOR UPDATE', [id]);
    if (!rows[0]) throw new PaymentError(409, 'Order is not available; retry later');
    return rows[0] as Order & RowDataPacket;
  }
  return {
    async reserve(draft: OrderDraft): Promise<Order> {
      const id = `lf_${randomBytes(16).toString('hex')}`;
      return transaction(async connection => {
        await connection.execute(`INSERT INTO orders
          (id, checkoutKeyHash, requestHash, amountAtomic, itemsJson, customerEmail, shippingJson,
           marketplaceId, sellerId, merchantAccountId, receivingAddress, asset, network)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE checkoutKeyHash = checkoutKeyHash`,
        [id, draft.checkoutKeyHash, draft.requestHash, draft.amountAtomic, draft.itemsJson, draft.customerEmail,
          draft.shippingJson, draft.marketplaceId, draft.sellerId, draft.merchantAccountId, draft.receivingAddress, draft.asset, draft.network]);
        const [rows] = await connection.execute<RowDataPacket[]>('SELECT * FROM orders WHERE checkoutKeyHash = ? FOR UPDATE', [draft.checkoutKeyHash]);
        const order = rows[0] as Order & RowDataPacket;
        if (!order || order.requestHash !== draft.requestHash) throw new PaymentError(409, 'Checkout details changed; start a new checkout');
        return order;
      });
    },
    async get(id: string): Promise<Order | undefined> {
      if (!/^lf_[a-f0-9]{32}$/.test(id)) return undefined;
      const [rows] = await pool.execute<RowDataPacket[]>('SELECT * FROM orders WHERE id = ?', [id]);
      return rows[0] as Order | undefined;
    },
    async claim(id: string): Promise<{ order: Order; token?: string; idempotencyKey: string }> {
      return transaction(async connection => {
        const order = await locked(connection, id);
        const idempotencyKey = `luvre:${order.id}`;
        if (order.paymentIntentId) return { order, idempotencyKey };
        // Keep this a current locking read: a snapshot read can miss the lease
        // committed by a competing transaction while this one waited for its lock.
        const [lease] = await connection.execute<RowDataPacket[]>('SELECT attemptLeaseUntil > UTC_TIMESTAMP(3) AS active FROM orders WHERE id = ? FOR UPDATE', [id]);
        if (lease[0].active) throw new PaymentError(409, 'Checkout is being prepared; retry shortly with the same checkout');
        if (order.attemptToken) await connection.execute("UPDATE paymentAttempts SET status = 'FAILED', lastError = 'LEASE_SUPERSEDED', completedAt = UTC_TIMESTAMP(3) WHERE id = ? AND orderId = ? AND status = 'STARTED'", [order.attemptToken, id]);
        const token = randomBytes(16).toString('hex');
        await connection.execute("INSERT INTO paymentAttempts (id, orderId, idempotencyKey, status) VALUES (?, ?, ?, 'STARTED')", [token, id, idempotencyKey]);
        await connection.execute('UPDATE orders SET attemptToken = ?, attemptLeaseUntil = DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 45 SECOND) WHERE id = ?', [token, id]);
        return { order, token, idempotencyKey };
      });
    },
    async bind(id: string, token: string, session: PaymentSession) {
      return transaction(async connection => {
        const order = await locked(connection, id);
        if (order.attemptToken !== token || order.paymentIntentId) throw new PaymentError(409, 'Checkout preparation changed; retry the original checkout');
        await connection.execute('UPDATE orders SET paymentIntentId = ?, checkoutUrl = ?, paymentExpiresAt = ?, attemptToken = NULL, attemptLeaseUntil = NULL WHERE id = ?', [session.id, session.checkoutUrl, session.expiresAt, id]);
        await connection.execute("UPDATE paymentAttempts SET status = 'BOUND', completedAt = UTC_TIMESTAMP(3) WHERE id = ? AND orderId = ?", [token, id]);
      });
    },
    async fail(id: string, token: string) {
      return transaction(async connection => {
        const order = await locked(connection, id);
        if (order.attemptToken !== token) return;
        await connection.execute('UPDATE orders SET attemptToken = NULL, attemptLeaseUntil = NULL WHERE id = ?', [id]);
        await connection.execute("UPDATE paymentAttempts SET status = 'FAILED', lastError = 'SESSION_NOT_BOUND', completedAt = UTC_TIMESTAMP(3) WHERE id = ? AND orderId = ?", [token, id]);
      });
    },
    async settle(event: PaymentEvent, payloadHash: string) {
      return transaction(async connection => {
        const order = await locked(connection, event.data.externalOrderId);
        assertEventMatches(order, event);
        const [events] = await connection.execute<RowDataPacket[]>('SELECT orderId, payloadHash FROM processedEvents WHERE eventId = ? FOR UPDATE', [event.id]);
        if (events[0]) {
          if (events[0].orderId !== order.id || events[0].payloadHash !== payloadHash) throw new PaymentError(409, 'Event identity conflicts with previous delivery');
          return { duplicate: true };
        }
        const hash = event.data.transactionHash.toLowerCase();
        await connection.execute('INSERT INTO processedEvents (eventId, orderId, payloadHash, transactionHash) VALUES (?, ?, ?, ?)', [event.id, order.id, payloadHash, hash]);
        if (order.status !== 'PAID') {
          await connection.execute("UPDATE orders SET status = 'PAID', transactionHash = ?, paidAt = UTC_TIMESTAMP(3) WHERE id = ?", [hash, order.id]);
          // Durable fulfillment work only; external fulfillment needs its own idempotent worker.
          await connection.execute('INSERT INTO fulfillmentOutbox (orderId, eventId, transactionHash) VALUES (?, ?, ?)', [order.id, event.id, hash]);
        }
        return { duplicate: order.status === 'PAID' };
      });
    },
  };
}
