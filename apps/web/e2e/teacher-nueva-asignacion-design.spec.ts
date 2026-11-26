import { addSessionCookie } from './session';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

const publishedActivities = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    title: 'Daily Routines Gap Fill',
    type: 'fill_blank',
    level: 'A1',
    status: 'published',
    version: 2,
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    title: 'Tell Us About Your Weekend',
    type: 'speaking',
    level: 'A2',
    status: 'published',
    version: 1,
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    title: 'Memory Safari Game',
    type: 'game',
    level: 'A1',
    status: 'published',
    version: 1,
  },
];

const activeGroups = [
  { id: 'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1', name: 'Kids A1 Mañana', activeStudentCount: 12, archivedAt: null },
  { id: 'aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaa2', name: 'Teens A2 Tarde', activeStudentCount: 9, archivedAt: null },
];

test.beforeEach(async ({ context, page }) => {
  const token = `header.${Buffer.from(JSON.stringify({ role: 'teacher' })).toString('base64url')}.signature`;
  await addSessionCookie(context, token);
  await page.route('**/api/v1/auth/session', (route) =>
    route.fulfill({
      json: {
        user: { id: 'teacher-design', name: 'Clara Gómez', email: 'teacher@example.test', role: 'teacher' },
        organizationId: 'org-design',
      },
    }),
  );
});

for (const [width, height] of [[1440, 900], [1280, 800], [820, 1080], [390, 844], [320, 640]] as const) {
  test(`Nueva asignación: diseño editorial, exclusión de game, preview 24h y a11y a ${width} × ${height}`, async ({ page }) => {
    await page.route('**/api/v1/activities?status=published*', (route) =>
      route.fulfill({ json: { items: publishedActivities, total: publishedActivities.length } }),
    );
    await page.route('**/api/v1/groups?archived=false*', (route) =>
      route.fulfill({ json: { items: activeGroups, total: activeGroups.length } }),
    );

    await page.setViewportSize({ width, height });
    await page.goto('/asignaciones/nueva');

    const breadcrumb = page.getByRole('navigation', { name: 'Ruta actual' });
    await expect(breadcrumb.getByRole('link', { name: 'Asignaciones' })).toHaveAttribute('href', '/asignaciones');
    await expect(breadcrumb.getByText('Nueva asignación')).toHaveAttribute('aria-current', 'page');

    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { level: 1, name: 'Nueva asignación' })).toBeVisible();
    await expect(main.getByText(/microjuegos.*abiertos 24\/7/i)).toBeVisible();

    // Excluye ActivityType.game tanto del listado como del selector de tipo
    await expect(main.getByText('Memory Safari Game')).toHaveCount(0);
    await expect(main.locator('#new-assignment-filter-type option[value="game"]')).toHaveCount(0);

    // Homologación 'Completar espacios' y lang="en" en título
    const firstActivityTitle = main.locator('label', { hasText: 'Daily Routines Gap Fill' }).locator('[lang="en"]');
    await expect(firstActivityTitle).toHaveText('Daily Routines Gap Fill');
    await expect(main.getByText('Completar espacios').first()).toBeVisible();

    // Preview en vivo de tolerancia 24h en America/Bogota
    await page.locator('#opens-at').fill('2026-11-04T08:00');
    await page.locator('#due-at').fill('2026-11-04T18:00');
    await expect(main.getByText(/Última hora para terminar si empezó a tiempo:.*5 de noviembre de 2026/i).first()).toBeVisible();

    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    expect((await new AxeBuilder({ page }).withTags(wcagTags).analyze()).violations).toEqual([]);
  });
}

test('Nueva asignación: conflicto ASSIGNMENT_ALREADY_ACTIVE enfoca errorAlertRef y conserva selecciones', async ({ page }) => {
  await page.route('**/api/v1/activities?status=published*', (route) =>
    route.fulfill({ json: { items: publishedActivities, total: publishedActivities.length } }),
  );
  await page.route('**/api/v1/groups?archived=false*', (route) =>
    route.fulfill({ json: { items: activeGroups, total: activeGroups.length } }),
  );
  await page.route('**/api/v1/assignments', (route) =>
    route.fulfill({
      status: 409,
      json: {
        statusCode: 409,
        code: 'ASSIGNMENT_ALREADY_ACTIVE',
        message: 'La actividad ya tiene una asignación activa en uno de los grupos seleccionados',
      },
    }),
  );

  await page.goto('/asignaciones/nueva');
  await page.locator('label', { hasText: 'Daily Routines Gap Fill' }).click();
  await page.locator('label', { hasText: 'Kids A1 Mañana' }).click();
  await page.getByRole('button', { name: 'Programar asignación' }).click();

  const alert = page.getByRole('main').getByRole('alert');
  await expect(alert).toBeVisible();
  await expect(alert).toContainText('La actividad ya tiene una asignación activa en uno de los grupos seleccionados');
  await expect(alert).toBeFocused();
  await expect(page.getByRole('radio', { name: /Daily Routines Gap Fill/ })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: /Kids A1 Mañana/ })).toBeChecked();
});

