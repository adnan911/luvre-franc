import { checkoutCore } from '../../lib/checkout-core';
import { checkoutConfig } from '../../lib/payment-config';
import { paymentFailure } from '../../lib/payment-http';
import { webhookCore } from '../../lib/webhook-core';
import { createD1OrderStore, type D1OrderDatabase } from '../../lib/orders.d1';

type Service = { fetch(request: Request): Promise<Response> };
type Env = {
  ASSETS: Service;
  LUVRE_ORDERS_DB: D1OrderDatabase;
  DRUTO_SERVICE: Service;
  DRUTO_API_URL: string;
  DRUTO_API_KEY?: string;
  DRUTO_WEBHOOK_SECRET?: string;
  LUVRE_SHOP_URL: string;
  LUVRE_DRUTO_MARKETPLACE_ID: string;
  LUVRE_DRUTO_SELLER_ID: string;
  LUVRE_DRUTO_MERCHANT_ACCOUNT_ID: string;
  LUVRE_DRUTO_RECEIVING_ADDRESS: string;
  NEXT_PUBLIC_DRUTO_DASHBOARD_URL: string;
};

const noStore = { 'Cache-Control': 'no-store' };
const unavailable = () => Response.json({ error: 'Payment service temporarily unavailable' }, { status: 503, headers: noStore });
const notFound = () => Response.json({ error: 'Not found' }, { status: 404, headers: noStore });

async function orderStatus(id: string, env: Env) {
  if (!/^lf_[a-f0-9]{32}$/.test(id)) return notFound();
  if (!env.LUVRE_ORDERS_DB) return unavailable();
  try {
    const order = await createD1OrderStore(env.LUVRE_ORDERS_DB).get(id);
    if (!order) return notFound();
    return Response.json({ id: order.id, amountAtomic: order.amountAtomic, status: order.status,
      paymentIntentId: order.paymentIntentId, transactionHash: order.transactionHash,
      createdAt: order.createdAt.toISOString() }, { headers: noStore });
  } catch { return unavailable(); }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    if (path === '/api/health' && request.method === 'GET') return Response.json({ ok: true }, { headers: noStore });
    if (path === '/api/ready' && request.method === 'GET') {
      if (!env.LUVRE_ORDERS_DB || !env.DRUTO_SERVICE || !env.DRUTO_API_KEY || !env.DRUTO_WEBHOOK_SECRET) return unavailable();
      try {
        await env.LUVRE_ORDERS_DB.prepare('SELECT id FROM orders LIMIT 1').bind().first();
        return Response.json({ ready: true, database: 'd1', network: 'arc-testnet' }, { headers: noStore });
      } catch { return unavailable(); }
    }
    if (path === '/api/druto/create-payment' || path === '/api/checkout') {
      if (request.method !== 'POST') return notFound();
      if (!env.LUVRE_ORDERS_DB || !env.DRUTO_SERVICE) return unavailable();
      try {
        const config = checkoutConfig(env as unknown as Record<string, string | undefined>);
        const serviceFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
          let serviceRequest: Request;
          try { serviceRequest = new Request(input, init); }
          catch (error) {
            const message = error instanceof Error ? error.message.toLowerCase() : '';
            const reason = ['cache', 'signal', 'redirect', 'duplex', 'body', 'header', 'method', 'url', 'unsupported', 'invalid']
              .filter(part => message.includes(part));
            console.error('druto_service_request_error', { type: error instanceof Error ? error.name : 'unknown', reason });
            throw error;
          }
          try { return await env.DRUTO_SERVICE.fetch(serviceRequest); }
          catch (error) {
            console.error('druto_service_fetch_error', { type: error instanceof Error ? error.name : 'unknown' });
            throw error;
          }
        }) as typeof fetch;
        return await checkoutCore(request, createD1OrderStore(env.LUVRE_ORDERS_DB), config, serviceFetch);
      } catch (error) { return paymentFailure(error); }
    }
    if (path === '/api/webhooks/druto') {
      if (request.method !== 'POST') return notFound();
      if (!env.LUVRE_ORDERS_DB) return unavailable();
      return webhookCore(request, createD1OrderStore(env.LUVRE_ORDERS_DB), env.DRUTO_WEBHOOK_SECRET);
    }
    if (path === '/api/druto/simulate-webhook') return Response.json({ error: 'Payment simulation endpoint is disabled' }, { status: 410, headers: noStore });
    const orderMatch = /^\/api\/orders\/(lf_[a-f0-9]{32})$/.exec(path);
    if (orderMatch && request.method === 'GET') return orderStatus(orderMatch[1], env);
    if (path.startsWith('/api/')) return notFound();
    if (path === '/druto-dashboard' || path === '/druto-checkout') {
      return Response.redirect(path === '/druto-dashboard' ? env.NEXT_PUBLIC_DRUTO_DASHBOARD_URL : new URL('/', request.url).toString(), 302);
    }
    if (/^\/orders\/lf_[a-f0-9]{32}\/paid\/?$/.test(path)) {
      const shell = new Request(new URL('/index.html', request.url), request);
      const response = await env.ASSETS.fetch(shell);
      const headers = new Headers(response.headers);
      headers.set('Cache-Control', 'no-store');
      return new Response(response.body, { status: response.status, headers });
    }
    return env.ASSETS.fetch(request);
  },
};
