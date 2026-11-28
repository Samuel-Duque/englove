import { addSessionCookie } from './session';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

const sampleGroups = [
  { id: 'grp-1', name: 'Kids Explorers A1', archivedAt: null, activeStudentCount: 10 },
  { id: 'grp-2', name: 'Teens Cohort 2025', archivedAt: '2026-01-15T00:00:00.000Z', activeStudentCount: 0 },
];

const sampleAssignments = [
  {
    id: 'asg-open',
    activity: { id: 'act-1', title: 'Daily Routines Practice', type: 'fill_blank', level: 'A1', version: 2, status: 'published' },
    group: { id: 'grp-1', name: 'Kids Explorers A1', archivedAt: null },
    opensAt: '2026-11-01T13:00:00.000Z',
    dueAt: '2026-11-30T23:00:00.000Z',
    cancelledAt: null,
    historicalStudentCount: null,
    availability: 'open',
    totalAttempts: 10,
    submittedAttempts: 8,
  },
  {
    id: 'asg-sched',
    activity: { id: 'act-2', title: 'Describe Your Favorite Hobby', type: 'speaking', level: 'A2', version: 1, status: 'published' },
    group: { id: 'grp-1', name: 'Kids Explorers A1', archivedAt: null },
    opensAt: '2026-12-05T13:00:00.000Z',
    dueAt: '2026-12-12T23:00:00.000Z',
    cancelledAt: null,
    historicalStudentCount: null,
    availability: 'scheduled',
    totalAttempts: 10,
    submittedAttempts: 0,
  },
  {
    id: 'asg-closed',
    activity: { id: 'act-3', title: 'Midterm Grammar Exam', type: 'exam', level: 'B1', version: 1, status: 'published' },
    group: { id: 'grp-2', name: 'Teens Cohort 2025', archivedAt: '2026-01-15T00:00:00.000Z' },
    opensAt: '2026-10-01T13:00:00.000Z',
    dueAt: '2026-10-10T23:00:00.000Z',
    cancelledAt: null,
    historicalStudentCount: 10,
    availability: 'closed',
    totalAttempts: 10,
    submittedAttempts: 10,
  },
  {
    id: 'asg-cancelled',
    activity: { id: 'act-4', title: 'Weekend Reflections', type: 'open_question', level: 'B2', version: 1, status: 'published' },
    group: { id: 'grp-1', name: 'Kids Explorers A1', archivedAt: null },
    opensAt: '2026-10-15T13:00:00.000Z',
    dueAt: '2026-10-20T23:00:00.000Z',
    cancelledAt: '2026-10-16T15:00:00.000Z',
    historicalStudentCount: null,
    availability: 'cancelled',
  },
];

test.beforeEach(async ({ context, page }) => {
  const token = `header.${Buffer.from(JSON.stringify({ role: 'teacher' })).toString('base64url')}.signature`;
  await addSessionCookie(context, token);
  await page.route('**/api/v1/auth/session', (route) =>
    route.fulfill({
      json: {
        user: { id: 'teacher-asg', name: 'Clara Gómez', email: 'teacher@example.test', role: 'teacher' },
        organizationId: 'org-asg',
      },
    }),
  );
});

