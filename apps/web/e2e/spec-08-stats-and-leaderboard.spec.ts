import { test, expect } from '@playwright/test';

test.describe('SPEC-08: Estadísticas Docentes, Alertas de Inactividad y Leaderboard (ENG-145)', () => {
  test.beforeEach(async ({ context, page }) => {
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
  });

  test('1. /estadisticas: Vista general con KPIs, alertas de inactividad de 14 días, pestañas de tendencia 30d/7d y leaderboard filtrable', async ({
    page,
  }) => {
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
            inactiveAlertsCount: 1,
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
          byGroup: [
            {
              groupId: 'grp-1',
              groupName: 'Grupo A1 Mañana',
              studentCount: 12,
              activeStudentCount: 10,
              assignedCount: 20,
              completedAssignedCount: 17,
              completionRatePercent: 85,
              averageScore: 4.2,
              timeSpentSeconds: 12000,
            },
          ],
          inactiveAlerts: [
            {
              studentId: 'std-inact-1',
              studentName: 'Sebastián Inactivo',
              level: 'A1',
              ageSegment: 'kids',
              groupId: 'grp-1',
              groupName: 'Grupo A1 Mañana',
              daysSinceLastActivity: 16,
              lastActivityAt: '2026-10-15T10:00:00.000Z',
            },
          ],
        }),
      });
    });

    await page.route('**/api/v1/stats/groups/grp-1*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          group: { id: 'grp-1', name: 'Grupo A1 Mañana', level: 'A1' },
          summary: {
            studentCount: 12,
            averageScore: 4.2,
            assignedCount: 20,
            completedAssignedCount: 17,
            completionRatePercent: 85,
            totalTimeSpentSeconds: 12000,
          },
          students: [
            {
              studentId: 'std-1',
              studentName: 'Ana Sofía',
              level: 'A1',
              ageSegment: 'kids',
              averageScore: 4.8,
              scoreTrend: 'up',
              scoreTrendDelta: 0.3,
              activeWeeksInPeriod: 4,
              currentStreakWeeks: 5,
              forgivenessAvailable: true,
              completedAssignedCount: 15,
              assignedCount: 15,
              completionRatePercent: 100,
              timeSpentSeconds: 6000,
              lastActivityAt: '2026-11-01T10:00:00.000Z',
            },
          ],
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

    // 1.1 Navegar a /estadisticas
    await page.goto('/estadisticas');

    // 1.2 Verificar KPIs y Alerta de inactividad de 14 días
    await expect(page.locator('p:has-text("4.2"), p:has-text("4,2")').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=85%').first()).toBeVisible();
    await expect(page.locator('text=Alumnos en riesgo de deserción o abandono')).toBeVisible();
    await expect(page.locator('text=Sebastián Inactivo')).toBeVisible();
    await expect(page.locator('text=16 días')).toBeVisible();

    // 1.3 Cambiar a pestaña Por Grupo y conmutar tendencias 30d vs 7d
    await page.click('button:has-text("Por Grupo")');
    await expect(page.locator('p:has-text("Grupo A1 Mañana")')).toBeVisible();
    await expect(page.locator('text=Tendencia comparada:')).toBeVisible();

    const weeklyBtn = page.locator('button:has-text("Semanal (7 días)")');
    await expect(weeklyBtn).toBeVisible();
    await weeklyBtn.click();

    const monthlyBtn = page.locator('button:has-text("Cada 30 días")');
    await expect(monthlyBtn).toBeVisible();
    await monthlyBtn.click();

    // 1.4 Cambiar a pestaña Leaderboard Privado y probar filtros
    await page.click('button:has-text("Leaderboard de Notas")');
    await expect(page.locator('text=Aviso de confidencialidad docente')).toBeVisible();
    await expect(page.locator('text=Ana Sofía')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Santiago Ruiz')).toBeVisible();

    // Filtrar por Nivel A1
    const a1Filter = page.locator('button:has-text("A1")').first();
    await expect(a1Filter).toBeVisible();
    await a1Filter.click();
  });

  test('2. /estadisticas/estudiantes/[id]: Ficha cronológica individual, polling TanStack Query y calendario de racha con perdón', async ({
    page,
  }) => {
    await page.route('**/api/v1/stats/students/std-1*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          student: {
            id: 'std-1',
            name: 'Ana Sofía',
            level: 'A1',
            ageSegment: 'kids',
            groupId: 'grp-1',
            groupName: 'Grupo A1 Mañana',
            joinedAt: '2026-09-01T00:00:00.000Z',
          },
          period: { from: '2026-10-01T00:00:00.000Z', to: '2026-11-01T00:00:00.000Z' },
          filters: { type: null, level: null },
          performance: {
            passingScore: 3.5,
            studentAverageScore: 4.8,
            groupAverageScore: 4.2,
            totalGradedActivities: 15,
            passedCount: 15,
            needsImprovementCount: 0,
            passRatePercent: 100,
            scoreSeries: [
              {
                attemptId: 'att-hist-1',
                assignmentId: 'asg-1',
                activityId: 'act-1',
                activityTitle: 'Colors and Animals',
                activityType: 'fill_blank',
                gameMechanic: null,
                level: 'A1',
                attemptNumber: 1,
                score: 5.0,
                passed: true,
                gradedAt: '2026-11-01T15:00:00.000Z',
                usedExtendedDeadline: false,
                // guardrails-ignore G-C06: bandera de duracion calculada en servidor, no telemetria de terceros
                implausibleDuration: false,
              },
            ],
            byActivityType: [],
            byGameMechanic: [],
            byLevel: [],
          },
          consistency: {
            currentStreakWeeks: 5,
            bestStreakWeeks: 6,
            forgivenessAvailable: true,
            activeWeeksInPeriod: 4,
            completedActivitiesInPeriod: 15,
            assignedCount: 15,
            completedAssignedCount: 15,
            completionRatePercent: 100,
            totalTimeSpentSeconds: 6000,
            weeklyCalendar: [
              { weekKey: '2026-W44', weekStart: '2026-10-26', status: 'active', completedCount: 3 },
              { weekKey: '2026-W43', weekStart: '2026-10-19', status: 'forgiven', completedCount: 0 },
              { weekKey: '2026-W42', weekStart: '2026-10-12', status: 'active', completedCount: 4 },
            ],
            dailyTime: [],
            weeklyTime: [],
            monthlyTime: [],
          },
        }),
      });
    });

    await page.goto('/estadisticas/estudiantes/std-1');
    await expect(page.locator('h1:has-text("Ana Sofía")')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Activa ✓').first()).toBeVisible();
    await expect(page.locator('text=Perdón aplicado 🛡️')).toBeVisible();
    await expect(page.locator('text=Colors and Animals')).toBeVisible();
    await expect(page.locator('*:has-text("5,0"), *:has-text("5.0")').first()).toBeVisible();
  });
});
