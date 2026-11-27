import { addSessionCookie, smokeApiUrl, smokeCredentials } from './session';
import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'tablet', width: 800, height: 1280 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  expect(overflow).toBe(false);
}

async function assertMinTouchTargetsInMain(page: Page) {
  const violations = await page.evaluate(() => {
    const main = document.querySelector('#main-content');
    if (!main) return ['missing #main-content'];
    const interactive = Array.from(
      main.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([type="hidden"]), select, textarea',
      ),
    );
    const bad: string[] = [];
    for (const el of interactive) {
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      // Enlaces dentro de texto corrido pueden ser menores (SPEC-09 RF-21); aquí validamos controles del runner
      const isParagraphLink = el.tagName === 'A' && el.closest('p') !== null;
      if (isParagraphLink) continue;
      if (rect.width < 47.5 || rect.height < 47.5) {
        bad.push(
          `${el.tagName}.${el.className} (${el.textContent?.trim().slice(0, 30) ?? ''}): ${Math.round(rect.width)}x${Math.round(rect.height)}`,
        );
      }
    }
    return bad;
  });
  expect(violations).toEqual([]);
}

async function setupTeensSessionMocks(page: Page) {
  const sessionPayload = {
    user: {
      id: 'std-teens-e2e-1',
      email: 'valentina.teens@upwardenglish.app',
      name: 'Valentina Cruz',
      role: 'student',
    },
    student: {
      id: 'std-teens-e2e-1',
      level: 'B1',
      ageSegment: 'teens',
      canSwitchInterface: true,
      group: { id: 'grp-b1', name: 'Teens B1 Tarde' },
    },
    organizationId: 'org-e2e',
  };

  await page.route('**/api/v1/auth/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(sessionPayload),
    });
  });

  await page.route('**/api/v1/auth/refresh', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(sessionPayload),
    });
  });

  await page.route('**/api/v1/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: sessionPayload.user,
        student: sessionPayload.student,
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
          extra_content: true,
        },
      }),
    });
  });
}

