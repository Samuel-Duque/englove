import { addSessionCookie } from './session';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

const activeGroup = {
  id: 'grp-kids-a1',
  name: 'Kids Explorers A1',
  archivedAt: null,
  activeStudentCount: 2,
};

const activeGroupTeens = {
  id: 'grp-teens-b1',
  name: 'Teens Leaders B1',
  archivedAt: null,
  activeStudentCount: 1,
};

const mockStudents = [
  {
    id: 'std-1',
    name: 'Camila Morales',
    email: 'camila.morales.estudiante@upwardenglish.local',
    birthDate: '2017-04-10',
    level: 'A1',
    ageSegment: 'kids',
    approvalStatus: 'approved',
    guardianName: 'Marta Morales',
    guardianContact: '+57 300 1112233',
    groupId: activeGroup.id,
    lockedUntil: null,
  },
  {
    id: 'std-2',
    name: 'Daniel Vargas',
    email: 'daniel.vargas@upwardenglish.local',
    birthDate: '2013-01-25',
    level: 'B1',
    ageSegment: 'teens',
    approvalStatus: 'approved',
    guardianName: 'Carlos Vargas',
    guardianContact: 'carlos.vargas@correo.test',
    groupId: activeGroupTeens.id,
    lockedUntil: null,
  },
  {
    id: 'std-pending',
    name: 'Emiliano López',
    email: 'emiliano@upwardenglish.local',
    birthDate: '2018-02-14',
    level: null,
    ageSegment: 'kids',
    approvalStatus: 'pending_approval',
    guardianName: 'Paula López',
    guardianContact: '+57 301 9998877',
    groupId: null,
    lockedUntil: null,
  },
];

const mockRequests = [mockStudents[2]];

const mockLocked = [
  {
    id: 'std-locked',
    name: 'Sofía Gómez',
    email: 'sofia@upwardenglish.local',
    birthDate: '2018-03-20',
    level: 'A1',
    ageSegment: 'kids',
    approvalStatus: 'approved',
    guardianName: 'Elena Gómez',
    guardianContact: '+57 310 5556677',
    groupId: activeGroup.id,
    lockedUntil: '2026-11-26T02:30:00.000Z',
  },
];

test.beforeEach(async ({ context, page }) => {
  const token = `header.${Buffer.from(JSON.stringify({ role: 'teacher' })).toString('base64url')}.signature`;
  await addSessionCookie(context, token);

  await page.route('**/api/v1/auth/session', (route) =>
    route.fulfill({
      json: {
        user: {
          id: 'teacher-alumnos',
          name: 'Clara Gómez',
          email: 'teacher@example.test',
          role: 'teacher',
        },
        organizationId: 'org-alumnos',
      },
    }),
  );
});

