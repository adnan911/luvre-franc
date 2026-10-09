# Persistent Arc testnet checkout

This milestone supports one configured Luvre seller and a server-side catalog. It is not a general multi-seller cart, custody system or production gateway certification.

## Server-only configuration

Never put credentials in NEXT_PUBLIC variables, screenshots, source files or chat.

| Variable | Required value |
| --- | --- |
| LUVRE_DATABASE_URL | MySQL URL for `luvre_testnet` and `.luvre_app`, without query parameters; code enforces TLS certificate verification |
| LUVRE_DRUTO_MARKETPLACE_ID | Expected marketplace |
| LUVRE_DRUTO_SELLER_ID | Expected external seller |
| LUVRE_DRUTO_MERCHANT_ACCOUNT_ID | Verified active account in the same Druto environment as the API key |
| LUVRE_DRUTO_RECEIVING_ADDRESS | That account's receiving wallet |
| DRUTO_API_URL | HTTPS origin, without a path, for the compatible Druto API |
| DRUTO_API_KEY | Seller-scoped API credential |
| DRUTO_WEBHOOK_SECRET | Endpoint signing secret from the same environment |
| LUVRE_SHOP_URL | Canonical HTTPS storefront origin used for return URLs |

Old NEXT_PUBLIC routing variables do not authorize checkout. Missing/inconsistent configuration fails closed. Previews need their own coherent shop origin, credentials and isolated test data; do not connect them to real orders.

## Database and migrations

Apply `migrations/0001_orders.sql` only to the dedicated empty database using a migration identity. It creates orders, payment attempts, processed events and fulfillment outbox tables. The application must not have DDL, DELETE, GRANT or access to Druto databases. The Druto workspace's `scripts/setup-luvre-testnet.mjs` records a migration checksum and provisions a restricted identity. It refuses unmanaged/partial migrations; investigate partial DDL failure before continuing. A checksum ledger is not schema drift detection or a backup/restore test.

Do not run DDL blindly on deployment. Map-only historical orders cannot be recovered by this migration. Preserve historical payment evidence for reconciliation; never manufacture paid orders from unbound historical events.

## Checkout and recovery

Both checkout API routes share one service:

1. Require a UUID v4 Idempotency-Key. Accept catalog product IDs/quantities, email and shipping details. Ignore client price, total, routing and return URL.
2. Compute USDC atomic units with integer arithmetic and persist an immutable snapshot. Same key with different details returns 409.
3. Claim a 45-second SQL lease. Call Druto tRPC createIntent with stable key `luvre:<server-order-id>` and a 15-second timeout. No REST fallback. Buyer email/shipping are not sent to the public Druto intent.
4. Validate amount, asset/network, order, seller/account/recipient, expiry and checkout origin in the response. Bind the expected intent durably before returning the checkout URL.
5. On timeout or process interruption, retry the same checkout key. Expired leases and the provider's stable idempotency key allow recovery. Stale attempts cannot overwrite a newer claim. Expired intents require an explicit new checkout.

The browser retains the key while checkout remains open. Full reload/cart changes currently start a new checkout; protected cross-reload recovery is future work. Public receipts omit email/address and never claim success when order data is unavailable.

## Webhook and fulfillment semantics

Require exact signed bytes, a timestamp within 5 minutes, matching x-druto-event-id and payment.verified version 2026-08-23. Expected amount, USDC/arc-testnet, order, intent, marketplace, seller, account and receiving wallet must all match the saved order.

A pessimistic SQL transaction locks the order, inserts the unique event, records immutable payment status and creates one fulfillment record. Current locking reads are necessary when a competing transaction commits during lock wait. Duplicate delivery is acknowledged only after durable state is validated. Changed payloads for an existing event, conflicting payments and reused transactions are rejected. Missing/unbound orders return 409; unavailable storage returns 503. Druto must retry/reconcile them.

**An outbox record is not a shipment.** A fulfillment worker, inventory controls, protected merchant order access and downstream idempotency remain necessary. Exactly-once external delivery is not claimed.

## Verification and release

- Use the pinned pnpm version and lockfile: frozen install, test, typecheck, build, then `node scripts/smoke-containment.mjs`. The stale npm lockfile was removed from this release branch so deployment cannot accidentally select it.
- SQL tests use `vitest.sql.config.ts`, explicit LUVRE_SQL_TEST=1, restricted app credentials and a test admin URL scoped to luvre_testnet. The Druto workspace's runner passes credentials without displaying them and removes only test-generated IDs.
- Coverage includes real SQL concurrency, underpayment/routing rejection, durable binding, transaction uniqueness, reads from a new database pool, duplicate acknowledgements and rollback after a forced outbox write failure. It does not simulate a full database service outage or actual wallet payment.
- Release gates: seller ownership/activation in the target database; matching API/webhook credentials; grants; trusted origins; privacy retention/backups; working Druto delivery worker; queue alerts; rate limits.
- Demonstrate one actual Arc testnet checkout and retry after receiver interruption before accepting public traffic. Mainnet, Circle wallets, country/legal availability and commercial hosting eligibility are separate gates.

Rollback must preserve SQL payment/event/outbox evidence. Disable checkout or apply a compatible forward fix; restoring the old Map receiver loses durable settlement guarantees.
