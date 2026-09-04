import { DrutoCheckout, type PaymentIntentRequest, type PaymentSession } from "@druto/sdk";

export function requireServerEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export function getDrutoBaseUrl() {
  return (process.env.DRUTO_API_URL || process.env.DRUTO_CHECKOUT_BASE_URL || "https://druto.xyz").replace(/\/$/, "");
}

export function getDruto() {
  const baseUrl = getDrutoBaseUrl();
  return new DrutoCheckout({
    environment: "testnet",
    network: "arc-testnet",
    asset: "USDC",
    checkoutBaseUrl: baseUrl,
    createPayment: async (request: PaymentIntentRequest): Promise<PaymentSession> => {
      const apiKey = process.env.DRUTO_API_KEY;
      if (!apiKey) throw new Error("DRUTO_API_KEY is not configured");

      // Attempt REST endpoint first
      const restEndpoint = `${baseUrl}/api/v1/payment-intents`;
      const response = await fetch(restEndpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(request),
        cache: "no-store",
      });

      if (response.ok) {
        const payload = await response.json();
        const session = payload.result?.data?.json || payload.result?.data || payload.data || payload;
        if (session && (session.checkoutUrl || session.id)) {
          return {
            id: session.id || session.paymentIntentId,
            checkoutUrl: session.checkoutUrl || `${baseUrl}/checkout/${session.id}`,
            displayAmount: session.displayAmount || `${request.amount} USDC`,
            asset: "USDC",
            network: "arc-testnet",
            merchantAddress: session.merchantAddress || "",
            expiresAt: session.expiresAt || new Date(Date.now() + 3600000).toISOString(),
          };
        }
      }

      // Fallback to tRPC if REST is 404 or unsupported
      const trpcEndpoint = `${baseUrl}/api/trpc/payments.createIntent`;
      const trpcResponse = await fetch(trpcEndpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ json: request }),
        cache: "no-store",
      });

      if (!trpcResponse.ok) {
        throw new Error(`Druto create-intent request failed with HTTP ${trpcResponse.status}`);
      }

      const trpcPayload = await trpcResponse.json() as { result?: { data?: { json?: PaymentSession } } };
      const session = trpcPayload.result?.data?.json;
      if (!session) throw new Error("Druto returned an invalid payment session");
      return session;
    },
  });
}
