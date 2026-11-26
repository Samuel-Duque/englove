import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

const ITEM_1_ID = '11111111-1111-4111-8111-111111111111';
const BLANK_1_ID = '22222222-2222-4222-8222-222222222222';
const OPT_1A_ID = '33333333-3333-4333-8333-333333333333';
const OPT_1B_ID = '44444444-4444-4444-8444-444444444444';
const ITEM_2_ID = '55555555-5555-4555-8555-555555555555';
const BLANK_2_ID = '66666666-6666-4666-8666-666666666666';
const OPT_2A_ID = '77777777-7777-4777-8777-777777777777';
const OPT_2B_ID = '88888888-8888-4888-8888-888888888888';

const publishedFillBlankActivity = {
  id: 'act-detail-fb-1',
  title: 'Present Simple Daily Routines',
  type: 'fill_blank',
  level: 'A1',
  status: 'published',
  version: 2,
  parentId: null,
  expectedDurationSeconds: 240,
  minPlausibleSeconds: 20,
  config: {
    instructions: 'Complete each sentence with the right verb form.',
    items: [
      {
        id: ITEM_1_ID,
        prompt: `She {{${BLANK_1_ID}}} to school every morning.`,
        blanks: [
          {
            id: BLANK_1_ID,
            options: [
              { id: OPT_1A_ID, text: 'walks' },
              { id: OPT_1B_ID, text: 'walk' },
            ],
          },
        ],
      },
    ],
  },
  answerKey: {
    items: {
      [ITEM_1_ID]: {
        [BLANK_1_ID]: OPT_1A_ID,
      },
    },
  },
};

test.beforeEach(async ({ context, page }) => {
  const token = `header.${Buffer.from(JSON.stringify({ role: 'teacher' })).toString('base64url')}.signature`;
  await context.addCookies([
    { name: `${process.env.COOKIE_PREFIX ?? 'englove_local_'}access_token`, value: token, domain: 'localhost', path: '/' },
    { name: 'upward_english_local_access_token', value: token, domain: 'localhost', path: '/' },
    { name: 'upward_english_access_token', value: token, domain: 'localhost', path: '/' },
  ]);
  await page.route('**/api/v1/auth/session', (route) =>
    route.fulfill({
      json: {
        user: { id: 'teacher-detail', name: 'Clara Gómez', email: 'teacher@example.test', role: 'teacher' },
        organizationId: 'org-detail',
      },
    }),
  );
});

for (const [width, height] of [[1440, 900], [1280, 800], [820, 1080], [390, 844], [320, 640]] as const) {
  test(`Detalle de actividad: diseño responsive y WCAG 2.2 AA a ${width} × ${height}`, async ({ page }) => {
    await page.route('**/api/v1/activities/act-detail-fb-1', (route) =>
      route.fulfill({ json: publishedFillBlankActivity }),
    );
    await page.setViewportSize({ width, height });
    await page.goto('/actividades/act-detail-fb-1');

    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { level: 1, name: 'Editor de actividad' })).toBeVisible();
    await expect(main.getByRole('link', { name: 'Volver a actividades' })).toHaveAttribute('href', '/actividades');
    await expect(main.getByRole('navigation', { name: 'Migas de pan de la actividad' })).toContainText('Present Simple Daily Routines');
    await expect(main.getByText('Publicada', { exact: true })).toBeVisible();
    await expect(main.getByText(/Los cambios guardados aplican únicamente a nuevos inicios/)).toBeVisible();
    await expect(main.locator('select#activity-type')).toBeDisabled();
    await expect(main.getByRole('button', { name: 'Previsualizar' })).toBeVisible();
    await expect(main.getByRole('button', { name: 'Guardar cambios' })).toBeVisible();

    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    expect((await new AxeBuilder({ page }).withTags(wcagTags).analyze()).violations).toEqual([]);
  });
}