for (const [width, height] of [[1440, 900], [1280, 800], [820, 1080], [390, 844], [320, 640]] as const) {
  test(`Asignaciones docente: diseño editorial, responsive y WCAG 2.2 AA a ${width} × ${height}`, async ({ page }) => {
    await page.route('**/api/v1/groups?limit=100', (route) =>
      route.fulfill({ json: { items: sampleGroups, total: sampleGroups.length } }),
    );
    await page.route('**/api/v1/assignments?*', (route) =>
      route.fulfill({ json: { items: sampleAssignments, total: sampleAssignments.length } }),
    );

    await page.setViewportSize({ width, height });
    await page.goto('/asignaciones');

    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { level: 1, name: 'Asignaciones' })).toBeVisible();
    await expect(main.getByRole('link', { name: 'Nueva asignación' })).toHaveAttribute('href', '/asignaciones/nueva');

    // Callout visible sobre exclusión de microjuegos (Decisiones 111 y 130)
    const callout = main.getByRole('note', { name: 'Regla sobre microjuegos' });
    await expect(callout).toBeVisible();
    await expect(callout).toContainText('microjuegos');

    // 4 badges de disponibilidad homologados
    for (const label of ['Abierta', 'Programada', 'Cerrada', 'Cancelada']) {
      await expect(main.getByText(label, { exact: true }).first()).toBeVisible();
    }

    // Programada usa Terracota Suave (#FFF0DE / #872E06)
    const scheduledBadge = main.getByText('Programada', { exact: true });
    await expect(scheduledBadge).toHaveCSS('background-color', 'rgb(255, 240, 222)');
    await expect(scheduledBadge).toHaveCSS('color', 'rgb(135, 46, 6)');

    // Título con lang="en", etiqueta Completar espacios y grupo archivado
    const englishTitle = main.locator('span[lang="en"]', { hasText: 'Daily Routines Practice' });
    await expect(englishTitle).toBeVisible();
    await expect(main.getByText(/Completar espacios · Nivel A1 · v2/)).toBeVisible();
    await expect(main.getByText('(Archivado)', { exact: true })).toBeVisible();

    // Cumplimiento con tabular-nums y enlaces de detalle
    await expect(main.getByText('8 / 10')).toBeVisible();
    await expect(main.getByText('10 / 10')).toBeVisible();
    await expect(
      main.getByRole('link', { name: 'Ver detalle de asignación: Daily Routines Practice para Kids Explorers A1' }),
    ).toHaveAttribute('href', '/asignaciones/asg-open');

    // Tamaño mínimo táctil
    const minTarget = width < 1024 ? 48 : 44;
    const ctaBox = await main.getByRole('link', { name: 'Nueva asignación' }).boundingBox();
    expect(ctaBox).not.toBeNull();
    if (ctaBox) {
      expect(ctaBox.height).toBeGreaterThanOrEqual(minTarget);
    }

    // Cero desborde horizontal y cero violaciones WCAG 2.2 AA
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    expect((await new AxeBuilder({ page }).withTags(wcagTags).analyze()).violations).toEqual([]);
  });
}

test('Asignaciones docente: notice, filtros sincronizados, estado vacío y reintento tras error', async ({ page }) => {
  await page.route('**/api/v1/groups?limit=100', (route) =>
    route.fulfill({ json: { items: sampleGroups, total: sampleGroups.length } }),
  );

  let shouldFail = true;
  await page.route('**/api/v1/assignments?*', async (route) => {
    const url = new URL(route.request().url());
    const availability = url.searchParams.get('availability');
    const groupId = url.searchParams.get('groupId');

    if (shouldFail) {
      return route.fulfill({ status: 503, json: { code: 'HEALTH_UNAVAILABLE', message: 'Servicio no disponible' } });
    }

    const filtered = sampleAssignments.filter((item) => {
      if (groupId && item.group.id !== groupId) return false;
      if (availability && item.availability !== availability) return false;
      return true;
    });

    return route.fulfill({ json: { items: filtered, total: filtered.length } });
  });

  await page.goto('/asignaciones?notice=Asignaci%C3%B3n%20creada');
  await expect(page.getByRole('status').filter({ hasText: 'Asignación creada' })).toBeVisible();
  await expect(page.getByRole('main').getByText('Servicio no disponible')).toBeVisible({ timeout: 15_000 });

  // Reintentar recupera los datos
  shouldFail = false;
  await page.getByRole('main').getByRole('button', { name: 'Reintentar' }).click();
  await expect(page.getByText('4 asignaciones')).toBeVisible();

  // Cerrar banner de notice
  await page.getByRole('button', { name: 'Cerrar aviso' }).click();
  await expect(page).not.toHaveURL(/notice=/);

  // Filtrar por grupo archivado y disponibilidad vacía
  await page.getByLabel('Grupo').selectOption('grp-2');
  await expect(page).toHaveURL(/groupId=grp-2/);
  await expect(page.getByText('1 asignación')).toBeVisible();

  await page.getByLabel('Disponibilidad').selectOption('open');
  await expect(page).toHaveURL(/availability=open/);
  await expect(page.getByRole('heading', { name: 'No hay asignaciones con estos filtros' })).toBeVisible();

  // Limpiar filtros vuelve al listado completo
  await page.getByRole('button', { name: 'Limpiar filtros' }).click();
  await expect(page).toHaveURL(/\/asignaciones$/);
  await expect(page.getByText('4 asignaciones')).toBeVisible();
});
