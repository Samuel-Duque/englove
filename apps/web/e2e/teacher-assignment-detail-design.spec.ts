import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

const baseAssignment = {
  id: 'asg-plan07-1',
  activity: {
    id: 'act-plan07-1',
    title: 'Daily Routines Speaking',
    type: 'speaking',
    level: 'A2',
    version: 2,
    status: 'published',
  },
  group: {
    id: 'grp-plan07-1',
    name: 'Kids Explorers A2',
    archivedAt: null,
  },
  opensAt: '2026-11-10T13:00:00Z',
  dueAt: '2026-11-30T23:00:00Z',
  cancelledAt: null,
  historicalStudentCount: null,
  availability: 'open',
  totalAttempts: 3,
  submittedAttempts: 2,
};

const mockMembers = {
  items: [
    {
      id: 'stu-1',
      name: 'Lucas Díaz',
      email: 'lucas@example.test',
      level: 'A2',
      ageSegment: 'kids',
      approvalStatus: 'approved',
      groupId: 'grp-plan07-1',
    },
    {
      id: 'stu-2',
      name: 'Sofía Gómez',
      email: 'sofia@example.test',
      level: 'A2',
      ageSegment: 'kids',
      approvalStatus: 'approved',
      groupId: 'grp-plan07-1',
    },
    {
      id: 'stu-3',
      name: 'Mateo Ruiz',
      email: 'mateo@example.test',
      level: 'A2',
      ageSegment: 'kids',
      approvalStatus: 'approved',
      groupId: 'grp-plan07-1',
    },
  ],
  total: 3,
};

const mockQueue = {
  items: [
    {
      student: { id: 'stu-2', displayName: 'Sofía Gómez', ageSegment: 'kids' },
      group: { id: 'grp-plan07-1', name: 'Kids Explorers A2' },
      activity: { id: 'act-plan07-1', title: 'Daily Routines Speaking', type: 'speaking' },
      assignment: { id: 'asg-plan07-1', dueAt: '2026-11-30T23:00:00Z', cancelledAt: null },
      attempt: {
        attemptId: 'att-2',
        attemptNumber: 1,
        status: 'pending_review',
        score: null,
        stars: 0,
        finishedAt: '2026-11-20T16:30:00Z',
        gradedAt: null,
      },
      review: null,
      mediaAsset: null,
    },
  ],
  total: 1,
};

const mockGraded = {
  items: [
    {
      student: { id: 'stu-1', displayName: 'Lucas Díaz', ageSegment: 'kids' },
      group: { id: 'grp-plan07-1', name: 'Kids Explorers A2' },
      activity: { id: 'act-plan07-1', title: 'Daily Routines Speaking', type: 'speaking' },
      assignment: { id: 'asg-plan07-1', dueAt: '2026-11-30T23:00:00Z', cancelledAt: null },
      attempt: {
        attemptId: 'att-1',
        attemptNumber: 1,
        status: 'graded',
        score: 4.5,
        stars: 3,
        finishedAt: '2026-11-18T14:15:00Z',
        gradedAt: '2026-11-19T15:00:00Z',
      },
      review: { id: 'rev-1', comment: 'Great fluency!', stickers: ['great_job'] },
      mediaAsset: null,
    },
  ],
  total: 1,
};

