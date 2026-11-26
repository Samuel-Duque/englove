import { expect, test } from '@playwright/test';

const email = process.env.ENGLOVE_SMOKE_EMAIL;
const password = process.env.ENGLOVE_SMOKE_PASSWORD;

test('Catálogo de Actividades con API y datos locales: listado, filtros, navegación, duplicación y limpieza', async ({ page }) => {
  test.skip(!email || !password, 'Requiere una cuenta docente sembrada en el entorno local.');
  if (!email || !password) return;
  test.setTimeout(90_000);

  // Iniciar sesión docente
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Correo electrónico' }).fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/inicio$/);

  // Navegar por la barra lateral hacia /actividades y validar respuesta real
  const activitiesPromise = page.waitForResponse((res) => {
    const url = new URL(res.url());
    return url.pathname === '/api/v1/activities' && res.request().method() === 'GET';
  });
  await page.getByRole('navigation', { name: 'Navegación docente' }).getByRole('link', { name: 'Actividades', exact: true }).click();
  await expect(page).toHaveURL(/\/actividades$/);
  const activitiesRes = await activitiesPromise;
  expect(activitiesRes.status()).toBe(200);

  const { ActivityListResponseSchema } = await import('@upward-english/shared');
  const catalog = ActivityListResponseSchema.parse(await activitiesRes.json());

  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { level: 1, name: 'Catálogo de Actividades' })).toBeVisible();
  await expect(main.getByText(`${catalog.total} actividad${catalog.total !== 1 ? 'es' : ''}`)).toBeVisible();

  // Verificar alias /contenidos -> /actividades
  await page.goto('/contenidos');
  await expect(page).toHaveURL(/\/actividades$/);
  await expect(main.getByText(`${catalog.total} actividad${catalog.total !== 1 ? 'es' : ''}`)).toBeVisible();

  // Verificar filtros contra API real
  const archivedPromise = page.waitForResponse((res) => {
    const url = new URL(res.url());
    return url.pathname === '/api/v1/activities' && url.searchParams.get('status') === 'archived';
  });
  await main.getByRole('button', { name: 'Archivadas', exact: true }).click();
  expect((await archivedPromise).status()).toBe(200);
  await expect(main.getByRole('button', { name: 'Archivadas', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await main.getByRole('button', { name: 'Catálogo activo', exact: true }).click();
  await expect(main.getByRole('button', { name: 'Catálogo activo', exact: true })).toHaveAttribute('aria-pressed', 'true');

  // Verificar enlace hacia creación /actividades/nueva
  await main.getByRole('link', { name: /Crear actividad/ }).click();
  await expect(page).toHaveURL(/\/actividades\/nueva$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Nueva actividad' })).toBeVisible();

  // Volver al catálogo y probar flujo completo con la primera actividad sembrada
  await page.goto('/actividades');
  await expect(main.getByText(`${catalog.total} actividad${catalog.total !== 1 ? 'es' : ''}`)).toBeVisible();
  const firstActivity = catalog.items[0];
  if (firstActivity) {
    // Ir al detalle de la actividad
    await main.getByRole('link', { name: new RegExp(`^(Editar|Ver) actividad: ${firstActivity.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }).click();
    await expect(page).toHaveURL(new RegExp(`/actividades/${firstActivity.id}$`));

    // Volver, duplicar la actividad y luego eliminar el borrador creado para dejar la BD limpia
    await page.goto('/actividades');
    await expect(main.getByText(`${catalog.total} actividad${catalog.total !== 1 ? 'es' : ''}`)).toBeVisible();
    const duplicateResPromise = page.waitForResponse((res) =>
      res.url().includes(`/api/v1/activities/${firstActivity.id}/duplicate`) && res.request().method() === 'POST',
    );
    await main.getByRole('button', { name: `Duplicar actividad: ${firstActivity.title}` }).click();
    const duplicateRes = await duplicateResPromise;
    expect(duplicateRes.status()).toBe(201);
    const { ActivitySummarySchema } = await import('@upward-english/shared');
    const duplicated = ActivitySummarySchema.parse(await duplicateRes.json());

    await expect(page).toHaveURL(new RegExp(`/actividades/${duplicated.id}$`));
    await page.goto('/actividades');
    await expect(main.getByRole('button', { name: `Eliminar borrador: ${duplicated.title}` })).toBeVisible();

    const deleteResPromise = page.waitForResponse((res) =>
      res.url().includes(`/api/v1/activities/${duplicated.id}`) && res.request().method() === 'DELETE',
    );
    await main.getByRole('button', { name: `Eliminar borrador: ${duplicated.title}` }).click();
    const dialog = page.getByRole('dialog', { name: 'Eliminar borrador' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Eliminar borrador', exact: true }).click();
    const deleteRes = await deleteResPromise;
    expect([200, 204]).toContain(deleteRes.status());
    await expect(main.getByRole('status')).toContainText('Borrador eliminado exitosamente');
  }
});
