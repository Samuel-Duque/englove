import { expect, test } from '@playwright/test';

const group = {
  id: 'origami-a1',
  name: 'Grupo inicial con un nombre largo para comprobar el espacio de trabajo',
  level: 'A1',
  activeStudentCount: 2,
  archivedAt: null,
};

test.beforeEach(async ({ context, page }) => {
  await context.addCookies(
    ['upward_english_local_access_token', 'upward_english_access_token'].map(
      (name) => ({
        name,
        value: 'mock-teacher-token',
        domain: 'localhost',
        path: '/',
      }),
    ),
  );
  await page.route('**/api/v1/auth/refresh', (route) =>
    route.fulfill({
      json: {
        user: {
          id: 'teacher-origami',
          name: 'Profesora Clara',
          role: 'teacher',
        },
        organizationId: 'org-origami',
      },
    }),
  );
  await page.route('**/api/v1/groups?*', (route) =>
    route.fulfill({ json: { items: [group], total: 1 } }),
  );
});

test('RF-7: grupos refluye en fichas con etiquetas y conserva la confirmación', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.goto('/grupos');

  const heading = page.getByRole('heading', { name: group.name });
  await expect(heading).toBeVisible();
  const groupRow = page.getByRole('row').filter({ has: heading });
  await expect(
    groupRow.getByText('Alumnos vigentes', { exact: true }),
  ).toBeVisible();
  await expect(groupRow.getByText('2 alumnos')).toBeVisible();
  await expect(heading).toHaveCSS('font-family', /Nunito/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );

  const archive = groupRow.getByRole('button', { name: 'Archivar' });
  await archive.focus();
  await archive.press('Enter');
  await expect(
    page.getByRole('alert').filter({ hasText: 'tiene 2 alumno(s) activo(s)' }),
  ).toBeVisible();

  const remove = groupRow.getByRole('button', { name: 'Eliminar' });
  await remove.focus();
  await remove.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Eliminar grupo' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(remove).toBeFocused();
});

test('RF-7: la tabla de estadísticas conserva encabezados y desplazamiento local', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.route('**/api/v1/stats/overview*', (route) =>
    route.fulfill({
      json: {
        period: {
          from: '2026-10-01T00:00:00.000Z',
          to: '2026-11-01T00:00:00.000Z',
        },
        organizationSummary: {
          totalApprovedStudents: 2,
          activeStudentsInPeriod: 2,
          averageScore: 4.2,
          completionRatePercent: 85,
          totalTimeSpentSeconds: 12000,
          inactiveAlertsCount: 0,
        },
        byLevel: [
          {
            level: 'A1',
            assignedCount: 20,
            completedAssignedCount: 17,
            completionRatePercent: 85,
            averageScore: 4.2,
            timeSpentSeconds: 12000,
          },
        ],
        byGroup: [],
        inactiveAlerts: [],
      },
    }),
  );
  await page.goto('/estadisticas');
  const region = page.getByRole('region', { name: 'Desempeño por nivel' });
  await expect(region.getByRole('table')).toBeVisible();
  await expect(
    region.getByRole('columnheader', { name: 'Nivel', exact: true }),
  ).toBeVisible();
  await region.focus();
  await expect(region).toBeFocused();
  expect(
    await region.evaluate(
      (element) => element.scrollWidth > element.clientWidth,
    ),
  ).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );
});
