import { AssignmentListResponseSchema, GroupListResponseSchema } from '@upward-english/shared';
import { expect, test } from '@playwright/test';

const email = process.env.ENGLOVE_SMOKE_EMAIL;
const password = process.env.ENGLOVE_SMOKE_PASSWORD;

test('Asignaciones docente con API y datos locales: navegación, filtros y rutas conectadas', async ({ page }) => {
  test.skip(!email || !password, 'Requiere una cuenta docente sembrada en el entorno local.');
  if (!email || !password) return;
  test.setTimeout(90_000);

  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Correo electrónico' }).fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/inicio$/);

  const groupsPromise = page.waitForResponse((res) => {
    const url = new URL(res.url());
    return url.pathname === '/api/v1/groups' && url.searchParams.get('limit') === '100';
  });
  const assignmentsPromise = page.waitForResponse((res) => {
    const url = new URL(res.url());
    return url.pathname === '/api/v1/assignments';
  });

  await page.getByRole('navigation', { name: 'Navegación docente' }).getByRole('link', { name: 'Asignaciones', exact: true }).click();
  await expect(page).toHaveURL(/\/asignaciones$/);

  const [groupsRes, assignmentsRes] = await Promise.all([groupsPromise, assignmentsPromise]);
  expect(groupsRes.status()).toBe(200);
  expect(assignmentsRes.status()).toBe(200);

  const groupsData = GroupListResponseSchema.parse(await groupsRes.json());
  const assignmentsData = AssignmentListResponseSchema.parse(await assignmentsRes.json());

  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { level: 1, name: 'Asignaciones' })).toBeVisible();
  await expect(main.getByRole('note', { name: 'Regla sobre microjuegos' })).toBeVisible();

  const expectedCountLabel = `${assignmentsData.total} asignaci${assignmentsData.total === 1 ? 'ón' : 'ones'}`;
  await expect(main.getByText(expectedCountLabel, { exact: true })).toBeVisible();

  if (assignmentsData.items.length > 0) {
    const first = assignmentsData.items[0];
    if (first) {
      await expect(main.locator('span[lang="en"]', { hasText: first.activity.title }).first()).toBeVisible();
      await main.getByRole('link', {
        name: `Ver detalle de asignación: ${first.activity.title} para ${first.group.name}`,
      }).first().click();
      await expect(page).toHaveURL(new RegExp(`/asignaciones/${first.id}$`));
      await expect(main.getByRole('heading', { level: 1, name: first.activity.title })).toBeVisible();
      await page.getByRole('navigation', { name: 'Navegación docente' }).getByRole('link', { name: 'Asignaciones', exact: true }).click();
      await expect(page).toHaveURL(/\/asignaciones$/);
    }
  }

  // Conectar con /asignaciones/nueva
  await main.getByRole('link', { name: 'Nueva asignación' }).click();
  await expect(page).toHaveURL(/\/asignaciones\/nueva$/);
  await expect(main.getByRole('heading', { level: 1, name: 'Nueva asignación' })).toBeVisible();

  // Conectar desde /grupos/[id] hacia /asignaciones?groupId=...
  const firstGroup = groupsData.items[0];
  if (firstGroup) {
    await page.goto(`/grupos/${firstGroup.id}`);
    await main.getByRole('link', { name: 'Ver asignaciones' }).click();
    await expect(page).toHaveURL(new RegExp(`/asignaciones\\?groupId=${firstGroup.id}$`));
    await expect(main.getByLabel('Grupo')).toHaveValue(firstGroup.id);
  }
});
