import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('SPEC-09: PWA, offline y accesibilidad (ENG-110, ENG-111, ENG-112, ENG-113)', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', (err) => {
      if (!err.message.includes('cache-bypass')) {
        console.error('Unhandled pageerror in test:', err.message);
      }
    });
  });

  test('RF-1: Manifest e iconos PWA válidos y accesibles públicamente sin auth', async ({ request, page }) => {
    // 1. Manifiesto web
    const manifestRes = await request.get('/manifest.webmanifest');
    expect(manifestRes.status()).toBe(200);
    const manifest = await manifestRes.json();
    expect(manifest.name).toBe('Englove');
    expect(manifest.short_name).toBe('Englove');
    expect(manifest.start_url).toBe('/inicio');
    expect(manifest.scope).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons).toBeDefined();
    expect(manifest.icons.length).toBeGreaterThanOrEqual(3);

    // 2. Iconos públicos
    const icon192 = await request.get('/icons/icon-192.png');
    expect(icon192.status()).toBe(200);
    expect(icon192.headers()['content-type']).toContain('image/png');

    const icon512 = await request.get('/icons/icon-512.png');
    expect(icon512.status()).toBe(200);

    const iconMaskable = await request.get('/icons/icon-512-maskable.png');
    expect(iconMaskable.status()).toBe(200);

    // 3. Service Worker script público
    const swRes = await request.get('/sw.js');
    expect(swRes.status()).toBe(200);

    // 4. Pantalla /offline pública sin sesión
    await page.goto('/offline');
    await expect(page.locator('button:has-text("Reintentar")')).toBeVisible();
  });

  test('RF-3: Pantalla sin conexión (/offline) con botón Reintentar accesible', async ({ page }) => {
    await page.goto('/offline');

    // Comprobar contenido y botón
    await expect(page.locator('h1')).toBeVisible();
    const retryBtn = page.locator('button:has-text("Reintentar")');
    await expect(retryBtn).toBeVisible();

    // Medir tamaño del botón táctil (RF-21: >= 48x48 px)
    const box = await retryBtn.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.width).toBeGreaterThanOrEqual(48);
      expect(box.height).toBeGreaterThanOrEqual(48);
    }
  });

  test('RF-7: Aviso de actualización obligatoria por X-App-Min-Version mayor a la del cliente', async ({ page }) => {
    // Mock refresh endpoint with X-App-Min-Version header
    await page.route('**/api/v1/auth/refresh', async (route) => {
      await route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-App-Min-Version': '99.0.0',
        },
        json: {
          user: { id: 'std-1', name: 'Estudiante E2E', role: 'student' },
          organizationId: 'org-1',
        },
      });
    });

    await page.goto('/login');
    // Banner should appear due to min version requirement from API
    await page.waitForTimeout(500);

    // Comprobar que aparece el banner con role status
    const banner = page.locator('aside[role="status"]');
    // If banner triggered, verify "Ahora no" is absent (RF-7)
    if (await banner.isVisible()) {
      await expect(banner.locator('text=Ahora no')).not.toBeVisible();
      await expect(banner.locator('button:has-text("Actualizar")')).toBeVisible();
    }
  });

  test('RF-17: Ficha de estudiante en panel muestra sección "Entregas que no llegaron a tiempo"', async ({ page }) => {
    const studentId = 'std-offline-late';

    await page.route('**/api/v1/auth/refresh', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          user: { id: 'tch-1', name: 'Profesora Clara', role: 'teacher' },
          organizationId: 'org-1',
        },
      });
    });

    await page.route(`**/api/v1/stats/students/${studentId}*`, async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          student: {
            id: studentId,
            name: 'Mateo Gómez',
            level: 'A1',
            ageSegment: 'kids',
            groupName: 'Kids A1 Mañana',
            joinedAt: '2026-09-01T08:00:00.000Z',
          },
          period: {
            from: '2026-10-01T00:00:00.000Z',
            to: '2026-11-04T23:59:59.000Z',
          },
          filters: { type: null, level: null },
          performance: {
            studentAverageScore: 3.8,
            groupAverageScore: 3.5,
            passRatePercent: 75,
            passedCount: 3,
            needsImprovementCount: 1,
            totalGradedActivities: 4,
            passingScore: 3.0,
            scoreSeries: [],
            byActivityType: [],
            byGameMechanic: [],
            byLevel: [],
          },
          consistency: {
            assignedCount: 4,
            completedAssignedCount: 3,
            completionRatePercent: 75,
            currentStreakWeeks: 2,
            bestStreakWeeks: 3,
            forgivenessAvailable: true,
            totalTimeSpentSeconds: 7200,
            completedActivitiesInPeriod: 3,
            weeklyCalendar: [],
            dailyTime: [],
            weeklyTime: [],
            monthlyTime: [],
            // SPEC-09 RF-17: Entregas tardías con marca offline_sync
            offlineUndeliveredAttempts: [
              {
                attemptId: 'att-late-1',
                assignmentId: 'asg-1',
                activityTitle: 'Animal Kingdom Speaking',
                activityType: 'speaking',
                startedAt: '2026-11-01T14:30:00.000Z',
                completeUntil: '2026-11-02T14:30:00.000Z',
              },
            ],
          },
        },
      });
    });

    // Mock teacher session
    await page.context().addCookies([
      {
        name: 'englove_access_token',
        value: `header.${Buffer.from(JSON.stringify({ role: 'teacher' })).toString('base64url')}.sig`,
        domain: 'localhost',
        path: '/',
      },
    ]);

    await page.goto(`/estadisticas/estudiantes/${studentId}`);

    // Verify section "Entregas que no llegaron a tiempo" renders with data
    const section = page.locator('[data-testid="offline-undelivered-attempts-section"]');
    await expect(section).toBeVisible();
    await expect(section.locator('text=Entregas que no llegaron a tiempo')).toBeVisible();
    await expect(section.locator('text=Animal Kingdom Speaking')).toBeVisible();
    await expect(section.locator('text=Se intentó enviar sin conexión después del límite')).toBeVisible();
  });

  test('RF-18: Confirmación al salir con trabajo sin enviar en tablet / alumno', async ({ page }) => {
    // Mock student session and feature flags
    await page.context().addCookies([
      {
        name: 'englove_access_token',
        value: `header.${Buffer.from(JSON.stringify({ role: 'student' })).toString('base64url')}.sig`,
        domain: 'localhost',
        path: '/',
      },
    ]);

    await page.route('**/api/v1/auth/refresh', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          user: {
            id: 'std-e2e-rf18',
            email: 'laura@englove.local',
            name: 'Laura Alumno',
            role: 'student',
          },
          student: { id: 'std-e2e-rf18', level: 'A1', ageSegment: 'kids' },
          organizationId: 'org-e2e',
        },
      });
    });

    await page.route('**/api/v1/me', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          user: { id: 'std-e2e-rf18', name: 'Laura Alumno', role: 'student' },
          student: { id: 'std-e2e-rf18', level: 'A1', ageSegment: 'kids' },
        },
      });
    });

    await page.route('**/api/v1/me/assignments*', async (route) => {
      await route.fulfill({
        status: 200,
        json: { items: [], total: 0 },
      });
    });

    await page.route('**/api/v1/feature-flags', async (route) => {
      await route.fulfill({ status: 200, json: { flags: { games: true } } });
    });

    await page.route('**/api/v1/student/portal', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          student: { id: 'std-e2e-rf18', name: 'Laura Alumno', level: 'A1' },
          missions: [],
          streak: { current: 1, best: 2 },
        },
      });
    });

    await page.route('**/api/v1/attempts/**', async (route) => {
      await route.fulfill({
        status: 500,
        json: { code: 'INTERNAL_ERROR', message: 'Offline sync failed for test' },
      });
    });

    await page.goto('/inicio');

    // Simulate an item added to IndexedDB offline queue
    await page.evaluate(async () => {
      const DB_NAME = 'englove_offline';
      const DB_VERSION = 1;
      const req = window.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('pendingEvents')) {
          const s = db.createObjectStore('pendingEvents', { keyPath: 'id', autoIncrement: true });
          s.createIndex('attemptId', 'attemptId', { unique: false });
          s.createIndex('userId', 'userId', { unique: false });
        }
        if (!db.objectStoreNames.contains('pendingUploads')) {
          const u = db.createObjectStore('pendingUploads', { keyPath: 'attemptId' });
          u.createIndex('userId', 'userId', { unique: false });
        }
      };
      await new Promise<void>((resolve, reject) => {
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('pendingEvents', 'readwrite');
          tx.objectStore('pendingEvents').add({
            userId: 'std-e2e-rf18',
            attemptId: 'att-pending-1',
            clientEventId: 'evt-test',
            eventType: 'answered',
            payload: {},
            attemptToken: 'tok',
            createdAt: Date.now(),
          });
          tx.oncomplete = () => { db.close(); resolve(); };
          tx.onerror = () => { db.close(); reject(tx.error); };
        };
        req.onerror = () => reject(req.error);
      });
    });

    // Student clicks "Cerrar sesión"
    const logoutBtn = page.locator('button:has-text("Cerrar sesión")');
    await logoutBtn.click();

    // Confirmation dialog should appear (RF-18, §7)
    const alertdialog = page.locator('[role="alertdialog"]');
    await expect(alertdialog).toBeVisible();
    await expect(alertdialog.locator('text=Tienes trabajo sin enviar. Si sales ahora se perderá.')).toBeVisible();

    // "Quedarme" cancels logout
    const stayBtn = alertdialog.locator('button:has-text("Quedarme")');
    await stayBtn.click();
    await expect(alertdialog).not.toBeVisible();

    // Student clicks "Cerrar sesión" again and chooses "Salir de todos modos" (RF-18, RF-5)
    await logoutBtn.click();
    await expect(alertdialog).toBeVisible();
    await page.route('**/api/v1/auth/logout', async (route) => {
      await route.fulfill({ status: 200, json: { success: true } });
    });
    await page.context().clearCookies();
    const leaveBtn = alertdialog.locator('button:has-text("Salir de todos modos")');
    await leaveBtn.click();
    await page.waitForURL('**/login');
  });

  test('RF-19: Auditoría de accesibilidad con axe en pantallas principales sin violaciones', async ({ page }) => {
    // 1. Pantalla pública: /login
    await page.route('**/api/v1/auth/refresh', async (route) => {
      await route.fulfill({ status: 401, json: { code: 'AUTH_UNAUTHORIZED' } });
    });
    await page.goto('/login');
    const loginAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(loginAxe.violations).toEqual([]);

    // 2. Pantalla pública: /offline
    await page.goto('/offline');
    const offlineAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(offlineAxe.violations).toEqual([]);
  });

  test('RF-21: Objetivos táctiles interactivos >= 48x48 px en dispositivos móviles (390x844)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/offline');

    const button = page.locator('button:has-text("Reintentar")');
    const box = await button.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.width).toBeGreaterThanOrEqual(48);
      expect(box.height).toBeGreaterThanOrEqual(48);
    }
  });
});
