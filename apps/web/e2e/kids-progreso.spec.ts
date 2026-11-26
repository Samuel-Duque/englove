import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { StudentProgressViewSchema, type StudentProgressView } from '@upward-english/shared';

const viewports = [
  { width: 390, height: 844, columns: 1 },
  { width: 320, height: 720, columns: 1 },
  { width: 800, height: 1280, columns: 2 },
  { width: 1280, height: 800, columns: 3 },
] as const;

async function expectTouchTarget(locator: Locator) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(48);
  expect(box?.width).toBeGreaterThanOrEqual(48);
}

async function expectAccessible(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(result.violations).toEqual([]);
}

test('Plan 5 Kids: carga, reintento, álbum responsive, historial y estados vacíos', async ({ page, context, baseURL }) => {
  test.setTimeout(90_000);
  const profile = {
    user: { id: 'student-kids', name: 'Estudiante de prueba', email: 'kids@example.test', role: 'student' },
    student: { id: 'student-kids', ageSegment: 'kids', level: 'A1', canSwitchInterface: false },
  };
  const progress: StudentProgressView = {
    streak: { weeks: 3, forgivenessAvailable: false, activeWeeksSinceForgivenessUsed: 1, periodKey: null },
    badges: ['Primera parada', 'Voz de explorador', 'Gran constancia'].map((name, index) => ({
      id: `badge-${index}`, key: `rule-${index}`, name, description: 'Sello de exploración', icon: 'star',
      awardedAt: '2026-11-12T02:00:00.000Z',
    })),
    activities: [
      { attemptId: 'attempt-graded', attemptNumber: 2, activityTitle: 'My daily routine', score: 4.5, stars: 3 },
      { attemptId: 'attempt-review', activityTitle: 'My school', score: null, stars: 0 },
    ],
  };
  const cookiePrefixes = new Set([
    process.env.COOKIE_PREFIX ?? process.env.NEXT_PUBLIC_COOKIE_PREFIX,
    'englove_local_',
    'upward_english_local_',
    'upward_english_',
  ]);
  for (const prefix of cookiePrefixes) {
    if (prefix) {
      await context.addCookies([{ name: `${prefix}access_token`, value: 'mock-student-token', url: baseURL }]);
    }
  }
  await page.route(/\/api\/v1\/(?:me|auth\/session)$/, (route) => route.fulfill({ json: profile }));
  await page.route('**/api/v1/feature-flags', (route) => route.fulfill({
    json: { flags: { games: true, extra_content: true } },
  }));

  let response: 'error' | 'populated' | 'empty' = 'error';
  let releaseLoading: () => void = () => {};
  const loading = new Promise<void>((resolve) => { releaseLoading = resolve; });
  await page.route('**/api/v1/me/progress', async (route) => {
    await loading;
    if (response === 'error') {
      await route.fulfill({ status: 503, json: { statusCode: 503, code: 'UNAVAILABLE', message: 'Sin conexión' } });
    } else {
      await route.fulfill({
        json: response === 'populated' ? progress : {
          badges: [],
          activities: [],
          streak: { ...progress.streak, weeks: 0, forgivenessAvailable: true },
        },
      });
    }
  });

  await page.setViewportSize(viewports[0]);
  await page.goto('/progreso');
  await expect(page.getByText('Abriendo tu diario de logros…')).toBeVisible();
  releaseLoading();
  await expect(page.getByRole('alert').filter({ hasText: 'No pudimos cargar tu progreso' })).toBeVisible();
  const retry = page.getByRole('button', { name: 'Reintentar' });
  await expectTouchTarget(retry);
  await expectAccessible(page);
  response = 'populated';
  await retry.focus();
  await retry.press('Enter');

  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { name: 'Diario de Logros', level: 1 })).toBeVisible();
  await expect(main.getByText('3 semanas activas')).toBeVisible();
  await expect(main.getByText('Recuperando escudo: 1 / 2 semanas')).toBeVisible();
  await expect(main.getByText('En revisión')).toBeVisible();
  await expect(main.getByText('4,5 / 5,0')).toHaveCSS('font-variant-numeric', 'tabular-nums');
  await expect(main.getByRole('img', { name: '3 de 3 estrellas' })).toBeVisible();
  await expect(main.getByText(/11 (?:de )?nov/).first()).toBeVisible();
  const detail = main.getByRole('link', { name: 'Ver detalles de My daily routine' });
  await expect(detail).toHaveAttribute('href', '/actividad/attempt-graded');

  const stamps = main.getByRole('region', { name: 'Álbum de Sellos (3)' }).getByRole('listitem');
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await expect.poll(async () => {
      const first = await stamps.first().boundingBox();
      const positions = await Promise.all((await stamps.all()).map((stamp) => stamp.boundingBox()));
      return positions.filter((position) => position?.y === first?.y).length;
    }).toBe(viewport.columns);
    for (const link of await main.getByRole('link', { name: /^Ver detalles/ }).all()) {
      await expectTouchTarget(link);
    }
    const overflow = await page.locator('html').evaluate((root) => root.scrollWidth - root.clientWidth);
    expect(overflow, `Desborde a ${viewport.width}px`).toBe(0);
    await expectAccessible(page);
  }

  response = 'empty';
  await page.setViewportSize(viewports[0]);
  await page.reload();
  await expect(main.getByText('Escudo activo', { exact: true })).toBeVisible();
  await expect(main.getByText(/Tu álbum está listo/)).toBeVisible();
  const back = main.getByRole('link', { name: 'Ir a mi ruta' });
  await expectTouchTarget(back);
  await expectAccessible(page);
  await back.press('Enter');
  await expect(page).toHaveURL(/\/inicio$/);

  profile.student.ageSegment = 'teens';
  await page.goto('/progreso');
  await expect(main.getByRole('heading', { name: /^Tu Progreso y Logros/, level: 1 })).toBeVisible();
});

