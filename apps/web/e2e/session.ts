import { setTimeout as delay } from 'node:timers/promises';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';

const localCookiePrefix = 'upward_english_local_';

export function sessionCookieName(suffix: 'access_token' | 'refresh_token' | 'session_hint') {
  const prefix = process.env.COOKIE_PREFIX || process.env.NEXT_PUBLIC_COOKIE_PREFIX || localCookiePrefix;
  return `${prefix}${suffix}`;
}

export function addSessionCookie(
  context: BrowserContext,
  token: string,
  baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000',
) {
  return context.addCookies([{
    name: sessionCookieName('access_token'),
    value: token,
    url: baseURL,
    httpOnly: true,
  }]);
}

export const smokeApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const seededAccounts = {
  teacher: ['UPWARD_SMOKE', 'profesora@upwardenglish.app', 'UpwardEnglish2026!'],
  kids: ['UPWARD_SMOKE_KIDS', 'lucas.kids@upwardenglish.app', 'Estudiante2026!'],
  teens: ['UPWARD_SMOKE_TEENS', 'camila.teens@upwardenglish.app', 'Estudiante2026!'],
} as const;

type SmokeRole = keyof typeof seededAccounts;

function localOrigin(url: string) {
  const parsed = new URL(url);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)) {
    throw new Error('El proyecto fullstack requiere frontend y API locales.');
  }
  return parsed.origin;
}

export function smokeCredentials(role: SmokeRole) {
  localOrigin(test.info().project.use.baseURL ?? 'http://localhost:3000');
  localOrigin(smokeApiUrl);
  const [prefix, defaultEmail, defaultPassword] = seededAccounts[role];
  return {
    email: process.env[`${prefix}_EMAIL`] || defaultEmail,
    password: process.env[`${prefix}_PASSWORD`] || defaultPassword,
  };
}

const smokeSessions = new Map<SmokeRole, Awaited<ReturnType<BrowserContext['cookies']>>>();
let teacherRequests: number[] = [];

export async function reserveTeacherRateBudget(page: Page) {
  // La API admite 120 peticiones por minuto y docente. Deja margen para
  // cada flujo y para las peticiones directas de preparación y limpieza.
  const windowMs = 60_000;
  const reservedRequests = 60;
  const oldest = teacherRequests.at(-reservedRequests);
  if (oldest !== undefined) {
    const wait = oldest + windowMs - Date.now();
    if (wait > 0) await delay(wait);
  }
  const apiOrigin = localOrigin(smokeApiUrl);
  page.context().on('request', (request) => {
    const url = new URL(request.url());
    if (url.origin === apiOrigin && url.pathname.startsWith('/api/v1/')) {
      const now = Date.now();
      teacherRequests = teacherRequests.filter((timestamp) => timestamp > now - windowMs);
      teacherRequests.push(now);
    }
  });
}

export async function signInForSmoke(page: Page, role: SmokeRole) {
  const { email, password } = smokeCredentials(role);
  if (role === 'teacher') await reserveTeacherRateBudget(page);
  const cookies = smokeSessions.get(role);
  if (cookies) {
    await page.context().addCookies(cookies);
  } else {
    // Una sesión por rol y worker mantiene el rate limit real para las pruebas de login.
    const origin = localOrigin(test.info().project.use.baseURL ?? 'http://localhost:3000');
    const response = await page.request.post(`${localOrigin(smokeApiUrl)}/api/v1/auth/login`, {
      data: { email, password },
      headers: { origin },
    });
    expect(response.status(), `Login local de ${role} (HTTP ${response.status()})`).toBe(200);
    smokeSessions.set(role, await page.context().cookies());
  }
  await page.goto('/inicio');
  await expect(page).toHaveURL(/\/inicio$/);
}
