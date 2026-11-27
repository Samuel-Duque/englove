import { defineConfig, devices } from '@playwright/test';

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