test('Plan 5 Kids: Inicio, progreso y detalle con API y PostgreSQL locales', async ({ page }) => {
  const email = process.env.ENGLOVE_KIDS_SMOKE_EMAIL;
  const password = process.env.ENGLOVE_KIDS_SMOKE_PASSWORD;
  test.skip(!email || !password, 'Requiere una cuenta Kids sembrada con al menos un intento calificado.');
  if (!email || !password) return;
  test.setTimeout(90_000);

  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Correo electrónico' }).fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  const loginResponse = page.waitForResponse((res) =>
    new URL(res.url()).pathname === '/api/v1/auth/login' && res.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  const login = await loginResponse;
  expect(login.ok(), `Login HTTP ${login.status()}; Retry-After: ${login.headers()['retry-after'] ?? '—'}`).toBe(true);
  await expect(page).toHaveURL(/\/inicio$/);
  const progressResponse = page.waitForResponse((res) => new URL(res.url()).pathname === '/api/v1/me/progress');
  await page.getByRole('navigation').getByRole('link', { name: 'Progreso' }).click();
  await expect(page).toHaveURL(/\/progreso$/);
  const response = await progressResponse;
  expect(response.status()).toBe(200);
  const progress = StudentProgressViewSchema.parse(await response.json());
  const first = progress.activities[0];
  if (!first || first.score === null) throw new Error('La cuenta Kids necesita un intento calificado.');
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { name: 'Diario de Logros', level: 1 })).toBeVisible();
  await expect(main.getByRole('heading', { name: `Álbum de Sellos (${progress.badges.length})` })).toBeVisible();
  const details = main.getByRole('link', { name: /^Ver detalles/ }).first();
  await expect(details).toHaveAttribute('href', `/actividad/${first.attemptId}`);
  const attemptResponse = page.waitForResponse((res) => new URL(res.url()).pathname === `/api/v1/attempts/${first.attemptId}`);
  await details.click();
  await expect(page).toHaveURL(new RegExp(`/actividad/${first.attemptId}$`));
  expect((await attemptResponse).status()).toBe(200);
  const formattedScore = first.score.toFixed(1).replace('.', ',');
  await expect(main.getByText(`Nota: ${formattedScore} / 5,0`, { exact: true })).toBeVisible();
  await main.getByRole('link', { name: 'Ver Mi Progreso' }).click();
  await expect(page).toHaveURL(/\/progreso$/);
  await expect(main.getByRole('heading', { name: 'Diario de Logros' })).toBeVisible();
});
