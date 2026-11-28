import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const configDir = path.dirname(fileURLToPath(import.meta.url));

function loadLocalEnvDefaults(files: readonly string[]): void {
  const allowedKeys = new Set([
    'COOKIE_PREFIX',
    'NEXT_PUBLIC_COOKIE_PREFIX',
    'NEXT_PUBLIC_API_URL',
    'PLAYWRIGHT_TEST_BASE_URL',
  ]);
  for (const filePath of files) {
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, 'utf8');
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const match = /^([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/.exec(line);
      if (!match) continue;
      const key = match[1];
      if (!key || !allowedKeys.has(key) || process.env[key]) continue;
      let val = (match[2] ?? '').trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

loadLocalEnvDefaults([
  path.resolve(configDir, '.env'),
  path.resolve(configDir, '../../.env'),
]);

const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';
const localSpecs = '**/*-local.spec.ts';
const fullstackTag = /@fullstack\b/;
const desktopChrome = devices['Desktop Chrome'];

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  expect: {
    timeout: 15_000,
  },
  use: {
    ...desktopChrome,
    headless: process.env.HEADED === '1' ? false : true,
    baseURL,
    trace: 'on-first-retry',
    launchOptions: {
      slowMo: process.env.SLOWMO ? Number(process.env.SLOWMO) : 0,
    },
  },
  projects: [
    {
      name: 'mocked-ci',
      testIgnore: localSpecs,
      grepInvert: fullstackTag,
    },
    {
      name: 'fullstack',
      workers: 1,
      // grep incluye el nombre del archivo y los tags de cada prueba.
      grep: [/-local\.spec\.ts /, fullstackTag],
    },
  ],
  webServer: {
    command: `pnpm dev --port ${new URL(baseURL).port || '3000'}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
