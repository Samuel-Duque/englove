import AxeBuilder from '@axe-core/playwright';
import { expect, test, type BrowserContext } from '@playwright/test';
import { GroupViewSchema } from '@upward-english/shared';

const email = process.env.ENGLOVE_SMOKE_EMAIL;
const password = process.env.ENGLOVE_SMOKE_PASSWORD;
const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

let teacherState: Awaited<ReturnType<BrowserContext['storageState']>>;

test.beforeAll(async ({ browser, baseURL }) => {
  test.skip(!email || !password, 'Requiere una cuenta docente del entorno local.');
  if (!email || !password) return;
  const context = await browser.newContext({ baseURL });
  try {
    const page = await context.newPage();
    await page.goto('/login');
    await page.getByRole('textbox', { name: 'Correo electrónico' }).fill(email);
    await page.getByLabel('Contraseña', { exact: true }).fill(password);
    const login = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/v1/auth/login' &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    const response = await login;
    expect(
      response.status(),
      `Login local: HTTP ${response.status()}, Retry-After: ${response.headers()['retry-after'] ?? '—'}`,
    ).toBe(200);
    await expect(page).toHaveURL(/\/inicio$/);
    teacherState = await context.storageState();
  } finally {
    await context.close();
  }
});

test.use({ storageState: async ({}, use) => use(teacherState) });

test('Plan 14: miembros, enlaces, diseño responsive y archivo protegido', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/grupos');
  const main = page.getByRole('main');
  const detailLink = main.getByRole('link', { name: /Ver detalle de/ }).first();
  await expect(detailLink).toBeVisible();

  const groups = await page.request.get(`${apiUrl}/api/v1/groups?archived=false&limit=100`);
  expect(groups.ok()).toBe(true);
  const populatedGroup = GroupViewSchema.array()
    .parse((await groups.json()).items)
    .find((group) => group.activeStudentCount > 0);
  expect(populatedGroup, 'La base local necesita un grupo con alumnos activos.').toBeDefined();
  if (!populatedGroup) return;

  const groupId = populatedGroup.id;
  await main
    .getByRole('link', {
      name: `Ver detalle de ${populatedGroup.name}`,
      exact: true,
    })
    .click();
  await expect(main.getByRole('heading', { level: 1, name: populatedGroup.name })).toBeVisible();
  await expect(main.getByRole('table')).toBeVisible();
  await expect(main.getByText('Antes de archivar')).toBeVisible();

  for (const [width, height] of [
    [1440, 900],
    [1280, 800],
    [820, 1080],
    [390, 844],
    [320, 640],
  ] as const) {
    await page.setViewportSize({ width, height });
    expect(await page.locator('html').evaluate((root) => root.scrollWidth)).toBe(width);
    expect((await new AxeBuilder({ page }).withTags(wcagTags).analyze()).violations).toEqual([]);
  }

  await main.getByRole('button', { name: 'Archivar grupo' }).click();
  await expect(main.getByRole('alert')).toContainText('traslada primero a sus alumnos activos');
  await expect(main.getByRole('dialog')).toHaveCount(0);
  const blocked = await page.request.post(`${apiUrl}/api/v1/groups/${groupId}/archive`, {
    headers: { Origin: new URL(page.url()).origin },
  });
  expect(blocked.status()).toBe(409);
  expect(await blocked.json()).toMatchObject({
    code: 'GROUP_HAS_ACTIVE_STUDENTS',
  });

  const studentLink = main.getByRole('link', { name: /Ver ficha de/ }).first();
  const studentPath = await studentLink.getAttribute('href');
  const student = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === studentPath?.replace('/alumnos/', '/api/v1/students/'),
  );
  await studentLink.click();
  await expect(page).toHaveURL((url) => url.pathname === studentPath);
  expect((await student).ok()).toBe(true);
  await expect(main.getByRole('heading', { level: 1 })).toBeVisible();

  await page.goBack();
  const assignments = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === '/api/v1/assignments' && url.searchParams.get('groupId') === groupId;
  });
  await main.getByRole('link', { name: 'Ver asignaciones' }).click();
  await expect(page).toHaveURL(
    (url) => url.pathname === '/asignaciones' && url.searchParams.get('groupId') === groupId,
  );
  expect((await assignments).ok()).toBe(true);

  await page.goBack();
  const stats = page.waitForResponse((response) =>
    /^\/api\/v1\/stats\/groups\/[^/]+$/.test(new URL(response.url()).pathname),
  );
  await main.getByRole('link', { name: 'Ver estadísticas' }).click();
  await expect(page).toHaveURL(/\/estadisticas\?tab=groups$/);
  expect((await stats).ok()).toBe(true);
  await expect(main.getByRole('button', { name: 'Por Grupo' })).toBeVisible();
});

