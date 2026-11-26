import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

const viewports = [
  { width: 1280, height: 800, columns: 3 },
  { width: 800, height: 1280, columns: 2 },
  { width: 390, height: 844, columns: 1 },
  { width: 320, height: 720, columns: 1 },
] as const;

const teensProfile = {
  user: {
    id: 'std-teens-1',
    name: 'Estudiante Teens',
    email: 'teens@example.test',
    role: 'student',
  },
  student: {
    id: 'std-teens-1',
    ageSegment: 'teens',
    level: 'B1',
    canSwitchInterface: true,
    group: { id: 'grp-b1', name: 'Teens B1' },
  },
  organizationId: 'org-teens',
};

const sampleGames = [
  {
    id: 'game-order-1',
    title: 'Clause Order Sprint',
    mechanic: 'order_words',
    level: 'B1',
    expectedDurationSeconds: 180,
    minPlausibleSeconds: 15,
    bestStars: 1,
    lastStars: 1,
    bestScore: 1.8,
    bestMaxScore: 5.0,
    attemptsCount: 1,
    lastPlayedAt: '2026-11-10T10:00:00.000Z',
    status: 'in_progress',
    inProgressAttemptId: 'att-resume-1',
  },
  {
    id: 'game-memory-2',
    title: 'Phrasal Verbs Match-Up',
    mechanic: 'memory',
    level: 'B1',
    expectedDurationSeconds: 180,
    minPlausibleSeconds: 15,
    bestStars: 0,
    lastStars: 0,
    bestScore: null,
    bestMaxScore: 5.0,
    attemptsCount: 0,
    lastPlayedAt: null,
    status: 'not_started',
    inProgressAttemptId: null,
  },
  {
    id: 'game-match-3',
    title: 'Connectors & Meanings',
    mechanic: 'match',
    level: 'B1',
    expectedDurationSeconds: 180,
    minPlausibleSeconds: 15,
    bestStars: 3,
    lastStars: 3,
    bestScore: 4.8,
    bestMaxScore: 5.0,
    attemptsCount: 3,
    lastPlayedAt: '2026-11-12T10:00:00.000Z',
    status: 'completed',
    inProgressAttemptId: null,
  },
];

async function expectTouchTarget(locator: Locator) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(48);
  expect(box?.width).toBeGreaterThanOrEqual(48);
}

async function expectAccessibleMain(page: Page) {
  const result = await new AxeBuilder({ page })
    .include('main')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(result.violations).toEqual([]);
}

