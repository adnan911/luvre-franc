# Druto Universal Marketplace Integration Guide

## 1. What this kit provides

Druto gives a marketplace or website a hosted crypto checkout for **USDC on Arc Testnet**. Your application remains the system of record for the cart, customer, shipping, fulfillment, and order ID. Druto creates a Payment Intent, resolves the seller’s approved receiving wallet, supports an EVM wallet or QR handoff, verifies the Arc transfer, and returns the buyer to your receipt page.

| Responsibility | Marketplace or website | Druto |
| --- | --- | --- |
| Product catalog and cart | Owns | Not applicable |
| Final amount calculation | Owns | Validates the Payment Intent amount |
| Seller identity | Sends stable marketplace and seller IDs | Resolves the approved receiving wallet |
| Payment window | Opens the hosted session | Hosts wallet and QR checkout |
| Wallet signing | Buyer controls the wallet | Supplies safe transaction parameters |
| Arc verification | Consumes the verified result | Verifies recipient, asset, amount, chain, and finality |
| Fulfillment | Owns after verified payment | Provides payment state and receipt context |

## 2. Recommended architecture

Use a three-part integration. The buyer browser calls your application, your server validates the order and seller, your server creates the Druto Payment Intent, and the browser redirects to the hosted checkout URL. Never expose a secret API credential or private key in browser code.

```text
Buyer browser
    │  cart and checkout form
    ▼
Your marketplace server
    │  validates cart + seller and creates an idempotency key
    ▼
Druto Payment Intent API
    │  resolves seller wallet from merchant account
    ▼
Hosted Druto checkout
    │  wallet or QR → Arc Testnet USDC transfer
    ▼
Verified seller ledger and dashboard
    │
    ▼
Your fulfillment system
```

## 3. Seller onboarding

Each seller needs a stable external seller ID and an approved Arc Testnet receiving address. Register the seller in Druto with a marketplace namespace:

```ts
await trpc.merchantAccounts.register.mutate({
  marketplaceId: "your-marketplace",
  sellerId: "seller_456",
  displayName: "Example Seller",
  receivingAddress: "0x...",
});
```

The current project exposes this as an admin-only `merchantAccounts.register` procedure. New accounts start as `pending`. The authorized seller operator then requests `merchantAccounts.createOwnershipChallenge`, asks the seller wallet to sign the exact returned message, and submits `merchantAccounts.verifyOwnership`. Druto recovers the signer, rejects expired or replayed challenges, and records `walletVerifiedAt`; only then can the admin approval procedure activate the account. Store the returned `merchantAccountId` on your server. The public browser should send `marketplaceId` and `sellerId`, not a destination wallet.

## 4. SDK installation and browser integration

Install the local starter package with `pnpm add ../druto-sdk`. After npm publication, use the registry package instead.

```ts
import { DrutoCheckout } from "@druto/sdk";

const druto = new DrutoCheckout({
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

const session = await druto.createPayment({
  orderId: "order_123",
  itemName: "Arc Testnet Starter × 1",
  amount: "1.00",
  buyerEmail: "buyer@example.com",
  seller: {
    marketplaceId: "your-marketplace",
    sellerId: "seller_456",
  },
  returnUrl: "https://shop.example/orders/order_123/paid",
});

druto.openCheckout(session);
```

The seller routing object identifies the seller but does not expose or override its wallet. Druto returns the resolved `merchantAddress` in the hosted session so the buyer can review the destination before signing.

## 5. Complete order context

Pass structured context so the buyer receipt and seller operations view can reconstruct the order:

```ts
const session = await druto.createPayment({
  orderId: "order_123",
  itemName: "Arc Testnet Starter × 1",
  amount: "1.00",
  buyerEmail: "buyer@example.com",
  seller: { marketplaceId: "your-marketplace", sellerId: "seller_456" },
  orderContext: {
    items: [{
      productId: "arc-starter",
      name: "Arc Testnet Starter",
      seller: "Example Seller",
      unitPrice: 1,
      quantity: 1,
    }],
    delivery: "Digital delivery",
    shippingAddress: {
      name: "Alex Rivera",
      line1: "1 Market Street",
      city: "Dhaka",
      postalCode: "1214",
      country: "BD",
    },
    buyerEmail: "buyer@example.com",
  },
  returnUrl: "https://shop.example/orders/order_123/paid",
});
```

