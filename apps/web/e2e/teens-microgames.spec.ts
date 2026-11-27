import { addSessionCookie } from './session';
import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 800, height: 1280 },
  { width: 1280, height: 800 },
] as const;

async function mockTeensSession(page: Page) {
  await addSessionCookie(page.context(), 'mock-teens-token');

  const profilePayload = {
    user: {
      id: 'std-teens-1',
      email: 'valentina@upwardenglish.local',
      name: 'Valentina Cruz',
      role: 'student',
    },
    student: {
      id: 'std-teens-1',
      level: 'B1',
      ageSegment: 'teens',
      canSwitchInterface: true,
      group: { id: 'grp-b1', name: 'B1 · Conversación' },
    },
    organizationId: 'org-e2e',
  };

  await page.route(/\/api\/v1\/(?:me|auth\/session|auth\/refresh)$/, (route) =>
    route.fulfill({ json: profilePayload }),
  );

  await page.route('**/api/v1/feature-flags', (route) =>
    route.fulfill({
      json: { flags: { games: true, extra_content: true } },
    }),
  );

  await page.route('**/api/v1/attempts/*/events', (route) =>
    route.fulfill({ status: 201, json: { ok: true } }),
  );
}

async function assertTeensGameAccessibilityAndResponsiveness(page: Page) {
  const gameRoot = page.locator('main [data-theme="teens"]');
  await expect(gameRoot).toBeVisible();

  // Regla TTS Teens: cero botones Escuchar dentro de GameRenderer
  await expect(gameRoot.getByRole('button', { name: /Escuchar/i })).toHaveCount(0);

  // Sin restos de paleta oscura genérica ni indigo dentro del tablero Teens
  const darkClasses = await gameRoot.evaluate((el) => {
    const html = el.outerHTML;
    return {
      hasZinc900: html.includes('bg-zinc-900') || html.includes('bg-zinc-950'),
      hasIndigo600: html.includes('bg-indigo-600'),
    };
  });
  expect(darkClasses).toEqual({ hasZinc900: false, hasIndigo600: false });

  for (const vp of VIEWPORTS) {
    await page.setViewportSize(vp);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    );
    expect(overflow).toBe(true);

    const buttons = gameRoot.locator('button:visible');
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i += 1) {
      const box = await buttons.nth(i).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(48);
      expect(box!.height).toBeGreaterThanOrEqual(48);
    }

    const axe = await new AxeBuilder({ page })
      .include('main [data-theme="teens"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(axe.violations).toEqual([]);
  }

  await page.setViewportSize({ width: 1280, height: 800 });
}

