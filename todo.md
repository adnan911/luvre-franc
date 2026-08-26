# Project TODO

- [x] Initialize a separate Luvre Franc storefront project with a production-ready Next.js-compatible structure.
- [x] Establish the quiet-luxury visual system: editorial black-and-cream palette, refined serif/display typography, restrained motion, responsive layouts, and accessible contrast.
- [x] Create a curated male clothing and accessories catalog with original product names, descriptions, prices, and product imagery; do not create fake reviews, ratings, testimonials, or customer activity.
- [x] Build public storefront navigation, hero, collection sections, product listing, product detail, and footer experiences.
- [x] Build cart state with quantity controls, item removal, subtotal, and persistent client-side cart behavior.
- [x] Build checkout with customer details, order summary, clear Arc Testnet and USDC disclosure, and Pay with Druto CTA.
- [x] Connect server-side payment-intent creation to the existing Druto platform using marketplaceId `luvre-franc` and the configured seller wallet.
- [x] Keep Druto API credentials server-only and validate trusted order totals, seller identity, network, token, and idempotency on the server.
- [x] Build wallet and QR payment handoff states, loading state, error state, success state, and buyer receipt with Payment Intent ID, transaction hash, and Arcscan link.
- [x] Implement a signed Druto webhook route with raw-body verification, event-ID deduplication, payment status reconciliation, and order fulfillment boundary.
- [x] Add seller access to the existing Druto dashboard and verify seller payment visibility for Luvre Franc transactions.
- [x] Add environment-variable documentation for local development, Vercel Preview, and Vercel Production.
- [x] Add Vitest coverage for cart/order contracts, payment-intent validation, webhook signature handling, and idempotency behavior.
- [ ] Complete a real public Arc Testnet payment and verify desktop/mobile presentation on the deployed domain after Vercel credentials are configured.
- [x] Package the separate storefront deliverable with setup documentation.
