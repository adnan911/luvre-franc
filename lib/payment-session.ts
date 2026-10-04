import { checkoutConfig } from './payment-config';
import { PaymentError, atomicToDecimal, decimalToAtomic, type Order, type PaymentSession } from './payment-model';
export function validateSession(value: any, order: Order, origin: string): PaymentSession {
  const invalid = () => new PaymentError(502, 'Payment provider returned an unexpected order binding');
  if (!value || typeof value.id !== 'string' || !/^[A-Za-z0-9_-]{1,32}$/.test(value.id) ||
    value.externalOrderId !== order.id || value.marketplaceId !== order.marketplaceId || value.sellerId !== order.sellerId ||
    value.merchantAccountId !== order.merchantAccountId || typeof value.merchantAddress !== 'string' ||
    value.merchantAddress.toLowerCase() !== order.receivingAddress || value.asset !== order.asset || value.network !== order.network) throw invalid();
  // The direct-payment MVP must never redirect a buyer to an older split/fee checkout.
  if (value.platformFeeBps !== 0 || value.platformFeeAmount !== '0' ||
    value.merchantPayoutAmount !== order.amountAtomic || value.splitContractAddress !== null) throw invalid();
  try { if (decimalToAtomic(String(value.displayAmount)) !== order.amountAtomic) throw invalid(); } catch { throw invalid(); }
  const expiresAt = new Date(value.expiresAt);
  if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) throw new PaymentError(409, 'Payment session expired; start a new checkout');
  let url: URL;
  try { url = new URL(value.checkoutUrl, origin); } catch { throw invalid(); }
  if (typeof value.checkoutUrl !== 'string' || url.origin !== origin || url.pathname !== `/checkout/${value.id}` || url.search || url.hash || url.username || url.password) throw invalid();
  return { id: value.id, checkoutUrl: url.href, expiresAt };
}
export async function createPaymentSession(order: Order, idempotencyKey: string, config: ReturnType<typeof checkoutConfig>) {
  const response = await fetch(`${config.apiUrl}/api/trpc/payments.createIntent`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({ json: { externalOrderId: order.id, idempotencyKey,
      itemName: 'Luvre Franc order', amount: atomicToDecimal(order.amountAtomic),
      returnUrl: `${config.shopUrl}/orders/${order.id}/paid`,
      seller: { marketplaceId: order.marketplaceId, sellerId: order.sellerId, merchantAccountId: order.merchantAccountId } } }),
    signal: AbortSignal.timeout(15000), redirect: 'error', cache: 'no-store',
  });
  if (!response.ok) { await response.body?.cancel(); throw new PaymentError(502, 'Payment provider could not prepare checkout; retry the same checkout'); }
  const payload = await response.json();
  return validateSession(payload?.result?.data?.json, order, config.apiUrl);
}
