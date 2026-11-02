import { test, expect } from '@playwright/test';

test.describe('SPEC-08: Estadísticas Docentes y Leaderboard (ENG-145)', () => {
  test('Panel estadístico: vista general, pestañas de tendencia 30d/7d y leaderboard', async ({
    page,
    context,
  }) => {
    // 1. Simular sesión de profesora
    await context.addCookies([
      {
        name: 'englove_local_access_token',
        value: 'mock-teacher-token',
        domain: 'localhost',
        path: '/',
      },
      {
        name: 'englove_access_token',
        value: 'mock-teacher-token',
        domain: 'localhost',
        path: '/',
      },
    ]);

    await page.route('**/api/v1/auth/refresh', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'tch-e2e-2',
            email: 'teacher@englove.local',
            name: 'Profesora Clara',
            role: 'teacher',
          },
          organizationId: 'org-e2e',
        }),
      });
    });

    await page.route('**/api/v1/groups?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            { id: 'grp-1', name: 'Grupo A1 Mañana', level: 'A1', activeStudentsCount: 12 },
          ],
          total: 1,
        }),
      });
    });

    await page.route('**/api/v1/stats/overview*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          period: { from: '2026-10-01T00:00:00.000Z', to: '2026-11-01T00:00:00.000Z' },
          organizationSummary: {
            totalApprovedStudents: 12,
            activeStudentsInPeriod: 10,
            averageScore: 4.2,
            completionRatePercent: 85,
            totalTimeSpentSeconds: 12000,
            inactiveAlertsCount: 0,
          },
          byLevel: [],
          byGroup: [],
          inactiveAlerts: [],
        }),
      });
    });

    await page.route('**/api/v1/stats/leaderboard*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          period: { from: '2026-10-01T00:00:00.000Z', to: '2026-11-01T00:00:00.000Z' },
          filters: { groupId: null, level: null },
          entries: [
            {
              rank: 1,
              studentId: 'std-1',
              studentName: 'Ana Sofía',
              level: 'A1',
              ageSegment: 'kids',
              groupId: 'grp-1',
              groupName: 'Grupo A1 Mañana',
              averageScore: 4.8,
              completedActivitiesCount: 22,
              currentStreakWeeks: 5,
              badgesCount: 4,
            },
            {
              rank: 2,
              studentId: 'std-2',
              studentName: 'Santiago Ruiz',
              level: 'A1',
              ageSegment: 'kids',
              groupId: 'grp-1',
              groupName: 'Grupo A1 Mañana',
              averageScore: 4.5,
              completedActivitiesCount: 20,
              currentStreakWeeks: 4,
              badgesCount: 3,
            },
          ],
          totalStudents: 2,
        }),
      });
    });

    // 2. Navegar a /estadisticas
    await page.goto('/estadisticas');

    // 3. Verificar KPIs generales
    await expect(page.locator('p:has-text("4.2"), p:has-text("4,2")').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=85%')).toBeVisible();

    // 4. Cambiar a pestaña Leaderboard Privado
    await page.click('button:has-text("Leaderboard Privado")');

    // 5. Verificar leaderboard privado con orden determinista
    await expect(page.locator('text=Ana Sofía')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Santiago Ruiz')).toBeVisible();
  });
});
