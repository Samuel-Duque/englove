import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

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
        user: { id: 'teacher-new-act', name: 'Clara Gómez', email: 'teacher@example.test', role: 'teacher' },
        organizationId: 'org-new-act',
      },
    }),
  );
});

for (const [width, height] of [[1440, 900], [1280, 800], [820, 1080], [390, 844], [320, 640]] as const) {
  test(`Nueva actividad: diseño responsive y WCAG 2.2 AA a ${width} × ${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/actividades/nueva');

    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { level: 1, name: 'Nueva actividad' })).toBeVisible();
    await expect(main.getByRole('link', { name: 'Volver a actividades' })).toHaveAttribute('href', '/actividades');
    await expect(page.getByRole('navigation', { name: 'Ruta actual' })).toContainText('Nueva actividad');
    await expect(main.getByRole('radio', { name: /Completar espacios/i })).toBeChecked();
    await expect(main.getByRole('button', { name: 'Guardar borrador' })).toBeVisible();
    await expect(main.getByRole('button', { name: 'Publicar actividad' })).toBeVisible();

    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    expect((await new AxeBuilder({ page }).withTags(wcagTags).analyze()).violations).toEqual([]);
  });
}

test('Nueva actividad: 5 tipos, 5 mecánicas, examen al 100 %, validación speaking y preview de juego sin red', async ({ page }) => {
  await page.goto('/actividades/nueva');

  // 1. Validar los 5 ActivityType como tarjetas radio sin JSON crudo
  for (const label of [/Completar espacios/i, /Pregunta abierta/i, /Expresión oral/i, /Microjuego/i, /Examen/i]) {
    const radio = page.getByRole('radio', { name: label });
    await radio.check();
    await expect(radio).toBeChecked();
  }

  // 2. Examen: normalización proporcional en tiempo real y bloqueo al publicar con < 2 ítems
  await page.fill('input#activity-title', 'Grammar Checkpoint Unit 1');
  await page.fill('input#exam-w1', '30');
  await page.fill('input#exam-w2', '30');
  const normList = page.getByLabel('Normalización proporcional al 100 %');
  await expect(normList).toContainText('Oración 1: 50,0 %');
  await expect(normList).toContainText('Oración 2: 50,0 %');

  let examPostCount = 0;
  await page.route('**/api/v1/activities**', async (route) => {
    examPostCount += 1;
    await route.abort();
  });

  await page.getByRole('button', { name: 'Eliminar oración 2' }).click();
  await page.getByRole('button', { name: 'Publicar actividad' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Un examen debe tener al menos 2 oraciones para ser publicado.');
  expect(examPostCount).toBe(0);

  // 3. Speaking: duración por defecto 120 s y bloqueo fuera de 2-300 s
  await page.getByRole('radio', { name: /Expresión oral/i }).check();
  await expect(page.locator('input#sp-max-dur')).toHaveValue('120');
  await page.fill('input#sp-max-dur', '350');
  await page.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('entre 2 y 300 segundos');

  // 4. Microjuego: probar las 5 mecánicas y abrir vista previa en AccessibleModal sin llamadas de red
  await page.getByRole('radio', { name: /Microjuego/i }).check();
  for (const mech of [/Ordenar palabras/i, /Emparejar/i, /Arrastrar y soltar/i, /Memoria/i, /Opción contra reloj/i]) {
    const mechRadio = page.getByRole('radio', { name: mech });
    await mechRadio.check();
    await expect(mechRadio).toBeChecked();
  }

  let networkCallsDuringPreview = 0;
  await page.route('**/api/v1/**', async (route) => {
    networkCallsDuringPreview += 1;
    await route.continue();
  });

  await page.getByRole('radio', { name: /Emparejar/i }).check();
  await page.getByRole('button', { name: 'Probar vista previa' }).click();
  const dialog = page.getByRole('dialog', { name: 'Previsualización Docente' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Apple')).toBeVisible();
  await expect(dialog.getByText('Manzana')).toBeVisible();
  await dialog.getByRole('button', { name: 'Cerrar previsualización' }).click();
  await expect(dialog).not.toBeVisible();
  expect(networkCallsDuringPreview).toBe(0);
});

test('Nueva actividad: guardar borrador y publicar directamente desde creación', async ({ page }) => {
  let createdCount = 0;
  let publishedCount = 0;

  const createdDraft = {
    id: 'act-created-draft-1',
    title: 'Daily Routines Fill Blank',
    type: 'fill_blank',
    level: 'A1',
    status: 'draft',
    version: 1,
    parentId: null,
    expectedDurationSeconds: 60,
    minPlausibleSeconds: 3,
    config: { items: [] },
    answerKey: { items: {} },
  };

  await page.route('**/api/v1/activities', async (route) => {
    if (route.request().method() === 'POST') {
      createdCount += 1;
      await route.fulfill({ status: 201, json: createdDraft });
      return;
    }
    await route.continue();
  });

  await page.route('**/api/v1/activities/act-created-draft-1/publish', async (route) => {
    publishedCount += 1;
    await route.fulfill({ status: 200, json: { ...createdDraft, status: 'published' } });
  });

  await page.route('**/api/v1/activities/act-created-draft-1', async (route) => {
    await route.fulfill({ json: { ...createdDraft, status: publishedCount > 0 ? 'published' : 'draft' } });
  });

  await page.goto('/actividades/nueva');
  await page.fill('input#activity-title', 'Daily Routines Fill Blank');
  await page.getByRole('button', { name: 'Publicar actividad' }).click();

  await expect(page).toHaveURL(/\/actividades\/act-created-draft-1$/);
  expect(createdCount).toBe(1);
  expect(publishedCount).toBe(1);
  await expect(page.getByRole('heading', { level: 1, name: 'Editor de actividad' })).toBeVisible();
  await expect(page.getByText('Publicada', { exact: true })).toBeVisible();
});
