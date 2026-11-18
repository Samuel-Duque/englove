import { test, expect } from '@playwright/test';

function silentWav() {
  const sampleRate = 8_000;
  const dataSize = sampleRate * 30;
  const wav = Buffer.alloc(44 + dataSize, 0x80);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + dataSize, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate, 28);
  wav.writeUInt16LE(1, 32);
  wav.writeUInt16LE(8, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(dataSize, 40);
  return wav;
}

test.describe('SPEC-07: Revisión Docente y Feedback de Alumno (ENG-094 / ENG-145)', () => {
  test('Flujo docente completo: cola con TanStack Query, audio speaking, calificación 0.0-5.0, stickers, reintento e inmutabilidad tras graded', async ({
    page,
    context,
  }) => {
    // 1. Simular sesión de profesora
    await context.addCookies([
      {
        name: 'upward_english_local_access_token',
        value: 'mock-teacher-token',
        domain: 'localhost',
        path: '/',
      },
      {
        name: 'upward_english_access_token',
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
            email: 'teacher@upwardenglish.local',
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
            {
              id: 'grp-1',
              name: 'Grupo A1 Mañana',
              level: 'A1',
              activeStudentsCount: 5,
            },
          ],
          total: 1,
        }),
      });
    });

    let isGraded = false;

    const mockPendingAttemptItem = {
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

    const mockGradedAttemptItem = {
      ...mockPendingAttemptItem,
      attempt: {
        ...mockPendingAttemptItem.attempt,
        status: 'graded',
        score: 4.5,
        stars: 2,
        gradedAt: '2026-11-02T14:00:00.000Z',
        retryGrantedAt: '2026-11-02T14:00:00.000Z',
      },
      review: {
        id: 'rev-1',
        comment: '¡Excelente fluidez y vocabulario!',
        stickers: ['grammar_star'],
        reviewerId: 'teacher-1',
        createdAt: '2026-11-02T14:00:00.000Z',
        updatedAt: '2026-11-02T14:00:00.000Z',
      },
    };

    await page.route('**/api/v1/reviews/queue*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: isGraded ? [] : [mockPendingAttemptItem],
          total: isGraded ? 0 : 1,
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
          items: isGraded ? [mockGradedAttemptItem] : [],
          total: isGraded ? 1 : 0,
          offset: 0,
          limit: 20,
        }),
      });
    });

    await page.route(
      '**/api/v1/attempts/att-rev-1/review-detail',
      async (route) => {
        const base = isGraded ? mockGradedAttemptItem : mockPendingAttemptItem;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ...base,
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
      },
    );

    const audioPath = '/test-review-audio.wav';
    await context.route(`**${audioPath}`, (route) =>
      route.fulfill({ contentType: 'audio/wav', body: silentWav() }),
    );
    await page.route('**/api/v1/media/asset-1/url', (route) =>
      route.fulfill({
        json: {
          url: new URL(audioPath, page.url()).href,
          expiresAt: '2026-11-02T14:05:00.000Z',
          format: 'converted',
          compatibilityWarning: false,
        },
      }),
    );

    // 2. Navegar a /revision
    await page.goto('/revision');

    // 3. Verificar que la cola de revisión cargue el intento pendiente
    await expect(
      page.locator('button:has-text("Speaking: My Daily Routine")').first(),
    ).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Mateo Gómez').first()).toBeVisible();

    // 4. Seleccionar el intento para calificar
    await page
      .locator('button:has-text("Speaking: My Daily Routine")')
      .first()
      .click();

    // 5. Verificar panel de detalle y audio de speaking
    await expect(
      page.getByRole('heading', { name: 'Speaking: My Daily Routine' }),
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page.locator('text=Describe your morning routine in 30 seconds.'),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Descargar audio' }),
    ).toBeVisible();
    const audio = page.locator('audio[controls]');
    await expect(audio).toHaveAttribute('src', /test-review-audio\.wav$/);
    await page.setViewportSize({ width: 390, height: 844 });
    await audio.evaluate((element) => {
      if (!(element instanceof HTMLAudioElement))
        throw new Error('No hay reproductor de audio');
      return element.play();
    });
    await expect(audio).toHaveJSProperty('paused', false);
    await page.getByRole('button', { name: 'Volver a la cola' }).click();
    await expect(audio).toHaveJSProperty('paused', true);
    await page.setViewportSize({ width: 1280, height: 800 });

    // 6. Calificar con nota 4.5, comentario, sticker y reintento
    const scoreInput = page.locator('input#score-input');
    await expect(scoreInput).toBeVisible();
    await scoreInput.fill('4.5');

    const commentInput = page.locator('textarea#comment-input');
    await expect(commentInput).toBeVisible();
    await commentInput.fill('¡Excelente fluidez y vocabulario!');

    // Seleccionar sticker
    const sticker = page.getByRole('button', {
      name: '¡Estrella de la gramática!',
    });
    await sticker.click();
    await expect(sticker).toHaveAttribute('aria-pressed', 'true');

    await page
      .getByRole('checkbox', { name: 'Permitir nuevo intento al estudiante' })
      .check();

    // 7. Enviar calificación
    const submittedBodies: unknown[] = [];
    await page.route('**/api/v1/attempts/att-rev-1/review', async (route) => {
      submittedBodies.push(route.request().postDataJSON());
      isGraded = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...mockGradedAttemptItem,
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

    const save = page.getByRole('button', {
      name: 'Guardar Revisión y Retroalimentación',
    });
    await scoreInput.fill('6');
    await save.click();
    await expect(
      page.getByText('Ingresa una calificación válida entre 0,0 y 5,0'),
    ).toBeVisible();
    expect(submittedBodies).toEqual([]);

    await scoreInput.fill('4.5');
    await save.click();
    await expect(
      page.locator(
        'text=¡Calificación y retroalimentación guardadas exitosamente!',
      ),
    ).toBeVisible();
    expect(submittedBodies).toEqual([
      {
        score: 4.5,
        comment: '¡Excelente fluidez y vocabulario!',
        stickers: ['grammar_star'],
        allowRetry: true,
        retryExtendUntil: null,
      },
    ]);

    // 8. Cambiar a pestaña Calificados y comprobar inmutabilidad de la nota
    await page.click('button[role="tab"]:has-text("Calificados")');
    await expect(
      page.locator('button:has-text("Speaking: My Daily Routine")').first(),
    ).toBeVisible();
    await page
      .locator('button:has-text("Speaking: My Daily Routine")')
      .first()
      .click();

    // En estado graded, la calificación es inmutable y no muestra input editable
    await expect(page.getByText('Calificación inmutable:')).toBeVisible();
    await expect(page.locator('text=4,5 / 5,0').first()).toBeVisible();
    await expect(
      page.locator('[aria-label="Calificación: 2 estrellas"]'),
    ).toHaveCount(0);
    await expect(page.locator('input#score-input')).not.toBeVisible();
  });
});