for (const [width, height] of [
  [1440, 900],
  [1280, 800],
  [820, 1080],
  [390, 844],
  [320, 640],
] as const) {
  test(`Alumnos docente: diseño, responsividad y accesibilidad a ${width} × ${height}`, async ({
    page,
  }) => {
    await page.route('**/api/v1/students?*', (route) =>
      route.fulfill({ json: { items: mockStudents, total: mockStudents.length } }),
    );
    await page.route('**/api/v1/students/requests?*', (route) =>
      route.fulfill({ json: { items: mockRequests, total: mockRequests.length } }),
    );
    await page.route('**/api/v1/students/locked?*', (route) =>
      route.fulfill({ json: { items: mockLocked, total: mockLocked.length } }),
    );
    await page.route('**/api/v1/groups?*', (route) =>
      route.fulfill({ json: { items: [activeGroup, activeGroupTeens], total: 2 } }),
    );

    await page.setViewportSize({ width, height });
    await page.goto('/alumnos');

    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { level: 1, name: 'Alumnos' })).toBeVisible();
    await expect(
      main.getByText(/auto-registro y aprobación docente en la pestaña/i),
    ).toBeVisible();

    // No "Crear alumno" button or link
    await expect(main.getByRole('button', { name: /Crear alumno/i })).toHaveCount(0);
    await expect(main.getByRole('link', { name: /Crear alumno/i })).toHaveCount(0);

    // Tablist and sibling link to /grupos
    const tablist = main.getByRole('tablist', { name: 'Pestañas de alumnos' });
    await expect(tablist).toBeVisible();
    const activeTab = tablist.getByRole('tab', { name: 'Alumnos activos' });
    const requestsTab = tablist.getByRole('tab', { name: /Solicitudes de registro/ });
    const lockedTab = tablist.getByRole('tab', { name: /Bloqueados/ });

    await expect(activeTab).toHaveAttribute('aria-selected', 'true');
    await expect(requestsTab).toHaveAttribute('aria-selected', 'false');
    await expect(requestsTab).toContainText('1');
    await expect(lockedTab).toHaveAttribute('aria-selected', 'false');
    await expect(lockedTab).toContainText('1');
    await expect(main.getByRole('link', { name: 'Gestionar grupos' })).toHaveAttribute(
      'href',
      '/grupos',
    );

    // Approved students appear with resolved group, segment, guardian contact and detail link
    await expect(main.getByRole('link', { name: 'Camila Morales', exact: true })).toHaveAttribute(
      'href',
      '/alumnos/std-1',
    );
    await expect(main.getByRole('link', { name: 'Kids Explorers A1', exact: true })).toHaveAttribute(
      'href',
      '/grupos/grp-kids-a1',
    );
    await expect(main.getByText('Marta Morales')).toBeVisible();
    await expect(main.getByText('+57 300 1112233')).toBeVisible();
    await expect(main.getByRole('link', { name: 'Ver ficha de Camila Morales' })).toHaveAttribute(
      'href',
      '/alumnos/std-1',
    );
    await expect(main.getByRole('link', { name: 'Daniel Vargas', exact: true })).toHaveAttribute(
      'href',
      '/alumnos/std-2',
    );
    await expect(main.getByRole('link', { name: 'Teens Leaders B1', exact: true })).toHaveAttribute(
      'href',
      '/grupos/grp-teens-b1',
    );

    // Pending approval student is excluded from Alumnos activos directory
    await expect(main.getByText('Emiliano López')).toHaveCount(0);

    // Zero horizontal overflow and zero WCAG 2.2 AA axe violations
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(width);
    if (width >= 1280) {
      const activeStudentsRegion = main.getByRole('region', { name: 'Alumnos activos' });
      await expect
        .poll(() => activeStudentsRegion.evaluate((el) => el.scrollWidth - el.clientWidth))
        .toBe(0);
    }
    expect((await new AxeBuilder({ page }).withTags(wcagTags).analyze()).violations).toEqual([]);

    await page.goto('/alumnos/solicitudes');
    await expect(page).toHaveURL(/\/alumnos\?tab=requests$/);
    const requestsPanel = main.getByRole('tabpanel', { name: /Solicitudes de registro/ });
    const requestRow = requestsPanel.getByRole('row').filter({ hasText: 'Emiliano López' });
    await expect(requestRow.getByText('Paula López')).toBeVisible();
    await expect(requestRow.getByText('Pendiente de aprobación')).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(width);
    const tableRegion = requestsPanel.getByRole('region', { name: 'Solicitudes pendientes' });
    await expect.poll(() => tableRegion.evaluate((el) => el.scrollWidth - el.clientWidth)).toBe(0);
    expect((await new AxeBuilder({ page }).withTags(wcagTags).analyze()).violations).toEqual([]);

    const approve = requestRow.getByRole('button', { name: /Aprobar a Emiliano/ });
    await approve.click();
    const approval = page.getByRole('dialog', { name: /Aprobar alumno/ });
    const confirm = approval.getByRole('button', { name: 'Confirmar aprobación' });
    await expect(confirm).toBeDisabled();
    await expect(approval.getByLabel('Nombre del acudiente')).toHaveValue('Paula López');
    await approval.getByLabel('Nivel MCER').selectOption('A2');
    await expect(confirm).toBeDisabled();
    await approval.getByLabel('Grupo inicial').selectOption(activeGroup.id);
    await expect(confirm).toBeEnabled();
    await expect.poll(() => approval.evaluate((el) => el.scrollWidth - el.clientWidth)).toBe(0);
    expect((await new AxeBuilder({ page }).withTags(wcagTags).analyze()).violations).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(approve).toBeFocused();

    await requestRow.getByRole('button', { name: /Rechazar solicitud de Emiliano/ }).click();
    const rejection = page.getByRole('dialog', { name: 'Rechazar solicitud' });
    await expect(rejection.getByText(/sin activar su cuenta/)).toBeVisible();
    expect((await new AxeBuilder({ page }).withTags(wcagTags).analyze()).violations).toEqual([]);
    await rejection.getByRole('button', { name: 'Cancelar' }).click();
    await expect(requestRow).toBeVisible();
  });
}

