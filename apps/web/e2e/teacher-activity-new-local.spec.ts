import { signInForSmoke, smokeApiUrl } from './session';
import { expect, test } from '@playwright/test';


test('Nueva actividad con API y DB locales: enlaces, borrador, publicación y limpieza', async ({ page, baseURL }) => {
  test.setTimeout(90_000);

  await signInForSmoke(page, 'teacher');

  // 1. Conexión desde /inicio y alias /contenidos/onboarding
  await page.getByRole('main').getByRole('link', { name: 'Nueva actividad', exact: true }).click();
  await expect(page).toHaveURL(/\/actividades\/nueva$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Nueva actividad' })).toBeVisible();

  await page.goto('/contenidos/onboarding');
  await expect(page).toHaveURL(/\/actividades\/nueva$/);

  // 2. Conexión desde /actividades
  await page.goto('/actividades');
  await page.getByRole('main').getByRole('link', { name: /Crear actividad/i }).first().click();
  await expect(page).toHaveURL(/\/actividades\/nueva$/);

  const uniqueSuffix = Date.now().toString().slice(-6);
  const draftTitle = `Smoke Draft ${uniqueSuffix}`;
  const publishedTitle = `Smoke Published ${uniqueSuffix}`;

  // 3. Crear borrador real
  await page.fill('input#activity-title', draftTitle);
  const createDraftResPromise = page.waitForResponse(
    (res) => new URL(res.url()).pathname === '/api/v1/activities' && res.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Guardar borrador' }).click();
  const createDraftRes = await createDraftResPromise;
  expect(createDraftRes.status()).toBe(201);
  const createdDraft = (await createDraftRes.json()) as { id: string };
  await expect(page).toHaveURL(new RegExp(`/actividades/${createdDraft.id}$`));
  await expect(page.getByRole('heading', { level: 1, name: 'Editor de actividad' })).toBeVisible();

  // 4. Crear y publicar directamente una actividad Speaking real desde /actividades/nueva
  await page.goto('/actividades/nueva');
  await page.getByRole('radio', { name: /Expresión oral/i }).check();
  await page.fill('input#activity-title', publishedTitle);
  await expect(page.locator('input#sp-max-dur')).toHaveValue('120');

  const createPubResPromise = page.waitForResponse(
    (res) => new URL(res.url()).pathname === '/api/v1/activities' && res.request().method() === 'POST',
  );
  const publishResPromise = page.waitForResponse((res) =>
    /\/api\/v1\/activities\/[^/]+\/publish$/.test(new URL(res.url()).pathname),
  );
  await page.getByRole('button', { name: 'Publicar actividad' }).click();

  const [createPubRes, publishRes] = await Promise.all([createPubResPromise, publishResPromise]);
  expect(createPubRes.status()).toBe(201);
  expect(publishRes.status()).toBe(200);
  const published = (await publishRes.json()) as { id: string; status: string };
  expect(published.status).toBe('published');
  await expect(page).toHaveURL(new RegExp(`/actividades/${published.id}$`));

  // 5. Verificar en /actividades y limpiar registros de prueba
  await page.goto('/actividades');
  await expect(page.getByText(publishedTitle)).toBeVisible();

  const headers = { origin: new URL(baseURL ?? 'http://localhost:3000').origin };
  const activities = `${smokeApiUrl}/api/v1/activities`;
  const deleted = await page.request.delete(`${activities}/${createdDraft.id}`, { headers });
  const archived = await page.request.post(`${activities}/${published.id}/archive`, { headers });
  expect(deleted.ok()).toBe(true);
  expect(archived.ok()).toBe(true);
});
