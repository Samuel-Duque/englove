import { test, expect } from '@playwright/test';

test.describe('SPEC-01 & SPEC-02: Rutas Públicas y Flujos de Autenticación (ENG-145)', () => {
  test.beforeEach(async ({ page }) => {
    // Monitor uncaught exceptions and page errors
    page.on('pageerror', (err) => {
      // Ignore benign Next dev cache bypass logs
      if (!err.message.includes('cache-bypass')) {
        console.error('Unhandled pageerror in test:', err.message);
      }
    });
  });

  test('1. /login: Renderizado, validación de credenciales inválidas (401), bloqueo (423) y aprobación pendiente', async ({
    page,
    context,
  }) => {
    // Mock silent refresh as 401 so login form displays
    await page.route('**/api/v1/auth/refresh', async (route) => {
      await route.fulfill({ status: 401, json: { code: 'AUTH_UNAUTHORIZED' } });
    });

    // 1.1 Renderizado de login
    await page.goto('/login');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    await expect(page.locator('text=Olvidé mi contraseña')).toBeVisible();
    await expect(page.locator('text=Crear cuenta')).toBeVisible();

    // 1.2 Credenciales inválidas (401)
    await page.route('**/api/v1/auth/login', async (route) => {
      await route.fulfill({
        status: 401,
        json: { code: 'AUTH_INVALID_CREDENTIALS', message: 'El correo o la contraseña no son correctos' },
      });
    });

    await page.fill('input[type="email"]', 'wrong@englove.local');
    await page.fill('input[type="password"]', 'WrongPass123');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=El correo o la contraseña no son correctos')).toBeVisible();

    // 1.3 Cuenta bloqueada (423 AUTH_ACCOUNT_LOCKED tras 10 intentos fallidos)
    await page.route('**/api/v1/auth/login', async (route) => {
      await route.fulfill({
        status: 423,
        json: { code: 'AUTH_ACCOUNT_LOCKED', message: 'Demasiados intentos. Intenta de nuevo en unos minutos' },
      });
    });

    await page.fill('input[type="password"]', 'AttemptTenFail123');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Demasiados intentos. Intenta de nuevo en unos minutos')).toBeVisible();

    // 1.4 Cuenta en pending_approval
    await page.route('**/api/v1/auth/login', async (route) => {
      await route.fulfill({
        status: 403,
        json: { code: 'ACCOUNT_PENDING_APPROVAL', message: 'Tu cuenta está pendiente de aprobación por tu profesora' },
      });
    });

    await page.fill('input[type="email"]', 'pending@englove.local');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Tu cuenta está pendiente de aprobación por tu profesora')).toBeVisible();

    // 1.5 Login exitoso redirige a /inicio
    await page.route('**/api/v1/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          user: { id: 'usr-1', email: 'valid@englove.local', name: 'Usuario Valido', role: 'teacher' },
          organizationId: 'org-1',
        },
      });
    });

    // Provide mock session responses for /inicio
    await page.route('**/api/v1/auth/refresh', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          user: { id: 'usr-1', email: 'valid@englove.local', name: 'Usuario Valido', role: 'teacher' },
          organizationId: 'org-1',
        },
      });
    });
    await page.route('**/api/v1/dashboard/reminders', async (route) => {
      await route.fulfill({
        status: 200,
        json: { pendingRegistrations: 0, overdueReviews: 0, ungradedReminderDays: 3 },
      });
    });

    await context.addCookies([
      { name: 'englove_access_token', value: 'token-valid', domain: 'localhost', path: '/' },
      { name: 'englove_local_access_token', value: 'token-valid', domain: 'localhost', path: '/' },
    ]);

    await page.fill('input[type="email"]', 'valid@englove.local');
    await page.fill('input[type="password"]', 'ValidPass123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/inicio/);
  });

  test('2. /registro: Auto-registro de estudiante con validación de política de contraseña y sin enumeración', async ({
    page,
  }) => {
    await page.goto('/registro');
    await expect(page.locator('h1:has-text("Crear cuenta")')).toBeVisible();

    // 2.1 Validación client-side de política de contraseña (8–16 caracteres, sin espacios)
    await page.fill('input#name', 'Sofía Gómez');
    await page.fill('input#email', 'sofia@englove.local');
    await page.fill('input#birthDate', '2016-05-15');
    await page.fill('input#password', 'short');
    await page.check('input[type="checkbox"]');
    await page.click('button[type="submit"]');
    await expect(page.locator('div[role="alert"]:has-text("Usa entre 8 y 16 caracteres, sin espacios")')).toBeVisible();

    // Contraseña con espacios rechazada
    await page.fill('input#password', 'pass with space');
    await page.click('button[type="submit"]');
    await expect(page.locator('div[role="alert"]:has-text("Usa entre 8 y 16 caracteres, sin espacios")')).toBeVisible();

    // 2.2 Envío exitoso sin enumeración de correos
    await page.route('**/api/v1/auth/signup', async (route) => {
      await route.fulfill({
        status: 201,
        json: {
          message: 'Recibimos tu solicitud. Revisa tu correo.',
        },
      });
    });

    await page.fill('input#password', 'SecurePass123');
    await page.fill('input#guardianName', 'Padre de Sofía');
    await page.fill('input#guardianContact', 'padre@correo.com');
    await page.click('button[type="submit"]');

    // Mensaje uniforme de confirmación
    await expect(page.locator('text=Solicitud recibida')).toBeVisible();
    await expect(page.locator('text=Recibimos tu solicitud. Revisa tu correo.')).toBeVisible();
    await expect(page.locator('a:has-text("Ir a iniciar sesión")')).toBeVisible();
  });

  test('3. /recuperar-contrasena: Flujo de recuperación sin enumeración de correos', async ({ page }) => {
    await page.goto('/recuperar-contrasena');
    await expect(page.locator('h1:has-text("Recuperar contraseña")')).toBeVisible();

    await page.route('**/api/v1/auth/forgot-password', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          message: 'Si el correo tiene una cuenta, recibirás un enlace para restablecer tu contraseña.',
        },
      });
    });

    await page.fill('input#email', 'alguien@englove.local');
    await page.click('button[type="submit"]');

    await expect(page.locator('h1:has-text("Revisa tu correo")')).toBeVisible();
    await expect(
      page.locator('text=Si el correo tiene una cuenta, recibirás un enlace para restablecer tu contraseña.'),
    ).toBeVisible();
    await expect(page.locator('a:has-text("Volver a iniciar sesión")')).toBeVisible();
  });

  test('4. /restablecer/[token]: Restablecimiento con token, manejo de token inválido y éxito', async ({ page }) => {
    // 4.1 Token inválido o expirado
    await page.route('**/api/v1/auth/reset-password', async (route) => {
      await route.fulfill({
        status: 400,
        json: {
          code: 'PASSWORD_RESET_INVALID',
          message: 'El enlace no es válido o ya venció. Solicita uno nuevo',
        },
      });
    });

    await page.goto('/restablecer/token-expirado-123');
    await expect(page.locator('h1:has-text("Crear nueva contraseña")')).toBeVisible();

    await page.fill('input#newPassword', 'NewPass1234');
    await page.fill('input#confirmPassword', 'NewPass1234');
    await page.click('button[type="submit"]');

    await expect(page.locator('text=El enlace no es válido o ya venció. Solicita uno nuevo')).toBeVisible();
    await expect(page.locator('a:has-text("Solicitar un nuevo enlace")')).toBeVisible();

    // 4.2 Restablecimiento exitoso con token válido
    await page.route('**/api/v1/auth/reset-password', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          message: 'Contraseña actualizada. Inicia sesión.',
        },
      });
    });

    await page.goto('/restablecer/token-valido-456');
    await page.fill('input#newPassword', 'FreshPass890');
    await page.fill('input#confirmPassword', 'FreshPass890');
    await page.click('button[type="submit"]');

    await expect(page.locator('h1:has-text("Contraseña actualizada")')).toBeVisible();
    await expect(page.locator('text=Contraseña actualizada. Inicia sesión.')).toBeVisible();
    await expect(page.locator('a:has-text("Iniciar sesión")')).toBeVisible();
  });

  test('5. /recuperar: Redirección transparente a /recuperar-contrasena', async ({ page }) => {
    await page.goto('/recuperar');
    await expect(page).toHaveURL(/\/recuperar-contrasena/);
    await expect(page.locator('h1:has-text("Recuperar contraseña")')).toBeVisible();
  });
});
