#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
if (args.length === 1 && args[0] === '--help') {
  console.log('Uso: node scripts/check-local-audio.mjs [--env-file apps/api/.env]');
  console.log('Comprueba ffmpeg/ffprobe y HeadBucket S3 local sin subir, listar ni borrar objetos.');
  console.log('Solo APP_ENV=local y endpoint loopback explícito; exit 0 listo, exit 1 incompleto.');
  process.exit(0);
}
if (args.length && (args.length !== 2 || args[0] !== '--env-file')) {
  console.error('Argumentos inválidos; consulta --help.');
  process.exit(1);
}

try {
  const values = Object.fromEntries(readFileSync(resolve(root, args[1] || 'apps/api/.env'), 'utf8')
    .split(/\r?\n/).flatMap((line) => {
      const match = /^\s*([A-Z][A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
      return match ? [[match[1], match[2].replace(/^(['"])(.*)\1$/, '$2')]] : [];
    }));
  const config = { ...values, ...process.env };
  if (config.APP_ENV !== 'local') throw new Error('APP_ENV debe ser local.');
  if (!config.R2_ENDPOINT) throw new Error('Falta R2_ENDPOINT explícito para MinIO local.');
  const endpoint = new URL(config.R2_ENDPOINT);
  if (!['http:', 'https:'].includes(endpoint.protocol)
    || !['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname)
    || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
    throw new Error('R2_ENDPOINT no es loopback local seguro; no se realizará ninguna conexión.');
  }
  let ready = true;
  for (const binary of ['ffmpeg', 'ffprobe']) {
    const result = spawnSync(binary, ['-version'], { shell: false, timeout: 5000, stdio: 'ignore' });
    const available = !result.error && result.status === 0;
    console.log(`${binary}: ${available ? 'disponible' : 'NO disponible en este runtime'}`);
    ready &&= available;
  }
  const require = createRequire(resolve(root, 'apps/api/package.json'));
  const { S3Client, HeadBucketCommand } = require('@aws-sdk/client-s3');
  const client = new S3Client({
    endpoint: endpoint.href,
    region: 'auto',
    forcePathStyle: true,
    // guardrails-ignore G-A09: reintentos del SDK S3, no intentos académicos ni campo del modelo retirado
    maxAttempts: 1,
    credentials: {
      accessKeyId: config.R2_ACCESS_KEY_ID || '',
      secretAccessKey: config.R2_SECRET_ACCESS_KEY || '',
    },
  });
  try {
    await client.send(new HeadBucketCommand({ Bucket: config.R2_BUCKET_NAME || 'englove-dev' }), {
      abortSignal: AbortSignal.timeout(5000),
    });
    console.log('S3 local: bucket autenticado disponible (sin mutaciones).');
  } catch {
    console.log('S3 local: NO disponible o credenciales/bucket inválidos.');
    ready = false;
  } finally {
    client.destroy();
  }
  console.log('Este diagnóstico no acredita grabación, confirmación ni transcodificación de extremo a extremo.');
  process.exitCode = ready ? 0 : 1;
} catch (error) {
  console.error(error instanceof Error && /^(R2_ENDPOINT|Falta R2_ENDPOINT|APP_ENV debe)/.test(error.message)
    ? error.message
    : 'Configuración local ausente o inválida; no se contactó ningún servicio remoto.');
  process.exitCode = 1;
}
