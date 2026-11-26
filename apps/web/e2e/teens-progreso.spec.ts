import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { StudentProgressViewSchema, type StudentProgressView } from '@upward-english/shared';

const viewports = [
  { width: 320, height: 720, columns: 1 },
  { width: 390, height: 844, columns: 1 },
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
    .include('main')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(result.violations).toEqual([]);
}

test('Plan 5 Teens: carga, reintento, insignias responsive, historial y estados vacíos', async ({
  page,
  context,
  baseURL,
}) => {
  test.setTimeout(90_000);
  const profile = {
    user: { id: 'student-teens', name: 'Valentina Cruz', email: 'teens@example.test', role: 'student' },
    student: { id: 'student-teens', ageSegment: 'teens', level: 'B1', canSwitchInterface: true },
  };
  const progress: StudentProgressView = {
    streak: { weeks: 6, forgivenessAvailable: false, activeWeeksSinceForgivenessUsed: 1, periodKey: null },
    badges: ['Constancia 4 semanas', 'Voz en ruta B1', '10 estrellas de práctica'].map((name, index) => ({
      id: `badge-${index}`,
      key: `rule-${index}`,
      name,
      description: 'Criterio cumplido en ruta B1',
      icon: 'star',
      awardedAt: '2026-11-12T02:00:00.000Z',
    })),
    activities: [
      { attemptId: 'attempt-graded', attemptNumber: 2, activityTitle: 'Unit 4 Reading Check', score: 4.5, stars: 3 },
      { attemptId: 'attempt-review', activityTitle: 'My travel podcast', score: null, stars: 0 },
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
      await context.addCookies([{ name: `${prefix}access_token`, value: 'mock-teens-token', url: baseURL }]);
    }
  }

  await page.route(/\/api\/v1\/(?:me|auth\/session)$/, (route) => route.fulfill({ json: profile }));
  await page.route('**/api/v1/feature-flags', (route) =>
    route.fulfill({
      json: { flags: { games: true, extra_content: true } },
    }),
  );

  let responseMode: 'error' | 'populated' | 'empty' = 'error';
  let releaseLoading: () => void = () => {};
  const loadingPromise = new Promise<void>((resolve) => {
    releaseLoading = resolve;
  });

  await page.route('**/api/v1/me/progress', async (route) => {
    await loadingPromise;
    if (responseMode === 'error') {
      await route.fulfill({
        status: 503,
        json: { statusCode: 503, code: 'UNAVAILABLE', message: 'Sin conexión' },
      });
    } else {
      await route.fulfill({
        json:
          responseMode === 'populated'
            ? progress
            : {
                badges: [],
                activities: [],
                streak: { ...progress.streak, weeks: 0, forgivenessAvailable: true },
              },
      });
    }
  });

  await page.setViewportSize(viewports[1]);
  await page.goto('/progreso');
  await expect(page.getByText('Cargando tu progreso…')).toBeVisible();
  releaseLoading();

  await expect(page.getByRole('alert').filter({ hasText: 'No pudimos cargar tu progreso' })).toBeVisible();
  const retry = page.getByRole('button', { name: 'Reintentar' });
  await expectTouchTarget(retry);
  await expectAccessible(page);

  responseMode = 'populated';
  await retry.focus();
  await retry.press('Enter');

  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { name: 'Tu Progreso y Logros', level: 1 })).toBeVisible();
  await expect(main.getByText('6 semanas seguidas')).toHaveCSS('font-variant-numeric', 'tabular-nums');
  await expect(main.getByText('Recuperando escudo: 1 de 2 semanas')).toBeVisible();
  await expect(main.getByText('En revisión')).toBeVisible();
  await expect(main.getByText('4,5 / 5,0')).toHaveCSS('font-variant-numeric', 'tabular-nums');
  await expect(main.getByRole('img', { name: '3 de 3 estrellas' })).toBeVisible();
  await expect(main.getByText(/11 (?:de )?nov/).first()).toBeVisible();

  const gradedTitle = main.getByRole('heading', { name: 'Unit 4 Reading Check' });
  await expect(gradedTitle).toHaveAttribute('lang', 'en');

  const detailLink = main.getByRole('link', { name: 'Ver detalles de Unit 4 Reading Check' });
  await expect(detailLink).toHaveAttribute('href', '/actividad/attempt-graded');

  const badgesList = main.getByRole('region', { name: 'Insignias (3)' }).getByRole('listitem');
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await expect
      .poll(async () => {
        const first = await badgesList.first().boundingBox();
        const boxes = await Promise.all((await badgesList.all()).map((item) => item.boundingBox()));
        return boxes.filter((box) => box?.y === first?.y).length;
      })
      .toBe(viewport.columns);

    for (const link of await main.getByRole('link', { name: /^Ver detalles/ }).all()) {
      await expectTouchTarget(link);
    }

    const overflow = await page.locator('html').evaluate((root) => root.scrollWidth - root.clientWidth);
    expect(overflow, `Desborde horizontal a ${viewport.width}px`).toBe(0);
    await expectAccessible(page);
  }

  responseMode = 'empty';
  await page.setViewportSize({ width: viewports[1].width, height: viewports[1].height });
  await page.reload();
  await expect(main.getByText('Escudo de perdón activo', { exact: true })).toBeVisible();
  await expect(main.getByText(/Aún no has desbloqueado insignias/)).toBeVisible();
  await expect(main.getByText(/Todavía no tienes entregas registradas/)).toBeVisible();

  const startLinks = main.getByRole('link', { name: 'Ir a inicio' });
  await expect(startLinks).toHaveCount(2);
  await expectTouchTarget(startLinks.first());
  await expectAccessible(page);

  await startLinks.first().press('Enter');
  await expect(page).toHaveURL(/\/inicio$/);
});

