import { PaymentError } from './payment-model';
export async function readBody(request: Request, maximum: number) {
  const reader = request.body?.getReader();
  if (!reader) throw new PaymentError(400, 'Request body is required');
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maximum) { await reader.cancel(); throw new PaymentError(413, 'Request body is too large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks).toString('utf8');
}
export function paymentFailure(error: unknown) {
  const known = error instanceof PaymentError;
  return Response.json({ error: known ? error.message : 'Payment service temporarily unavailable; retry with the same checkout' },
    { status: known ? error.status : 503, headers: { 'Cache-Control': 'no-store' } });
}