test.describe('Portal Teens Plan 2: Zona de Microjuegos (/juegos)', () => {
  test.beforeEach(async ({ page, context, baseURL }) => {
    const prefixes = new Set([
      process.env.COOKIE_PREFIX ?? process.env.NEXT_PUBLIC_COOKIE_PREFIX,
      'englove_local_',
      'upward_english_local_',
      'upward_english_',
    ]);
    await context.addCookies(
      [...prefixes]
        .filter((prefix): prefix is string => Boolean(prefix))
        .map((prefix) => ({
          name: `${prefix}access_token`,
          value: 'mock-teens-token',
          url: baseURL ?? 'http://localhost:3000',
        })),
    );
    await page.route(/\/api\/v1\/(?:me|auth\/session|auth\/refresh)$/, (route) =>
      route.fulfill({ json: teensProfile }),
    );
  });

  test('renderiza diseño Teens responsive (3→2→1 cols), sin TTS ni clases oscuras heredadas, y conecta con /actividad', async ({
    page,
  }) => {
    let gamesEnabled = true;
    let failStart = true;

    await page.route('**/api/v1/feature-flags', (route) =>
      route.fulfill({
        json: { flags: { games: gamesEnabled, extra_content: true } },
      }),
    );

    await page.route('**/api/v1/me/games*', (route) =>
      route.fulfill({
        json: { items: sampleGames, total: sampleGames.length },
      }),
    );

    await page.route('**/api/v1/activities/*/attempts', (route) => {
      if (failStart) {
        failStart = false;
        return route.fulfill({
          status: 503,
          json: {
            statusCode: 503,
            code: 'SERVICE_UNAVAILABLE',
            message: 'Error temporal al iniciar el microjuego.',
          },
        });
      }
      return route.fulfill({
        status: 201,
        json: { attempt: { id: 'att-new-teens-1' } },
      });
    });

    await page.route('**/api/v1/attempts/*', (route) =>
      route.fulfill({
        json: {
          attempt: {
            id: 'att-new-teens-1',
            assignmentId: null,
            attemptNumber: 1,
            previousAttemptId: null,
            status: 'in_progress',
            startedAt: '2026-11-20T10:00:00.000Z',
            finishedAt: null,
            gradedAt: null,
            score: null,
            flags: [],
            effectiveDueAt: null,
            completeUntil: null,
          },
          activity: {
            id: 'game-memory-2',
            title: 'Phrasal Verbs Match-Up',
            type: 'game',
            level: 'B1',
            config: {
              type: 'game',
              mechanic: 'memory',
              instructions: 'Encuentra cada verbo con su significado.',
              settings: {
                pairs: [
                  {
                    id: '11111111-1111-4111-8111-111111111111',
                    front: 'Give up',
                    back: 'Rendirse',
                  },
                ],
              },
            },
          },
          answers: {},
          mediaId: null,
          correction: null,
          attemptToken: 'mock-attempt-token',
        },
      }),
    );

    // Verifica redirección /juegos/[activityId] -> /juegos
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/juegos/game-order-1');
    await expect(page).toHaveURL(/\/juegos$/);

    const main = page.getByRole('main');
    await expect(
      main.getByRole('heading', { name: 'Zona de Microjuegos', level: 1 }),
    ).toBeVisible();

    // Contadores personales en tabular-nums, sin rankings ni botones TTS
    const starsStat = main.getByText('Estrellas de práctica: 4 / 9');
    await expect(starsStat).toBeVisible();
    await expect(starsStat).toHaveCSS('font-variant-numeric', 'tabular-nums');
    await expect(main.getByText('Partidas jugadas: 4')).toBeVisible();
    await expect(
      main.getByRole('button', { name: /escuchar/i }),
    ).toHaveCount(0);
    await expect(main.locator('.bg-zinc-900, .bg-indigo-600')).toHaveCount(0);

    // Estrellas SVG accesibles
    await expect(
      main.getByRole('img', { name: 'Estrellas de práctica: 1 de 3' }),
    ).toBeVisible();
    await expect(
      main.getByRole('img', { name: 'Estrellas de práctica: 3 de 3' }),
    ).toBeVisible();

    // Verifica layout 3 -> 2 -> 1 columnas, cero desborde horizontal y targets >= 48x48
    for (const viewport of viewports) {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      );
      expect(overflow).toBe(false);

      const cards = main.locator('article');
      await expect(cards).toHaveCount(3);
      const firstCardBox = await cards.nth(0).boundingBox();
      const secondCardBox = await cards.nth(1).boundingBox();
      const thirdCardBox = await cards.nth(2).boundingBox();
      expect(firstCardBox).not.toBeNull();
      expect(secondCardBox).not.toBeNull();
      expect(thirdCardBox).not.toBeNull();

      if (viewport.columns === 3) {
        expect(Math.abs((firstCardBox?.y ?? 0) - (secondCardBox?.y ?? 0))).toBeLessThan(4);
        expect(Math.abs((secondCardBox?.y ?? 0) - (thirdCardBox?.y ?? 0))).toBeLessThan(4);
      } else if (viewport.columns === 2) {
        expect(Math.abs((firstCardBox?.y ?? 0) - (secondCardBox?.y ?? 0))).toBeLessThan(4);
        expect((thirdCardBox?.y ?? 0)).toBeGreaterThan((firstCardBox?.y ?? 0) + 100);
      } else {
        expect((secondCardBox?.y ?? 0)).toBeGreaterThan((firstCardBox?.y ?? 0) + 100);
      }

      const controls = main.locator('button, a');
      const count = await controls.count();
      for (let idx = 0; idx < count; idx++) {
        await expectTouchTarget(controls.nth(idx));
      }
    }

    await page.setViewportSize({ width: 1280, height: 800 });
    await expectAccessibleMain(page);

    // Verifica filtros
    const pendingFilter = main.getByRole('button', {
      name: 'Por practicar (2)',
    });
    const completedFilter = main.getByRole('button', { name: 'Jugados (1)' });
    const allFilter = main.getByRole('button', { name: 'Todos (3)' });

    await pendingFilter.click();
    await expect(pendingFilter).toHaveAttribute('aria-pressed', 'true');
    await expect(main.locator('article')).toHaveCount(2);

    await completedFilter.click();
    await expect(completedFilter).toHaveAttribute('aria-pressed', 'true');
    await expect(main.locator('article')).toHaveCount(1);
    await expect(
      main.getByRole('heading', { name: 'Connectors & Meanings' }),
    ).toBeVisible();

    await allFilter.click();
    await expect(main.locator('article')).toHaveCount(3);

    // Verifica enlace Reanudar partida
    const resumeLink = main.getByRole('link', { name: 'Reanudar partida' });
    await expect(resumeLink).toHaveAttribute('href', '/actividad/att-resume-1');

    // Verifica error recuperable al iniciar y cierre de alerta >= 48x48
    const playButton = main.getByRole('button', { name: 'Jugar', exact: true });
    await playButton.click();
    const alert = main.getByRole('alert');
    await expect(alert).toContainText('Error temporal al iniciar el microjuego.');
    const closeAlert = main.getByRole('button', { name: 'Cerrar' });
    await expectTouchTarget(closeAlert);
    await closeAlert.click();
    await expect(alert).toHaveCount(0);

    // Verifica inicio exitoso de microjuego hacia /actividad/:attemptId
    await playButton.click();
    await expect(page).toHaveURL(/\/actividad\/att-new-teens-1$/);

    // Verifica estado flag games: false
    gamesEnabled = false;
    await page.goto('/juegos');
    await expect(
      main.getByRole('heading', { name: 'Microjuegos no disponibles', level: 1 }),
    ).toBeVisible();
    const backHome = main.getByRole('link', { name: 'Volver a inicio' });
    await expect(backHome).toHaveAttribute('href', '/inicio');
    await expectTouchTarget(backHome);
    await expectAccessibleMain(page);
  });
});
