import { execFileSync } from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs';

export function loadEnvFile(): void {
  if (process.env.CI === 'true' && !process.env.DATABASE_URL) {
    throw new Error('CI-02: CI requiere una DATABASE_URL explícita de pruebas');
  }
  if (process.env.DATABASE_URL) return;
  try {
    const envPath = path.resolve(__dirname, '../.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const [k, ...v] = trimmed.split('=');
        if (k && v.length > 0) {
          const key = k.trim();
          let val = v.join('=').trim();
          if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
          ) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  } catch {
    // ignore
  }
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5433/englove_dev?schema=public';
  }
}

loadEnvFile();

export function getPostgresPort(): number {
  const url = process.env.DATABASE_URL;
  if (!url) return 5433;
  try {
    const parsed = new URL(url);
    return parsed.port ? parseInt(parsed.port, 10) : 5433;
  } catch {
    return 5433;
  }
}

export function getPostgresHost(): string {
  const url = process.env.DATABASE_URL;
  if (!url) return '127.0.0.1';
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    return host === 'localhost' || !host ? '127.0.0.1' : host;
  } catch {
    return '127.0.0.1';
  }
}

export function checkPortOpenSync(port: number, host = '127.0.0.1'): boolean {
  try {
    execFileSync(
      process.execPath,
      [
        '-e',
        `const net = require('net');
        const s = new net.Socket();
        s.setTimeout(2500);
        s.once('connect', () => { s.destroy(); process.exit(0); });
        s.once('timeout', () => { s.destroy(); process.exit(1); });
        s.once('error', () => { s.destroy(); process.exit(1); });
        s.connect(${port}, '${host}');`,
      ],
      { stdio: 'ignore', timeout: 6000 },
    );
    return true;
  } catch {
    return false;
  }
}

export function checkPostgresRunning(): boolean {
  const configuredPort = getPostgresPort();
  const host = getPostgresHost();
  return checkPortOpenSync(configuredPort, host);
}

export const isPostgresAvailable = checkPostgresRunning();
if ((process.env.CI === 'true' || process.env.REQUIRE_POSTGRES_TESTS === '1') && !isPostgresAvailable) {
  throw new Error('CI-02: PostgreSQL de pruebas es obligatorio y no está disponible');
}
