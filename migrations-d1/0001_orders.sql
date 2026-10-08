CREATE TABLE orders (
  id TEXT PRIMARY KEY NOT NULL,
  checkoutKeyHash TEXT NOT NULL UNIQUE,
  requestHash TEXT NOT NULL,
  amountAtomic TEXT NOT NULL,
  itemsJson TEXT NOT NULL,
  customerEmail TEXT NOT NULL,
  shippingJson TEXT NOT NULL,
  marketplaceId TEXT NOT NULL,
  sellerId TEXT NOT NULL,
  merchantAccountId TEXT NOT NULL,
  receivingAddress TEXT NOT NULL,
  asset TEXT NOT NULL,
  network TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','PAID')),
  paymentIntentId TEXT UNIQUE,
  transactionHash TEXT UNIQUE,
  checkoutUrl TEXT,
  paymentExpiresAt INTEGER,
  attemptToken TEXT,
  attemptLeaseUntil INTEGER,
  createdAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  paidAt INTEGER
);
CREATE TABLE paymentAttempts (
  id TEXT PRIMARY KEY NOT NULL,
  orderId TEXT NOT NULL,
  idempotencyKey TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('STARTED','BOUND','FAILED')),
  lastError TEXT,
  createdAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  completedAt INTEGER
);
CREATE INDEX paymentAttempts_order ON paymentAttempts(orderId);
CREATE TABLE processedEvents (
  eventId TEXT PRIMARY KEY NOT NULL,
  orderId TEXT NOT NULL,
  payloadHash TEXT NOT NULL,
  transactionHash TEXT NOT NULL UNIQUE,
  paymentIntentId TEXT NOT NULL,
  amountAtomic TEXT NOT NULL,
  merchantAccountId TEXT NOT NULL,
  processedAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX processedEvents_order ON processedEvents(orderId);
CREATE TABLE fulfillmentOutbox (
  orderId TEXT PRIMARY KEY NOT NULL,
  eventId TEXT NOT NULL,
  transactionHash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','COMPLETED')),
  createdAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  completedAt INTEGER
);
CREATE TRIGGER orders_claim_attempt AFTER UPDATE OF attemptToken ON orders
WHEN NEW.attemptToken IS NOT NULL AND (OLD.attemptToken IS NULL OR OLD.attemptToken <> NEW.attemptToken)
BEGIN
  UPDATE paymentAttempts SET status='FAILED', lastError='LEASE_SUPERSEDED', completedAt=unixepoch()*1000
    WHERE id=OLD.attemptToken AND orderId=NEW.id AND status='STARTED';
  INSERT INTO paymentAttempts(id,orderId,idempotencyKey,status)
    VALUES(NEW.attemptToken,NEW.id,'luvre:' || NEW.id,'STARTED');
END;
CREATE TRIGGER orders_bind_attempt AFTER UPDATE OF paymentIntentId ON orders
WHEN OLD.paymentIntentId IS NULL AND NEW.paymentIntentId IS NOT NULL
BEGIN
  UPDATE paymentAttempts SET status='BOUND', completedAt=unixepoch()*1000
    WHERE id=OLD.attemptToken AND orderId=NEW.id AND status='STARTED';
  SELECT RAISE(ABORT,'attempt_bind_conflict') WHERE changes() <> 1;
END;
CREATE TRIGGER orders_fail_attempt AFTER UPDATE OF attemptToken ON orders
WHEN OLD.attemptToken IS NOT NULL AND NEW.attemptToken IS NULL AND NEW.paymentIntentId IS NULL
BEGIN
  UPDATE paymentAttempts SET status='FAILED', lastError='SESSION_NOT_BOUND', completedAt=unixepoch()*1000
    WHERE id=OLD.attemptToken AND orderId=NEW.id AND status='STARTED';
END;
CREATE TRIGGER processedEvents_validate BEFORE INSERT ON processedEvents
BEGIN
  SELECT RAISE(ABORT,'event_order_conflict') WHERE NOT EXISTS (
    SELECT 1 FROM orders WHERE id=NEW.orderId AND paymentIntentId=NEW.paymentIntentId
      AND amountAtomic=NEW.amountAtomic AND merchantAccountId=NEW.merchantAccountId
      AND status IN ('PENDING','PAID')
      AND (transactionHash IS NULL OR lower(transactionHash)=lower(NEW.transactionHash))
  );
END;
CREATE TRIGGER processedEvents_settle AFTER INSERT ON processedEvents
BEGIN
  UPDATE orders SET status='PAID', transactionHash=NEW.transactionHash, paidAt=unixepoch()*1000
    WHERE id=NEW.orderId AND status='PENDING' AND paymentIntentId=NEW.paymentIntentId;
  INSERT OR IGNORE INTO fulfillmentOutbox(orderId,eventId,transactionHash)
    SELECT id,NEW.eventId,NEW.transactionHash FROM orders
      WHERE id=NEW.orderId AND status='PAID' AND lower(transactionHash)=lower(NEW.transactionHash);
END;
