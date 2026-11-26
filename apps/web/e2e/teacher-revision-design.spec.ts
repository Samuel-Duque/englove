import { addSessionCookie } from './session';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

function createPendingSpeakingItem(overrides?: {
  attemptId?: string;
  dueAt?: string;
  mediaStatus?: 'ready' | 'deleted';
}) {
  return {
    student: {
      id: 'std-design-1',
      displayName: 'Mateo Gómez',
      ageSegment: 'kids',
    },
    group: {
      id: 'grp-design-1',
      name: 'Grupo A1 Mañana',
    },
    activity: {
      id: 'act-design-spk',
      title: 'Speaking: My Daily Routine',
      type: 'speaking',
    },
    assignment: {
      id: 'asg-design-1',
      dueAt: overrides?.dueAt ?? '2026-10-01T18:00:00.000Z',
      cancelledAt: null,
    },
    attempt: {
      attemptId: overrides?.attemptId ?? 'att-design-1',
      attemptNumber: 1,
      status: 'pending_review',
      score: null,
      stars: 0,
      finishedAt: '2026-10-01T12:00:00.000Z',
      gradedAt: null,
      retryGrantedAt: null,
      retryExtendUntil: null,
      effectiveDueAt: overrides?.dueAt ?? '2026-10-01T18:00:00.000Z',
      canGrantRetry: true,
    },
    review: null,
    mediaAsset: {
      id: 'asset-design-1',
      status: overrides?.mediaStatus ?? 'ready',
      durationSeconds: 42,
      isConverted: true,
      retentionUntil: '2026-12-01T18:00:00.000Z',
    },
  };
}

function createGradedItem() {
  return {
    student: {
      id: 'std-design-2',
      displayName: 'Valeria Torres',
      ageSegment: 'teens',
    },
    group: {
      id: 'grp-design-1',
      name: 'Grupo A1 Mañana',
    },
    activity: {
      id: 'act-design-fb',
      title: 'Past Simple Fill in the Blanks',
      type: 'fill_blank',
    },
    assignment: {
      id: 'asg-design-2',
      dueAt: '2026-12-10T18:00:00.000Z',
      cancelledAt: null,
    },
    attempt: {
      attemptId: 'att-design-graded',
      attemptNumber: 1,
      status: 'graded',
      score: 4.5,
      stars: 3,
      finishedAt: '2026-11-20T14:00:00.000Z',
      gradedAt: '2026-11-20T14:00:00.000Z',
      retryGrantedAt: null,
      retryExtendUntil: null,
      effectiveDueAt: '2026-12-10T18:00:00.000Z',
      canGrantRetry: true,
    },
    review: {
      id: 'rev-design-1',
      comment: 'Buen dominio de verbos regulares.',
      stickers: ['great_job', 'grammar_star'],
      reviewerId: 'tch-design-1',
      createdAt: '2026-11-20T15:00:00.000Z',
      updatedAt: '2026-11-20T15:00:00.000Z',
    },
    mediaAsset: null,
  };
}

