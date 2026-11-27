import { reserveTeacherRateBudget, smokeCredentials } from './session';
import { expect, test } from '@playwright/test';


test('Inicio docente con API y datos locales: sesión, recordatorios, grupos, enlaces y salida', async ({ page }) => {
  test.setTimeout(90_000);

  const { email, password } = smokeCredentials('teacher');
  await reserveTeacherRateBudget(page);
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Correo electrónico' }).fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  const remindersPromise = page.waitForResponse((res) => new URL(res.url()).pathname === '/api/v1/dashboard/reminders');
  const groupsPromise = page.waitForResponse((res) => {
    const url = new URL(res.url());
    return url.pathname === '/api/v1/groups' && url.searchParams.get('archived') === 'false';
  });
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/inicio$/);
  const [reminders, groups] = await Promise.all([remindersPromise, groupsPromise]);
  expect(reminders.status()).toBe(200);
  expect(groups.status()).toBe(200);

  const { RemindersResponseSchema, GroupListResponseSchema } = await import('@upward-english/shared');
  const counts = RemindersResponseSchema.parse(await reminders.json());
  const activeGroups = GroupListResponseSchema.parse(await groups.json()).items;
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { level: 1, name: /^Buen día,/ })).toBeVisible();
  for (const [title, count] of [
    ['Solicitudes de registro', counts.pendingRegistrations],
    ['Entregas sin calificar', counts.overdueReviews],
  ] as const) {
    const card = main.getByRole('article').filter({ has: page.getByRole('heading', { name: title }) });
    await expect(card.getByText(String(count), { exact: true })).toBeVisible();
  }
  if (activeGroups.length) {
    await expect(main.getByRole('row')).toHaveCount(activeGroups.length + 1);
    for (const group of activeGroups) {
      const row = main.getByRole('row').filter({ has: page.getByRole('rowheader', { name: group.name, exact: true }) });
      await expect(row.getByRole('cell', { name: String(group.activeStudentCount), exact: true })).toBeVisible();
    }
    const firstGroup = activeGroups[0];
    if (firstGroup) {
      await main.getByRole('link', { name: `Ver grupo: ${firstGroup.name}`, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/grupos/${firstGroup.id}$`));
      await expect(page.getByRole('navigation', { name: 'Navegación docente' }).getByRole('link', { name: 'Grupos' })).toHaveAttribute('aria-current', 'location');
    }
  } else {
    await expect(main.getByRole('link', { name: 'Crear el primer grupo' })).toBeVisible();
  }
  for (const [label, location] of [
    ['Nueva actividad', /\/actividades\/nueva$/],
    ['Revisar solicitudes', /\/alumnos\?tab=requests$/],
    ['Ir a revisión', /\/revision$/],
  ] as const) {
    await page.goto('/inicio');
    await main.getByRole('link', { name: label, exact: true }).click();
    await expect(page).toHaveURL(location);
    await expect(page.getByRole('navigation', { name: 'Navegación docente' })).toBeVisible();
  }

  for (const [label, path] of [
    ['Inicio', '/inicio'], ['Actividades', '/actividades'], ['Asignaciones', '/asignaciones'],
    ['Revisión', '/revision'], ['Alumnos', '/alumnos'], ['Grupos', '/grupos'],
    ['Estadísticas', '/estadisticas'], ['Contenido extra', '/contenido-extra'],
  ] as const) {
    const link = page.getByRole('navigation', { name: 'Navegación docente' }).getByRole('link', { name: label, exact: true });
    await link.click();
    await expect(page).toHaveURL(path);
    await expect(link).toHaveAttribute('aria-current', 'page');
  }
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  await page.goto('/inicio');
  await expect(page).toHaveURL(/\/login\?next=/);
});
