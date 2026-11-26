import { addSessionCookie } from './session';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

test.beforeEach(async ({ context, page }) => {
  const token = `header.${Buffer.from(JSON.stringify({ role: 'teacher' })).toString('base64url')}.signature`;
  await addSessionCookie(context, token);
  await page.route('**/api/v1/auth/session', (route) => route.fulfill({
    json: {
      user: { id: 'teacher-home', name: 'Clara Gómez', email: 'teacher@example.test', role: 'teacher' },
      organizationId: 'org-home',
    },
  }));
});

for (const [width, height] of [[1440, 900], [1280, 800], [820, 1080], [390, 844], [320, 640]] as const) {
  test(`Inicio docente: navegación y accesibilidad a ${width} × ${height}`, async ({ page }) => {
    await page.route('**/api/v1/dashboard/reminders', (route) => route.fulfill({
      json: { pendingRegistrations: 3, overdueReviews: 2, ungradedReminderDays: 5 },
    }));
    await page.route('**/api/v1/groups?archived=false&limit=20', (route) => route.fulfill({
      json: { items: [{ id: 'group-home', name: 'Exploradores', activeStudentCount: 8 }] },
    }));
    await page.setViewportSize({ width, height });
    await page.goto('/inicio');

    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { name: 'Buen día, Clara Gómez' })).toBeVisible();
    await expect(main.getByRole('link', { name: 'Nueva actividad' })).toHaveAttribute('href', '/actividades/nueva');
    await expect(main.getByRole('link', { name: 'Revisar solicitudes' })).toHaveAttribute('href', '/alumnos/solicitudes');
    await expect(main.getByRole('link', { name: 'Ir a revisión' })).toHaveAttribute('href', '/revision');
    await expect(main.getByText(/más de 5 días/)).toBeVisible();
    await expect(main.getByRole('row', { name: /Exploradores.*8/ }).getByRole('link')).toHaveAttribute('href', '/grupos/group-home');

    if (width < 1024) {
      const menu = page.getByRole('button', { name: 'Menú docente' });
      await expect(menu).toHaveAttribute('aria-expanded', 'false');
      await menu.press('Enter');
      await expect(menu).toHaveAttribute('aria-expanded', 'true');
    }
    await expect(page.getByRole('navigation', { name: 'Navegación docente' }).getByRole('link', { name: 'Inicio', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    expect((await new AxeBuilder({ page }).withTags(wcagTags).analyze()).violations).toEqual([]);
  });
}

test('Inicio docente: un error de grupos no oculta los recordatorios y el refresco recupera los datos', async ({ page }) => {
  let available = false;
  let remindersRequests = 0;
  await page.route('**/api/v1/dashboard/reminders', (route) => {
    remindersRequests += 1;
    return route.fulfill({ json: { pendingRegistrations: 0, overdueReviews: 0, ungradedReminderDays: 3 } });
  });
  await page.route('**/api/v1/groups?archived=false&limit=20', (route) => available
    ? route.fulfill({ json: { items: [] } })
    : route.fulfill({ status: 503, json: { code: 'HEALTH_UNAVAILABLE' } }));
  await page.goto('/inicio');
  await expect(page.getByText('No hay alumnos pendientes de aprobación.')).toBeVisible();
  await expect(page.getByText('No pudimos cargar los grupos activos.')).toBeVisible();
  available = true;
  const requestsBeforeRefresh = remindersRequests;
  await page.getByRole('button', { name: 'Refrescar' }).click();
  await expect(page.getByRole('link', { name: 'Crear el primer grupo' })).toHaveAttribute('href', '/grupos');
  await expect.poll(() => remindersRequests).toBeGreaterThan(requestsBeforeRefresh);
  await expect(page.getByText(/Actualizado.*cada 30 s/)).toBeVisible();
});
