export type DrutoEnvironment = "testnet" | "production";
export type DrutoNetwork = "arc" | "arc-testnet";
export type DrutoAsset = "USDC";

export type ShippingAddress = {
  name: string;
  line1: string;
  city: string;
  postalCode: string;
  country: string;
};

export type OrderLine = {
  productId: string;
  name: string;
  seller: string;
  unitPrice: number;
  quantity: number;
};

export type OrderContext = {
  items: OrderLine[];
  delivery: string;
  shippingAddress: ShippingAddress;
  buyerEmail: string;
};

export type SellerRouting = {
  marketplaceId: string;
  sellerId: string;
  merchantAccountId?: string;
};

export type CreatePaymentParams = {
  orderId: string;
  amount: string | number;
  itemName: string;
  buyerEmail?: string;
  returnUrl?: string;
  orderContext?: OrderContext;
  seller?: SellerRouting;
  idempotencyKey?: string;
};

export type PaymentIntentRequest = {
  externalOrderId: string;
  idempotencyKey: string;
  itemName: string;
  amount: string;
  buyerLabel?: string;
  returnUrl?: string;
  orderContext?: OrderContext;
  seller?: SellerRouting;
};

export type PaymentSession = {
  id: string;
  externalOrderId: string;
  itemName: string;
  buyerLabel?: string;
  returnUrl: string;
  displayAmount: string;
  asset: DrutoAsset;
  network: "arc-testnet";
  marketplaceId?: string;
  sellerId?: string;
  merchantAccountId?: string;
  merchantAddress: string;
  expiresAt: string | Date;
  checkoutUrl: string;
};

export type DrutoCheckoutOptions = {
  environment: DrutoEnvironment;
  network: DrutoNetwork;
  asset: DrutoAsset;
  checkoutBaseUrl?: string;
  createPayment?: (request: PaymentIntentRequest) => Promise<PaymentSession>;
  fetcher?: typeof fetch;
};
