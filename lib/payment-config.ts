import { PaymentError } from './payment-model';
function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value || /replace|placeholder/i.test(value)) throw new PaymentError(503, 'Payment service configuration is incomplete');
  return value;
}
export function checkoutConfig() {
  const cfg = {
    marketplaceId: required('LUVRE_DRUTO_MARKETPLACE_ID'), sellerId: required('LUVRE_DRUTO_SELLER_ID'),
    merchantAccountId: required('LUVRE_DRUTO_MERCHANT_ACCOUNT_ID'), receivingAddress: required('LUVRE_DRUTO_RECEIVING_ADDRESS').toLowerCase(),
    apiKey: required('DRUTO_API_KEY'), apiUrl: required('DRUTO_API_URL'), shopUrl: required('LUVRE_SHOP_URL'),
  };
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(cfg.marketplaceId) || !/^[A-Za-z0-9_-]{1,128}$/.test(cfg.sellerId) ||
    !/^[A-Za-z0-9_-]{1,32}$/.test(cfg.merchantAccountId) || !/^0x[0-9a-f]{40}$/.test(cfg.receivingAddress) || /^0x0{40}$/.test(cfg.receivingAddress)) throw new PaymentError(503, 'Invalid seller configuration');
  for (const field of ['apiUrl', 'shopUrl'] as const) {
    let url: URL; try { url = new URL(cfg[field]); } catch { throw new PaymentError(503, 'Invalid payment service URL'); }
    const local = process.env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1'].includes(url.hostname);
    if ((!local && url.protocol !== 'https:') || !['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new PaymentError(503, 'Invalid payment service origin');
    cfg[field] = url.origin;
  }
  return cfg;
}
