import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

const viewports = [
  { name: 'desktop', width: 1280, height: 800, cardColumns: 2, heroColumns: 2, foxVisible: true },
  { name: 'tablet', width: 800, height: 1280, cardColumns: 2, heroColumns: 1, foxVisible: true },
  { name: 'mobile', width: 390, height: 844, cardColumns: 1, heroColumns: 1, foxVisible: false },
] as const;

async function expectTouchTarget(locator: Locator, minHeight = 48, minWidth = 48) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(minHeight);
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(minWidth);
}

async function expectAccessible(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(result.violations).toEqual([]);
}

test('Plan 0 y Plan 1 Teens: base compartida, /inicio responsive, estados, navegación y WCAG 2.2 AA', async ({
  page,
  context,
  baseURL,
}) => {
  test.setTimeout(120_000);

  const profile = {
    user: {
      id: 'std-teens-1',
      name: 'Valentina Cruz',
      email: 'valentina.teens@upwardenglish.org',
      role: 'student',
    },
    student: {
      id: 'std-teens-1',
      ageSegment: 'teens',
      level: 'B1',
      canSwitchInterface: true,
    },
    organizationId: 'org-teens-e2e',
  };

  const cookiePrefixes = new Set([
    process.env.COOKIE_PREFIX ?? process.env.NEXT_PUBLIC_COOKIE_PREFIX,
    'englove_local_',
    'upward_english_local_',
    'upward_english_',
  ]);

  for (const prefix of cookiePrefixes) {
    if (prefix) {
      await context.addCookies([
        { name: `${prefix}access_token`, value: 'mock-teens-token', url: baseURL },
      ]);
    }
  }

  await page.route(/\/api\/v1\/(?:me|auth\/session|auth\/refresh)$/, (route) =>
    route.fulfill({ status: 200, json: profile }),
  );
  await page.route('**/api/v1/me/profile', (route) =>
    route.fulfill({ status: 200, json: profile }),
  );
  await page.route('**/api/v1/feature-flags', (route) =>
    route.fulfill({ status: 200, json: { flags: { games: true, extra_content: true } } }),
  );
  await page.route('**/api/v1/me/progress', (route) =>
    route.fulfill({
      status: 200,
      json: {
        streak: {
          weeks: 6,
          forgivenessAvailable: true,
          activeWeeksSinceForgivenessUsed: 0,
          periodKey: null,
        },
        badges: [],
        activities: [],
      },
    }),
  );

  const now = Date.now();
  const futureDue = new Date(now + 48 * 60 * 60 * 1000).toISOString();
  const graceDue = new Date(now - 2 * 60 * 60 * 1000).toISOString();

  const populatedAssignments = {
    items: [
      {
        id: 'asg-teens-speaking',
        dueAt: graceDue,
        effectiveDueAt: graceDue,
        retryAvailable: false,
        canStart: false,
        canContinue: true,
        activity: {
          id: 'act-1',
          title: 'Travel Habits Interview',
          type: 'speaking',
          level: 'B1',
        },
        latestAttempt: {
          id: 'att-teens-in-progress',
          status: 'in_progress',
          score: null,
        },
      },
      {
        id: 'asg-teens-blank',
        dueAt: futureDue,
        effectiveDueAt: futureDue,
        retryAvailable: false,
        canStart: true,
        canContinue: false,
        activity: {
          id: 'act-2',
          title: 'Future Plans Practice',
          type: 'fill_blank',
          level: 'B1',
        },
        latestAttempt: null,
      },
      {
        id: 'asg-teens-retry',
        dueAt: futureDue,
        effectiveDueAt: futureDue,
        retryAvailable: true,
        canStart: true,
        canContinue: false,
        activity: {
          id: 'act-3',
          title: 'Opinion Essay Draft',
          type: 'open_question',
          level: 'B1',
        },
        latestAttempt: {
          id: 'att-teens-prev',
          status: 'graded',
          score: 3.8,
        },
      },
      {
        id: 'asg-teens-exam',
        dueAt: graceDue,
        effectiveDueAt: graceDue,
        retryAvailable: false,
        canStart: false,
        canContinue: false,
        activity: {
          id: 'act-4',
          title: 'Midterm Grammar Check',
          type: 'exam',
          level: 'B1',
        },
        latestAttempt: {
          id: 'att-teens-graded',
          status: 'graded',
          score: 4.6,
        },
      },
    ],
    total: 4,
  };

  let mode: 'error' | 'populated' | 'empty' = 'error';
  let releaseLoading: () => void = () => {};
  const loadingGate = new Promise<void>((resolve) => {
    releaseLoading = resolve;
  });

  await page.route('**/api/v1/me/assignments', async (route) => {
    await loadingGate;
    if (mode === 'error') {
      await route.fulfill({
        status: 503,
        json: { statusCode: 503, code: 'UNAVAILABLE', message: 'Servicio no disponible' },
      });
      return;
    }
    await route.fulfill({
      status: 200,
      json: mode === 'populated' ? populatedAssignments : { items: [], total: 0 },
    });
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/inicio');

  // 1. Estado de carga
  await expect(page.getByText('Cargando tus actividades…').first()).toBeVisible();
  releaseLoading();

  // 2. Estado de error + objetivo táctil >= 48px + axe WCAG 2.2 AA
  const alert = page.getByRole('alert').filter({ hasText: 'No pudimos cargar tus actividades.' });
  await expect(alert).toBeVisible();
  const retryButton = alert.getByRole('button', { name: 'Reintentar' });
  await expectTouchTarget(retryButton);
  await expectAccessible(page);

  // 3. Reintentar carga a estado poblado
  mode = 'populated';
  await retryButton.click();

  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { name: 'Hola, Valentina Cruz', level: 1 })).toBeVisible();
  await expect(main.getByText('Tienes 3 actividades por hacer.')).toBeVisible();
  await expect(main.getByText('6 semanas activas')).toBeVisible();
  await expect(main.getByText('Escudo de perdón activo')).toBeVisible();
  await expect(main.getByText('Nota: 4,6 / 5,0')).toHaveCSS('font-variant-numeric', 'tabular-nums');
  await expect(main.getByRole('img', { name: '3 de 3 estrellas' })).toBeVisible();

  // Regla Teens: cero botones TTS repetidos ("Escuchar")
  await expect(main.getByRole('button', { name: /Escuchar/i })).toHaveCount(0);

  // Títulos pedagógicos en inglés marcados con lang="en"
  await expect(main.locator('h3[lang="en"]', { hasText: 'Travel Habits Interview' })).toBeVisible();

  // Verificar layout y objetivos táctiles en los 3 viewports
  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height });

    // Token Teens aplicado sobre contenedor raíz (sin bg-zinc-950)
    await expect(page.locator('[data-theme="teens"]')).toHaveCSS(
      'background-color',
      'rgb(250, 246, 238)',
    );

    // Sin desbordamiento horizontal
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `Desborde horizontal en ${vp.name} (${vp.width}px)`).toBe(0);

    // Visibilidad del Zorro Teens en hero según viewport
    const heroFox = main.locator('section').first().locator('svg').last();
    if (vp.foxVisible) {
      await expect(heroFox).toBeVisible();
    } else {
      await expect(heroFox).toBeHidden();
    }

    // Columnas en heroGrid
    const heroChildren = await main.locator('section').nth(0).boundingBox();
    const logBox = await main.locator('section').nth(1).boundingBox();
    if (vp.heroColumns === 2) {
      expect(heroChildren?.y).toBe(logBox?.y);
    } else {
      expect(logBox?.y ?? 0).toBeGreaterThan(heroChildren?.y ?? 0);
    }

    // Columnas en rejilla de tarjetas
    const cards = main.locator('article');
    await expect.poll(async () => {
      const firstBox = await cards.first().boundingBox();
      const boxes = await Promise.all((await cards.all()).map((c) => c.boundingBox()));
      return boxes.filter((b) => b?.y === firstBox?.y).length;
    }).toBe(vp.cardColumns);

    // Objetivos táctiles >= 48px en cabecera, navegación y página
    const header = page.locator('header');
    await expect(header.locator('.teens-badge')).toBeVisible();
    await expectTouchTarget(header.getByRole('link', { name: /Upward English/i }));
    await expectTouchTarget(header.getByRole('link', { name: /Perfil/i }));
    await expectTouchTarget(header.getByRole('button', { name: 'Salir' }));

    for (const label of ['Inicio', 'Juegos', 'Progreso', 'Feedback', 'Extra']) {
      const navLink = page.getByRole('navigation', { name: 'Navegación del estudiante' }).getByRole('link', {
        name: label === 'Extra' ? 'Contenido extra' : label,
      });
      await expectTouchTarget(navLink, vp.width <= 680 ? 52 : 48, 48);
    }

    await expectTouchTarget(main.getByRole('link', { name: /Practicar en microjuegos/i }));
    await expectTouchTarget(main.getByRole('link', { name: /Revisar feedback/i }));
    for (const chip of await main.getByRole('group', { name: 'Filtrar actividades' }).getByRole('button').all()) {
      await expectTouchTarget(chip);
    }
    for (const cta of await main.locator('article a, article button').all()) {
      await expectTouchTarget(cta);
    }

    await expectAccessible(page);
  }

  // 4. Probar filtros en escritorio
  await page.setViewportSize({ width: 1280, height: 800 });
  const filterGroup = main.getByRole('group', { name: 'Filtrar actividades' });
  await filterGroup.getByRole('button', { name: /Por hacer \(3\)/ }).click();
  await expect(main.locator('article')).toHaveCount(3);
  await filterGroup.getByRole('button', { name: /Entregadas \(2\)/ }).click();
  await expect(main.locator('article')).toHaveCount(2);
  await filterGroup.getByRole('button', { name: /Todas \(4\)/ }).click();
  await expect(main.locator('article')).toHaveCount(4);

  // 5. Probar error al iniciar intento (Modal Teens >= 48px)
  let failAttempt = true;
  await page.route('**/api/v1/assignments/asg-teens-blank/attempts', async (route) => {
    if (failAttempt) {
      await route.fulfill({
        status: 409,
        json: { statusCode: 409, code: 'ATTEMPT_CLOSED', message: 'La actividad ya cerró.' },
      });
      return;
    }
    await route.fulfill({
      status: 201,
      json: {
        attempt: {
          id: 'att-teens-new-1',
          assignmentId: 'asg-teens-blank',
          attemptNumber: 1,
          status: 'in_progress',
          effectiveDueAt: futureDue,
        },
        activity: {
          id: 'act-2',
          title: 'Future Plans Practice',
          type: 'fill_blank',
          level: 'B1',
          config: { items: [] },
        },
        answers: {},
        attemptToken: 'tok-teens-1',
      },
    });
  });

  const startBtn = main
    .locator('article', { hasText: 'Future Plans Practice' })
    .getByRole('button', { name: 'Empezar actividad' });
  await startBtn.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('La actividad ya cerró.');
  const closeModalBtn = dialog.getByRole('button', { name: 'Entendido' });
  await expectTouchTarget(closeModalBtn);
  await closeModalBtn.click();
  await expect(dialog).toBeHidden();

  // 5b. Reintento exitoso al iniciar intento -> navega a /actividad/:id
  failAttempt = false;
  await page.route('**/api/v1/attempts/att-teens-new-1', (route) =>
    route.fulfill({
      status: 200,
      json: {
        attempt: {
          id: 'att-teens-new-1',
          assignmentId: 'asg-teens-blank',
          attemptNumber: 1,
          status: 'in_progress',
          effectiveDueAt: futureDue,
        },
        activity: {
          id: 'act-2',
          title: 'Future Plans Practice',
          type: 'fill_blank',
          level: 'B1',
          config: { items: [] },
        },
        answers: {},
        attemptToken: 'tok-teens-1',
      },
    }),
  );
  await startBtn.click();
  await expect(page).toHaveURL(/\/actividad\/att-teens-new-1$/);
  await page.goto('/inicio');

  // 6. Estado vacío Teens + CTA a /juegos
  mode = 'empty';
  await page.reload();
  await expect(
    main.getByText('No tienes actividades pendientes esta semana. Puedes practicar en la Zona de Microjuegos.'),
  ).toBeVisible();
  const emptyGamesCta = main.getByRole('link', { name: /Ir a Zona de Microjuegos/i });
  await expectTouchTarget(emptyGamesCta);
  await expectAccessible(page);

  // 7. Navegación hacia /juegos
  await emptyGamesCta.click();
  await expect(page).toHaveURL(/\/juegos$/);
});

