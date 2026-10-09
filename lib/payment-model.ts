export class PaymentError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export type OrderItem = { productId: string; name: string; seller: string; unitPriceAtomic: string; quantity: number };
export type ShippingAddress = { name: string; line1: string; city: string; postalCode: string; country: string };
export type Order = {
  id: string; checkoutKeyHash: string; requestHash: string; amountAtomic: string;
  itemsJson: string; customerEmail: string; shippingJson: string;
  marketplaceId: string; sellerId: string; merchantAccountId: string; receivingAddress: string;
  asset: string; network: string; status: 'PENDING' | 'PAID';
  paymentIntentId: string | null; transactionHash: string | null; checkoutUrl: string | null;
  paymentExpiresAt: Date | null; attemptToken: string | null; attemptLeaseUntil: Date | null;
  createdAt: Date; paidAt: Date | null;
};
export type OrderDraft = Pick<Order, 'checkoutKeyHash' | 'requestHash' | 'amountAtomic' | 'itemsJson' | 'customerEmail' | 'shippingJson' | 'marketplaceId' | 'sellerId' | 'merchantAccountId' | 'receivingAddress' | 'asset' | 'network'>;
export type PaymentSession = { id: string; checkoutUrl: string; expiresAt: Date };
export type PaymentEvent = { id: string; type: 'payment.verified'; version: string; data: {
  externalOrderId: string; paymentIntentId: string; marketplaceId: string; sellerId: string; merchantAccountId: string;
  merchantAddress: string; amountAtomic: string; asset: 'USDC'; network: 'arc-testnet'; status: 'succeeded'; transactionHash: string;
} };
export function decimalToAtomic(value: string) {
  if (!/^(0|[1-9]\d*)(\.\d{1,6})?$/.test(value)) throw new PaymentError(400, 'Invalid USDC amount');
  const [whole, fraction = ''] = value.split('.');
  const amount = BigInt(whole) * BigInt(1000000) + BigInt(fraction.padEnd(6, '0'));
  if (amount <= BigInt(0) || amount > BigInt('1000000000000')) throw new PaymentError(400, 'USDC amount is outside checkout limits');
  return amount.toString();
}
export function atomicToDecimal(value: string) {
  const amount = BigInt(value);
  return `${amount / BigInt(1000000)}.${(amount % BigInt(1000000)).toString().padStart(6, '0')}`;
}
