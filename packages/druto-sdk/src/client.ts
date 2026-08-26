import type { CreatePaymentParams, DrutoCheckoutOptions, PaymentIntentRequest, PaymentSession } from "./types.js";

function assertNonEmpty(value: string, field: string) {
  if (!value.trim()) throw new Error(`${field} is required`);
}

function normalizeAmount(amount: string | number) {
  const value = typeof amount === "number" ? amount.toFixed(2) : amount;
  if (!/^\d+(\.\d{1,6})?$/.test(value) || Number(value) <= 0) {
    throw new Error("amount must be a positive USDC decimal amount");
  }
  return value;
}

export function buildPaymentIntentRequest(params: CreatePaymentParams): PaymentIntentRequest {
  assertNonEmpty(params.orderId, "orderId");
  assertNonEmpty(params.itemName, "itemName");
  const amount = normalizeAmount(params.amount);
  return {
    externalOrderId: params.orderId,
    idempotencyKey: params.idempotencyKey ?? `sdk-${params.orderId}`,
    itemName: params.itemName,
    amount,
    buyerLabel: params.buyerEmail,
    returnUrl: params.returnUrl,
    orderContext: params.orderContext,
    seller: params.seller,
  };
}

export class DrutoCheckout {
  private readonly options: DrutoCheckoutOptions;

  constructor(options: DrutoCheckoutOptions) {
    if (options.asset !== "USDC") throw new Error("The current Druto SDK supports USDC only");
    if (options.network !== "arc" && options.network !== "arc-testnet") throw new Error("Unsupported Druto network");
    if (!options.createPayment && !options.checkoutBaseUrl) {
      throw new Error("Provide createPayment or checkoutBaseUrl");
    }
    this.options = options;
  }

  async createPayment(params: CreatePaymentParams): Promise<PaymentSession> {
    const request = buildPaymentIntentRequest(params);
    if (!this.options.createPayment) {
      throw new Error("No createPayment adapter configured. Create intents on your server and pass the result to openCheckout.");
    }
    const session = await this.options.createPayment(request);
    return { ...session, checkoutUrl: this.checkoutUrl(session.checkoutUrl) };
  }

  openCheckout(session: PaymentSession) {
    const url = this.checkoutUrl(session.checkoutUrl);
    if (typeof window === "undefined") return url;
    window.location.assign(url);
    return url;
  }

  private checkoutUrl(path: string) {
    if (/^https?:\/\//.test(path)) return path;
    const base = (this.options.checkoutBaseUrl ?? "").replace(/\/$/, "");
    return `${base}/${path.replace(/^\//, "")}`;
  }
}

export function createTrpcPaymentAdapter(endpoint: string, fetcher: typeof fetch = fetch) {
  return async (request: PaymentIntentRequest): Promise<PaymentSession> => {
    const response = await fetcher(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ json: request }),
    });
    if (!response.ok) throw new Error(`Druto create-intent request failed with HTTP ${response.status}`);
    const payload = await response.json() as { result?: { data?: { json?: PaymentSession } } };
    const session = payload.result?.data?.json;
    if (!session) throw new Error("Druto returned an invalid payment session");
    return session;
  };
}