test('Plan 0 y Plan 1 Teens: flujo real contra API local y PostgreSQL Docker', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const healthy = await page.request
    .get(`${apiUrl}/health`)
    .then((res) => res.status() === 200)
    .catch(() => false);
  test.skip(!healthy, 'Requiere API local activa en http://localhost:3001');

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Correo electrónico' }).fill('camila.teens@upwardenglish.org');
  await page.getByLabel('Contraseña', { exact: true }).fill('Estudiante2026!');

  const [loginRes] = await Promise.all([
    page.waitForResponse(
      (res) => new URL(res.url()).pathname === '/api/v1/auth/login' && res.request().method() === 'POST',
    ),
    page.getByRole('button', { name: 'Entrar', exact: true }).click(),
  ]);
  if (loginRes.status() === 429) {
    test.skip(true, `API local en rate limit (429); Retry-After: ${loginRes.headers()['retry-after'] ?? '—'}s`);
    return;
  }
  expect(loginRes.status(), `Login HTTP ${loginRes.status()}`).toBe(200);

  await expect(page).toHaveURL(/\/inicio$/);
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { name: /Hola, Camila Torres/, level: 1 })).toBeVisible();
  await expect(page.locator('[data-theme="teens"]')).toHaveCSS('background-color', 'rgb(250, 246, 238)');
  await expect(main.getByText(/semanas? activas?/)).toBeVisible();
  await expect(main.getByRole('button', { name: /Escuchar/i })).toHaveCount(0);

  // Verificar conectividad real desde /inicio hacia las demás rutas del estudiante Teens
  const nav = page.getByRole('navigation', { name: 'Navegación del estudiante' });
  for (const [label, expectedPath] of [
    ['Progreso', /\/progreso$/],
    ['Feedback', /\/feedback$/],
  ] as const) {
    await nav.getByRole('link', { name: label }).click();
    await expect(page).toHaveURL(expectedPath);
    await expect(page.locator('[data-theme="teens"]')).toBeVisible();
  }

  await page.locator('header').getByRole('link', { name: /Perfil/i }).click();
  await expect(page).toHaveURL(/\/perfil$/);
  await expect(page.locator('[data-theme="teens"]')).toBeVisible();

  await nav.getByRole('link', { name: 'Inicio' }).click();
  await expect(page).toHaveURL(/\/inicio$/);
  await expectAccessible(page);

  await page.locator('header').getByRole('button', { name: 'Salir' }).click();
  await expect(page).toHaveURL(/\/login/);
});

