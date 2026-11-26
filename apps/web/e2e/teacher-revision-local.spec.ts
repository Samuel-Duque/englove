import { expect, test } from '@playwright/test';

const email = process.env.ENGLOVE_SMOKE_EMAIL;
const password = process.env.ENGLOVE_SMOKE_PASSWORD;

test('Revisión docente con API y datos locales: navegación, filtros, detalle real, responsividad y enlaces', async ({
  page,
}) => {
  test.skip(!email || !password, 'Requiere una cuenta docente sembrada en el entorno local.');
  if (!email || !password) return;
  test.setTimeout(90_000);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Correo electrónico' }).fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/inicio$/, { timeout: 15_000 });

  const groupsPromise = page.waitForResponse(
    (res) => new URL(res.url()).pathname === '/api/v1/groups',
  );
  const queuePromise = page.waitForResponse(
    (res) => new URL(res.url()).pathname === '/api/v1/reviews/queue',
  );
  const gradedPromise = page.waitForResponse(
    (res) => new URL(res.url()).pathname === '/api/v1/reviews/graded',
  );

  await page.getByRole('main').getByRole('link', { name: 'Ir a revisión', exact: true }).click();
  await expect(page).toHaveURL(/\/revision$/, { timeout: 15_000 });

  const [groupsRes, queueRes, gradedRes] = await Promise.all([
    groupsPromise,
    queuePromise,
    gradedPromise,
  ]);
  expect(groupsRes.status()).toBe(200);
  expect(queueRes.status()).toBe(200);
  expect(gradedRes.status()).toBe(200);

  const {
    GroupListResponseSchema,
    ReviewListResponseSchema,
    AttemptReviewDetailViewSchema,
  } = await import('@upward-english/shared');

  const groupsData = GroupListResponseSchema.parse(await groupsRes.json());
  const queueData = ReviewListResponseSchema.parse(await queueRes.json());
  const gradedData = ReviewListResponseSchema.parse(await gradedRes.json());

  const main = page.getByRole('main');
  await expect(
    main.getByRole('heading', { level: 1, name: 'Revisión y Retroalimentación' }),
  ).toBeVisible();
  await expect(
    page
      .getByRole('navigation', { name: 'Navegación docente' })
      .getByRole('link', { name: 'Revisión', exact: true }),
  ).toHaveAttribute('aria-current', 'page');

  // Verifica detalle real si hay entregas pendientes o calificadas
  if (queueData.items.length > 0) {
    const first = queueData.items[0];
    if (first) {
      const detailResPromise = page.waitForResponse(
        (res) =>
          new URL(res.url()).pathname === `/api/v1/attempts/${first.attempt.attemptId}/review-detail`,
      );
      await main.getByRole('button', { name: new RegExp(first.student.displayName, 'i') }).first().click();
      const detailRes = await detailResPromise;
      expect(detailRes.status()).toBe(200);
      AttemptReviewDetailViewSchema.parse(await detailRes.json());
      await expect(main.locator('input#score-input')).toBeVisible();
    }
  } else {
    await expect(main.getByRole('heading', { name: 'No hay entregas pendientes' })).toBeVisible();
  }

  // Cambiar a pestaña Calificados y validar si existen entregas calificadas
  await main.getByRole('tab', { name: /Calificados/i }).click();
  if (gradedData.items.length > 0) {
    const firstGraded = gradedData.items[0];
    if (firstGraded) {
      await main
        .getByRole('button', { name: new RegExp(firstGraded.activity.title, 'i') })
        .first()
        .click();
      await expect(main.getByText('🔒 Calificación inmutable:')).toBeVisible();
    }
  } else {
    await expect(main.getByRole('heading', { name: 'No hay entregas calificadas' })).toBeVisible();
  }

  // Filtros reales por grupo y refresco manual
  if (groupsData.items.length > 0 && groupsData.items[0]) {
    const filteredQueuePromise = page.waitForResponse(
      (res) =>
        new URL(res.url()).pathname === '/api/v1/reviews/queue' &&
        new URL(res.url()).searchParams.get('groupId') === groupsData.items[0]?.id,
    );
    await main.getByLabel('Grupo').selectOption(groupsData.items[0].id);
    expect((await filteredQueuePromise).status()).toBe(200);
    await main.getByRole('button', { name: 'Limpiar filtros' }).click();
  }

  const refreshQueuePromise = page.waitForResponse(
    (res) => new URL(res.url()).pathname === '/api/v1/reviews/queue',
  );
  await main.getByRole('button', { name: 'Refrescar' }).click();
  expect((await refreshQueuePromise).status()).toBe(200);

  // Responsividad en tablet (820x1080) sin overflow horizontal
  await page.setViewportSize({ width: 820, height: 1080 });
  await expect(main.getByRole('button', { name: /Lista de entregas/i })).toBeVisible();
  await expect(main.getByRole('button', { name: 'Inspector', exact: true })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(820);

  // Navegación desde /revision hacia las demás rutas del panel docente (escritorio)
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const [label, path] of [
    ['Inicio', '/inicio'],
    ['Actividades', '/actividades'],
    ['Asignaciones', '/asignaciones'],
    ['Alumnos', '/alumnos'],
    ['Grupos', '/grupos'],
    ['Estadísticas', '/estadisticas'],
    ['Contenido extra', '/contenido-extra'],
    ['Revisión', '/revision'],
  ] as const) {
    const navLink = page
      .getByRole('navigation', { name: 'Navegación docente' })
      .getByRole('link', { name: label, exact: true });
    await navLink.click();
    await expect(page).toHaveURL(path, { timeout: 15_000 });
    await expect(navLink).toHaveAttribute('aria-current', 'page');
  }
});
