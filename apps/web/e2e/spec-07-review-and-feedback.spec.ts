import { test, expect } from '@playwright/test';

test.describe('SPEC-07: Revisión Docente y Feedback de Alumno (ENG-094 / ENG-145)', () => {
  test('Flujo docente: cola de revisión con TanStack Query y visualización de feedback', async ({
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
            id: 'tch-e2e-1',
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
          items: [{ id: 'grp-1', name: 'Grupo A1 Mañana', level: 'A1', activeStudentsCount: 5 }],
          total: 1,
        }),
      });
    });

    const mockAttemptItem = {
      student: {
        id: 'std-1',
        displayName: 'Mateo Gómez',
        ageSegment: 'kids',
      },
      group: {
        id: 'grp-1',
        name: 'Grupo A1 Mañana',
      },
      activity: {
        id: 'act-spk-1',
        title: 'Speaking: My Daily Routine',
        type: 'speaking',
      },
      assignment: {
        id: 'asg-spk-1',
        dueAt: '2026-11-02T18:00:00.000Z',
        cancelledAt: null,
      },
      attempt: {
        attemptId: 'att-rev-1',
        attemptNumber: 1,
        status: 'pending_review',
        score: null,
        stars: 0,
        finishedAt: '2026-11-01T12:00:00.000Z',
        gradedAt: null,
        retryGrantedAt: null,
        retryExtendUntil: null,
        effectiveDueAt: '2026-11-02T18:00:00.000Z',
        canGrantRetry: true,
      },
      review: null,
      mediaAsset: {
        id: 'asset-1',
        status: 'ready',
        durationSeconds: 15,
        isConverted: true,
        retentionUntil: '2026-12-01T00:00:00.000Z',
      },
    };

    await page.route('**/api/v1/reviews/queue*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [mockAttemptItem],
          total: 1,
          offset: 0,
          limit: 20,
        }),
      });
    });

    await page.route('**/api/v1/reviews/graded*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [],
          total: 0,
          offset: 0,
          limit: 20,
        }),
      });
    });

    await page.route('**/api/v1/attempts/att-rev-1/review-detail', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...mockAttemptItem,
          items: [
            {
              id: 'spk-item-1',
              prompt: 'Describe your morning routine in 30 seconds.',
              rubricText: 'Usa presente simple y pronunciación clara.',
              maxDurationSeconds: 60,
            },
          ],
          answers: { audioAssetId: 'asset-1' },
          attemptHistory: [],
        }),
      });
    });

    await page.route('**/api/v1/media/asset-1/url', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          url: 'https://example.com/audio-mock.mp3',
          expiresIn: 300,
          isConverted: true,
        }),
      });
    });

    // 2. Navegar a /revision
    await page.goto('/revision');

    // 3. Verificar que la cola de revisión cargue el intento pendiente
    await expect(page.locator('button:has-text("Speaking: My Daily Routine")').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Mateo Gómez').first()).toBeVisible();

    // 4. Seleccionar el intento para calificar
    await page.locator('button:has-text("Speaking: My Daily Routine")').first().click();

    // 5. Verificar que el panel de detalle muestre la rúbrica y formulario de calificación
    await expect(page.getByRole('heading', { name: 'Speaking: My Daily Routine' })).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Describe your morning routine in 30 seconds.')).toBeVisible();
    await expect(page.locator('input#score-input')).toBeVisible();
  });
});
