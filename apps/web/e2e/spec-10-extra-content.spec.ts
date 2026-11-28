import { addSessionCookie } from './session';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('SPEC-10: Contenido Extra — E2E y Accesibilidad (ENG-120, ENG-121)', () => {
  const teacherPayload = Buffer.from(
    JSON.stringify({
      sub: '22222222-2222-4222-8222-222222222222',
      email: 'profesora@upwardenglish.app',
      role: 'teacher',
      org: '11111111-1111-4111-8111-111111111111',
      sid: 'sid-teacher-1',
    }),
  ).toString('base64url');
  const teacherToken = `header.${teacherPayload}.sig`;

  const studentPayload = Buffer.from(
    JSON.stringify({
      sub: '33333333-3333-4333-8333-333333333333',
      email: 'alumno@upwardenglish.app',
      role: 'student',
      org: '11111111-1111-4111-8111-111111111111',
      sid: 'sid-student-1',
      student_id: '44444444-4444-4444-8444-444444444444',
      age_segment: 'kids',
    }),
  ).toString('base64url');
  const studentToken = `header.${studentPayload}.sig`;

  test.describe('1. Panel Docente: /contenido-extra (ENG-120, RF-1 a RF-4)', () => {
    test.beforeEach(async ({ context, page }) => {
      await addSessionCookie(context, teacherToken);

      await page.route('**/api/v1/auth/refresh', async (route) => {
        await route.fulfill({
          status: 200,
          json: {
            accessToken: teacherToken,
            user: {
              id: '22222222-2222-4222-8222-222222222222',
              email: 'profesora@upwardenglish.app',
              role: 'teacher',
              organizationId: '11111111-1111-4111-8111-111111111111',
              name: 'Profesora Principal',
            },
          },
        });
      });
    });

    test('1.1 Estado vacío y banner de sección oculta para estudiantes (RF-3, RF-4)', async ({ page }) => {
      await page.route('**/api/v1/feature-flags', async (route) => {
        await route.fulfill({
          status: 200,
          json: {
            flags: { games: true, extra_content: false },
            config: { passing_score: 3.0, retention_days: 30, pending_upload_ttl_days: 7, ungraded_reminder_days: 3 },
          },
        });
      });

      await page.route('**/api/v1/resources*', async (route) => {
        await route.fulfill({
          status: 200,
          json: { items: [], total: 0 },
        });
      });

      await page.goto('/contenido-extra');

      // Verifica aviso de sección oculta
      await expect(page.locator('text=Sección oculta para los estudiantes')).toBeVisible();
      await expect(page.locator('text=Puedes preparar los enlaces y activarla cuando estés lista.')).toBeVisible();

      // Verifica estado vacío
      await expect(page.locator('text=Aún no has publicado enlaces de contenido extra.')).toBeVisible();
      await expect(page.locator('button:has-text("Agregar primer enlace")')).toBeVisible();
    });

    test('1.2 Validación en línea de URL https:// en formulario modal (RF-1, RF-4)', async ({ page }) => {
      await page.route('**/api/v1/feature-flags', async (route) => {
        await route.fulfill({
          status: 200,
          json: {
            flags: { games: true, extra_content: true },
            config: { passing_score: 3.0, retention_days: 30, pending_upload_ttl_days: 7, ungraded_reminder_days: 3 },
          },
        });
      });

      await page.route('**/api/v1/resources*', async (route) => {
        await route.fulfill({
          status: 200,
          json: { items: [], total: 0 },
        });
      });

      await page.goto('/contenido-extra');
      await page.click('button:has-text("+ Nuevo enlace")');

      // Modal abierto
      await expect(page.locator('h2#modal-title')).toHaveText('Nuevo enlace');

      // Intenta enviar con http:// inseguro
      await page.fill('#form-title', 'Prueba Insegura');
      await page.fill('#form-url', 'http://insecure.com/resource');
      await page.click('button[type="submit"]');

      // Debe mostrar advertencia en línea sin llamar a la API
      await expect(page.locator('text=Ingresa un enlace válido que comience con https://')).toBeVisible();

      // Cierre con Escape
      await page.keyboard.press('Escape');
      await expect(page.locator('h2#modal-title')).not.toBeVisible();
    });

    test('1.3 Creación, renderizado, reordenamiento y confirmación de borrado (RF-1, RF-2, RF-4)', async ({ page }) => {
      let extraFlag = false;
      const mockResources = [
        {
          id: '00000000-0000-4000-8000-000000000001',
          title: 'Animals Memory - Educaplay',
          url: 'https://es.educaplay.com/recursos/1',
          description: 'Repaso vocabulario',
          level: 'A1',
          position: 0,
          createdBy: '22222222-2222-4222-8222-222222222222',
          createdAt: '2026-11-04T12:00:00.000Z',
          updatedAt: '2026-11-04T12:00:00.000Z',
        },
        {
          id: '00000000-0000-4000-8000-000000000002',
          title: 'Diccionario Cambridge',
          url: 'https://dictionary.cambridge.org/es/',
          description: 'Diccionario visual general',
          level: null,
          position: 1,
          createdBy: '22222222-2222-4222-8222-222222222222',
          createdAt: '2026-11-04T12:05:00.000Z',
          updatedAt: '2026-11-04T12:05:00.000Z',
        },
      ];

      await page.route('**/api/v1/feature-flags', async (route) => {
        await route.fulfill({
          status: 200,
          json: {
            flags: { games: true, extra_content: extraFlag },
            config: { passing_score: 3.0, retention_days: 30, pending_upload_ttl_days: 7, ungraded_reminder_days: 3 },
          },
        });
      });

      await page.route('**/api/v1/feature-flags/extra_content', async (route) => {
        const body = JSON.parse(route.request().postData() || '{}');
        extraFlag = Boolean(body.enabled);
        await route.fulfill({
          status: 200,
          json: {
            flags: { games: true, extra_content: extraFlag },
            config: { passing_score: 3.0, retention_days: 30, pending_upload_ttl_days: 7, ungraded_reminder_days: 3 },
          },
        });
      });

      await page.route('**/api/v1/resources*', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            json: { items: mockResources, total: mockResources.length },
          });
        } else if (route.request().method() === 'DELETE') {
          await route.fulfill({ status: 204 });
        }
      });

      await page.goto('/contenido-extra');

      // 1. Alterna el flag de visibilidad
      await page.click('button:has-text("○ Oculto para estudiantes")');
      await expect(page.locator('text=✓ Visible para estudiantes')).toBeVisible();

      // 2. Renderizado de lista
      await expect(page.locator('text=Animals Memory - Educaplay')).toBeVisible();
      await expect(page.locator('span:has-text("Nivel A1")')).toBeVisible();
      await expect(page.locator('text=Diccionario Cambridge')).toBeVisible();
      await expect(page.locator('span:has-text("General")')).toBeVisible();

      // 3. Modal de confirmación de borrado (RF-4)
      await page
        .getByRole('list', { name: 'Lista de recursos de contenido extra' })
        .getByRole('button', { name: 'Eliminar' })
        .first()
        .click();
      await expect(
        page.locator('text=¿Eliminar el enlace "Animals Memory - Educaplay"? Dejará de aparecer en el portal inmediatamente.'),
      ).toBeVisible();

      await page.click('button:has-text("Cancelar")');
      await expect(page.locator('text=¿Eliminar el enlace')).not.toBeVisible();
    });

    test('1.4 Auditoría de accesibilidad con axe en /contenido-extra sin violaciones (T-05)', async ({ page }) => {
      await page.route('**/api/v1/feature-flags', async (route) => {
        await route.fulfill({
          status: 200,
          json: {
            flags: { games: true, extra_content: true },
            config: { passing_score: 3.0, retention_days: 30, pending_upload_ttl_days: 7, ungraded_reminder_days: 3 },
          },
        });
      });

      await page.route('**/api/v1/resources*', async (route) => {
        await route.fulfill({
          status: 200,
          json: {
            items: [
              {
                id: '00000000-0000-4000-8000-000000000001',
                title: 'Animals Memory - Educaplay',
                url: 'https://es.educaplay.com/recursos/1',
                description: 'Repaso vocabulario',
                level: 'A1',
                position: 0,
                createdBy: '22222222-2222-4222-8222-222222222222',
                createdAt: '2026-11-04T12:00:00.000Z',
                updatedAt: '2026-11-04T12:00:00.000Z',
              },
            ],
            total: 1,
          },
        });
      });

      await page.goto('/contenido-extra');

      const axeResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(axeResults.violations).toEqual([]);
    });
  });

  test.describe('2. Portal del Estudiante: /extra (ENG-121, RF-5 a RF-9)', () => {
    test.beforeEach(async ({ context, page }) => {
      await addSessionCookie(context, studentToken);

      await page.route('**/api/v1/auth/refresh', async (route) => {
        await route.fulfill({
          status: 200,
          json: {
            accessToken: studentToken,
            user: {
              id: '33333333-3333-4333-8333-333333333333',
              email: 'alumno@upwardenglish.app',
              role: 'student',
              organizationId: '11111111-1111-4111-8111-111111111111',
              name: 'Lucas Diaz',
            },
          },
        });
      });

      await page.route('**/api/v1/me', async (route) => {
        await route.fulfill({
          status: 200,
          json: {
            user: {
              id: '33333333-3333-4333-8333-333333333333',
              email: 'alumno@upwardenglish.app',
              name: 'Lucas Diaz',
              role: 'student',
            },
            student: {
              id: '44444444-4444-4444-8444-444444444444',
              birthDate: '2017-05-15',
              age: 9,
              ageSegment: 'kids',
              level: 'A1',
              canSwitchInterface: false,
              approvalStatus: 'approved',
              guardianName: null,
              guardianContact: null,
              currentGroup: { id: 'g1', name: 'Kids Explorers' },
            },
          },
        });
      });
    });

    test('2.1 Bloqueo amigable cuando extra_content está desactivado (RF-3, RF-5)', async ({ page }) => {
      await page.route('**/api/v1/feature-flags', async (route) => {
        await route.fulfill({
          status: 200,
          json: {
            flags: { games: true, extra_content: false },
            config: { passing_score: 3.0, retention_days: 30, pending_upload_ttl_days: 7, ungraded_reminder_days: 3 },
          },
        });
      });

      await page.goto('/extra');

      await expect(page.locator('text=Contenido extra no disponible')).toBeVisible();
      await expect(page.locator('text=El contenido extra no está habilitado en este momento.')).toBeVisible();
      await expect(page.locator('a:has-text("Volver al inicio")')).toBeVisible();
      await expect(page.getByRole('link', { name: 'Contenido extra', exact: true })).toHaveCount(0);
    });

    test('2.2 Portal /extra activo: navegación, tarjetas, enlace seguro rel="noopener noreferrer" y TTS (RF-5, RF-6, RF-9)', async ({
      page,
    }) => {
      await page.route('**/api/v1/feature-flags', async (route) => {
        await route.fulfill({
          status: 200,
          json: {
            flags: { games: true, extra_content: true },
            config: { passing_score: 3.0, retention_days: 30, pending_upload_ttl_days: 7, ungraded_reminder_days: 3 },
          },
        });
      });

      await page.route('**/api/v1/resources', async (route) => {
        await route.fulfill({
          status: 200,
          json: {
            items: [
              {
                id: '00000000-0000-4000-8000-000000000001',
                title: 'Animals Memory Game',
                url: 'https://es.educaplay.com/recursos/animals.html',
                description: 'Memoria de animales y colores',
                level: 'A1',
                position: 0,
                createdBy: 'prof-1',
                createdAt: '2026-11-04T12:00:00.000Z',
                updatedAt: '2026-11-04T12:00:00.000Z',
              },
              {
                id: '00000000-0000-4000-8000-000000000002',
                title: 'Cambridge English Dictionary',
                url: 'https://dictionary.cambridge.org/es/',
                description: 'Diccionario interactivo con pronunciación',
                level: null,
                position: 1,
                createdBy: 'prof-1',
                createdAt: '2026-11-04T12:05:00.000Z',
                updatedAt: '2026-11-04T12:05:00.000Z',
              },
            ],
            total: 2,
          },
        });
      });

      await page.goto('/extra');

      // Verifica entrada en StudentNav con max 5 items
      const extraNavLink = page.locator('a[aria-label="Contenido extra"]');
      await expect(extraNavLink).toBeVisible();

      // Verifica tarjetas
      await expect(page.locator('text=Animals Memory Game')).toBeVisible();
      await expect(page.locator('text=Cambridge English Dictionary')).toBeVisible();

      // Verifica enlace externo seguro en pestaña nueva (RF-6)
      const externalLink = page.getByRole('link', { name: 'Abrir recurso externo' }).first();
      await expect(externalLink).toHaveAttribute('target', '_blank');
      await expect(externalLink).toHaveAttribute('rel', 'noopener noreferrer');
      await expect(externalLink).toHaveAttribute('href', 'https://es.educaplay.com/recursos/animals.html');

      // Filtro local por píldora (RF-5)
      await page.getByRole('button', { name: 'Para todos' }).click();
      await expect(page.locator('text=Cambridge English Dictionary')).toBeVisible();
      await expect(page.locator('text=Animals Memory Game')).not.toBeVisible();
    });

    test('2.3 Auditoría de accesibilidad con axe en /extra (kids y teens) sin violaciones (T-05)', async ({ page }) => {
      await page.route('**/api/v1/feature-flags', async (route) => {
        await route.fulfill({
          status: 200,
          json: {
            flags: { games: true, extra_content: true },
            config: { passing_score: 3.0, retention_days: 30, pending_upload_ttl_days: 7, ungraded_reminder_days: 3 },
          },
        });
      });

      await page.route('**/api/v1/resources', async (route) => {
        await route.fulfill({
          status: 200,
          json: {
            items: [
              {
                id: '00000000-0000-4000-8000-000000000001',
                title: 'Animals Memory Game',
                url: 'https://es.educaplay.com/recursos/animals.html',
                description: 'Memoria de animales y colores',
                level: 'A1',
                position: 0,
                createdBy: 'prof-1',
                createdAt: '2026-11-04T12:00:00.000Z',
                updatedAt: '2026-11-04T12:00:00.000Z',
              },
            ],
            total: 1,
          },
        });
      });

      // 1. Kids theme
      await page.goto('/extra');
      await expect(page.getByRole('heading', { name: 'Mapa de Recursos' })).toBeVisible();
      const kidsAxe = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(kidsAxe.violations).toEqual([]);

      // 2. Teens theme
      await page.route('**/api/v1/me', async (route) => {
        await route.fulfill({
          status: 200,
          json: {
            user: {
              id: '33333333-3333-4333-8333-333333333333',
              email: 'teens@upwardenglish.app',
              name: 'Camila Torres',
              role: 'student',
            },
            student: {
              id: '44444444-4444-4444-8444-444444444444',
              birthDate: '2012-08-10',
              age: 14,
              ageSegment: 'teens',
              level: 'B1',
              canSwitchInterface: false,
              approvalStatus: 'approved',
              guardianName: null,
              guardianContact: null,
              currentGroup: { id: 'g2', name: 'Teens Leaders' },
            },
          },
        });
      });

      await page.goto('/extra');
      await expect(page.getByRole('heading', { name: 'Contenido extra', exact: true })).toBeVisible();
      await page.locator('[data-theme="teens"]').evaluate(async (shell) => {
        await Promise.all(shell.getAnimations().map((animation) => animation.finished));
      });
      const teensAxe = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(teensAxe.violations).toEqual([]);
    });

    test('2.4 Mapa Kids adaptable y controles táctiles (RF-9, T-05)', async ({ page, context }) => {
      await page.addInitScript(() => {
        Object.defineProperty(window.speechSynthesis, 'getVoices', { value: () => [{}] });
        Object.defineProperty(window.speechSynthesis, 'speak', { value: () => undefined });
      });

      await page.route('**/api/v1/feature-flags', async (route) => {
        await route.fulfill({
          status: 200,
          json: {
            flags: { games: true, extra_content: true },
            config: { passing_score: 3.0, retention_days: 30, pending_upload_ttl_days: 7, ungraded_reminder_days: 3 },
          },
        });
      });

      await page.route('**/api/v1/resources', async (route) => {
        await route.fulfill({
          status: 200,
          json: {
            items: [
              {
                id: '00000000-0000-4000-8000-000000000001',
                title: 'Animals Memory Game',
                url: `https://${'exploradores'.repeat(5)}.${'recursos'.repeat(7)}.example/animals.html`,
                description: 'Memoria de animales y colores',
                level: 'A1',
                position: 0,
                createdBy: 'prof-1',
                createdAt: '2026-11-04T12:00:00.000Z',
                updatedAt: '2026-11-04T12:00:00.000Z',
              },
              {
                id: '00000000-0000-4000-8000-000000000002',
                title: 'Recurso sin HTTPS',
                url: 'http://example.com',
                level: 'A1',
              },
            ],
            total: 2,
          },
        });
      });

      await page.goto('/extra');

      const externalButton = page.getByRole('link', { name: 'Abrir recurso externo' });
      const listenButton = page.getByRole('button', { name: /Escuchar: .*Animals Memory Game/ });
      await expect(externalButton).toBeVisible();
      await expect(page.getByRole('button', { name: 'Enlace no disponible' })).toBeDisabled();
      await expect(page.locator('main iframe, main embed, main object')).toHaveCount(0);

      const viewports = [
        { width: 320, height: 720 },
        { width: 390, height: 844 },
        { width: 800, height: 1280 },
        { width: 1280, height: 800 },
      ];
      for (const { width, height } of viewports) {
        await page.setViewportSize({ width, height });
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        const rows = await page.getByRole('list', { name: 'Tarjetas de contenido extra' })
          .getByRole('listitem').evaluateAll((cards) => cards.map((card) => card.getBoundingClientRect().top));
        expect(new Set(rows).size).toBe(width <= 680 ? 2 : 1);
        for (const control of [externalButton, listenButton, page.getByRole('button', { name: 'Todos', exact: true })]) {
          const box = await control.boundingBox();
          expect(box?.width).toBeGreaterThanOrEqual(48);
          expect(box?.height).toBeGreaterThanOrEqual(48);
        }
      }

      await listenButton.click();
      const stopButton = page.getByRole('button', { name: /Detener: .*Animals Memory Game/ });
      await expect(stopButton).toHaveAttribute('aria-pressed', 'true');
      await stopButton.click();
      await expect(listenButton).toHaveAttribute('aria-pressed', 'false');

      await page.getByRole('button', { name: 'Para todos' }).click();
      await expect(page.getByText('Aún no hay enlaces en este filtro.')).toBeVisible();
      await page.getByRole('button', { name: 'Tu nivel' }).click();
      await expect(externalButton).toBeVisible();
      await context.setOffline(true);
      await expect(page.getByText('Necesitas conexión a internet para abrir enlaces externos.')).toBeVisible();
      await expect(externalButton).toHaveCount(0);
      await context.setOffline(false);
      await expect(externalButton).toBeVisible();
    });
  });
});
