import { DrutoCheckout, type PaymentIntentRequest, type PaymentSession } from "@druto/sdk";

export function requireServerEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export function getDruto() {
  return new DrutoCheckout({
    environment: "testnet",
    network: "arc-testnet",
    asset: "USDC",
    checkoutBaseUrl: requireServerEnv("DRUTO_CHECKOUT_BASE_URL"),
    createPayment: async (request: PaymentIntentRequest): Promise<PaymentSession> => {
      const baseUrl = requireServerEnv("DRUTO_CHECKOUT_BASE_URL").replace(/\/$/, "");
      const configuredEndpoint = process.env.DRUTO_CREATE_INTENT_ENDPOINT ?? "/api/trpc/payments.createIntent";
      const endpoint = /^https?:\/\//.test(configuredEndpoint) ? configuredEndpoint : `${baseUrl}/${configuredEndpoint.replace(/^\//, "")}`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${requireServerEnv("DRUTO_API_KEY")}`,
        },
        body: JSON.stringify({ json: request }),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Druto create-intent request failed with HTTP ${response.status}`);
      const payload = await response.json() as { result?: { data?: { json?: PaymentSession } } };
      const session = payload.result?.data?.json;
      if (!session) throw new Error("Druto returned an invalid payment session");
      return session;
    },
  });
}
