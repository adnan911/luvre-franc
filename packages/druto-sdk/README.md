# Druto SDK Starter

`@druto/sdk` is a TypeScript integration kit for marketplaces and websites that want to accept **USDC on Arc Testnet** through Druto hosted checkout. The kit builds typed Payment Intent requests, carries marketplace order context, routes payments to an onboarded seller, and opens wallet or QR checkout.

> This is a starter integration kit for the Druto demo foundation. It does not custody private keys, choose seller wallets in the browser, or move funds by itself.

## Install locally

```bash
pnpm install
pnpm build
pnpm test
```

Before npm publication, a marketplace can use the package locally with `pnpm add ../druto-sdk`.

## Any-marketplace quickstart

Keep the create-intent adapter behind your server boundary. The browser sends a seller identifier, never a receiving wallet address. Druto resolves the approved Arc wallet from its merchant-account registry.

```ts
import { DrutoCheckout } from "@druto/sdk";

const checkout = new DrutoCheckout({
  environment: "testnet",
  network: "arc",
  asset: "USDC",
  checkoutBaseUrl: "https://shop.example",
  createPayment: (request) => fetch("/api/druto/create-payment", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  }).then((response) => response.json()),
});

const session = await checkout.createPayment({
  orderId: "order_123",
  itemName: "Arc Testnet Starter × 1",
  amount: "1.00",
  buyerEmail: "buyer@example.com",
  seller: {
    marketplaceId: "your-marketplace",
    sellerId: "seller_456",
  },
  returnUrl: "https://shop.example/paid",
});

checkout.openCheckout(session);
```

## Seller onboarding

A seller must first be registered in Druto with a marketplace ID, the marketplace’s external seller ID, display name, and an approved Arc Testnet receiving address. The marketplace should store the returned `merchantAccountId` server-side. At checkout, send either the stable pair `{ marketplaceId, sellerId }` or the account ID together with the pair. Do not accept a wallet address from an untrusted browser request.

The current demo exposes `merchantAccounts.register` as an admin-only onboarding procedure. New accounts start as `pending`; an administrator must approve the wallet before it can receive payments. A production marketplace should also require authenticated seller onboarding, wallet ownership verification, and operational review.

## Multi-seller carts

A direct merchant-wallet transfer has one recipient per Payment Intent. For a cart containing products from multiple sellers, group the cart by seller and create one Payment Intent per seller, or use a future split-payment contract. Never add several seller wallets to a single direct-transfer intent. Each seller intent should have its own idempotency key, seller routing fields, amount, and order group reference.

## Server contract

The marketplace server validates the cart, computes the final USDC amount, creates a unique idempotency key, and calls Druto’s `payments.createIntent` contract. The seller-aware request includes:

```json
{
  "externalOrderId": "order_123",
  "idempotencyKey": "marketplace-order_123-seller_456",
  "itemName": "Arc Testnet Starter × 1",
  "amount": "1.00",
  "buyerLabel": "buyer@example.com",
  "returnUrl": "https://shop.example/paid",
  "seller": {
    "marketplaceId": "your-marketplace",
    "sellerId": "seller_456"
  },
  "orderContext": {
    "items": [],
    "delivery": "Digital delivery",
    "shippingAddress": {},
    "buyerEmail": "buyer@example.com"
  }
}
```

The hosted session returns the resolved `merchantAddress`, seller identifiers, Payment Intent ID, amount, expiration, and `checkoutUrl`. The buyer is redirected to that URL. Druto prepares an ERC-20 USDC transfer to the resolved seller wallet and verifies the submitted Arc transaction against the expected amount, token, chain, recipient, and intent.

## Verification and fulfillment

Fulfill an order only after Druto reports `succeeded` or your trusted backend receives a signed `payment.verified` event. A buyer return URL is navigation context, not proof of payment. The current demo has seller-scoped query procedures for verified payments and summary metrics; signed webhooks and production API authentication remain future work.

## Package contents

| Path | Purpose |
| --- | --- |
| `src/client.ts` | SDK validation, request mapping, hosted checkout, and tRPC adapter |
| `src/types.ts` | Seller routing, order, shipping, Payment Intent, and session types |
| `src/index.ts` | Public package exports |
| `src/client.test.ts` | SDK behavior and seller-routing tests |
| `GUIDE.md` | Detailed Arc Testnet and multi-seller integration guide |
| `examples/` | Server-boundary integration example |

## Security boundaries

API credentials belong on the server. Calculate totals from trusted product data, keep idempotency keys stable across retries, resolve receiving wallets server-side, verify finality before fulfillment, and treat return URLs and client-submitted seller labels as untrusted input. The SDK never receives or stores private keys.

## Current limitations

The current implementation supports direct USDC transfers on Arc Testnet. It does not yet provide production API keys, signed webhooks, refunds, automated settlements, split-payment contracts, KYC tooling, or multi-asset settlement. Mainnet deployment requires a separate security, compliance, RPC, and operational review.

## Signed payment webhooks

After an Arc Testnet transfer is verified, Druto can deliver a versioned `payment.verified` event to the registered marketplace endpoint. The delivery includes `x-druto-event-id` and a `druto-signature` header in the form `t=<unix-seconds>,v1=<hex-hmac>`. The HMAC input is `${timestamp}.${rawRequestBody}` and the signing secret is shown once when the endpoint is registered.

Always verify the raw request body before parsing JSON, reject timestamps outside the five-minute tolerance, and deduplicate by `x-druto-event-id`. Fulfillment should be idempotent: mark the marketplace order paid only once, then use the `data.externalOrderId`, `data.sellerId`, `data.amountAtomic`, and `data.transactionHash` fields for reconciliation.

```ts
import { parsePaymentVerifiedEvent, verifyWebhookSignature } from "@druto/sdk";

const rawBody = await request.text();
const signature = request.headers.get("druto-signature") ?? "";
if (!(await verifyWebhookSignature(process.env.DRUTO_WEBHOOK_SECRET!, rawBody, signature))) {
  return new Response("invalid signature", { status: 401 });
}
const event = parsePaymentVerifiedEvent(rawBody);
if (!event) return new Response("ignored", { status: 400 });
await fulfillOnce(event.data.externalOrderId, event.data.transactionHash);
return new Response("ok");
```

The current starter uses Arc Testnet and direct merchant-wallet transfers. Production deployments should add secret rotation, endpoint health monitoring, rate limiting, durable retry workers, and a dead-letter workflow.

## Seller wallet ownership

Before a seller wallet becomes active, an authorized marketplace operator requests a short-lived ownership challenge from Druto. The seller signs the exact message with an EVM wallet using `personal_sign`; this is an offchain signature and does not send a transaction. Submit the challenge ID, extracted nonce, and signature to Druto. Druto verifies the signature against the registered receiving address, rejects expired or already-used challenges, records `walletVerifiedAt`, and leaves final activation to administrator approval.

```ts
const challenge = await api.merchantAccounts.createOwnershipChallenge({
  seller: { marketplaceId: "your-marketplace", sellerId: "seller_456" },
  origin: "https://shop.example"
});
const signature = await walletClient.signMessage({ message: challenge.message });
await api.merchantAccounts.verifyOwnership({
  challengeId: challenge.challengeId,
  nonce: challenge.message.match(/Nonce: ([a-f0-9]+)/)![1],
  signature
});
```

Never approve ownership from a client-side address alone. Bind the challenge to the marketplace domain, seller identity, wallet address, and Arc Testnet, and keep the returned challenge message unchanged.
