import { addSessionCookie } from './session';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('SPEC-05 & SPEC-07: Portal del Alumno — Feedback, Reintentos y Perfil (ENG-145)', () => {
  test.beforeEach(async ({ context, page }) => {
    // 1. Simular cookie de sesión de estudiante
    await addSessionCookie(context, 'mock-student-token');

    await page.route('**/api/v1/auth/refresh', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          user: {
            id: 'std-e2e-ext',
            email: 'student.extended@upwardenglish.local',
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
            email: 'student.extended@upwardenglish.local',
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
    context,
    baseURL,
  }) => {
    await addSessionCookie(context, 'mock-student-token', baseURL);
    await page.addInitScript(() => {
      const utterances = document.createElement('div');
      Object.defineProperties(window.speechSynthesis, {
        getVoices: { value: () => [{ lang: 'es-CO' }] },
        speak: { value: (utterance: SpeechSynthesisUtterance) => { utterances.dataset.lang = utterance.lang; } },
        cancel: { value: () => { utterances.dataset.lang = ''; } },
      });
      window.addEventListener('DOMContentLoaded', () => {
        utterances.dataset.testid = 'speech-language';
        utterances.hidden = true;
        document.body.append(utterances);
      });
    });
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
          attemptNumber: 2,
          score: 3.5,
          stars: 2,
          comment: '¡Muy buen vocabulario Valeria! Practica la pronunciación de verbos en pasado.',
          stickers: [{ code: 'grammar_star', emoji: '⭐', label: 'Estrella' }],
          gradedAt: '2026-11-01T15:30:00Z',
        },
        attempts: [
          {
            id: 'att-feed-0',
            attemptNumber: 1,
            score: 2,
            stars: 1,
            gradedAt: '2026-10-26T15:30:00Z',
          },
          {
            id: 'att-feed-1',
            attemptNumber: 2,
            score: 3.5,
            stars: 2,
            gradedAt: '2026-11-01T15:30:00Z',
          },
        ],
      },
    ];

    let releaseLoading: () => void = () => {};
    const loading = new Promise<void>((resolve) => { releaseLoading = resolve; });
    let feedbackFailed = true;
    await page.route('**/api/v1/student/feedback', async (route) => {
      await loading;
      if (feedbackFailed) {
        await route.fulfill({ status: 503, json: { message: 'Sin conexión' } });
        return;
      }
      await route.fulfill({
        status: 200,
        json: {
          items: mockFeedbackItems,
          total: 1,
        },
      });
    });

    await page.goto('/feedback');
    const main = page.getByRole('main');
    await expect(main.getByRole('status').filter({ hasText: 'Trayendo las postales de tu profesora…' })).toBeVisible();
    releaseLoading();
    await expect(main.getByText('No pudimos cargar tus comentarios.', { exact: false })).toBeVisible();
    const reload = main.getByRole('button', { name: 'Reintentar' });
    expect((await reload.boundingBox())?.height).toBeGreaterThanOrEqual(52);
    feedbackFailed = false;
    await reload.press('Enter');

    // Header y título de la página
    await expect(page.getByRole('heading', { name: 'Postales de tu Profesora', level: 1 })).toBeVisible();

    // Ver tarjeta con título, nota formateada con coma, comentario de la profesora y sticker
    await expect(page.locator('text=Speaking: My Weekend Routine')).toBeVisible();
    await expect(main.getByRole('heading', { name: 'Speaking: My Weekend Routine' })).toHaveAttribute('lang', 'en');
    await expect(main.getByText('3,5', { exact: true })).toBeVisible();
    await expect(main.getByText('3,5 / 5,0', { exact: true }).filter({ visible: true })).toBeVisible();
    await expect(main.getByRole('img', { name: '2 de 3 estrellas' })).toBeVisible();
    await expect(
      page.locator('text=¡Muy buen vocabulario Valeria! Practica la pronunciación de verbos en pasado.'),
    ).toBeVisible();
    await expect(page.locator('text=Estrella')).toBeVisible();

    // Ver aviso de nuevo intento concedido
    await expect(page.locator('text=¡Tu profesora te habilitó un nuevo intento!')).toBeVisible();

    const listen = main.getByRole('button', { name: 'Escuchar comentario' });
    const history = main.getByRole('button', { name: 'Ver historial de intentos (2)' });
    const retryBtn = main.getByRole('button', { name: 'Intentar de nuevo' });
    for (const viewport of [
      { width: 320, height: 720 },
      { width: 390, height: 844 },
      { width: 800, height: 1280 },
      { width: 1280, height: 800 },
    ]) {
      await page.setViewportSize(viewport);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
      for (const control of [listen, history, retryBtn]) {
        const box = await control.boundingBox();
        expect(box?.width).toBeGreaterThanOrEqual(48);
        expect(box?.height).toBeGreaterThanOrEqual(48);
      }
      const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(violations).toEqual([]);
    }
    const sticker = main.getByRole('listitem').filter({ hasText: 'Estrella' });
    await expect(sticker).not.toHaveCSS('transform', 'none');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(sticker).toHaveCSS('transform', 'none');

    await history.press('Enter');
    const openHistory = main.getByRole('button', { name: 'Ocultar historial de intentos' });
    await expect(openHistory).toHaveAttribute('aria-expanded', 'true');
    await expect(main.getByText('2,0 / 5,0')).toBeVisible();
    await openHistory.press('Enter');
    await expect(history).toHaveAttribute('aria-expanded', 'false');

    await listen.press('Enter');
    await expect(listen).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('speech-language')).toHaveAttribute('data-lang', 'es-CO');
    await listen.press('Enter');
    await expect(listen).toHaveAttribute('aria-pressed', 'false');

    // Iniciar nuevo intento concedido
    let retryRequests = 0;
    await page.route('**/api/v1/assignments/asg-feed-1/attempts', async (route) => {
      expect(route.request().method()).toBe('POST');
      retryRequests += 1;
      if (retryRequests === 1) {
        await route.fulfill({ status: 409, json: { message: 'Revisa el plazo con tu profesora.' } });
        return;
      }
      await route.fulfill({
        status: 201,
        json: {
          attempt: {
            id: 'att-feed-2',
            assignmentId: 'asg-feed-1',
            attemptNumber: 3,
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

    await retryBtn.click();
    const dialog = page.getByRole('dialog', { name: 'Aviso de intento' });
    await expect(dialog).toContainText('Revisa el plazo con tu profesora.');
    const understood = dialog.getByRole('button', { name: 'Entendido' });
    expect((await understood.boundingBox())?.height).toBeGreaterThanOrEqual(48);
    await understood.click();
    await expect(dialog).toBeHidden();
    await listen.click();
    await retryBtn.click();

    // Debe navegar al runner del nuevo intento
    await expect(page).toHaveURL(/\/actividad\/att-feed-2/);
    await expect(page.getByTestId('speech-language')).toHaveAttribute('data-lang', '');
  });

  test('/feedback vacío en Kids vuelve a la ruta del alumno', async ({ page, context, baseURL }) => {
    await addSessionCookie(context, 'mock-student-token', baseURL);
    await page.route('**/api/v1/student/feedback', (route) => route.fulfill({ json: { items: [] } }));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/feedback');
    const main = page.getByRole('main');
    await expect(main.getByText('Todavía no tienes postales calificadas.', { exact: false })).toBeVisible();
    const home = main.getByRole('link', { name: 'Ir a mi ruta' });
    expect((await home.boundingBox())?.height).toBeGreaterThanOrEqual(52);
    await home.click();
    await expect(page).toHaveURL(/\/inicio$/);
  });

  test('2. /perfil: Información de alumno, cambio de tema Kids/Teens y solicitud/confirmación de cambio de correo con OTP', async ({
    page,
    context,
    baseURL,
  }) => {
    await addSessionCookie(context, 'mock-student-token', baseURL);
    await page.goto('/perfil');

    // Información básica
    await expect(page.getByRole('heading', { name: 'Mi perfil: Credencial de Explorador', level: 1 })).toBeVisible();
    await expect(page.locator('main').locator('text=Valeria Restrepo')).toBeVisible();
    await expect(page.locator('text=student.extended@upwardenglish.local')).toBeVisible();

    // Conmutación de interfaz Kids -> Teens (canSwitchInterface = true)
    await page.route('**/api/v1/me/interface', async (route) => {
      await route.fulfill({
        status: 200,
        json: { ageSegment: 'teens' },
      });
    });

    const teensThemeBtn = page.getByRole('button', { name: /^Teens Interfaz limpia/ });
    await expect(teensThemeBtn).toHaveAttribute('aria-pressed', 'false');

    // Solicitar cambio de correo
    await page.route('**/api/v1/me/email-change', async (route) => {
      expect(route.request().postDataJSON()).toEqual({
        newEmail: 'valeria.new@upwardenglish.local',
        password: 'CurrentPassword123',
      });
      await route.fulfill({
        status: 202,
        json: { message: 'Código OTP enviado a tu nuevo correo.' },
      });
    });

    const changeEmailToggle = page.locator('button:has-text("Cambiar correo electrónico")');
    await expect(changeEmailToggle).toBeVisible();
    await changeEmailToggle.click();

    await page.fill('input[type="email"]', 'valeria.new@upwardenglish.local');
    await page.fill('input[type="password"]', 'CurrentPassword123');
    await page.click('button:has-text("Solicitar cambio")');

    // Formulario de OTP de 6 dígitos
    await expect(page.locator('text=Código OTP enviado')).toBeVisible();
    await page.fill('input[placeholder="123456"]', '123456');

    await page.route('**/api/v1/me/email-change/confirm', async (route) => {
      expect(route.request().postDataJSON()).toEqual({ otp: '123456' });
      await route.fulfill({
        status: 200,
        json: { message: '¡Correo actualizado exitosamente! El cambio ya está activo.' },
      });
    });

    await page.click('button:has-text("Confirmar nuevo correo")');
    await expect(page.locator('text=¡Correo actualizado exitosamente!')).toBeVisible();
  });
});