test('Plan 5 Teens: Inicio, progreso y detalle con API y PostgreSQL locales', async ({ page }) => {
  const email = process.env.ENGLOVE_TEENS_SMOKE_EMAIL;
  const password = process.env.ENGLOVE_TEENS_SMOKE_PASSWORD;
  test.skip(!email || !password, 'Requiere una cuenta Teens sembrada (ENGLOVE_TEENS_SMOKE_EMAIL / ENGLOVE_TEENS_SMOKE_PASSWORD).');
  if (!email || !password) return;
  test.setTimeout(90_000);

  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Correo electrónico' }).fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  const loginResponse = page.waitForResponse(
    (res) => new URL(res.url()).pathname === '/api/v1/auth/login' && res.request().method() === 'POST',
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
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { name: 'Tu Progreso y Logros', level: 1 })).toBeVisible();
  await expect(main.getByRole('heading', { name: `Insignias (${progress.badges.length})` })).toBeVisible();
  await expect(main.getByRole('heading', { name: `Historial de actividades (${progress.activities.length})` })).toBeVisible();

  const first = progress.activities[0];
  if (first) {
    const details = main.getByRole('link', { name: /^Ver detalles/ }).first();
    await expect(details).toHaveAttribute('href', `/actividad/${first.attemptId}`);
    const attemptResponse = page.waitForResponse(
      (res) => new URL(res.url()).pathname === `/api/v1/attempts/${first.attemptId}`,
    );
    await details.click();
    await expect(page).toHaveURL(new RegExp(`/actividad/${first.attemptId}$`));
    expect((await attemptResponse).status()).toBe(200);
    await main.getByRole('link', { name: 'Ver Mi Progreso' }).click();
    await expect(page).toHaveURL(/\/progreso$/);
    await expect(main.getByRole('heading', { name: 'Tu Progreso y Logros' })).toBeVisible();
  } else {
    const goHome = main.getByRole('link', { name: 'Ir a inicio' }).first();
    await expectTouchTarget(goHome);
    await goHome.click();
    await expect(page).toHaveURL(/\/inicio$/);
  }
});
