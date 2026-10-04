import { createHash } from 'node:crypto';
import { getProduct } from './catalog';
import { checkoutConfig } from './payment-config';
import { decimalToAtomic, PaymentError, type OrderDraft, type OrderItem, type ShippingAddress } from './payment-model';
export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
function field(value: unknown, max: number, name: string) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new PaymentError(400, `${name} is required and must be within ${max} characters`);
  return value.trim();
}
export function trustedOrder(body: unknown, key: string | null, config: ReturnType<typeof checkoutConfig>): OrderDraft {
  if (!key || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) throw new PaymentError(400, 'A UUID v4 Idempotency-Key header is required');
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new PaymentError(400, 'Invalid checkout payload');
  const input = body as Record<string, any>;
  if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > 30) throw new PaymentError(400, 'Checkout requires between 1 and 30 catalog items');
  const quantities = new Map<string, number>();
  for (const line of input.items) {
    const product = getProduct(line?.productId);
    if (!product || !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 10) throw new PaymentError(400, 'Unknown product or invalid quantity');
    const total = (quantities.get(product.id) ?? 0) + line.quantity;
    if (total > 10) throw new PaymentError(400, 'Maximum quantity is 10 per product');
    quantities.set(product.id, total);
  }
  const items: OrderItem[] = [...quantities.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([id, quantity]) => {
    const product = getProduct(id)!;
    return { productId: id, name: product.name, seller: config.sellerId, quantity, unitPriceAtomic: decimalToAtomic(String(product.price)) };
  });
  const total = items.reduce((sum, i) => sum + BigInt(i.unitPriceAtomic) * BigInt(i.quantity), BigInt(0));
  if (total <= BigInt(0) || total > BigInt('1000000000000')) throw new PaymentError(400, 'Order total exceeds checkout limits');
  const email = field(input.buyerEmail ?? input.customerEmail, 254, 'Buyer email');
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new PaymentError(400, 'Invalid buyer email');
  const address = input.shippingAddress;
  const shipping: ShippingAddress = { name: field(address?.name, 120, 'Name'), line1: field(address?.line1, 250, 'Address'), city: field(address?.city, 100, 'City'), postalCode: field(address?.postalCode, 32, 'Postal code'), country: field(address?.country, 100, 'Country') };
  const snapshot = { amountAtomic: total.toString(), itemsJson: JSON.stringify(items), customerEmail: email, shippingJson: JSON.stringify(shipping),
    marketplaceId: config.marketplaceId, sellerId: config.sellerId, merchantAccountId: config.merchantAccountId, receivingAddress: config.receivingAddress,
    asset: 'USDC', network: 'arc-testnet' };
  return { ...snapshot, checkoutKeyHash: sha256(key.toLowerCase()), requestHash: sha256(JSON.stringify(snapshot)) };
}