test.describe('Portal Teens — Plan 4 (/actividad/[attemptId])', () => {
  test('Integración real local con backend: login Teens -> abrir actividad real -> responsive y sin TTS repetido', { tag: '@fullstack' }, async ({
    page,
    request,
  }) => {
    const { email, password } = smokeCredentials('teens');
    const healthRes = await request.get(`${smokeApiUrl}/health`);
    expect(healthRes.status()).toBe(200);

    await page.goto('/login');
    await page.getByLabel('Correo electrónico').fill(email);
    await page.getByLabel('Contraseña', { exact: true }).fill(password);
    const [loginResponse] = await Promise.all([
      page.waitForResponse((response) =>
        new URL(response.url()).pathname === '/api/v1/auth/login' &&
        response.request().method() === 'POST',
      ),
      page.getByRole('button', { name: 'Entrar', exact: true }).click(),
    ]);
    expect(loginResponse.status(), `Login Teens (HTTP ${loginResponse.status()})`).toBe(200);
    await expect(page).toHaveURL('/inicio');

    await expect(page.locator('[data-theme="teens"]')).toBeVisible();

    await page.goto('/juegos');
    const game = page.getByRole('article', { name: 'Vocabulary Match: Animals & Objects' });
    await game.getByRole('button', { name: /^Jugar(?: de nuevo)?$/ }).or(
      game.getByRole('link', { name: 'Reanudar partida' }),
    ).click();

    await page.waitForURL(/\/actividad\/[^/]+/);
    await expect(page.locator('#main-content h1')).toBeVisible({ timeout: 15_000 });

    // Verificar ausencia de botones TTS repetidos en Teens
    await expect(page.locator('#main-content').getByRole('button', { name: /^Escuchar/i })).toHaveCount(0);

    const mutedSound = page.getByRole('button', { name: 'Sonido: Silenciado', exact: true });
    const activeSound = page.getByRole('button', { name: 'Sonido: Activado', exact: true });
    await expect(mutedSound).toHaveAttribute('aria-pressed', 'false');
    await mutedSound.press('Enter');
    await expect(activeSound).toHaveAttribute('aria-pressed', 'true');
    await activeSound.press('Space');
    await expect(mutedSound).toHaveAttribute('aria-pressed', 'false');

    // Verificar responsive en los 3 viewports reales
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await assertNoHorizontalOverflow(page);
      await assertMinTouchTargetsInMain(page);
    }

    const axeResults = await new AxeBuilder({ page }).include('#main-content').analyze();
    expect(axeResults.violations).toEqual([]);
  });

  test('fill_blank Teens: diseño limpio, select >= 48px, sin TTS, responsive (1280/800/390), entrega y axe-core', async ({
    page,
    context,
  }) => {
    await addSessionCookie(context, 'mock-teens-token');
    await setupTeensSessionMocks(page);

    let completed = false;

    await page.route('**/api/v1/attempts/att-teens-fb', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          attempt: {
            id: 'att-teens-fb',
            activityId: 'act-teens-fb',
            attemptNumber: 1,
            status: completed ? 'graded' : 'in_progress',
            startedAt: '2026-11-26T10:00:00.000Z',
            completeUntil: '2026-11-30T23:59:00.000Z',
            score: completed ? 5.0 : null,
            stars: completed ? 3 : null,
          },
          activity: {
            id: 'act-teens-fb',
            title: 'First & Second Conditional Practice',
            type: 'fill_blank',
            level: 'B1',
            config: {
              items: [
                {
                  id: 'q-1',
                  prompt: 'If we {{b1}} every week, our fluency will improve quickly.',
                  blanks: [
                    {
                      id: 'b1',
                      options: [
                        { id: 'opt-practice', text: 'practice' },
                        { id: 'opt-practiced', text: 'practiced' },
                      ],
                    },
                  ],
                },
              ],
            },
          },
          answers: completed ? { 'q-1': { b1: 'opt-practice' } } : { 'q-1': { b1: 'opt-practice' } },
          attemptToken: 'tok-teens-fb',
        }),
      });
    });

    await page.route('**/api/v1/attempts/att-teens-fb/events', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ accepted: 1 }) });
    });

    await page.route('**/api/v1/attempts/att-teens-fb/complete', async (route) => {
      completed = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          attempt: {
            id: 'att-teens-fb',
            activityId: 'act-teens-fb',
            attemptNumber: 1,
            status: 'graded',
            score: 5.0,
            stars: 3,
          },
          correction: {
            'q-1': {
              b1: { correct: true },
            },
          },
          newBadges: [],
        }),
      });
    });

    await page.goto('/actividad/att-teens-fb');

    await expect(page.locator('[data-theme="teens"]')).toBeVisible();
    await expect(page.getByRole('link', { name: /Volver a inicio/i })).toBeVisible();
    await expect(page.getByText('Respuesta guardada en el servidor')).toBeVisible();
    await expect(page.locator('#main-content h1')).toHaveText('First & Second Conditional Practice');
    await expect(page.locator('#main-content').getByRole('button', { name: /Escuchar/i })).toHaveCount(0);

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await assertNoHorizontalOverflow(page);
      await assertMinTouchTargetsInMain(page);
    }

    const axeBeforeSubmit = await new AxeBuilder({ page }).include('#main-content').analyze();
    expect(axeBeforeSubmit.violations).toEqual([]);

    await page.getByRole('button', { name: 'Entregar actividad' }).click();

    await expect(page.getByRole('heading', { name: '¡Actividad completada!' })).toBeVisible();
    await expect(page.getByText('Nota: 5,0 / 5,0')).toBeVisible();
    await expect(page.getByText('Espacio 1: Correcto')).toBeVisible();

    const axeAfterSubmit = await new AxeBuilder({ page }).include('#main-content').analyze();
    expect(axeAfterSubmit.violations).toEqual([]);
  });

  test('Speaking Teens: grabadora >= 56px, tope dinámico maxDurationSeconds, preescucha <audio controls> y entrega offline honesta', async ({
    page,
    context,
  }) => {
    await addSessionCookie(context, 'mock-teens-token');
    await setupTeensSessionMocks(page);

    // Simular MediaRecorder y getUserMedia en navegador de pruebas
    await page.addInitScript(() => {
      class MockMediaRecorder {
        state = 'inactive';
        mimeType = 'audio/webm';
        ondataavailable: ((ev: { data: Blob }) => void) | null = null;
        onstop: (() => void) | null = null;
        static isTypeSupported() {
          return true;
        }
        start() {
          this.state = 'recording';
        }
        stop() {
          this.state = 'inactive';
          if (this.ondataavailable) {
            this.ondataavailable({ data: new Blob(['mock-audio'], { type: 'audio/webm' }) });
          }
          if (this.onstop) {
            this.onstop();
          }
        }
      }
      Object.defineProperty(window, 'MediaRecorder', { value: MockMediaRecorder, configurable: true });
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: async () => ({
            getTracks: () => [{ stop: () => {} }],
          }),
        },
        configurable: true,
      });
    });

    await page.route('**/api/v1/attempts/att-teens-spk', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          attempt: {
            id: 'att-teens-spk',
            activityId: 'act-teens-spk',
            attemptNumber: 1,
            status: 'in_progress',
            startedAt: '2026-11-26T10:00:00.000Z',
          },
          activity: {
            id: 'act-teens-spk',
            title: 'Debate: Social media habits',
            type: 'speaking',
            level: 'B1',
            config: {
              prompt: 'Explain two advantages and one risk of daily social media use.',
              minDurationSeconds: 2,
              maxDurationSeconds: 180,
            },
          },
          answers: {},
          attemptToken: 'tok-teens-spk',
        }),
      });
    });

    await page.goto('/actividad/att-teens-spk');

    await expect(page.getByText('00:00 / 03:00')).toBeVisible();
    await expect(page.locator('#main-content').getByRole('button', { name: /Escuchar/i })).toHaveCount(0);

    const recordBtn = page.getByRole('button', { name: 'Grabar audio' });
    await expect(recordBtn).toBeVisible();
    const recordBox = await recordBtn.boundingBox();
    expect(recordBox?.height).toBeGreaterThanOrEqual(55.5);

    // Iniciar y esperar 2.2s para cumplir minDurationSeconds
    await recordBtn.click();
    await expect(page.getByRole('button', { name: 'Detener grabación' })).toBeVisible();
    await page.waitForTimeout(2300);

    // Simular pérdida de conexión antes de detener para verificar preescucha y entrega offline
    await context.setOffline(true);
    await page.getByRole('button', { name: 'Detener grabación' }).click();

    await expect(page.locator('audio[controls]')).toBeVisible();
    await expect(page.getByText('Guardado en este dispositivo')).toBeVisible();

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await assertNoHorizontalOverflow(page);
      await assertMinTouchTargetsInMain(page);
    }

    await page.getByRole('button', { name: 'Entregar actividad' }).click();
    await expect(
      page.getByRole('heading', { name: 'Guardado en este dispositivo. Se enviará cuando vuelva la conexión.' }),
    ).toBeVisible();
    await context.setOffline(false);

    const axeOffline = await new AxeBuilder({ page }).include('#main-content').analyze();
    expect(axeOffline.violations).toEqual([]);
  });

  test('ErrorState Teens (ATTEMPT_CLOSED) y open_question con contador tabular-nums', async ({
    page,
    context,
  }) => {
    await addSessionCookie(context, 'mock-teens-token');
    await setupTeensSessionMocks(page);

    await page.route('**/api/v1/attempts/att-closed-teens', async (route) => {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          statusCode: 409,
          code: 'ATTEMPT_CLOSED',
          message: 'Attempt closed',
        }),
      });
    });

    await page.goto('/actividad/att-closed-teens');
    await expect(
      page.getByText(
        'No fue posible tomar tu intento porque la actividad ya cerró. Comunícate con tu maestra para ver si hay opción de volver a habilitarla.',
      ),
    ).toBeVisible();
    const backLink = page.getByRole('link', { name: 'Volver a inicio' });
    await expect(backLink).toBeVisible();
    await assertMinTouchTargetsInMain(page);
    await assertNoHorizontalOverflow(page);

    const axeError = await new AxeBuilder({ page }).include('#main-content').analyze();
    expect(axeError.violations).toEqual([]);

    // Verificar open_question Teens con contador y altura >= 148px sin TTS
    await page.route('**/api/v1/attempts/att-teens-open', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          attempt: {
            id: 'att-teens-open',
            activityId: 'act-teens-open',
            attemptNumber: 1,
            status: 'in_progress',
            startedAt: '2026-11-26T10:00:00.000Z',
          },
          activity: {
            id: 'act-teens-open',
            title: 'Opinion Essay: Sustainable Cities',
            type: 'open_question',
            level: 'B2',
            config: {
              instructions: 'Answer clearly with examples.',
              items: [
                {
                  id: '11111111-1111-4111-8111-111111111111',
                  prompt: 'How can young people help reduce plastic waste in their schools?',
                  maxLength: 500,
                },
              ],
            },
          },
          answers: {},
          attemptToken: 'tok-teens-open',
        }),
      });
    });

    await page.goto('/actividad/att-teens-open');
    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible();
    const box = await textarea.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(148);
    await textarea.fill('Students can bring reusable bottles.');
    await expect(page.getByText('36 / 500 caracteres')).toBeVisible();
    await expect(page.locator('#main-content').getByRole('button', { name: /Escuchar/i })).toHaveCount(0);

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await assertNoHorizontalOverflow(page);
      await assertMinTouchTargetsInMain(page);
    }

    const axeOpen = await new AxeBuilder({ page }).include('#main-content').analyze();
    expect(axeOpen.violations).toEqual([]);
  });
});
