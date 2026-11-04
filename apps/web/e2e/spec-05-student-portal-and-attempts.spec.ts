import { test, expect } from '@playwright/test';

test.describe('SPEC-05: Portal del Alumno y Ciclo de Intentos (ENG-145 / RF-30)', () => {
  test('RF-17: Acceso no autenticado a /inicio redirige a /login con parametro next seguro', async ({ page }) => {
    await page.goto('/inicio');
    await expect(page).toHaveURL(/\/login\?next=%2Finicio/);
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('RF-1 & RF-30: Flujo completo estudiante: ver asignación fill_blank, completar actividad y persistencia al recargar', async ({
    page,
    context,
  }) => {
    // 1. Simular cookie de sesión para proxy.ts
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

    // 2. Mockear endpoints de API a nivel de red
    await page.route('**/api/v1/auth/refresh', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'std-e2e-1',
            email: 'student@englove.local',
            name: 'Juanita Pérez',
            role: 'student',
          },
          student: {
            id: 'std-e2e-1',
            level: 'A1',
            ageSegment: 'kids',
            canSwitchInterface: false,
            group: { id: 'grp-1', name: 'Kids A1 Mañana' },
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
            id: 'std-e2e-1',
            name: 'Juanita Pérez',
            email: 'student@englove.local',
            role: 'student',
          },
          student: {
            id: 'std-e2e-1',
            level: 'A1',
            ageSegment: 'kids',
            canSwitchInterface: false,
            group: { id: 'grp-1', name: 'Kids A1 Mañana' },
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

    let attemptStatus = 'in_progress';
    let attemptScore: number | null = null;

    await page.route('**/api/v1/me/assignments*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: 'asg-e2e-1',
              activity: {
                id: 'act-e2e-1',
                title: 'Family Members Vocabulary',
                type: 'fill_blank',
                level: 'A1',
              },
              opensAt: '2026-10-01T00:00:00.000Z',
              dueAt: '2026-12-01T18:00:00.000Z',
              cancelledAt: null,
              effectiveDueAt: '2026-12-01T18:00:00.000Z',
              latestAttempt: {
                id: 'att-e2e-1',
                attemptNumber: 1,
                status: attemptStatus,
                score: attemptScore,
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

    await page.route('**/api/v1/attempts/att-e2e-1', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          attempt: {
            id: 'att-e2e-1',
            assignmentId: 'asg-e2e-1',
            attemptNumber: 1,
            previousAttemptId: null,
            status: attemptStatus,
            startedAt: '2026-11-01T10:00:00.000Z',
            finishedAt: attemptStatus === 'graded' ? '2026-11-01T10:05:00.000Z' : null,
            gradedAt: attemptStatus === 'graded' ? '2026-11-01T10:05:00.000Z' : null,
            score: attemptScore,
            flags: [],
            effectiveDueAt: '2026-12-01T18:00:00.000Z',
            completeUntil: '2026-12-01T18:00:00.000Z',
          },
          activity: {
            id: 'act-e2e-1',
            title: 'Family Members Vocabulary',
            type: 'fill_blank',
            level: 'A1',
            config: {
              type: 'fill_blank',
              items: [
                {
                  id: 'item-1',
                  prompt: 'My {{blank1}} is a teacher and my {{blank2}} is a doctor.',
                  blanks: [
                    { id: 'blank1' },
                    { id: 'blank2' },
                  ],
                },
              ],
            },
          },
          answers: {},
          mediaId: null,
          correction: null,
          attemptToken: 'mock-attempt-token',
        }),
      });
    });

    await page.route('**/api/v1/attempts/att-e2e-1/complete', async (route) => {
      attemptStatus = 'graded';
      attemptScore = 5.0;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          attempt: {
            id: 'att-e2e-1',
            assignmentId: 'asg-e2e-1',
            attemptNumber: 1,
            previousAttemptId: null,
            status: 'graded',
            startedAt: '2026-11-01T10:00:00.000Z',
            finishedAt: '2026-11-01T10:05:00.000Z',
            gradedAt: '2026-11-01T10:05:00.000Z',
            score: 5.0,
            flags: [],
            effectiveDueAt: '2026-12-01T18:00:00.000Z',
            completeUntil: '2026-12-01T18:00:00.000Z',
          },
          correction: null,
          newBadges: [],
        }),
      });
    });

    await page.route('**/api/v1/me/progress', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          streak: {
            weeks: 3,
            forgivenessAvailable: true,
            activeWeeksSinceForgivenessUsed: 0,
            periodKey: '2026-W44',
          },
          badges: [
            {
              id: 'bdg-1',
              key: 'first_activity',
              name: 'Primera Actividad',
              description: 'Completaste tu primera actividad',
              icon: '🏅',
              awardedAt: '2026-10-25T10:00:00.000Z',
            },
          ],
          activities: [
            {
              attemptId: 'att-e2e-1',
              score: 5.0,
              stars: 3,
            },
          ],
        }),
      });
    });

    // 3. Cargar /inicio en el navegador real
    await page.goto('/inicio');

    // Verificar saludo
    await expect(page.getByRole('heading', { name: /Juanita Pérez/ })).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Family Members Vocabulary')).toBeVisible();

    // 4. Hacer clic en el botón de la asignación para abrir el runner
    await page.click('text=Continuar actividad');
    await expect(page).toHaveURL(/\/actividad\/att-e2e-1/);

    // 5. Verificar que el runner de fill_blank se renderice correctamente en el DOM
    await expect(page.locator('text=Completa los espacios en blanco con la palabra correcta:')).toBeVisible();
    const inputs = page.locator('input[type="text"]');
    await expect(inputs).toHaveCount(2);

    await inputs.nth(0).fill('mother');
    await inputs.nth(1).fill('father');

    // 6. Entregar la actividad
    const submitButton = page.locator('button:has-text("Entregar actividad")');
    await submitButton.first().click();

    // 7. Verificar pantalla de completado con estrellas (SPEC-05 RF-14, Decision 101: 5.0 = 3 estrellas)
    await expect(page.locator('text=¡Misión completada!')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=5.0 / 5.0')).toBeVisible();

    // 8. RF-30: Recargar la página y verificar que el intento persiste completado
    await page.reload();
    await expect(page.locator('text=¡Misión completada!')).toBeVisible();
    await expect(page.locator('text=5.0 / 5.0')).toBeVisible();

    // 9. Navegar a /progreso y verificar racha y medallas
    await page.goto('/progreso');
    await expect(page.locator('text=3 semanas consecutivas')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Primera Actividad' })).toBeVisible();
  });

  test('RF-2 & RF-8: Runner de open_question transiciona a pending_review con aviso docente', async ({
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
          user: { id: 'std-e2e-open', name: 'Laura Gómez', email: 'laura@englove.local', role: 'student' },
          student: { id: 'std-e2e-open', level: 'A2', ageSegment: 'teens', canSwitchInterface: false },
          organizationId: 'org-e2e',
        },
      });
    });

    await page.route('**/api/v1/attempts/att-open-1', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          attempt: {
            id: 'att-open-1',
            assignmentId: 'asg-open-1',
            attemptNumber: 1,
            status: 'in_progress',
            effectiveDueAt: '2026-12-01T18:00:00Z',
          },
          activity: {
            id: 'act-open-1',
            title: 'Describe Your Hometown',
            type: 'open_question',
            level: 'A2',
            config: {
              prompt: 'Write at least 3 sentences describing what you like about your hometown.',
            },
          },
          answers: {},
          attemptToken: 'token-open-1',
        },
      });
    });

    await page.route('**/api/v1/attempts/att-open-1/complete', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          attempt: {
            id: 'att-open-1',
            status: 'pending_review',
            score: null,
          },
          newBadges: [],
        },
      });
    });

    await page.goto('/actividad/att-open-1');
    await expect(page.locator('h1:has-text("Describe Your Hometown")')).toBeVisible();
    await expect(page.locator('text=Write at least 3 sentences describing what you like about your hometown.')).toBeVisible();

    const textarea = page.locator('textarea');
    await textarea.fill('My hometown is beautiful. It has many parks and nice trees. I love the weather.');

    await page.click('button:has-text("Entregar actividad")');

    // Mensaje de entrega exitosa en estado pending_review
    await expect(page.locator('text=¡Actividad entregada con éxito!')).toBeVisible({ timeout: 5000 });
    await expect(
      page.locator('text=Tu respuesta ha quedado registrada. Tu profesora la revisará y calificará en los próximos días.'),
    ).toBeVisible();
  });

  test('RF-3 & RF-13: Runner de speaking con grabación de audio y subida firmada a R2', async ({
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
          user: { id: 'std-e2e-spk', name: 'Tomás Speaking', email: 'tomas@englove.local', role: 'student' },
          student: { id: 'std-e2e-spk', level: 'A1', ageSegment: 'kids', canSwitchInterface: false },
          organizationId: 'org-e2e',
        },
      });
    });

    await page.route('**/api/v1/attempts/att-spk-1', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          attempt: {
            id: 'att-spk-1',
            assignmentId: 'asg-spk-1',
            attemptNumber: 1,
            status: 'in_progress',
            effectiveDueAt: '2026-12-01T18:00:00Z',
          },
          activity: {
            id: 'act-spk-1',
            title: 'Introduce Yourself in English',
            type: 'speaking',
            level: 'A1',
            config: {
              prompt: 'Say hello and say your name and favorite color.',
            },
          },
          answers: {},
          attemptToken: 'token-spk-1',
        },
      });
    });

    // Mock media upload-url and R2 PUT
    await page.route('**/api/v1/media/upload-url', async (route) => {
      await route.fulfill({
        status: 201,
        json: {
          mediaId: 'asset-r2-mock-123',
          uploadUrl: 'https://r2.englove.test/bucket/audio-mock.webm',
          expiresAt: '2026-12-01T19:00:00Z',
        },
      });
    });

    await page.route('https://r2.englove.test/bucket/**', async (route) => {
      await route.fulfill({ status: 200 });
    });

    await page.route('**/api/v1/attempts/att-spk-1/complete', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          attempt: {
            id: 'att-spk-1',
            status: 'pending_review',
            score: null,
          },
          newBadges: [],
        },
      });
    });

    // Mock MediaDevices and MediaRecorder in the browser context
    await page.addInitScript(() => {
      class MockMediaRecorder {
        static isTypeSupported(_mimeType: string) {
          return true;
        }
        public mimeType = 'audio/webm';
        public ondataavailable: ((e: { data: Blob }) => void) | null = null;
        public onstop: (() => void) | null = null;
        start() {}
        stop() {
          if (this.ondataavailable) {
            this.ondataavailable({ data: new Blob(['mock audio stream'], { type: 'audio/webm' }) });
          }
          if (this.onstop) {
            this.onstop();
          }
        }
      }
      (window as unknown as { MediaRecorder: unknown }).MediaRecorder = MockMediaRecorder;

      navigator.mediaDevices.getUserMedia = async () => {
        return {
          getTracks: () => [{ stop: () => {} }],
        } as unknown as MediaStream;
      };
    });

    await page.goto('/actividad/att-spk-1');
    await expect(page.locator('h1:has-text("Introduce Yourself in English")')).toBeVisible();

    // Iniciar grabación
    const recordBtn = page.locator('button:has-text("Empezar a grabar")');
    await expect(recordBtn).toBeVisible();
    await recordBtn.click();

    // Detener grabación
    const stopBtn = page.locator('button:has-text("Detener grabación")');
    await expect(stopBtn).toBeVisible();
    await stopBtn.click();

    await expect(page.locator('text=Grabación lista para enviar')).toBeVisible();

    // Entregar actividad oral
    await page.click('button:has-text("Entregar actividad")');
    await expect(page.locator('text=¡Actividad entregada con éxito!')).toBeVisible({ timeout: 5000 });
  });
});