test('Plan 14: renombra, archiva y elimina un grupo temporal mediante la API local', async ({
  page,
  baseURL,
}) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  const origin = new URL(baseURL ?? 'http://localhost:3000').origin;
  const apiGroups = `${apiUrl}/api/v1/groups`;
  const original = `Prueba plan 14 ${Date.now()}`;
  const created = await page.request.post(apiGroups, {
    data: { name: original },
    headers: { Origin: origin },
  });
  expect(created.status()).toBe(201);
  const group = GroupViewSchema.parse(await created.json());
  const groupUrl = `${apiGroups}/${group.id}`;

  try {
    await page.goto(`/grupos/${group.id}`);
    const main = page.getByRole('main');
    const rename = main.getByRole('button', { name: 'Renombrar' });
    await expect(main.getByText(/Puedes archivarlo si ya no lo vas a usar/)).toBeVisible();
    await rename.click();
    const nameField = main.getByRole('textbox', { name: 'Nombre del grupo' });
    await expect(nameField).toBeFocused();
    await main.getByRole('button', { name: 'Cancelar' }).click();
    await expect(rename).toBeFocused();
    await rename.click();
    await nameField.fill(`${original} renombrado`);
    const renamed = page.waitForResponse(
      (response) => response.url() === groupUrl && response.request().method() === 'PATCH',
    );
    await nameField.press('Enter');
    expect((await renamed).status()).toBe(200);
    await expect(
      main.getByRole('heading', { level: 1, name: `${original} renombrado` }),
    ).toBeVisible();

    await main.getByRole('button', { name: 'Archivar grupo' }).click();
    const dialog = page.getByRole('dialog', { name: 'Archivar grupo' });
    await expect(dialog).toBeVisible();
    expect((await new AxeBuilder({ page }).withTags(wcagTags).analyze()).violations).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await main.getByRole('button', { name: 'Archivar grupo' }).click();
    const archived = page.waitForResponse((response) => response.url() === `${groupUrl}/archive`);
    await dialog.getByRole('button', { name: 'Confirmar' }).click();
    expect((await archived).status()).toBe(200);
    await expect(main.getByText('Archivado', { exact: true })).toBeVisible();
    await expect(main.getByRole('heading', { level: 1 })).toBeFocused();
    await expect(rename).toHaveCount(0);
    await expect(main.getByRole('button', { name: 'Archivar grupo' })).toHaveCount(0);

    await main.getByRole('button', { name: 'Eliminar grupo' }).click();
    const deleted = page.waitForResponse(
      (response) => response.url() === groupUrl && response.request().method() === 'DELETE',
    );
    await page
      .getByRole('dialog', { name: 'Eliminar grupo' })
      .getByRole('button', { name: 'Confirmar' })
      .click();
    expect((await deleted).status()).toBe(204);
    await expect(page).toHaveURL(/\/grupos$/);
    await page.goto(`/grupos/${group.id}`);
    await expect(main.getByRole('alert')).toHaveText('Grupo no encontrado.');
  } finally {
    const cleanup = await page.request.delete(groupUrl, {
      headers: { Origin: origin },
    });
    expect([204, 404]).toContain(cleanup.status());
  }
});
