import { signInForSmoke, smokeApiUrl } from './session';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { ActivityEditorSchema, ExamConfigSchema } from '@upward-english/shared';

const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

test('Detalle de actividad con API y PostgreSQL locales: duplicar, editar preservando UUIDs, publicar, previsualizar y enlazar desde asignaciones', async ({
  page, baseURL,
}) => {
  test.setTimeout(90_000);

  await signInForSmoke(page, 'teacher');

  await page.goto('/actividades');
  await expect(page.getByRole('heading', { level: 1, name: 'Catálogo de Actividades' })).toBeVisible({ timeout: 15_000 });

  const examCard = page
    .getByRole('row', { name: /Midterm Exam A1/ })
    .first();
  await expect(examCard).toBeVisible({ timeout: 15_000 });

  const duplicatePromise = page.waitForResponse(
    (res) => res.url().includes('/duplicate') && res.request().method() === 'POST',
  );
  await examCard.getByRole('button', { name: 'Duplicar' }).click();
  const duplicateRes = await duplicatePromise;
  expect(duplicateRes.status()).toBe(201);
  const duplicated = ActivityEditorSchema.parse(await duplicateRes.json());
  const originalItemIds = ExamConfigSchema.parse(duplicated.config).items.map((i) => i.id);
  expect(originalItemIds.length).toBeGreaterThanOrEqual(2);

  await expect(page).toHaveURL(new RegExp(`/actividades/${duplicated.id}$`));
  await expect(page.getByRole('heading', { level: 1, name: 'Editor de actividad' })).toBeVisible();
  await expect(page.getByText('Borrador', { exact: true })).toBeVisible();
  await expect(page.locator('select#activity-type')).toBeDisabled();

  const updatedTitle = `Midterm Exam E2E ${Date.now()}`;
  await page.fill('input#activity-title', updatedTitle);

  const patchPromise = page.waitForResponse(
    (res) => res.url().includes(`/api/v1/activities/${duplicated.id}`) && res.request().method() === 'PATCH',
  );
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  const patchRes = await patchPromise;
  expect(patchRes.status()).toBe(200);
  const patched = ActivityEditorSchema.parse(await patchRes.json());
  expect(ExamConfigSchema.parse(patched.config).items.map((i) => i.id)).toEqual(originalItemIds);

  const publishPromise = page.waitForResponse(
    (res) => res.url().includes(`/api/v1/activities/${duplicated.id}/publish`) && res.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Publicar actividad' }).click();
  const publishRes = await publishPromise;
  expect(publishRes.status()).toBe(200);
  await expect(page.getByText('Publicada', { exact: true })).toBeVisible();

  expect((await new AxeBuilder({ page }).withTags(wcagTags).analyze()).violations).toEqual([]);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280);

  // Clean up test copy by archiving so active catalog stays clean
  const archiveRes = await page.request.post(
    `${smokeApiUrl}/api/v1/activities/${duplicated.id}/archive`,
    { headers: { Origin: baseURL ?? 'http://localhost:3000' } },
  );
  expect(archiveRes.status()).toBe(200);

  // Verify seeded microgame detail & preview modal
  await page.goto('/actividades/20000000-0000-4000-8000-000000000011');
  await expect(page.getByRole('heading', { level: 1, name: 'Editor de actividad' })).toBeVisible();
  await expect(page.locator('select#game-mechanic')).toBeDisabled();
  await page.getByRole('button', { name: 'Previsualizar' }).click();
  const dialog = page.getByRole('dialog', { name: 'Previsualización Docente' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cerrar previsualización' }).click();

  // Verify cross-page navigation from /asignaciones/[id] -> /actividades/[id]
  await page.goto('/asignaciones/30000000-0000-4000-8000-000000000002');
  await page.getByRole('link', { name: /Ver editor de actividad/ }).click();
  await expect(page).toHaveURL(/\/actividades\/20000000-0000-4000-8000-000000000003$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Editor de actividad' })).toBeVisible();
});
