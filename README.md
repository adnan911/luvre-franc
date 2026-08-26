# Luvre Franc — Druto-powered menswear storefront

Luvre Franc is a quiet-luxury men’s clothing and accessories storefront connected to the existing Druto payment infrastructure. Customers can browse a curated collection, add products to a persistent cart, enter delivery details, and open hosted Druto checkout to pay **USDC on Arc Testnet** with an EVM wallet or QR flow.

The storefront does not seed fake customers, orders, payments, reviews, ratings, or testimonials. Payment records are created only when a real visitor completes a Druto Arc Testnet payment. The seller can use the **Seller access** link in the storefront header and footer to open the Druto dashboard.

> This project is a public testnet demo. Never use production funds, a production wallet, or mainnet credentials with this configuration.

## Run locally

```bash
pnpm install
cp .env.example .env.local
# edit .env.local with the Druto seller credentials
NODE_ENV=development pnpm dev
```

The site runs at `http://localhost:3000` unless another port is supplied directly to Next.js:

```bash
NODE_ENV=development pnpm exec next dev -p 3001
```

Validate the project before presenting it:

```bash
pnpm exec tsc --noEmit
NODE_ENV=test pnpm test
NODE_ENV=production pnpm build
```

The explicit `NODE_ENV=production` on the build command matters in environments that inherit `NODE_ENV=development`; otherwise Next.js can fail while prerendering its error routes.

## Environment variables

Copy `.env.example` to `.env.local` for local work, and add the same values in Vercel under **Settings → Environment Variables** for Preview and Production as appropriate.

| Variable | Scope | Purpose |
| --- | --- | --- |
| `DRUTO_API_KEY` | Server-only | Authenticates Payment Intent creation against Druto. Never expose it with a `NEXT_PUBLIC_` prefix. |
| `DRUTO_WEBHOOK_SECRET` | Server-only | Verifies the raw signed Druto webhook body. Keep it separate from the API key. |
| `DRUTO_CHECKOUT_BASE_URL` | Server-only | Druto host used by the server transport and hosted checkout. |
| `DRUTO_CREATE_INTENT_ENDPOINT` | Server-only | Druto Payment Intent endpoint, normally `/api/trpc/payments.createIntent`. |
| `NEXT_PUBLIC_DRUTO_MARKETPLACE_ID` | Browser-safe | Stable marketplace identifier; default is `luvre-franc`. |
| `NEXT_PUBLIC_DRUTO_SELLER_ID` | Browser-safe | Stable seller identifier; default is `luvre-main`. |
| `NEXT_PUBLIC_DRUTO_DASHBOARD_URL` | Browser-safe | Link used by the seller-access controls. |
| `NEXT_PUBLIC_SHOP_URL` | Browser-safe | Public storefront URL used when configuring return URLs and deployment documentation. |

Only the four `DRUTO_*` values are secret in this project. Do not put API keys, webhook secrets, receiving wallet addresses, or signing credentials in client components.

## Connect Luvre Franc to Druto

1. In the Druto seller dashboard, create or use the Luvre Franc seller with stable identifiers `marketplaceId=luvre-franc` and `sellerId=luvre-main`.
2. Confirm the seller’s Arc Testnet receiving wallet and complete the wallet-ownership challenge required by Druto.
3. Generate an API key and webhook secret from the seller dashboard. Save each value immediately; secret values are shown only once.
4. Set `DRUTO_CHECKOUT_BASE_URL` to the deployed Druto host and set `DRUTO_CREATE_INTENT_ENDPOINT` to the Druto Payment Intent route.
5. Register the production webhook URL:

```text
https://your-luvre-domain.example/api/webhooks/druto
```

6. Copy the generated webhook secret to `DRUTO_WEBHOOK_SECRET` in Vercel. Redeploy after changing secrets.
7. Confirm that the storefront’s **Seller access** link points to the seller’s Druto dashboard URL.

The browser sends seller identifiers and order context. It does not choose the receiving wallet. The server-side route validates the product IDs, quantities, trusted catalog total, seller identifiers, network, asset, and order reference before requesting a Payment Intent.

