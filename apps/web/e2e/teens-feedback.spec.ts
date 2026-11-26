import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  StudentFeedbackListResponseSchema,
  type StudentFeedbackListResponse,
} from '@upward-english/shared';

async function expectTouchTarget(control: Locator) {
  await expect(control).toBeVisible();
  const box = await control.boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(48);
  expect(box?.width).toBeGreaterThanOrEqual(48);
}

async function expectAccessible(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .include('main')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(violations).toEqual([]);
}

test('Plan 6 Teens: feedback responsive, historial, estado vacío y reintento accesible', async ({
  page, context, baseURL,
}) => {
  test.setTimeout(90_000);
  const prefixes = new Set([
    process.env.COOKIE_PREFIX ?? process.env.NEXT_PUBLIC_COOKIE_PREFIX,
    'englove_local_',
    'upward_english_local_',
    'upward_english_',
  ]);
  for (const prefix of prefixes) {
    if (prefix) await context.addCookies([{ name: `${prefix}access_token`, value: 'mock-teens-token', url: baseURL }]);
  }

  const profile = {
    user: { id: 'student-teens', name: 'Valentina Cruz', email: 'teens@example.test', role: 'student' },
    student: { id: 'student-teens', ageSegment: 'teens', level: 'B1', canSwitchInterface: true },
  };
  await page.route(/\/api\/v1\/(?:me|auth\/session)$/, (route) => route.fulfill({ json: profile }));
  await page.route('**/api/v1/feature-flags', (route) =>
    route.fulfill({ json: { flags: { games: true, extra_content: true } } }),
  );

  const latestAttempt = {
    id: 'graded-2',
    attemptNumber: 2,
    score: 4.6,
    stars: 3,
    gradedAt: '2026-11-12T02:00:00.000Z',
    comment: `Añade un ejemplo para respaldar tu argumento.\n${'abc'.repeat(85)}`,
    stickers: [
      { code: 'great_job', label: 'Great job!', emoji: '⭐' },
      { code: 'grammar_star', label: 'Grammar star!', emoji: '🏅' },
      { code: 'super_effort', label: 'Super effort!', emoji: '💪' },
    ],
  };
  const payload: StudentFeedbackListResponse = {
    items: [{
      assignmentId: 'feedback-assignment',
      activityType: 'open_question',
      activityTitle: 'Writing a review',
      hasAvailableRetry: true,
      effectiveDueAt: '2026-12-01T02:00:00.000Z',
      latestAttempt,
      attempts: [
        { id: 'graded-1', attemptNumber: 1, score: 0, stars: 0, gradedAt: '', stickers: [] },
        latestAttempt,
      ],
    }, {
      assignmentId: 'read-only-assignment',
      activityType: 'exam',
      activityTitle: 'Reading check',
      hasAvailableRetry: false,
      effectiveDueAt: '',
      latestAttempt: { ...latestAttempt, id: 'graded-3', comment: null, stickers: [] },
      attempts: [],
    }],
  };
  let mode: 'error' | 'populated' | 'empty' = 'error';
  let releaseLoading = () => {};
  const loading = new Promise<void>((resolve) => { releaseLoading = resolve; });
  await page.route('**/api/v1/student/feedback', async (route) => {
    await loading;
    if (mode === 'error') {
      await route.fulfill({ status: 503, json: { statusCode: 503, code: 'UNAVAILABLE', message: 'Sin conexión' } });
      return;
    }
    await route.fulfill({ json: mode === 'populated' ? payload : { items: [] } });
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/feedback');
  const main = page.getByRole('main');
  await expect(main.getByRole('status')).toContainText('Cargando tu retroalimentación…');
  releaseLoading();

  const loadAgain = main.getByRole('button', { name: 'Reintentar' });
  await expectTouchTarget(loadAgain);
  await expectAccessible(page);
  mode = 'populated';
  await loadAgain.press('Enter');
  await expect(main.getByRole('heading', { name: 'Mi Feedback', level: 1 })).toBeVisible();
  const card = main.getByRole('article', { name: 'Writing a review' });
  const title = card.getByRole('heading', { name: 'Writing a review' });
  const grade = card.getByText('4,6 / 5,0', { exact: true }).filter({ visible: true });
  const start = card.getByRole('button', { name: 'Intentar de nuevo' });
  const history = card.getByRole('button', { name: 'Ver historial de intentos (2)' });
  await expect(title).toHaveAttribute('lang', 'en');
  await expect(grade).toHaveCSS('font-variant-numeric', 'tabular-nums');
  await expect(card.getByRole('img', { name: '3 de 3 estrellas' })).toBeVisible();
  await expect(card.getByText(/11 (?:de )?nov/).filter({ visible: true })).toBeVisible();
  await expect(card.getByText(/30 (?:de )?nov/)).toBeVisible();
  await expect(main.getByRole('button', { name: /escuchar/i })).toHaveCount(0);
  await expect(main.getByRole('button', { name: 'Intentar de nuevo' })).toHaveCount(1);
  await expect(main.getByText('Sin comentario personalizado para esta entrega.')).toBeVisible();
  const stickers = card.getByRole('listitem');
  await expect(stickers).toHaveCount(3);
  for (const sticker of await stickers.all()) {
    await expect(sticker).toHaveCSS('transform', 'none');
    await expect(sticker).toHaveCSS('background-color', 'rgb(243, 234, 218)');
  }
  await expect(history).toHaveAttribute('aria-expanded', 'false');
  await history.press('Enter');
  const closeHistory = card.getByRole('button', { name: 'Ocultar historial de intentos' });
  await expect(closeHistory).toHaveAttribute('aria-expanded', 'true');
  await expect(card.getByText('0,0 / 5,0')).toBeVisible();
  await expect(card.getByRole('img', { name: '0 de 3 estrellas' })).toBeVisible();

  for (const viewport of [
    { width: 320, height: 720 },
    { width: 390, height: 844 },
    { width: 800, height: 1280 },
    { width: 1280, height: 800 },
  ]) {
    await page.setViewportSize(viewport);
    await expectTouchTarget(closeHistory);
    await expectTouchTarget(start);
    const titleBox = await title.boundingBox();
    const gradeBox = await card.getByText('Nota', { exact: true }).boundingBox();
    expect(titleBox).not.toBeNull();
    expect(gradeBox).not.toBeNull();
    if (titleBox && gradeBox) {
      if (viewport.width <= 600) expect(gradeBox.y).toBeGreaterThan(titleBox.y + titleBox.height);
      else expect(gradeBox.x).toBeGreaterThan(titleBox.x + titleBox.width);
    }
    const overflow = await page.locator('html').evaluate((root) => root.scrollWidth - root.clientWidth);
    expect(overflow, `Desborde horizontal a ${viewport.width}px`).toBe(0);
    await expectAccessible(page);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await closeHistory.press('Enter');
  await expect(history).toHaveAttribute('aria-expanded', 'false');
  const runtime = {
    attempt: { id: 'new-feedback-attempt', assignmentId: 'feedback-assignment', attemptNumber: 3, status: 'in_progress' },
    activity: { id: 'writing', title: 'Writing a review', type: 'open_question', level: 'B1', config: { prompt: 'Write a review' } },
    attemptToken: 'mock-attempt-token',
  };
  await page.route('**/api/v1/attempts/new-feedback-attempt', (route) => route.fulfill({ json: runtime }));
  let retryRequests = 0;
  await page.route('**/api/v1/assignments/feedback-assignment/attempts', async (route) => {
    expect(route.request().method()).toBe('POST');
    retryRequests++;
    if (retryRequests === 1) {
      await route.fulfill({ status: 409, json: { message: 'Revisa el plazo con tu profesora.' } });
      return;
    }
    await route.fulfill({ status: 201, json: runtime });
  });
  await start.press('Enter');
  const dialog = main.getByRole('dialog', { name: 'Aviso de intento' });
  await expect(dialog).toContainText('Revisa el plazo con tu profesora.');
  const understood = dialog.getByRole('button', { name: 'Entendido' });
  await expectTouchTarget(understood);
  await expectTouchTarget(dialog.getByRole('button', { name: 'Cerrar modal' }));
  await expectAccessible(page);
  await understood.press('Enter');
  await expect(dialog).toBeHidden();
  await expect(start).toBeFocused();
  await start.press('Enter');
  await expect(page).toHaveURL(/\/actividad\/new-feedback-attempt$/);
  expect(retryRequests).toBe(2);

  mode = 'empty';
  await page.goto('/feedback');
  await expect(main.getByRole('heading', { name: 'Aún no tienes actividades calificadas' })).toBeVisible();
  await expectAccessible(page);
});

test('Plan 6 Teens: navegación y reintento con la API y PostgreSQL locales', async ({ page }) => {
  const email = process.env.ENGLOVE_TEENS_SMOKE_EMAIL;
  const password = process.env.ENGLOVE_TEENS_SMOKE_PASSWORD;
  test.skip(!email || !password, 'Requiere una cuenta Teens sembrada.');
  if (!email || !password) return;

  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Correo electrónico' }).fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/inicio$/);

  const responsePromise = page.waitForResponse((response) =>
    new URL(response.url()).pathname === '/api/v1/student/feedback' && response.request().method() === 'GET',
  );
  const navigation = page.getByRole('navigation', { name: 'Navegación del estudiante' });
  await navigation.getByRole('link', { name: 'Feedback' }).click();
  await expect(page).toHaveURL(/\/feedback$/);
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  const { items } = StudentFeedbackListResponseSchema.parse(await response.json());
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { name: 'Mi Feedback' })).toBeVisible();
  await expect(main.getByRole('article')).toHaveCount(items.length);
  if (items[0]) {
    await expect(main.getByRole('article', { name: items[0].activityTitle }).first()).toBeVisible();
  } else {
    await expect(main.getByRole('heading', { name: 'Aún no tienes actividades calificadas' })).toBeVisible();
  }
  await navigation.getByRole('link', { name: 'Progreso' }).click();
  await expect(page).toHaveURL(/\/progreso$/);

  const retryFixtureId = process.env.ENGLOVE_TEENS_SMOKE_RETRY_FIXTURE_ID;
  if (retryFixtureId) {
    const fixture = items.find((item) => item.assignmentId === retryFixtureId);
    expect(fixture?.hasAvailableRetry).toBe(true);
    if (!fixture) throw new Error('Falta la asignación de prueba de reintento.');
    await navigation.getByRole('link', { name: 'Feedback' }).click();
    const start = main
      .getByRole('article', { name: fixture.activityTitle, exact: true })
      .getByRole('button', { name: 'Intentar de nuevo' });
    const retryResponse = page.waitForResponse((result) =>
      new URL(result.url()).pathname === `/api/v1/assignments/${retryFixtureId}/attempts` &&
      result.request().method() === 'POST',
    );
    const runtimeResponse = page.waitForResponse((result) =>
      /^\/api\/v1\/attempts\/[^/]+$/.test(new URL(result.url()).pathname) &&
      result.request().method() === 'GET',
    );
    await start.click();
    expect((await retryResponse).status()).toBe(201);
    await expect(page).toHaveURL(/\/actividad\/[^/]+$/);
    expect((await runtimeResponse).status()).toBe(200);
  }
});
