# Cloudflare Arc Testnet cutover

This runbook covers the Luvre Franc storefront and Druto gateway. Keep the existing Vercel deployments and TiDB databases until every gate below is verified. All names and URLs here are **Testnet only**.

## State on 2026-10-09

- Druto D1 Worker is deployed at `https://druto-d1-testnet.robobq.workers.dev`. Its readiness endpoint passed, and the verified Luvre seller data was imported into isolated D1.
- Luvre D1 database `luvre-d1-testnet` exists with the order schema, four tables, and five triggers. It is separate from Druto D1.
- Luvre Cloudflare-native Worker is deployed at `https://luvre-franc-d1-testnet.robobq.workers.dev`. The static storefront, readiness, checkout, and signed webhook paths have been exercised. The Worker fails closed if the required secrets are absent. Local typecheck, 52 tests, D1 smoke test, and hosted route checks passed before the hosted payment.
- Druto D1 now allows only the exact Luvre Worker HTTPS origin for webhook registration and supports same-zone Worker fetch. Druto health and readiness stayed 200 after redeploy.
- A fresh seller-scoped Druto API key and webhook signing secret are configured as Luvre Cloudflare Worker secrets. One real Arc Testnet 2 USDC payment through the Luvre checkout has been verified end to end: order `lf_4f7f0d0e50a246d20e847488bd7b1e4c`, intent `pi_nXi5jBv0Bxe4`, transaction `0x4d43ddbf2a8dee4c539c827e5a81514404429940d914ee55a6c26eb74bad27cb`. Arc RPC receipt succeeded with one matching 2 USDC seller transfer; Druto reports `succeeded`; Luvre reports `PAID`. Druto recorded one successful webhook delivery after one attempt, and Luvre recorded one processed event and one fulfillment outbox row for this order. The outbox row is `PENDING`; no shipment or external fulfillment is claimed.
- Remote D1 aggregate check found 0 pending or failed Druto webhooks, 2 Luvre paid demo orders, 2 pending fulfillment records, and 1 expired pending demo order. These counts are snapshots, not a continuously monitored reconciliation report.
- An isolated local D1 recovery smoke test now exercises the actual signed webhook receiver through a simulated storage outage, concurrent duplicate deliveries, a later replay, invalid signature, changed payload, and wrong amount. It asserts one processed event and one fulfillment outbox row. The live paid order was not replayed or edited. A read-only operator script in the Druto repo at `../../druto-release-review/scripts/reconcile-cloudflare-testnet.mjs` compared the two remote D1 databases with Arc Testnet receipts and returned `PASS` with zero exceptions for the two paid demo orders. Set `LUVRE_REPO_DIR` if the repositories are not siblings. This script covers at most 100 bound orders and is not an automated production monitor or a scan for unreported on-chain transfers.

## Deployment gates

1. Confirm the wallet owner can sign in to Druto D1 and sees the active `luvre-franc / luvre-seller-1` account with merchant ID `ma_4uguzltzDSiU` and receiving wallet `0x49b1C6BE866396d6732a16A48D39e9fc305eF4fB`.
2. Create a fresh seller-scoped Druto D1 API key. Store it as the Luvre Worker secret `DRUTO_API_KEY`; never use the old Vercel key.
3. Register the Luvre `/api/webhooks/druto` endpoint in the Druto dashboard and save its new signing secret as Luvre Worker secret `DRUTO_WEBHOOK_SECRET`.
4. **Completed for one hosted payment:** Arc Testnet USDC, direct seller recipient, 0% fee, actual transaction receipt, Druto succeeded intent, Luvre paid order, signed webhook delivery, and one fulfillment outbox row agree.
5. **Partially completed in isolated D1:** duplicate signed webhook delivery, invalid signature, changed payload, wrong amount, and simulated DB outage were exercised with one durable payment/outbox record. Still test live retry/receiver interruption, wrong recipient, expired session, buyer return without payment, and recovery alerts without mutating the successful demo order ad hoc.
6. Move the public storefront link to Cloudflare. Monitor Worker errors, D1 writes, webhook retries, and on-chain reconciliation through a stabilization window before deleting any Vercel project or TiDB database.

## Retirement order after cutover

Export a final backup of demo records and configs without secrets. Disable new traffic to Vercel, verify Cloudflare remains healthy, then revoke old Vercel API keys/webhook endpoints, remove old Vercel deployments, and finally retire TiDB demo databases. Never delete the old systems to solve a Cloudflare build or integration failure.

The old Luvre TiDB `luvre_testnet` order tables held zero rows at the audit. Its restricted local credential was rotated after accidental diagnostic exposure; the new password was verified and saved only in the ignored local environment file. The Vercel Luvre project had no `LUVRE_DATABASE_URL` variable.
