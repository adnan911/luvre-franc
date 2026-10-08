# Cloudflare Arc Testnet cutover

This runbook covers the Luvre Franc storefront and Druto gateway. Keep the existing Vercel deployments and TiDB databases until every gate below is verified. All names and URLs here are **Testnet only**.

## State on 2026-10-08

- Druto D1 Worker is deployed at `https://druto-d1-testnet.robobq.workers.dev`. Its readiness endpoint passed, and the verified Luvre seller data was imported into isolated D1.
- Luvre D1 database `luvre-d1-testnet` exists with the order schema, four tables, and five triggers. It is separate from Druto D1.
- Luvre Cloudflare-native Worker is deployed at `https://luvre-franc-d1-testnet.robobq.workers.dev`. The static storefront and API health are 200; readiness, checkout, and webhook paths fail closed without secrets. Local typecheck, 52 tests, D1 smoke test, and hosted route checks passed. Wrangler reported 8.76 KiB compressed Worker code.
- Druto D1 now allows only the exact Luvre Worker HTTPS origin for webhook registration and supports same-zone Worker fetch. Druto health and readiness stayed 200 after redeploy.
- No new D1-scoped API key or webhook secret has been configured for Luvre. No hosted Luvre checkout or actual Arc payment has been verified through the new Worker.
- No Git push was made for this migration at the user's request.

## Deployment gates

1. Confirm the wallet owner can sign in to Druto D1 and sees the active `luvre-franc / luvre-seller-1` account with merchant ID `ma_4uguzltzDSiU` and receiving wallet `0x49b1C6BE866396d6732a16A48D39e9fc305eF4fB`.
2. Create a fresh seller-scoped Druto D1 API key. Store it as the Luvre Worker secret `DRUTO_API_KEY`; never use the old Vercel key.
3. Register the Luvre `/api/webhooks/druto` endpoint in the Druto dashboard and save its new signing secret as Luvre Worker secret `DRUTO_WEBHOOK_SECRET`.
4. Complete an Arc Testnet USDC payment through Luvre checkout. Confirm the wallet network, USDC token, direct seller recipient, 0% fee, and actual transaction hash. Confirm Druto intent, Luvre D1 paid order, webhook event, and one fulfillment outbox row agree.
5. Exercise duplicate webhook delivery, invalid signature, wrong amount/recipient, expired session, buyer return without payment, DB failure, and webhook retry. Verify no duplicate fulfillment.
6. Move the public storefront link to Cloudflare. Monitor Worker errors, D1 writes, webhook retries, and on-chain reconciliation through a stabilization window before deleting any Vercel project or TiDB database.

## Retirement order after cutover

Export a final backup of demo records and configs without secrets. Disable new traffic to Vercel, verify Cloudflare remains healthy, then revoke old Vercel API keys/webhook endpoints, remove old Vercel deployments, and finally retire TiDB demo databases. Never delete the old systems to solve a Cloudflare build or integration failure.

The old Luvre TiDB `luvre_testnet` order tables held zero rows at the audit. Its restricted local credential was rotated after accidental diagnostic exposure; the new password was verified and saved only in the ignored local environment file. The Vercel Luvre project had no `LUVRE_DATABASE_URL` variable.
