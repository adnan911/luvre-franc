import { checkoutConfig } from './payment-config';
import { orderStore } from './orders';
import { checkoutCore } from './checkout-core';
import { paymentFailure } from './payment-http';

export async function checkout(request: Request) {
  try { return await checkoutCore(request, orderStore, checkoutConfig()); }
  catch (error) { return paymentFailure(error); }
}
