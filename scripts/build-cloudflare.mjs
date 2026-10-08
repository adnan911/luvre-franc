import { build } from 'esbuild';
import { cp, mkdir, rm, copyFile, stat } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'dist-cloudflare');
if (!output.startsWith(root + sep) || output === root) throw new Error('Unsafe Cloudflare build output');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await build({ entryPoints: [join(root, 'cloudflare/client.tsx')], outdir: output,
  entryNames: 'app', bundle: true, minify: true, format: 'esm', platform: 'browser', target: 'es2022',
  jsx: 'automatic', plugins: [{ name: 'root-public-assets', setup(bundle) {
    bundle.onResolve({ filter: /^\/hero-campaign\.jpg$/ }, () => ({ path: '/hero-campaign.jpg', external: true }));
  } }], define: {
    'process.env.NEXT_PUBLIC_DRUTO_MARKETPLACE_ID': JSON.stringify('luvre-franc'),
    'process.env.NEXT_PUBLIC_DRUTO_SELLER_ID': JSON.stringify('luvre-seller-1'),
    'process.env.NEXT_PUBLIC_DRUTO_DASHBOARD_URL': JSON.stringify('https://druto-d1-testnet.robobq.workers.dev/dashboard'),
  }, logLevel: 'warning' });
await copyFile(join(root, 'cloudflare/index.html'), join(output, 'index.html'));
await copyFile(join(root, 'cloudflare/_headers'), join(output, '_headers'));
await cp(join(root, 'public'), output, { recursive: true });
const js = (await stat(join(output, 'app.js'))).size;
const css = (await stat(join(output, 'app.css'))).size;
console.log(JSON.stringify({ output: 'dist-cloudflare', jsBytes: js, cssBytes: css }));