Your server must calculate `amount` from trusted product, tax, discount, and shipping data. Do not accept a client-provided total without rechecking it.

## 6. Server contract

The marketplace server sends `payments.createIntent` a stable order reference, amount, seller routing, buyer context, and optional order context:

```json
{
  "externalOrderId": "order_123",
  "idempotencyKey": "order_123-seller_456-v1",
  "itemName": "Arc Testnet Starter × 1",
  "amount": "1.00",
  "buyerLabel": "buyer@example.com",
  "seller": {
    "marketplaceId": "your-marketplace",
    "sellerId": "seller_456"
  },
  "returnUrl": "https://shop.example/orders/order_123/paid"
}
```

The optional `merchantAccountId` can be supplied as a server-side shortcut, but the marketplace and seller IDs must still match the registered account. Do not include `receivingAddress` in a browser-controlled request. Druto resolves it from the merchant-account registry and persists it on the Payment Intent.

## 7. Arc Testnet behavior

The buyer may connect an injected EVM wallet such as MetaMask or Rabby, or scan the checkout QR code from a phone. The wallet transaction uses the Arc Testnet USDC contract and a direct ERC-20 `transfer` call to the resolved seller wallet. The buyer should review the token, chain, amount, and recipient in the wallet before signing.

Druto verifies the transaction receipt, successful status, USDC contract address, chain ID, transfer amount, expected seller recipient, and transaction ownership. Only a verified transfer changes the intent to `succeeded` and becomes seller dashboard activity.

The current Arc Testnet configuration is chain ID `5042002`, USDC with six decimals, RPC endpoint `https://rpc.testnet.arc.io`, and the project’s configured fallback merchant wallet for legacy demo intents. No real transaction should be approved without a disposable test wallet and explicit final confirmation.

## 8. Multi-seller carts

A direct merchant-wallet transfer has one recipient per Payment Intent. For a cart containing products from multiple sellers, group the cart by seller and create one intent per seller, or use a future split-payment contract. Each seller group needs its own amount, order group reference, and idempotency key.

The current demo marketplace intentionally blocks a mixed-seller cart from creating one ambiguous payment. This is safer than silently routing the full cart to one seller. A production marketplace can orchestrate multiple seller intents in sequence and show each group’s status to the buyer.

## 9. Seller dashboard statistics

Seller-scoped data is derived from verified transactions joined to Payment Intents. The current server contract exposes `payments.sellerPayments` and `payments.sellerSummary`, keyed by `marketplaceId`, `sellerId`, and optionally `merchantAccountId`.

A seller dashboard can calculate gross sales, available verified balance, successful order count, pending payment count, buyer wallet, order references, transaction hashes, and recipient wallet from the same normalized records. This keeps the seller dashboard and buyer receipt consistent.

## 10. Verification and fulfillment

The safe state sequence is `requires_payment` → `submitted` → `verifying` → `succeeded`, with explicit expired and mismatch failure states. Fulfill only after the trusted backend observes a verified Payment Intent. A browser redirect, wallet popup completion, or transaction hash alone is not proof of payment.

Signed `payment.verified` webhooks are the recommended production fulfillment boundary, but the current starter kit does not yet ship webhook delivery. Until that is implemented, a trusted backend can query the Payment Intent and seller ledger using server-side credentials and a reconciliation process.

## 11. Testing the integration

Run the SDK tests with:

```bash
pnpm install
pnpm build
pnpm test
```

At the application level, test seller registration, duplicate seller handling, inactive seller rejection, seller-routing mismatch on reused idempotency keys, recipient-specific transfer construction, recipient-specific Arc verification, seller summary aggregation, and multi-seller cart grouping.

For a safe browser rehearsal, use the clearly labelled demo fallback. It records a presentation-only completion and sends no blockchain transaction. For a real Arc Testnet test, obtain testnet USDC, confirm the seller wallet and exact amount, and approve only after reviewing the wallet prompt.

## 12. Production checklist

