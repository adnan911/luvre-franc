import { createHmac, timingSafeEqual } from "node:crypto";

export type PaymentIntentRequest = {
  orderId: string;
  itemName: string;
  amount: number;
  buyerEmail: string;
  seller: { marketplaceId?: string; sellerId?: string };
  returnUrl: string;
  idempotencyKey?: string;
  orderContext?: Record<string, unknown>;
};

export type PaymentSession = {
  id: string;
  checkoutUrl: string;
  displayAmount: string;
  asset: "USDC";
  network: "arc-testnet";
  merchantAddress: string;
  expiresAt: string;
};

export interface DrutoCheckoutOptions {
  environment?: "testnet" | "mainnet" | string;
  network?: string;
  asset?: string;
  checkoutBaseUrl?: string;
  createPayment?: (request: PaymentIntentRequest) => Promise<PaymentSession>;
}

export class DrutoCheckout {
  options: DrutoCheckoutOptions;

  constructor(options: DrutoCheckoutOptions) {
    this.options = options;
  }

  async createPayment(request: PaymentIntentRequest): Promise<PaymentSession> {
    if (this.options.createPayment) {
      return this.options.createPayment(request);
    }
    throw new Error("createPayment handler not configured");
  }
}

export type PaymentVerifiedEvent = {
  id: string;
  type: "payment.verified";
  version?: string;
  createdAt?: string;
  data: {
    paymentIntentId: string;
    externalOrderId: string;
    marketplaceId: string;
    sellerId: string;
    merchantAccountId?: string;
    status: "succeeded" | string;
    amount: string;
    amountAtomic?: string;
    asset: string;
    network: string;
    buyerAddress?: string;
    merchantAddress?: string;
    transactionHash?: string;
    orderContext?: Record<string, unknown>;
  };
};

export async function verifyWebhookSignature(
  secret: string,
  rawBody: string,
  signatureHeader: string,
  customTimestamp?: number
): Promise<boolean> {
  try {
    if (!secret || !rawBody || !signatureHeader) return false;

    const matchT = signatureHeader.match(/t=(\d+)/);
    const matchV1 = signatureHeader.match(/v1=([a-fA-F0-9]+)/);
    if (!matchT || !matchV1) return false;

    const timestamp = parseInt(matchT[1], 10);
    const signature = matchV1[1];

    if (Number.isNaN(timestamp)) return false;

    const now = customTimestamp ?? Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > 300 && customTimestamp === undefined) {
      return false;
    }

    const expectedSignature = createHmac("sha256", secret)
      .update(`${timestamp}.${rawBody}`)
      .digest("hex");

    if (expectedSignature.length !== signature.length) return false;

    return timingSafeEqual(
      Buffer.from(expectedSignature, "utf-8"),
      Buffer.from(signature, "utf-8")
    );
  } catch {
    return false;
  }
}

export function parsePaymentVerifiedEvent(rawBody: string): PaymentVerifiedEvent | null {
  try {
    const parsed = typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody;
    if (
      parsed &&
      typeof parsed === "object" &&
      parsed.type === "payment.verified" &&
      parsed.data &&
      parsed.data.status === "succeeded" &&
      typeof parsed.data.externalOrderId === "string" &&
      typeof parsed.data.paymentIntentId === "string"
    ) {
      return parsed as PaymentVerifiedEvent;
    }
    return null;
  } catch {
    return null;
  }
}