## Buyer flow

The presentation flow is:

1. A visitor opens the Luvre Franc storefront and selects one or more products.
2. The cart drawer shows quantities, item details, and a trusted subtotal.
3. The visitor continues to checkout and supplies name, email, delivery address, city, postal code, and country.
4. The server creates a Druto Payment Intent using the catalog total and the configured Luvre Franc seller.
5. The visitor opens Druto hosted checkout and chooses an EVM wallet or QR payment.
6. The visitor approves an **Arc Testnet USDC** transfer after confirming the network, amount, and recipient in the wallet.
7. Druto verifies the onchain settlement. The browser return page explicitly says that the payment is being verified; it does not treat a redirect as proof of payment.
8. The signed `payment.verified` webhook is processed by the seller backend. This is the fulfillment boundary and the source of truth for the seller dashboard reconciliation.

## Seller dashboard visibility

The storefront does not duplicate or fabricate payment data. The Druto dashboard remains the seller’s payment operations view. After Druto verifies a real payment, the seller can inspect the Payment Intent, settlement status, amount, buyer/order context, transaction hash, and Arcscan link in the Druto dashboard, subject to the current Druto account and event configuration.

Use the existing Druto dashboard URL rather than creating a second seller dashboard inside this storefront. This keeps payment records owner-scoped to Druto and gives the seller one place to reconcile all Luvre Franc payments.

## Webhook boundary

`app/api/webhooks/druto/route.ts` preserves the raw request body, validates `druto-signature`, requires the event ID header, and accepts only a seller-scoped `payment.verified` event for the configured marketplace and seller. Replace the marked persistence hook with your production database transaction before fulfilling physical orders.

A production fulfillment transaction should:

- Deduplicate the Druto event ID before changing order state.
- Match `externalOrderId` to the order created by the storefront.
- Store the Payment Intent ID, settlement status, amount, asset, network, buyer address, merchant address, transaction hash, and Arcscan URL.
- Mark the order paid exactly once and enqueue fulfillment only after verification.
- Return a retryable error when persistence fails so Druto can retry delivery.

## Security notes

The server route is the trust boundary. Do not accept the browser’s total, seller wallet, or payment status as authoritative. Recalculate totals from the catalog, apply quantity limits, use stable idempotent order references, and keep API credentials server-side. Add database-backed idempotency, rate limiting, authenticated order lookup, audit logs, webhook retry/dead-letter handling, reconciliation, refund records, and monitoring before handling mainnet funds.

## Main files

| File | Purpose |
| --- | --- |
| `app/page.tsx` | Public Luvre Franc storefront, cart, checkout form, seller access, and Arc Testnet disclosure. |
| `lib/catalog.ts` | Trusted catalog and server-side total calculation. |
| `components/PayWithDrutoButton.tsx` | Client-side loading, hosted-checkout handoff, success, and error states. |
| `lib/druto.ts` | Lazy server-only Druto transport and secret validation. |
| `app/api/druto/create-payment/route.ts` | Validates the order and creates a Druto Payment Intent. |
| `app/api/webhooks/druto/route.ts` | Verifies and scopes signed Druto webhook events. |
| `app/orders/[orderId]/paid/page.tsx` | Buyer return page that clearly distinguishes redirect from verified settlement. |
| `public/hero-campaign.jpg` | Original Luvre Franc editorial campaign asset used by the storefront. |

## Safe Arc Testnet checklist

Use a disposable EVM wallet funded only with Arc Testnet USDC. Before signing, verify the recipient, amount, chain ID `5042002`, and token. Test a successful payment, an abandoned checkout, an expired session, an incorrect amount, an inactive seller, duplicate payment-intent requests, duplicate webhook delivery, and webhook retry behavior.

After a successful payment, confirm the transaction on Arcscan and then open the Druto seller dashboard. The dashboard should show the verified payment only after Druto’s onchain verification and signed webhook flow complete.
#   l u v r e f r a n c  
 # luvrefranc
