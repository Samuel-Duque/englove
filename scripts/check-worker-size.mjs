import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const require = createRequire(new URL('../apps/web/package.json', import.meta.url));
const manifestPath = require.resolve('wrangler/package.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const executable = resolve(dirname(manifestPath), typeof manifest.bin === 'string' ? manifest.bin : manifest.bin.wrangler);
const result = spawnSync(process.execPath, [executable,
  'deploy', '--dry-run', '--config', 'dist/server/wrangler.json'], {
  cwd: new URL('../apps/web/', import.meta.url), encoding: 'utf8', timeout: 120_000,
});
if (result.error || result.status !== 0) {
  console.error('No se pudo empaquetar el Worker:', result.error?.message ?? result.stderr);
  process.exit(1);
}
const match = result.stdout.match(/Total Upload:.*gzip:\s*([\d.]+)\s*(KiB|MiB)/);
if (!match) throw new Error('Wrangler no informó el tamaño gzip; no se puede acreditar el presupuesto');
const bytes = Number(match[1]) * (match[2] === 'MiB' ? 1024 * 1024 : 1024);
console.log(`Worker gzip: ${Math.round(bytes)} bytes (límite staging: 3 MiB)`);
if (bytes > 3 * 1024 * 1024) process.exit(1);
