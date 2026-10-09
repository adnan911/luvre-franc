import mysql, { type Pool } from 'mysql2/promise';
import { PaymentError } from './payment-model';
let pool: Pool | undefined;
export function orderDatabase() {
  if (pool) return pool;
  let url: URL;
  try { url = new URL(process.env.LUVRE_DATABASE_URL || ''); }
  catch { throw new PaymentError(503, 'Order database is not configured'); }
  const user = decodeURIComponent(url.username);
  if (url.protocol !== 'mysql:' || !url.hostname.endsWith('.tidbcloud.com') || url.pathname !== '/luvre_testnet' ||
      !/^[A-Za-z0-9]+\.luvre_app$/.test(user) || !url.password || url.search || url.hash) throw new PaymentError(503, 'Invalid order database configuration');
  pool = mysql.createPool({ host: url.hostname, port: Number(url.port || 4000), user,
    password: decodeURIComponent(url.password), database: 'luvre_testnet', ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
    timezone: 'Z', connectionLimit: 3, queueLimit: 10, connectTimeout: 10000, multipleStatements: false });
  return pool;
}