Before accepting customer funds, add production API authentication, signed webhooks, seller review controls, refund records, settlement records, rate limits, monitoring, reconciliation jobs, incident procedures, and compliance review. The demo now includes wallet ownership verification, but production deployments should additionally enforce origin allowlists and durable audit records. Add split-payment or escrow contracts only after a separate smart-contract audit. Review Arc RPC reliability, token addresses, confirmation policy, and mainnet configuration independently from this testnet demo.

## 13. Current scope boundary

This kit is a reusable seller-aware Arc Testnet foundation for marketplaces and websites. It supports direct USDC transfer to one approved seller wallet per Payment Intent, wallet/QR hosted checkout, idempotent request construction, receipt context, and seller-scoped read queries. It does not yet publish a production npm package, deliver signed webhooks, execute refunds, perform automated settlements, or support multiple assets.

## Signed webhooks and fulfillment

Register one HTTPS endpoint per marketplace or seller account using the protected `merchantAccounts.registerWebhook` procedure. The response contains the endpoint ID and a signing secret exactly once; store that secret in the marketplace backend, never in browser code or source control.

When `verifyTransfer` confirms a valid Arc Testnet USDC transaction, Druto emits `payment.verified`. The event includes the Payment Intent ID, external order ID, seller identity, merchant account, exact atomic amount, buyer and merchant addresses, transaction hash, and structured order context. The event ID is deterministic for the Payment Intent, so the marketplace can safely retry fulfillment without creating duplicate shipments or access grants.

The receiver must read the raw request body, verify `druto-signature` using `verifyWebhookSignature`, reject stale timestamps, deduplicate `x-druto-event-id`, and only then parse the event. Return a 2xx response after the order has been durably marked paid. A non-2xx response or network failure is recorded as a failed delivery with retry metadata; production systems should run a durable retry worker and dead-letter process.

```text
Arc transfer verified
  -> payment.verified event created
  -> signed delivery persisted
  -> marketplace verifies HMAC and event timestamp
  -> order marked paid exactly once
  -> seller fulfillment starts
```

This starter does not custody funds, issue refunds, or guarantee fulfillment. The marketplace remains responsible for inventory, shipping, access provisioning, refund policy, and idempotent order state transitions.

### Delivery retries

Failed deliveries retain their attempt count, error, and `nextAttemptAt`. An authorized merchant operator can invoke the protected `merchantAccounts.retryWebhook` operation after that timestamp; the operation reuses the persisted event ID and raw payload, signs a fresh timestamp header, and updates the delivery state. Marketplace receivers should still deduplicate by event ID because network retries and operator retries can overlap.

## 14. Secure seller onboarding: wallet ownership proof

Seller registration and seller activation are separate. After an authorized marketplace operator registers a seller and receiving address, call `merchantAccounts.createOwnershipChallenge` with the marketplace ID, seller ID, and marketplace origin. The response is a short-lived, domain-bound message containing the exact wallet and Arc Testnet network.

Ask the seller’s EVM wallet to sign that exact message with `personal_sign` or the wallet client’s `signMessage` method. This is an offchain proof only: it cannot move USDC and does not require a gas payment. Submit the returned signature, challenge ID, and nonce to `merchantAccounts.verifyOwnership`. The platform recovers the signer address, compares it to the registered receiving wallet, rejects expired and already-used challenges, and records the verified timestamp. An administrator may then activate the seller account.

```ts
import { signOwnershipChallenge, ownershipVerificationPayload } from "@druto/sdk";

const challenge = await druto.merchantAccounts.createOwnershipChallenge({
  seller: { marketplaceId, sellerId },
  origin: window.location.origin
});

const signature = await signOwnershipChallenge(challenge, (message) =>
  walletClient.signMessage({ message })
);

const proof = ownershipVerificationPayload(challenge, signature);
await druto.merchantAccounts.verifyOwnership(proof);
```

**Security rules:** never trust a browser-supplied wallet address without recovering the signer; never alter the challenge message; never reuse a challenge; keep the marketplace origin allowlisted; and do not treat ownership proof as payment confirmation. Payment confirmation still requires Arc Testnet USDC transfer verification and finality.
