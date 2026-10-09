import { orderStore } from '../../../../lib/orders';
import { webhookCore } from '../../../../lib/webhook-core';
import { paymentFailure } from '../../../../lib/payment-http';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    return await webhookCore(request, orderStore, process.env.DRUTO_WEBHOOK_SECRET);
  } catch (error) { return paymentFailure(error); }
}