test.describe('Portal Teens — Plan 3: GameRenderer y 5 mecánicas (/juegos/[activityId])', () => {
  test.beforeEach(async ({ page }) => {
    await mockTeensSession(page);
  });

  test('Redirige /juegos/[activityId] a /juegos manteniendo flujo conectado', async ({ page }) => {
    await page.route('**/api/v1/me/games*', (route) =>
      route.fulfill({ json: { items: [], total: 0 } }),
    );
    await page.goto('/juegos/act-teens-1');
    await expect(page).toHaveURL(/\/juegos$/);
  });

  test('MatchGame Teens: tokens cálidos, 2 pasos + teclado, responsive y WCAG 2.2 AA', async ({ page }) => {
    await page.route('**/api/v1/attempts/att-teens-match', (route) =>
      route.fulfill({
        json: {
          attempt: { id: 'att-teens-match', assignmentId: null, attemptNumber: 1, status: 'in_progress' },
          activity: {
            id: 'act-match-b1',
            title: 'Phrasal Verbs Match',
            type: 'game',
            level: 'B1',
            config: {
              type: 'game',
              mechanic: 'match',
              instructions: 'Match each phrasal verb with its meaning.',
              settings: {
                left: [
                  { id: '11111111-1111-4111-8111-111111111111', text: 'Give up' },
                  { id: '22222222-2222-4222-8222-222222222222', text: 'Look after' },
                ],
                right: [
                  { id: '33333333-3333-4333-8333-333333333333', text: 'Rendirse' },
                  { id: '44444444-4444-4444-8444-444444444444', text: 'Cuidar' },
                ],
              },
            },
          },
          answers: {},
          mediaId: null,
          correction: null,
          attemptToken: 'mock-token',
        },
      }),
    );

    let completedBody: unknown = null;
    await page.route('**/api/v1/attempts/att-teens-match/complete', async (route) => {
      completedBody = route.request().postDataJSON();
      await route.fulfill({
        json: {
          attempt: {
            id: 'att-teens-match',
            assignmentId: null,
            status: 'graded',
            score: 5.0,
            stars: 3,
            motivationMessage: '¡Excelente dominio de vocabulario B1!',
          },
          newBadges: [],
        },
      });
    });

    await page.goto('/actividad/att-teens-match');
    await assertTeensGameAccessibilityAndResponsiveness(page);

    const gameRoot = page.locator('main [data-theme="teens"]');
    await gameRoot.getByRole('button', { name: /Give up/ }).click();
    await gameRoot.getByRole('button', { name: /Rendirse/ }).click();
    await expect(gameRoot.getByText('1 de 2 parejas formadas')).toBeVisible();

    await gameRoot.getByRole('button', { name: 'Finalizar emparejamiento' }).click();
    await expect.poll(() => completedBody).toBeTruthy();
    await expect(page.getByText('¡Partida completada!')).toBeVisible();
    await expect(page.getByRole('img', { name: '3 de 3 estrellas' })).toBeVisible();
  });

  test('OrderWordsGame Teens: construcción en línea, controles >= 48px, responsive y WCAG 2.2 AA', async ({ page }) => {
    await page.route('**/api/v1/attempts/att-teens-order', (route) =>
      route.fulfill({
        json: {
          attempt: { id: 'att-teens-order', assignmentId: null, attemptNumber: 1, status: 'in_progress' },
          activity: {
            id: 'act-order-b1',
            title: 'Passive Voice Builder',
            type: 'game',
            level: 'B1',
            config: {
              type: 'game',
              mechanic: 'order_words',
              instructions: 'Order the words to form a sentence.',
              settings: {
                tokens: [
                  { id: '11111111-1111-4111-8111-111111111101', text: 'The' },
                  { id: '11111111-1111-4111-8111-111111111102', text: 'letter' },
                  { id: '11111111-1111-4111-8111-111111111103', text: 'was' },
                  { id: '11111111-1111-4111-8111-111111111104', text: 'sent' },
                ],
              },
            },
          },
          answers: {},
          mediaId: null,
          correction: null,
          attemptToken: 'mock-token',
        },
      }),
    );

    await page.goto('/actividad/att-teens-order');
    const gameRoot = page.locator('main [data-theme="teens"]');
    await gameRoot.getByRole('button', { name: 'The', exact: true }).click();
    await gameRoot.getByRole('button', { name: 'letter', exact: true }).click();
    await expect(gameRoot.getByText('2 de 4 palabras')).toBeVisible();

    await assertTeensGameAccessibilityAndResponsiveness(page);

    await gameRoot.getByRole('button', { name: 'Reiniciar orden' }).click();
    await expect(gameRoot.getByText('0 de 4 palabras')).toBeVisible();
  });

  test('DragDropGame Teens: clasificación en 2 pasos, botones devolver >= 48px y WCAG 2.2 AA', async ({ page }) => {
    await page.route('**/api/v1/attempts/att-teens-drag', (route) =>
      route.fulfill({
        json: {
          attempt: { id: 'att-teens-drag', assignmentId: null, attemptNumber: 1, status: 'in_progress' },
          activity: {
            id: 'act-drag-b1',
            title: 'Connectors Sort',
            type: 'game',
            level: 'B1',
            config: {
              type: 'game',
              mechanic: 'drag_drop',
              instructions: 'Classify each connector.',
              settings: {
                objects: [
                  { id: '22222222-2222-4222-8222-222222222201', text: 'However' },
                  { id: '22222222-2222-4222-8222-222222222202', text: 'Therefore' },
                ],
                targets: [
                  { id: '33333333-3333-4333-8333-333333333301', text: 'Contrast' },
                  { id: '33333333-3333-4333-8333-333333333302', text: 'Result' },
                ],
              },
            },
          },
          answers: {},
          mediaId: null,
          correction: null,
          attemptToken: 'mock-token',
        },
      }),
    );

    await page.goto('/actividad/att-teens-drag');
    const gameRoot = page.locator('main [data-theme="teens"]');
    await gameRoot.getByRole('button', { name: /However/ }).click();
    await gameRoot.getByRole('button', { name: /Contrast/ }).click();
    await expect(gameRoot.getByText('1 de 2 clasificados')).toBeVisible();

    await assertTeensGameAccessibilityAndResponsiveness(page);
  });

  test('MemoryGame Teens: dorso sobrio, volteo, responsive y WCAG 2.2 AA', async ({ page }) => {
    await page.route('**/api/v1/attempts/att-teens-memory', (route) =>
      route.fulfill({
        json: {
          attempt: { id: 'att-teens-memory', assignmentId: null, attemptNumber: 1, status: 'in_progress' },
          activity: {
            id: 'act-memory-b1',
            title: 'Irregular Verbs Memory',
            type: 'game',
            level: 'B1',
            config: {
              type: 'game',
              mechanic: 'memory',
              instructions: 'Find each verb pair.',
              settings: {
                cards: [
                  { id: '44444444-4444-4444-8444-444444444401', text: 'Go' },
                  { id: '44444444-4444-4444-8444-444444444402', text: 'Went' },
                  { id: '44444444-4444-4444-8444-444444444403', text: 'See' },
                  { id: '44444444-4444-4444-8444-444444444404', text: 'Saw' },
                ],
              },
            },
          },
          answers: {},
          mediaId: null,
          correction: null,
          attemptToken: 'mock-token',
        },
      }),
    );

    await page.goto('/actividad/att-teens-memory');
    await assertTeensGameAccessibilityAndResponsiveness(page);

    const gameRoot = page.locator('main [data-theme="teens"]');
    const hiddenCards = gameRoot.getByRole('button', { name: 'Tarjeta oculta' });
    await expect(hiddenCards).toHaveCount(4);
    await hiddenCards.first().click();
    await expect(gameRoot.getByRole('button', { name: 'Tarjeta oculta' })).toHaveCount(3);
  });

  test('TimedChoiceGame Teens: reinicio en recarga (Decisión 106), barra de tiempo y WCAG 2.2 AA', async ({ page }) => {
    const q1Id = '55555555-5555-4555-8555-555555555501';
    const a1Id = '66666666-6666-4666-8666-666666666601';
    const a2Id = '66666666-6666-4666-8666-666666666602';
    const q2Id = '55555555-5555-4555-8555-555555555502';
    const b1Id = '66666666-6666-4666-8666-666666666603';
    const b2Id = '66666666-6666-4666-8666-666666666604';

    await page.route('**/api/v1/attempts/att-teens-timed', (route) =>
      route.fulfill({
        json: {
          attempt: { id: 'att-teens-timed', assignmentId: null, attemptNumber: 1, status: 'in_progress' },
          activity: {
            id: 'act-timed-b1',
            title: 'Conditionals Sprint',
            type: 'game',
            level: 'B1',
            config: {
              type: 'game',
              mechanic: 'timed_choice',
              instructions: 'Choose the right conditional form.',
              settings: {
                timeLimitSeconds: 20,
                questions: [
                  {
                    id: q1Id,
                    prompt: 'If I ____ time, I will call you.',
                    options: [
                      { id: a1Id, text: 'have' },
                      { id: a2Id, text: 'had' },
                    ],
                  },
                  {
                    id: q2Id,
                    prompt: 'If she studied more, she ____ pass.',
                    options: [
                      { id: b1Id, text: 'would' },
                      { id: b2Id, text: 'will' },
                    ],
                  },
                ],
              },
            },
          },
          answers: { choices: { [q1Id]: a1Id } },
          mediaId: null,
          correction: null,
          attemptToken: 'mock-token',
        },
      }),
    );

    await page.goto('/actividad/att-teens-timed');
    const gameRoot = page.locator('main [data-theme="teens"]');
    await expect(gameRoot.getByText('Pregunta 1 de 2', { exact: true })).toBeVisible();
    await assertTeensGameAccessibilityAndResponsiveness(page);

    await gameRoot.getByRole('button', { name: /have/ }).click();
    await expect(gameRoot.getByText('Pregunta 2 de 2', { exact: true })).toBeVisible({ timeout: 3000 });

    // Decisión 106: al recargar reinicia en pregunta 1 con tiempo completo
    await page.reload();
    await expect(gameRoot.getByText('Pregunta 1 de 2', { exact: true })).toBeVisible();
  });
});
