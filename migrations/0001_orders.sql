CREATE TABLE orders (
  id varchar(48) PRIMARY KEY,
  checkoutKeyHash char(64) NOT NULL UNIQUE,
  requestHash char(64) NOT NULL,
  amountAtomic varchar(32) NOT NULL,
  itemsJson text NOT NULL,
  customerEmail varchar(254) NOT NULL,
  shippingJson text NOT NULL,
  marketplaceId varchar(128) NOT NULL,
  sellerId varchar(128) NOT NULL,
  merchantAccountId varchar(32) NOT NULL,
  receivingAddress varchar(42) NOT NULL,
  asset varchar(16) NOT NULL,
  network varchar(32) NOT NULL,
  status enum('PENDING','PAID') NOT NULL DEFAULT 'PENDING',
  paymentIntentId varchar(32) UNIQUE,
  transactionHash varchar(66) UNIQUE,
  checkoutUrl varchar(2048),
  paymentExpiresAt datetime(3),
  attemptToken varchar(32),
  attemptLeaseUntil datetime(3),
  createdAt datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  paidAt datetime(3)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;
CREATE TABLE paymentAttempts (
  id varchar(32) PRIMARY KEY,
  orderId varchar(48) NOT NULL,
  idempotencyKey varchar(128) NOT NULL,
  status enum('STARTED','BOUND','FAILED') NOT NULL,
  lastError varchar(120),
  createdAt datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  completedAt datetime(3),
  INDEX paymentAttempts_order (orderId)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;
CREATE TABLE processedEvents (
  eventId varchar(64) PRIMARY KEY,
  orderId varchar(48) NOT NULL,
  payloadHash char(64) NOT NULL,
  transactionHash varchar(66) NOT NULL,
  processedAt datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX processedEvents_order (orderId)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;
CREATE TABLE fulfillmentOutbox (
  orderId varchar(48) PRIMARY KEY,
  eventId varchar(64) NOT NULL,
  transactionHash varchar(66) NOT NULL,
  status enum('PENDING','COMPLETED') NOT NULL DEFAULT 'PENDING',
  createdAt datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  completedAt datetime(3)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;
