# Luvre Franc — Arc Testnet storefront

Luvre Franc is a marketplace integration demo for Druto. Checkout is denominated in testnet USDC on Arc Testnet and pays the verified seller wallet directly. The configured platform fee is 0%. No mainnet payment or fiat payout is supported by this branch.

## Cloudflare Testnet migration status

The storefront order ledger is implemented for Cloudflare D1 (`luvre-d1-testnet`). The four-table schema and five integrity triggers are in `migrations-d1/0001_orders.sql`. The native Cloudflare Worker and static React storefront are deployed. A seller-scoped API key and webhook secret are configured as Worker secrets, and one hosted 2 USDC Arc Testnet payment completed end to end: Druto verified the transfer, delivered the signed webhook, and Luvre marked the order `PAID` with one fulfillment outbox entry. Local D1 tests cover checkout reservation, attempt binding, settlement, duplicate webhook handling, and recovery after a simulated database outage. The old Vercel deployment remains active during cutover review.

The deployed testnet URL is `https://luvre-franc-d1-testnet.robobq.workers.dev`. A custom domain is not required for the testnet pilot.

## Local development

```bash
pnpm install
cp .env.example .env.local
# replace placeholder secrets locally; do not commit the file
pnpm dev
pnpm typecheck
pnpm test
```

The existing Next.js routes use TiDB for the current Vercel deployment. The Cloudflare-native Worker in `workers/luvre-d1-app/index.ts` uses the D1 binding `LUVRE_ORDERS_DB` and shares checkout/webhook validation code. The Worker configuration is in `wrangler.jsonc`. Apply migrations with `pnpm exec wrangler d1 migrations apply luvre-d1-testnet --local --config wrangler.jsonc` or `--remote` for the isolated remote database. Never apply a test migration to a production customer database.

Build the static React assets with `pnpm cf:build`, run the Worker locally with `pnpm cf:preview`, and deploy with `pnpm cf:deploy`. Storefront assets are served separately from the native Worker. The hosted `/api/ready` endpoint returned 200 after the D1 binding and secrets were configured.

## Secrets and seller binding

The public seller identity is `luvre-franc / luvre-seller-1`, Druto merchant account `ma_4uguzltzDSiU`, receiving wallet `0x49b1C6BE866396d6732a16A48D39e9fc305eF4fB`. These are pinned server-side in the Worker configuration. Buyers cannot supply another receiving wallet, amount, or seller identity.

`DRUTO_API_KEY` and `DRUTO_WEBHOOK_SECRET` are server-only Cloudflare Worker secrets. A fresh API key and webhook endpoint were created in the Druto D1 dashboard for `https://luvre-franc-d1-testnet.robobq.workers.dev/api/webhooks/druto`. New environments must create and store their own credentials. Never send secrets in chat or commit them to Git. The old Vercel keys and webhook secret must not be reused for the new D1 environment.

## Payment and fulfillment boundary

The server calculates the price from its catalog, reserves an order idempotently in D1, and creates a Druto Payment Intent. The buyer receives a checkout URL only after the intent is bound to the saved order. A return-page redirect is not proof of payment. The signed `payment.verified` webhook must match order ID, intent ID, seller, amount, asset, chain, recipient, and transaction hash before D1 marks the order paid. The D1 trigger queues one fulfillment outbox row per paid order. A separate idempotent fulfillment worker is still required before shipping real orders.

The storefront's `/druto-dashboard` route redirects to the real Druto dashboard. It never displays synthetic transaction data.

## Release gates

- Native Cloudflare Worker build and compressed size check (passed).
- Cloudflare Worker deploy with D1 binding; reject requests when secrets are missing (passed).
- New D1-scoped Druto API key and signed webhook endpoint, stored only as Worker secrets (passed).
- Hosted Arc Testnet checkout with the verified seller, correct direct recipient, 0% fee, and actual on-chain receipt (passed for one 2 USDC payment).
- Local D1 duplicate webhook, invalid signature, wrong amount, and simulated storage-outage recovery tests (passed). Live receiver interruption and replay remain open.
- Read-only reconciliation between Druto verified intent, Luvre paid order, D1 outbox, and Arc receipt (passed for bound demo orders; limited to 100 orders per run).
- Add monitoring, alerts, a fulfillment consumer, backup/restore drill, and rollback procedure before moving public traffic or retiring Vercel/TiDB.