test('Nueva asignación: estados vacíos (solo game publicado / sin grupos) y recuperación tras error 503', async ({ page }) => {
  // 1. Solo hay un microjuego publicado -> estado vacío de actividades asignables
  await page.route('**/api/v1/activities?status=published*', (route) =>
    route.fulfill({ json: { items: [publishedActivities[2]], total: 1 } }),
  );
  await page.route('**/api/v1/groups?archived=false*', (route) =>
    route.fulfill({ json: { items: activeGroups, total: activeGroups.length } }),
  );

  await page.goto('/asignaciones/nueva');
  await expect(page.getByRole('heading', { name: 'Publica una actividad para poder asignarla' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Crear actividad' })).toHaveAttribute('href', '/actividades/nueva');
  await expect(page.getByRole('link', { name: 'Ir al catálogo de actividades' })).toHaveAttribute('href', '/actividades');

  // 2. Sin grupos activos -> estado vacío de grupos
  await page.unroute('**/api/v1/activities?status=published*');
  await page.unroute('**/api/v1/groups?archived=false*');
  await page.route('**/api/v1/activities?status=published*', (route) =>
    route.fulfill({ json: { items: publishedActivities, total: publishedActivities.length } }),
  );
  await page.route('**/api/v1/groups?archived=false*', (route) =>
    route.fulfill({ json: { items: [], total: 0 } }),
  );

  await page.goto('/asignaciones/nueva');
  await expect(page.getByRole('heading', { name: 'Crea un grupo activo para poder asignar' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ir a gestión de grupos' })).toHaveAttribute('href', '/grupos');

  // 3. Error 503 recuperable con Reintentar
  await page.unroute('**/api/v1/groups?archived=false*');
  let available = false;
  await page.route('**/api/v1/groups?archived=false*', (route) =>
    available
      ? route.fulfill({ json: { items: activeGroups, total: activeGroups.length } })
      : route.fulfill({ status: 503, json: { code: 'HEALTH_UNAVAILABLE', message: 'Servicio temporalmente no disponible' } }),
  );

  await page.goto('/asignaciones/nueva');
  await expect(page.getByRole('main').getByRole('alert')).toBeVisible({ timeout: 10000 });
  available = true;
  await page.getByRole('button', { name: 'Reintentar' }).click();
  await expect(page.getByRole('heading', { name: 'Selecciona la actividad' })).toBeVisible();
});

test('Nueva asignación: flujo completo por teclado y navegación hacia /asignaciones', async ({ page }) => {
  let submittedPayload: unknown = null;
  await page.route('**/api/v1/activities?status=published*', (route) =>
    route.fulfill({ json: { items: publishedActivities, total: publishedActivities.length } }),
  );
  await page.route('**/api/v1/groups?archived=false*', (route) =>
    route.fulfill({ json: { items: activeGroups, total: activeGroups.length } }),
  );
  await page.route('**/api/v1/assignments*', (route) => {
    if (route.request().method() === 'POST') {
      submittedPayload = route.request().postDataJSON();
      return route.fulfill({
        status: 201,
        json: {
          items: [{ id: 'asg-kb-1', activity: publishedActivities[0], group: activeGroups[0] }],
          count: 1,
        },
      });
    }
    return route.fulfill({ json: { items: [], total: 0 } });
  });

  await page.goto('/asignaciones/nueva');

  const firstRadio = page.getByRole('radio', { name: /Daily Routines Gap Fill/ });
  await firstRadio.focus();
  await firstRadio.press('Space');
  await expect(firstRadio).toBeChecked();

  const firstGroup = page.getByRole('checkbox', { name: /Kids A1 Mañana/ });
  await firstGroup.focus();
  await firstGroup.press('Space');
  await expect(firstGroup).toBeChecked();

  const submitBtn = page.getByRole('button', { name: 'Programar asignación' });
  await submitBtn.focus();
  await submitBtn.press('Enter');

  const targetActivity = publishedActivities[0];
  const targetGroup = activeGroups[0];
  if (!targetActivity || !targetGroup) {
    throw new Error('Fixture de actividad o grupo faltante');
  }

  await expect(page).toHaveURL(/\/asignaciones\?notice=Asignaci%C3%B3n%20creada/);
  expect(submittedPayload).toMatchObject({
    activityId: targetActivity.id,
    groupIds: [targetGroup.id],
  });
});
