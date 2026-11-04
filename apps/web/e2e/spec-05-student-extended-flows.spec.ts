import { test, expect } from '@playwright/test';

test.describe('SPEC-05 & SPEC-07: Portal del Alumno — Feedback, Reintentos y Perfil (ENG-145)', () => {
  test.beforeEach(async ({ context, page }) => {
    // 1. Simular cookie de sesión de estudiante
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

    await page.route('**/api/v1/auth/refresh', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          user: {
            id: 'std-e2e-ext',
            email: 'student.extended@englove.local',
            name: 'Valeria Restrepo',
            role: 'student',
          },
          student: {
            id: 'std-e2e-ext',
            level: 'A2',
            ageSegment: 'kids',
            canSwitchInterface: true,
            group: { id: 'grp-1', name: 'Kids A2' },
          },
          organizationId: 'org-e2e',
        },
      });
    });

    await page.route('**/api/v1/me', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          user: {
            id: 'std-e2e-ext',
            name: 'Valeria Restrepo',
            email: 'student.extended@englove.local',
            role: 'student',
          },
          student: {
            id: 'std-e2e-ext',
            level: 'A2',
            ageSegment: 'kids',
            canSwitchInterface: true,
            group: { id: 'grp-1', name: 'Kids A2' },
          },
        },
      });
    });
  });

  test('1. /feedback: Historial de retroalimentación, stickers, comentarios docentes y activación de reintento concedido', async ({
    page,
  }) => {
    const mockFeedbackItems = [
      {
        assignmentId: 'asg-feed-1',
        activityTitle: 'Speaking: My Weekend Routine',
        activityType: 'speaking',
        level: 'A2',
        hasAvailableRetry: true,
        effectiveDueAt: '2026-11-05T18:00:00Z',
        latestAttempt: {
          id: 'att-feed-1',
          attemptNumber: 1,
          score: 3.5,
          stars: 2,
          comment: '¡Muy buen vocabulario Valeria! Practica la pronunciación de verbos en pasado.',
          stickers: [{ code: 'star', emoji: '⭐', label: 'Estrella' }],
          gradedAt: '2026-11-01T15:30:00Z',
        },
        attempts: [
          {
            id: 'att-feed-1',
            attemptNumber: 1,
            score: 3.5,
            stars: 2,
            gradedAt: '2026-11-01T15:30:00Z',
          },
        ],
      },
    ];

    await page.route('**/api/v1/student/feedback', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          items: mockFeedbackItems,
          total: 1,
        },
      });
    });

    await page.goto('/feedback');

    // Header y título de la página
    await expect(page.locator('h1:has-text("Tus Calificaciones y Retroalimentación")')).toBeVisible();

    // Ver tarjeta con título, nota formateada con coma, comentario de la profesora y sticker
    await expect(page.locator('text=Speaking: My Weekend Routine')).toBeVisible();
    await expect(page.locator('text=3,5')).toBeVisible();
    await expect(page.locator('text=/ 5,0')).toBeVisible();
    await expect(
      page.locator('text=¡Muy buen vocabulario Valeria! Practica la pronunciación de verbos en pasado.'),
    ).toBeVisible();
    await expect(page.locator('text=Estrella')).toBeVisible();

    // Ver aviso de nuevo intento concedido
    await expect(page.locator('text=¡Tu profesora te habilitó un nuevo intento!')).toBeVisible();

    // Iniciar nuevo intento concedido
    await page.route('**/api/v1/assignments/asg-feed-1/attempts', async (route) => {
      await route.fulfill({
        status: 201,
        json: {
          attempt: {
            id: 'att-feed-2',
            assignmentId: 'asg-feed-1',
            attemptNumber: 2,
            status: 'in_progress',
          },
          activity: {
            id: 'act-feed-1',
            title: 'Speaking: My Weekend Routine',
            type: 'speaking',
            level: 'A2',
            config: { prompt: 'Talk about your weekend' },
          },
          attemptToken: 'token-retry-2',
        },
      });
    });

    const retryBtn = page.locator('button:has-text("Intentar de nuevo")');
    await expect(retryBtn).toBeVisible();
    await retryBtn.click();

    // Debe navegar al runner del nuevo intento
    await expect(page).toHaveURL(/\/actividad\/att-feed-2/);
  });

  test('2. /perfil: Información de alumno, cambio de tema Kids/Teens y solicitud/confirmación de cambio de correo con OTP', async ({
    page,
  }) => {
    await page.goto('/perfil');

    // Información básica
    await expect(page.locator('h1:has-text("Tu Perfil de Alumno")')).toBeVisible();
    await expect(page.locator('main').locator('text=Valeria Restrepo')).toBeVisible();
    await expect(page.locator('text=student.extended@englove.local')).toBeVisible();

    // Conmutación de interfaz Kids -> Teens (canSwitchInterface = true)
    await page.route('**/api/v1/me/interface', async (route) => {
      await route.fulfill({
        status: 200,
        json: { ageSegment: 'teens' },
      });
    });

    const teensThemeBtn = page.locator('button:has-text("Teens (11 a 14 años)")');
    await expect(teensThemeBtn).toBeVisible();

    // Solicitar cambio de correo
    await page.route('**/api/v1/me/email-change', async (route) => {
      await route.fulfill({
        status: 200,
        json: { message: 'Código OTP enviado a tu nuevo correo.' },
      });
    });

    const changeEmailToggle = page.locator('button:has-text("Cambiar correo electrónico")');
    await expect(changeEmailToggle).toBeVisible();
    await changeEmailToggle.click();

    await page.fill('input[type="email"]', 'valeria.new@englove.local');
    await page.fill('input[type="password"]', 'CurrentPassword123');
    await page.click('button:has-text("Solicitar cambio")');

    // Formulario de OTP de 6 dígitos
    await expect(page.locator('text=Código OTP enviado')).toBeVisible();
    await page.fill('input[placeholder="123456"]', '123456');

    await page.route('**/api/v1/me/email-change/confirm', async (route) => {
      await route.fulfill({
        status: 200,
        json: { message: '¡Correo actualizado exitosamente! El cambio ya está activo.' },
      });
    });

    await page.click('button:has-text("Confirmar nuevo correo")');
    await expect(page.locator('text=¡Correo actualizado exitosamente!')).toBeVisible();
  });
});