test('Detalle de actividad: estados de carga, 404 y recuperación tras error 503', async ({ page }) => {
  let failFirst = true;
  await page.route('**/api/v1/activities/act-retry', async (route) => {
    if (failFirst) {
      await new Promise((r) => setTimeout(r, 150));
      await route.fulfill({ status: 503, json: { code: 'HEALTH_UNAVAILABLE', message: 'Servicio temporalmente no disponible' } });
      return;
    }
    await route.fulfill({ json: { ...publishedFillBlankActivity, id: 'act-retry' } });
  });

  await page.goto('/actividades/act-retry');
  await expect(page.getByRole('status').filter({ hasText: 'Cargando actividad…' })).toBeVisible();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('No se pudo cargar la actividad');
  failFirst = false;
  await page.getByRole('button', { name: 'Reintentar' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Editor de actividad' })).toBeVisible();

  await page.route('**/api/v1/activities/act-missing', (route) =>
    route.fulfill({ status: 404, json: { code: 'NOT_FOUND', message: 'Actividad no encontrada' } }),
  );
  await page.goto('/actividades/act-missing');
  const alert = page.getByRole('main').getByRole('alert');
  await expect(alert.getByRole('heading', { level: 1, name: 'Actividad no encontrada' })).toBeVisible();
  await expect(alert.getByRole('link', { name: 'Volver al catálogo' })).toHaveAttribute('href', '/actividades');
  expect((await new AxeBuilder({ page }).withTags(wcagTags).analyze()).violations).toEqual([]);
});

test('Detalle de actividad: preserva UUIDs de ítems, huecos y opciones en fill_blank y exam (Decisión 140)', async ({ page }) => {
  let capturedPatch: unknown = null;

  await page.route('**/api/v1/activities/act-uuid-fb', async (route) => {
    if (route.request().method() === 'PATCH') {
      capturedPatch = JSON.parse(route.request().postData() || '{}');
      await route.fulfill({
        json: {
          ...publishedFillBlankActivity,
          id: 'act-uuid-fb',
          title: 'Present Simple Updated',
        },
      });
      return;
    }
    await route.fulfill({ json: { ...publishedFillBlankActivity, id: 'act-uuid-fb' } });
  });

  await page.goto('/actividades/act-uuid-fb');
  await page.fill('input#activity-title', 'Present Simple Updated');
  await page.fill('input[aria-label="Opción 1 espacio 1 oración 1"]', 'runs');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Actividad guardada correctamente' })).toBeVisible();

  expect(capturedPatch).not.toBeNull();
  expect(capturedPatch).toMatchObject({
    title: 'Present Simple Updated',
    config: {
      items: [
        {
          id: ITEM_1_ID,
          blanks: [
            {
              id: BLANK_1_ID,
              options: [
                { id: OPT_1A_ID, text: 'runs' },
                { id: OPT_1B_ID, text: 'walk' },
              ],
            },
          ],
        },
      ],
    },
    answerKey: {
      items: {
        [ITEM_1_ID]: {
          [BLANK_1_ID]: OPT_1A_ID,
        },
      },
    },
  });

  const examActivity = {
    id: 'act-uuid-exam',
    title: 'Unit 1 Exam',
    type: 'exam',
    level: 'A2',
    status: 'draft',
    version: 1,
    parentId: null,
    expectedDurationSeconds: 600,
    minPlausibleSeconds: 60,
    config: {
      items: [
        {
          id: ITEM_1_ID,
          weight: 50,
          prompt: `She {{${BLANK_1_ID}}} home.`,
          blanks: [{ id: BLANK_1_ID, options: [{ id: OPT_1A_ID, text: 'goes' }, { id: OPT_1B_ID, text: 'go' }] }],
        },
        {
          id: ITEM_2_ID,
          weight: 50,
          prompt: `They {{${BLANK_2_ID}}} happy.`,
          blanks: [{ id: BLANK_2_ID, options: [{ id: OPT_2A_ID, text: 'are' }, { id: OPT_2B_ID, text: 'is' }] }],
        },
      ],
    },
    answerKey: {
      items: {
        [ITEM_1_ID]: { [BLANK_1_ID]: OPT_1A_ID },
        [ITEM_2_ID]: { [BLANK_2_ID]: OPT_2A_ID },
      },
    },
  };

  let capturedExamPatch: unknown = null;
  await page.route('**/api/v1/activities/act-uuid-exam', async (route) => {
    if (route.request().method() === 'PATCH') {
      capturedExamPatch = JSON.parse(route.request().postData() || '{}');
      await route.fulfill({ json: examActivity });
      return;
    }
    await route.fulfill({ json: examActivity });
  });

  await page.goto('/actividades/act-uuid-exam');
  await expect(page.getByText('100,0 %')).toBeVisible();
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Actividad guardada correctamente' })).toBeVisible();
  expect(capturedExamPatch).toMatchObject({
    config: {
      items: [
        { id: ITEM_1_ID, weight: 50, blanks: [{ id: BLANK_1_ID }] },
        { id: ITEM_2_ID, weight: 50, blanks: [{ id: BLANK_2_ID }] },
      ],
    },
  });
});

test('Detalle de actividad: publicar borrador, restaurar archivada y duplicar ante ACTIVITY_HAS_ATTEMPTS', async ({ page }) => {
  const draftActivity = { ...publishedFillBlankActivity, id: 'act-draft-1', status: 'draft' };

  await page.route('**/api/v1/activities/act-draft-1', (route) => route.fulfill({ json: draftActivity }));
  await page.route('**/api/v1/activities/act-draft-1/publish', (route) =>
    route.fulfill({ json: { ...draftActivity, status: 'published' } }),
  );

  await page.goto('/actividades/act-draft-1');
  await expect(page.getByText('Borrador', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Publicar actividad' }).click();
  await expect(page.getByText('Publicada', { exact: true })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: '¡Actividad publicada exitosamente!' })).toBeVisible();

  const archivedActivity = { ...publishedFillBlankActivity, id: 'act-arch-1', status: 'archived' };
  await page.route('**/api/v1/activities/act-arch-1', (route) => route.fulfill({ json: archivedActivity }));
  await page.route('**/api/v1/activities/act-arch-1/restore', (route) =>
    route.fulfill({ json: { ...archivedActivity, status: 'draft' } }),
  );

  await page.goto('/actividades/act-arch-1');
  await expect(page.getByText('Archivada', { exact: true })).toBeVisible();
  await expect(page.locator('input#activity-title')).toBeDisabled();
  await page.getByRole('button', { name: 'Restaurar al catálogo' }).click();
  await expect(page.getByText('Borrador', { exact: true })).toBeVisible();
  await expect(page.locator('input#activity-title')).toBeEnabled();

  await page.route('**/api/v1/activities/act-locked-1', async (route) => {
    if (route.request().method() === 'PATCH') {
      await route.fulfill({
        status: 409,
        json: {
          statusCode: 409,
          code: 'ACTIVITY_HAS_ATTEMPTS',
          message: 'No se puede editar una actividad que ya tiene intentos de alumnos.',
        },
      });
      return;
    }
    await route.fulfill({ json: { ...publishedFillBlankActivity, id: 'act-locked-1' } });
  });
  await page.route('**/api/v1/activities/act-locked-1/duplicate', (route) =>
    route.fulfill({ status: 201, json: { ...draftActivity, id: 'act-locked-copy', title: 'Copia de Present Simple Daily Routines' } }),
  );
  await page.route('**/api/v1/activities/act-locked-copy', (route) =>
    route.fulfill({ json: { ...draftActivity, id: 'act-locked-copy', title: 'Copia de Present Simple Daily Routines' } }),
  );

  await page.goto('/actividades/act-locked-1');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('No se puede editar una actividad que ya tiene intentos');
  await page.getByRole('button', { name: 'Duplicar actividad' }).click();
  await expect(page).toHaveURL(/\/actividades\/act-locked-copy$/);
});

test('Detalle de actividad: microjuego bloquea mecánica y su vista previa no hace llamadas de red', async ({ page }) => {
  const gameActivity = {
    id: 'act-game-detail',
    title: 'Vocabulary Match Practice',
    type: 'game',
    level: 'A1',
    status: 'published',
    version: 1,
    parentId: null,
    expectedDurationSeconds: 180,
    minPlausibleSeconds: 15,
    config: {
      mechanic: 'match',
      settings: {
        left: [
          { id: ITEM_1_ID, text: 'Sun' },
          { id: ITEM_2_ID, text: 'Moon' },
        ],
        right: [
          { id: OPT_1A_ID, text: 'Sol' },
          { id: OPT_2A_ID, text: 'Luna' },
        ],
      },
    },
    answerKey: {
      solution: {
        pairs: {
          [ITEM_1_ID]: OPT_1A_ID,
          [ITEM_2_ID]: OPT_2A_ID,
        },
      },
    },
  };

  let previewNetworkCalls = 0;
  let trackingPreview = false;
  await page.route('**/api/v1/**', async (route) => {
    const url = route.request().url();
    if (trackingPreview) previewNetworkCalls += 1;
    if (url.includes('/api/v1/auth/session')) {
      await route.fulfill({
        json: {
          user: { id: 'teacher-detail', name: 'Clara Gómez', email: 'teacher@example.test', role: 'teacher' },
          organizationId: 'org-detail',
        },
      });
      return;
    }
    if (url.includes('/api/v1/activities/act-game-detail')) {
      await route.fulfill({ json: gameActivity });
      return;
    }
    await route.continue();
  });

  await page.goto('/actividades/act-game-detail');
  await expect(page.locator('select#game-mechanic')).toBeDisabled();
  trackingPreview = true;
  await page.getByRole('button', { name: 'Previsualizar' }).click();

  const dialog = page.getByRole('dialog', { name: 'Previsualización Docente' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Sun')).toBeVisible();
  await expect(dialog.getByText('Sol')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Kids' })).toHaveAttribute('aria-pressed', 'true');
  expect((await new AxeBuilder({ page }).withTags(wcagTags).analyze()).violations).toEqual([]);
  await dialog.getByRole('button', { name: 'Teens' }).click();
  await expect(dialog.getByRole('button', { name: 'Teens' })).toHaveAttribute('aria-pressed', 'true');
  await dialog.getByRole('button', { name: 'Cerrar previsualización' }).click();
  await expect(dialog).not.toBeVisible();
  expect(previewNetworkCalls).toBe(0);
});
