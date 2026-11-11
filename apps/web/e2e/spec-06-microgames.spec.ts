import { test, expect } from '@playwright/test';

test.describe('SPEC-06: Microjuegos en Navegador Real (ENG-145)', () => {
  test('RF-11: Zona /juegos disponible tras flag games, runner de microjuegos interactivo y reinicio con Jugar de nuevo', async ({
    page,
    context,
  }) => {
    // 1. Simular cookie de sesión
    await context.addCookies([
      {
        name: 'englove_local_access_token',
        value: 'mock-student-token',
        domain: 'localhost',
        path: '/',
      },
      {
        name: 'englove_access_token',
        value: 'mock-student-token',
        domain: 'localhost',
        path: '/',
      },
    ]);

    // 2. Mockear auth y feature-flags (games: true)
    await page.route('**/api/v1/auth/refresh', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'std-e2e-2',
            email: 'gamer@englove.local',
            name: 'Carlos Gamer',
            role: 'student',
          },
          student: {
            id: 'std-e2e-2',
            level: 'A2',
            ageSegment: 'kids',
            canSwitchInterface: false,
            group: { id: 'grp-2', name: 'Kids A2' },
          },
          organizationId: 'org-e2e',
        }),
      });
    });

    await page.route('**/api/v1/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'std-e2e-2',
            name: 'Carlos Gamer',
            email: 'gamer@englove.local',
            role: 'student',
          },
          student: {
            id: 'std-e2e-2',
            level: 'A2',
            ageSegment: 'kids',
            canSwitchInterface: false,
            group: { id: 'grp-2', name: 'Kids A2' },
          },
        }),
      });
    });

    await page.route('**/api/v1/feature-flags', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          flags: {
            games: true,
            extra_content: false,
          },
        }),
      });
    });

    await page.route('**/api/v1/me/games*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: 'act-game-1',
              title: 'Colors Match Challenge',
              mechanic: 'match',
              level: 'A1',
              expectedDurationSeconds: 180,
              minPlausibleSeconds: 15,
              bestStars: 3,
              lastStars: 3,
              bestScore: 5.0,
              bestMaxScore: 5.0,
              attemptsCount: 1,
              lastPlayedAt: '2026-11-01T10:00:00.000Z',
              status: 'in_progress',
              inProgressAttemptId: 'att-game-1',
            },
          ],
          total: 1,
        }),
      });
    });

    await page.route('**/api/v1/me/assignments*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: 'asg-game-1',
              activity: {
                id: 'act-game-1',
                title: 'Colors Match Challenge',
                type: 'game',
                level: 'A1',
                mechanic: 'match',
              },
              opensAt: '2026-10-01T00:00:00.000Z',
              dueAt: '2026-12-01T18:00:00.000Z',
              cancelledAt: null,
              effectiveDueAt: '2026-12-01T18:00:00.000Z',
              latestAttempt: {
                id: 'att-game-1',
                attemptNumber: 1,
                status: 'in_progress',
                score: null,
                startedAt: '2026-11-01T10:00:00.000Z',
                finishedAt: null,
                gradedAt: null,
              },
              canStart: true,
              canContinue: true,
              retryAvailable: false,
            },
          ],
          total: 1,
          offset: 0,
          limit: 20,
        }),
      });
    });

    await page.route('**/api/v1/attempts/att-game-1', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          attempt: {
            id: 'att-game-1',
            assignmentId: 'asg-game-1',
            attemptNumber: 1,
            previousAttemptId: null,
            status: 'in_progress',
            startedAt: '2026-11-01T10:00:00.000Z',
            finishedAt: null,
            gradedAt: null,
            score: null,
            flags: [],
            effectiveDueAt: '2026-12-01T18:00:00.000Z',
            completeUntil: '2026-12-01T18:00:00.000Z',
          },
          activity: {
            id: 'act-game-1',
            title: 'Colors Match Challenge',
            type: 'game',
            level: 'A1',
            config: {
              type: 'game',
              mechanic: 'match',
              instructions: 'Une los colores en español con su traducción.',
              settings: {
                left: [
                  { id: '11111111-1111-4111-8111-111111111111', text: 'Rojo' },
                  { id: '22222222-2222-4222-8222-222222222222', text: 'Azul' },
                ],
                right: [
                  { id: '33333333-3333-4333-8333-333333333333', text: 'Red' },
                  { id: '44444444-4444-4444-8444-444444444444', text: 'Blue' },
                ],
              },
            },
          },
          answers: {},
          mediaId: null,
          correction: null,
          attemptToken: 'mock-attempt-token',
        }),
      });
    });

    // 3. Probar redirección transparente desde /juegos/:activityId hacia /juegos
    await page.goto('/juegos/act-game-1');
    await expect(page).toHaveURL(/\/juegos/);

    // Verificar que la pestaña Juegos cargue y muestre la tarjeta
    await expect(page.locator('text=Colors Match Challenge')).toBeVisible({ timeout: 5000 });

    // 4. Abrir la actividad de juego pulsando en Reanudar partida o Continuar juego
    await page.locator('a:has-text("Reanudar partida"), a:has-text("Continuar juego")').click();
    await expect(page).toHaveURL(/\/actividad\/att-game-1/);

    // 5. Verificar que GameRenderer renderice los elementos interactivos del microjuego match
    await expect(page.locator('text=Une los colores en español con su traducción.').first()).toBeVisible();
    await expect(page.locator('text=Rojo')).toBeVisible();
    await expect(page.locator('text=Azul')).toBeVisible();
    await expect(page.locator('text=Red')).toBeVisible();
    await expect(page.locator('text=Blue')).toBeVisible();

    // 6. Completar partida
    await page.route('**/api/v1/attempts/att-game-1/complete', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          attempt: {
            id: 'att-game-1',
            assignmentId: 'asg-game-1',
            status: 'graded',
            score: 5.0,
          },
          newBadges: [],
        },
      });
    });

    await page.click('button:has-text("Finalizar")');
    await expect(page.locator('*:has-text("¡Partida completada!"), *:has-text("¡Misión completada!")').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('button:has-text("Jugar de nuevo")')).toBeVisible();
  });

  test('RF-11: Zona /juegos cuando feature flag games = false muestra aviso informativo', async ({
    page,
    context,
  }) => {
    await context.addCookies([
      { name: 'englove_access_token', value: 'mock-student-token', domain: 'localhost', path: '/' },
      { name: 'englove_local_access_token', value: 'mock-student-token', domain: 'localhost', path: '/' },
    ]);

    await page.route('**/api/v1/auth/refresh', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          user: { id: 'std-e2e-nogames', email: 'nogames@englove.local', name: 'Sin Juegos', role: 'student' },
          student: { id: 'std-e2e-nogames', level: 'A1', ageSegment: 'kids', canSwitchInterface: false },
          organizationId: 'org-e2e',
        },
      });
    });

    await page.route('**/api/v1/feature-flags', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          flags: { games: false, extra_content: false },
        },
      });
    });

    await page.goto('/juegos');
    await expect(page.locator('text=Microjuegos no disponibles')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=La zona de juegos interactivos no está habilitada')).toBeVisible();
    await expect(page.locator('a:has-text("Volver al inicio")')).toBeVisible();
  });
});