test('Alumnos docente: navegación por teclado en tablist, estado de carga, vacío y recuperación de error', async ({
  page,
}) => {
  let available = false;
  await page.route('**/api/v1/students?*', async (route) => {
    if (!available) {
      await route.fulfill({ status: 503, json: { code: 'HEALTH_UNAVAILABLE' } });
      return;
    }
    await route.fulfill({ json: { items: [], total: 0 } });
  });
  await page.route('**/api/v1/students/requests?*', (route) =>
    route.fulfill({ json: { items: [], total: 0 } }),
  );
  await page.route('**/api/v1/students/locked?*', (route) =>
    route.fulfill({ json: { items: [], total: 0 } }),
  );
  await page.route('**/api/v1/groups?*', (route) =>
    route.fulfill({ json: { items: [], total: 0 } }),
  );

  await page.goto('/alumnos');

  // Error state and retry
  const main = page.getByRole('main');
  await expect(main.getByRole('alert')).toContainText(/No pudimos conectar/i);
  available = true;
  await main.getByRole('button', { name: 'Reintentar' }).click();

  // Empty state and switch to Solicitudes de registro
  await expect(
    main.getByRole('heading', { level: 2, name: 'Aún no hay alumnos activos' }),
  ).toBeVisible();

  const tablist = main.getByRole('tablist', { name: 'Pestañas de alumnos' });
  const activeTab = tablist.getByRole('tab', { name: 'Alumnos activos' });
  const requestsTab = tablist.getByRole('tab', { name: 'Solicitudes de registro' });
  const lockedTab = tablist.getByRole('tab', { name: 'Bloqueados' });

  await activeTab.focus();
  await activeTab.press('ArrowRight');
  await expect(requestsTab).toBeFocused();
  await requestsTab.press('End');
  await expect(lockedTab).toBeFocused();
  await lockedTab.press('ArrowLeft');
  await expect(requestsTab).toBeFocused();
  await requestsTab.press('Enter');

  await expect(page).toHaveURL(/\/alumnos\?tab=requests/);
  await expect(requestsTab).toHaveAttribute('aria-selected', 'true');
  await expect(main.getByRole('heading', { name: 'No hay solicitudes pendientes de aprobación.' })).toBeVisible();
});

test('Alumnos docente: esqueleto de carga muestra 6 filas', async ({ page }) => {
  await page.route('**/api/v1/students?*', async () => {
    // Keep pending to inspect skeleton state
    await new Promise(() => {});
  });
  await page.route('**/api/v1/students/requests?*', (route) =>
    route.fulfill({ json: { items: [], total: 0 } }),
  );
  await page.route('**/api/v1/students/locked?*', (route) =>
    route.fulfill({ json: { items: [], total: 0 } }),
  );
  await page.route('**/api/v1/groups?*', (route) =>
    route.fulfill({ json: { items: [], total: 0 } }),
  );

  await page.goto('/alumnos');
  const status = page.getByRole('main').getByRole('status').filter({
    hasText: 'Cargando alumnos activos…',
  });
  await expect(status).toBeVisible();
  await expect(status.locator('[data-skeleton-row]')).toHaveCount(6);
});

test('Solicitudes de registro: reintento de carga y enlace cuando faltan grupos activos', async ({
  page,
}) => {
  let available = false;
  await page.route('**/api/v1/students/requests?*', (route) =>
    available
      ? route.fulfill({ json: { items: mockRequests, total: mockRequests.length } })
      : route.fulfill({ status: 503, json: { code: 'HEALTH_UNAVAILABLE' } }),
  );
  await page.route('**/api/v1/groups?*', (route) =>
    route.fulfill({
      json: {
        items: [{ ...activeGroup, archivedAt: '2026-11-20T12:00:00.000Z' }],
        total: 1,
      },
    }),
  );

  await page.goto('/alumnos/solicitudes');
  const requestsPanel = page.getByRole('tabpanel', { name: /Solicitudes de registro/ });
  await expect(requestsPanel.getByRole('alert')).toBeVisible();
  available = true;
  await requestsPanel.getByRole('button', { name: 'Reintentar' }).click();

  await requestsPanel.getByRole('button', { name: /Aprobar a Emiliano/ }).click();
  const approval = page.getByRole('dialog', { name: /Aprobar alumno/ });
  await expect(approval.getByText(/Debes crear un grupo activo/)).toBeVisible();
  await expect(approval.getByRole('button', { name: 'Confirmar aprobación' })).toHaveCount(0);
  await expect(approval.getByRole('link', { name: 'Gestionar grupos' })).toHaveAttribute(
    'href',
    '/grupos',
  );
});