test.beforeEach(async ({ context, page }) => {
  const token = `header.${Buffer.from(JSON.stringify({ role: 'teacher' })).toString('base64url')}.signature`;
  await context.addCookies([
    { name: `${process.env.COOKIE_PREFIX ?? 'englove_local_'}access_token`, value: token, domain: 'localhost', path: '/' },
    { name: 'upward_english_local_access_token', value: token, domain: 'localhost', path: '/' },
    { name: 'upward_english_access_token', value: token, domain: 'localhost', path: '/' },
  ]);

  await page.route('**/api/v1/auth/session', (route) =>
    route.fulfill({
      json: {
        user: { id: 'teacher-1', name: 'Clara Gómez', email: 'teacher@example.test', role: 'teacher' },
        organizationId: 'org-1',
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
  test(`Detalle de asignación: layout editorial, enlaces y accesibilidad a ${width} × ${height}`, async ({
    page,
  }) => {
    await page.route('**/api/v1/assignments/asg-plan07-1', (route) =>
      route.fulfill({ json: baseAssignment }),
    );
    await page.route('**/api/v1/groups/grp-plan07-1/members*', (route) =>
      route.fulfill({ json: mockMembers }),
    );
    await page.route('**/api/v1/reviews/queue*', (route) =>
      route.fulfill({ json: mockQueue }),
    );
    await page.route('**/api/v1/reviews/graded*', (route) =>
      route.fulfill({ json: mockGraded }),
    );

    await page.setViewportSize({ width, height });
    await page.goto('/asignaciones/asg-plan07-1');

    const main = page.getByRole('main');
    const heading = main.getByRole('heading', { level: 1, name: 'Daily Routines Speaking' });
    await expect(heading).toBeVisible();
    await expect(heading).toHaveAttribute('lang', 'en');
    await expect(main.getByText('Abierta', { exact: true })).toBeVisible();
    await expect(main.getByText('v2', { exact: true })).toBeVisible();
    await expect(main.getByText('2 / 3', { exact: true })).toBeVisible();
    await expect(main.getByText('Hora de Colombia (America/Bogota)')).toBeVisible();

    await expect(
      main.getByRole('navigation', { name: 'Ubicación de la asignación' }).getByRole('link', { name: 'Asignaciones' }),
    ).toHaveAttribute('href', '/asignaciones');
    await expect(main.getByRole('link', { name: 'Ver ficha del grupo' })).toHaveAttribute(
      'href',
      '/grupos/grp-plan07-1',
    );
    await expect(main.getByRole('link', { name: 'Ver editor de actividad' })).toHaveAttribute(
      'href',
      '/actividades/act-plan07-1',
    );
    await expect(main.getByRole('link', { name: 'Ir a revisión' })).toHaveAttribute(
      'href',
      '/revision',
    );

    await expect(main.getByRole('link', { name: 'Lucas Díaz' })).toHaveAttribute(
      'href',
      '/alumnos/stu-1',
    );
    await expect(main.getByText('4,5 / 5,0')).toBeVisible();
    await expect(main.getByText('Por revisar', { exact: true })).toBeVisible();
    await expect(main.getByText('Sin entregar', { exact: true })).toBeVisible();

    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    expect((await new AxeBuilder({ page }).withTags(wcagTags).analyze()).violations).toEqual([]);
  });
}

test('Detalle de asignación: modal crítico Decisión 98, gestión de foco y cancelación en vivo', async ({
  page,
}) => {
  let cancelled = false;
  await page.route('**/api/v1/assignments/asg-plan07-1', (route) =>
    route.fulfill({
      json: cancelled
        ? {
            ...baseAssignment,
            cancelledAt: '2026-11-25T18:30:00Z',
            availability: 'cancelled',
          }
        : baseAssignment,
    }),
  );
  await page.route('**/api/v1/assignments/asg-plan07-1/cancel', (route) => {
    cancelled = true;
    return route.fulfill({
      json: {
        ...baseAssignment,
        cancelledAt: '2026-11-25T18:30:00Z',
        availability: 'cancelled',
      },
    });
  });
  await page.route('**/api/v1/groups/grp-plan07-1/members*', (route) =>
    route.fulfill({ json: mockMembers }),
  );
  await page.route('**/api/v1/reviews/queue*', (route) =>
    route.fulfill({ json: mockQueue }),
  );
  await page.route('**/api/v1/reviews/graded*', (route) =>
    route.fulfill({ json: mockGraded }),
  );

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/asignaciones/asg-plan07-1');

  const cancelTrigger = page.getByRole('button', { name: 'Cancelar asignación' });
  await expect(cancelTrigger).toBeVisible();
  await cancelTrigger.click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/No borra la asignación/)).toBeVisible();
  await expect(dialog.getByText(/cierre efectivo \+ 24 h/)).toBeVisible();
  await expect(dialog.getByText(/excluye del denominador de cumplimiento/)).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Volver' })).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(cancelTrigger).toBeFocused();

  await cancelTrigger.click();
  await expect(dialog).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(wcagTags).analyze()).violations).toEqual([]);

  await dialog.getByRole('button', { name: 'Cancelar asignación' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Asignación cancelada', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancelar asignación' })).toHaveCount(0);
  await expect(page.getByText('Cancelada', { exact: true })).toBeVisible();
  await expect(page.getByText(/Cancelada el /)).toBeVisible();
  await expect(page.getByText('Excluida', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Lucas Díaz' })).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(wcagTags).analyze()).violations).toEqual([]);
});

test('Detalle de asignación: error 404 muestra alerta editorial y enlace de regreso', async ({
  page,
}) => {
  await page.route('**/api/v1/assignments/asg-missing', (route) =>
    route.fulfill({
      status: 404,
      json: { statusCode: 404, code: 'NOT_FOUND', message: 'Not found' },
    }),
  );

  await page.goto('/asignaciones/asg-missing');
  const alert = page.getByRole('alert');
  await expect(alert).toBeVisible();
  await expect(
    alert.getByText('No encontramos esta asignación o alguno de los recursos seleccionados'),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Volver a asignaciones' })).toHaveAttribute(
    'href',
    '/asignaciones',
  );
  expect((await new AxeBuilder({ page }).withTags(wcagTags).analyze()).violations).toEqual([]);
});
