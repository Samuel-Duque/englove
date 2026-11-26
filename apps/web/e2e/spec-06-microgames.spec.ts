import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';

test.describe('SPEC-06: Microjuegos en Navegador Real (ENG-145)', () => {
  test.beforeEach(async ({ page, context, baseURL }) => {
    const prefixes = new Set([
      process.env.COOKIE_PREFIX || process.env.NEXT_PUBLIC_COOKIE_PREFIX,
      'upward_english_',
      'upward_english_local_',
      'englove_local_',
    ]);
    await context.addCookies([...prefixes].filter((prefix) => prefix !== undefined).map((prefix) => ({
      name: `${prefix}access_token`,
      value: 'mock-student-token',
      url: baseURL ?? 'http://localhost:3000',
    })));
    await page.route(/\/api\/v1\/(?:me|auth\/session)$/, (route) => route.fulfill({
      json: {
        user: { id: 'std-e2e-2', email: 'gamer@upwardenglish.local', name: 'Carlos Gamer', role: 'student' },
        student: { id: 'std-e2e-2', level: 'A2', ageSegment: 'kids', canSwitchInterface: false },
        organizationId: 'org-e2e',
      },
    }));
  });

  test('RF-11: Zona /juegos disponible tras flag games, runner de microjuegos interactivo y reinicio con Jugar de nuevo', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperties(window.speechSynthesis, {
        getVoices: { value: () => [{ lang: 'en-US' }] },
        speak: { value: () => undefined },
        cancel: { value: () => undefined },
      });
    });
    // 2. Mockear auth y feature-flags (games: true)
    await page.route('**/api/v1/auth/refresh', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'std-e2e-2',
            email: 'gamer@upwardenglish.local',
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
            email: 'gamer@upwardenglish.local',
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

    let persistedPairs: Record<string, string> = {
      '11111111-1111-4111-8111-111111111111': '33333333-3333-4333-8333-333333333333',
    };
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
          answers: { pairs: persistedPairs },
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
    await expect(page.getByRole('heading', { name: 'Campamento de Microjuegos' })).toBeVisible();
    await expect(page.getByText('Estrellas de práctica: 3 / 3')).toBeVisible();
    await expect(page.getByText('Partidas jugadas: 1')).toBeVisible();
    await expect(page.getByRole('img', { name: 'Estrellas de práctica: 3 de 3' })).toBeVisible();
    const listen = page.getByRole('button', { name: 'Escuchar: Colors Match Challenge' });
    const listenBounds = await listen.boundingBox();
    expect(listenBounds?.width).toBe(48);
    expect(listenBounds?.height).toBe(48);
    await listen.press('Enter');
    const stop = page.getByRole('button', { name: 'Detener: Colors Match Challenge' });
    await expect(stop).toHaveAttribute('aria-pressed', 'true');
    await stop.press('Enter');
    await expect(listen).toHaveAttribute('aria-pressed', 'false');

    // 4. Abrir la actividad de juego pulsando en Reanudar partida o Continuar juego
    await page.locator('a:has-text("Reanudar partida"), a:has-text("Continuar juego")').click();
    await expect(page).toHaveURL(/\/actividad\/att-game-1/);

    // 5. Verificar que GameRenderer renderice los elementos interactivos del microjuego match
    await expect(page.locator('text=Une los colores en español con su traducción.').first()).toBeVisible();
    await expect(page.locator('text=Rojo')).toBeVisible();
    await expect(page.locator('text=Azul')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Red', exact: true })).toBeVisible();
    await expect(page.locator('text=Blue')).toBeVisible();
    // La respuesta ya persistida debe estar visible al reanudar y al recargar.
    await expect(page.getByText('1 de 2 parejas formadas')).toBeVisible();
    await page.reload();
    await expect(page.getByText('1 de 2 parejas formadas')).toBeVisible();
    await page.getByRole('link', { name: 'Juegos', exact: true }).click();
    persistedPairs = { ...persistedPairs, '22222222-2222-4222-8222-222222222222': '44444444-4444-4444-8444-444444444444' };
    await page.locator('a:has-text("Reanudar partida"), a:has-text("Continuar juego")').click();
    await expect(page.getByText('2 de 2 parejas formadas')).toBeVisible();

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
  }) => {
    await page.route('**/api/v1/auth/refresh', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          user: { id: 'std-e2e-nogames', email: 'nogames@upwardenglish.local', name: 'Sin Juegos', role: 'student' },
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
    await expect(page.getByText(/El Campamento de Microjuegos aún no está abierto/)).toBeVisible();
    await expect(page.locator('a:has-text("Volver al inicio")')).toBeVisible();
  });

  test('Campamento Kids distingue un fallo del catálogo de un catálogo vacío', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route('**/api/v1/feature-flags', (route) => route.fulfill({
      json: { flags: { games: true, extra_content: false } },
    }));
    let catalogFails = true;
    await page.route('**/api/v1/me/games', (route) => route.fulfill(catalogFails ? {
      status: 503,
      json: { statusCode: 503, code: 'SERVER_ERROR', message: 'No se pudo cargar el catálogo.' },
    } : { json: { items: [], total: 0 } }));

    await page.goto('/juegos');
    const main = page.getByRole('main');
    const alert = main.getByRole('alert');
    const empty = main.getByText(/Todavía no hay juegos publicados/);
    await expect(alert).toHaveText('No se pudo cargar el catálogo.');
    await expect(empty).toHaveCount(0);
    const close = main.getByRole('button', { name: 'Cerrar', exact: true });
    const bounds = await close.boundingBox();
    expect(bounds?.width).toBeGreaterThanOrEqual(48);
    expect(bounds?.height).toBeGreaterThanOrEqual(48);
    await close.press('Enter');
    await expect(alert).toHaveCount(0);

    catalogFails = false;
    await page.reload();
    await expect(empty).toBeVisible();
    await expect(main.getByText('Estrellas de práctica: 0 / 0')).toBeVisible();
  });

  test('Campamento Kids adapta la rejilla y permite iniciar una partida desde Por practicar', async ({ page }) => {
    await page.route('**/api/v1/feature-flags', (route) => route.fulfill({
      json: { flags: { games: true, extra_content: false } },
    }));
    const catalogGate = Promise.withResolvers<void>();
    await page.route('**/api/v1/me/games', async (route) => {
      await catalogGate.promise;
      await route.fulfill({
        json: {
          total: 3,
          items: [
            { id: 'game-new', title: 'Forest Animals', mechanic: 'match', level: 'A1', status: 'not_started' },
            { id: 'game-resume', title: 'Find the Hidden Word', mechanic: 'order_words', level: 'A2',
              status: 'in_progress', inProgressAttemptId: 'attempt-resume' },
            { id: 'game-complete', title: 'Mountain Memory', mechanic: 'memory', level: 'A1',
              status: 'completed', attemptsCount: 2, bestStars: 2 },
          ],
        },
      });
    });
    await page.route('**/api/v1/activities/game-new/attempts', (route) => route.fulfill({
      status: 201,
      json: { attempt: { id: 'attempt-new' } },
    }));
    await page.route('**/api/v1/attempts/attempt-new', (route) => route.fulfill({
      json: {
        attempt: { id: 'attempt-new', status: 'in_progress' },
        activity: { id: 'game-new', title: 'Forest Animals', type: 'game', level: 'A1',
          config: { type: 'game', mechanic: 'match', instructions: 'Empareja los animales.',
            settings: { left: [], right: [] } } },
        answers: {},
        mediaId: null,
        correction: null,
        attemptToken: 'mock-attempt-token',
      },
    }));

    await page.goto('/juegos');
    const main = page.getByRole('main');
    try {
      await expect(main.getByText('Cargando el Campamento de Microjuegos…')).toBeAttached();
    } finally {
      catalogGate.resolve();
    }
    const cards = main.getByRole('article');
    await expect(cards).toHaveCount(3);

    for (const [width, height, columns] of [[390, 844, 1], [800, 1280, 2], [1280, 800, 3]] as const) {
      await page.setViewportSize({ width, height });
      const boxes = await Promise.all([0, 1, 2].map((index) => cards.nth(index).boundingBox()));
      expect(new Set(boxes.map((box) => box?.x)).size).toBe(columns);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(results.violations).toEqual([]);
    }

    const pending = main.getByRole('button', { name: /^Por practicar/ });
    await pending.press('Enter');
    await expect(pending).toHaveAttribute('aria-pressed', 'true');
    await expect(cards).toHaveCount(2);
    await expect(main.getByText('Estrellas de práctica: 2 / 9')).toBeVisible();
    const play = main.getByRole('button', { name: 'Jugar', exact: true });
    expect((await play.boundingBox())?.height).toBeGreaterThanOrEqual(52);
    const requestPromise = page.waitForRequest('**/api/v1/activities/game-new/attempts');
    await play.click();
    expect((await requestPromise).method()).toBe('POST');
    await expect(page).toHaveURL(/\/actividad\/attempt-new$/);
  });
});