test.beforeEach(async ({ context, page }) => {
  const token = `header.${Buffer.from(JSON.stringify({ role: 'teacher' })).toString('base64url')}.signature`;
  await addSessionCookie(context, token);

  await page.route('**/api/v1/auth/session', (route) =>
    route.fulfill({
      json: {
        user: {
          id: 'tch-design-1',
          name: 'Clara Gómez',
          email: 'teacher@example.test',
          role: 'teacher',
        },
        organizationId: 'org-design',
      },
    }),
  );

  await page.route('**/api/v1/groups?*', (route) =>
    route.fulfill({
      json: {
        items: [{ id: 'grp-design-1', name: 'Grupo A1 Mañana', activeStudentCount: 8 }],
        total: 1,
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
  test(`Revisión docente: layout responsivo y accesibilidad WCAG 2.2 AA a ${width} × ${height}`, async ({
    page,
  }) => {
    const pendingItem = createPendingSpeakingItem();
    const gradedItem = createGradedItem();

    await page.route('**/api/v1/reviews/queue*', (route) =>
      route.fulfill({ json: { items: [pendingItem], total: 1, offset: 0, limit: 20 } }),
    );
    await page.route('**/api/v1/reviews/graded*', (route) =>
      route.fulfill({ json: { items: [gradedItem], total: 1, offset: 0, limit: 20 } }),
    );
    await page.route('**/api/v1/attempts/att-design-1/review-detail', (route) =>
      route.fulfill({
        json: {
          ...pendingItem,
          items: [
            {
              id: 'spk-item-1',
              prompt: 'Describe your daily routine in English.',
              rubricText: 'Pronunciación clara y uso de presente simple.',
              maxDurationSeconds: 120,
            },
          ],
          answers: { audioAssetId: 'asset-design-1' },
          attemptHistory: [],
        },
      }),
    );
    await page.route('**/api/v1/media/asset-design-1/url', (route) =>
      route.fulfill({
        json: {
          url: 'https://example.com/audio.mp4',
          expiresAt: '2026-12-01T00:00:00.000Z',
          format: 'converted',
          compatibilityWarning: false,
          durationSeconds: 42,
        },
      }),
    );

    await page.setViewportSize({ width, height });
    await page.goto('/revision');

    const main = page.getByRole('main');
    await expect(
      main.getByRole('heading', { level: 1, name: 'Revisión y Retroalimentación' }),
    ).toBeVisible();

    if (width < 1024) {
      const menu = page.getByRole('button', { name: 'Menú docente' });
      await expect(menu).toHaveAttribute('aria-expanded', 'false');
      await menu.press('Enter');
      await expect(menu).toHaveAttribute('aria-expanded', 'true');
    }

    await expect(
      page
        .getByRole('navigation', { name: 'Navegación docente' })
        .getByRole('link', { name: 'Revisión', exact: true }),
    ).toHaveAttribute('aria-current', 'page');

    if (width < 1024) {
      await page.getByRole('button', { name: 'Menú docente' }).press('Enter');
    }

    const listBtn = main.getByRole('button', { name: /Lista de entregas/i });
    const inspectorBtn = main.getByRole('button', { name: 'Inspector', exact: true });

    if (width < 1024) {
      await expect(listBtn).toBeVisible();
      await expect(inspectorBtn).toBeVisible();
      await main.getByRole('button', { name: /Speaking: My Daily Routine/i }).click();
      await expect(inspectorBtn).toHaveAttribute('aria-pressed', 'true');
    } else {
      await expect(listBtn).toBeHidden();
    }

    await expect(main.getByText('Grabación de Speaking')).toBeVisible();
    await expect(main.getByText(/Duración: 00:42 \/ 02:00/)).toBeVisible();
    await expect(main.getByText(/Retención en la nube: disponible hasta 30 días/)).toBeVisible();

    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(width);

    expect(
      (await new AxeBuilder({ page }).withTags(wcagTags).analyze()).violations,
    ).toEqual([]);
  });
}

test('Revisión docente: Speaking fallback, audio borrado, límite 3 stickers, inmutabilidad, retry vencido y refresco', async ({
  page,
}) => {
  const pendingSpeakingFallback = createPendingSpeakingItem({
    attemptId: 'att-fallback',
    dueAt: '2025-01-01T18:00:00.000Z',
    mediaStatus: 'ready',
  });
  const pendingSpeakingDeleted = {
    ...createPendingSpeakingItem({
      attemptId: 'att-deleted',
      dueAt: '2026-12-20T18:00:00.000Z',
      mediaStatus: 'deleted',
    }),
    student: {
      id: 'std-design-3',
      displayName: 'Sofía Ramírez',
      ageSegment: 'kids',
    },
    activity: {
      id: 'act-design-spk-2',
      title: 'Speaking: My Favorite Animal',
      type: 'speaking',
    },
  };
  const gradedItem = createGradedItem();

  let queueCalls = 0;
  await page.route('**/api/v1/reviews/queue*', (route) => {
    queueCalls += 1;
    return route.fulfill({
      json: {
        items: [pendingSpeakingFallback, pendingSpeakingDeleted],
        total: 2,
        offset: 0,
        limit: 20,
      },
    });
  });
  await page.route('**/api/v1/reviews/graded*', (route) =>
    route.fulfill({ json: { items: [gradedItem], total: 1, offset: 0, limit: 20 } }),
  );
  await page.route('**/api/v1/attempts/att-fallback/review-detail', (route) =>
    route.fulfill({
      json: {
        ...pendingSpeakingFallback,
        items: [
          {
            id: 'spk-1',
            prompt: 'Tell us about your weekend.',
            rubricText: 'Claridad y vocabulario.',
            maxDurationSeconds: 120,
          },
        ],
        answers: { audioAssetId: 'asset-design-1' },
        attemptHistory: [],
      },
    }),
  );
  await page.route('**/api/v1/attempts/att-deleted/review-detail', (route) =>
    route.fulfill({
      json: {
        ...pendingSpeakingDeleted,
        items: [{ id: 'spk-2', prompt: 'Describe your pet.', maxDurationSeconds: 120 }],
        answers: {},
        attemptHistory: [],
      },
    }),
  );
  await page.route('**/api/v1/attempts/att-design-graded/review-detail', (route) =>
    route.fulfill({
      json: {
        ...gradedItem,
        items: [
          {
            id: 'fb-1',
            prompt: 'Yesterday I ___ (walk) to school.',
            correctAnswer: 'walked',
          },
        ],
        answers: { 'fb-1': 'walked' },
        attemptHistory: [],
      },
    }),
  );
  await page.route('**/api/v1/media/asset-design-1/url', (route) =>
    route.fulfill({
      json: {
        url: 'https://example.com/raw-audio.webm',
        expiresAt: '2026-12-01T00:00:00.000Z',
        format: 'raw',
        compatibilityWarning: true,
        durationSeconds: 18,
      },
    }),
  );

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/revision');

  // Fallback compatibilityWarning visible en el primer intento
  await expect(
    page.getByText(/El audio original no pudo convertirse a MP4 estándar/),
  ).toBeVisible();

  // Selector de hasta 3 stickers con aria-pressed y aviso en vivo al elegir el 4.º
  await expect(page.getByText('Seleccionados: 0 / 3')).toBeVisible();
  const s1 = page.getByRole('button', { name: /¡Excelente trabajo!/i });
  const s2 = page.getByRole('button', { name: /¡Muy buena pronunciación!/i });
  const s3 = page.getByRole('button', { name: /¡Respuesta muy creativa!/i });
  const s4 = page.getByRole('button', { name: /¡Estrella de la gramática!/i });
  await s1.click();
  await s2.click();
  await s3.click();
  await expect(s1).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Seleccionados: 3 / 3')).toBeVisible();
  await s4.click();
  await expect(page.getByText('Puedes seleccionar hasta 3 stickers por revisión.')).toBeVisible();
  await expect(s4).toHaveAttribute('aria-pressed', 'false');
  await s2.click();
  await expect(page.getByText('Seleccionados: 2 / 3')).toBeVisible();

  // Toggle nuevo intento en asignación vencida muestra alerta viva y desaparece al poner fecha
  const retrySwitch = page.getByRole('switch', {
    name: 'Permitir nuevo intento al estudiante',
  });
  await retrySwitch.click({ force: true });
  await expect(
    page.getByText(/La asignación ya cerró\. Si no defines una nueva fecha límite/),
  ).toBeVisible();
  await page.locator('input#extend-date').fill('2026-12-15T18:00');
  await expect(
    page.getByText(/La asignación ya cerró\. Si no defines una nueva fecha límite/),
  ).toBeHidden();

  // Segundo intento con audio eliminado tras 30 días
  await page.getByRole('button', { name: /Speaking: My Favorite Animal/i }).click();
  await expect(
    page.getByText(/El audio cumplió los 30 días de retención tras la calificación/),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Descargar audio' })).toBeDisabled();

  // Refresco manual
  const callsBefore = queueCalls;
  await page.getByRole('button', { name: 'Refrescar' }).click();
  await expect.poll(() => queueCalls).toBeGreaterThan(callsBefore);
  await expect(page.getByText(/Actualizado .* · cada 30 s/)).toBeVisible();

  // Pestaña Calificados: nota inmutable + respuesta modelo
  await page.getByRole('tab', { name: /Calificados/i }).click();
  await expect(page.getByText('🔒 Calificación inmutable:')).toBeVisible();
  await expect(page.getByText('4,5 / 5,0').first()).toBeVisible();
  await expect(page.locator('input#score-input')).toHaveCount(0);
  await expect(page.getByText('Respuesta modelo / correcta:')).toBeVisible();
});

test('Revisión docente: muestra estado vacío y error recuperable sin romper la página', async ({
  page,
}) => {
  let failQueue = true;
  await page.route('**/api/v1/reviews/queue*', (route) =>
    failQueue
      ? route.fulfill({ status: 503, json: { message: 'Servicio temporalmente no disponible' } })
      : route.fulfill({ json: { items: [], total: 0, offset: 0, limit: 20 } }),
  );
  await page.route('**/api/v1/reviews/graded*', (route) =>
    route.fulfill({ json: { items: [], total: 0, offset: 0, limit: 20 } }),
  );

  await page.goto('/revision');
  await expect(page.getByText('No pudimos cargar las entregas de revisión.')).toBeVisible();

  failQueue = false;
  await page.getByRole('button', { name: 'Reintentar' }).click();
  await expect(page.getByRole('heading', { name: 'No hay entregas pendientes' })).toBeVisible();
});
