import { addSessionCookie } from './session';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator } from '@playwright/test';
import type { StudentProfileView } from '@upward-english/shared';

async function expectTouchSize(control: Locator, minimumHeight = 48) {
  await expect(control).toBeVisible();
  const box = await control.boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(48);
  expect(box?.height).toBeGreaterThanOrEqual(minimumHeight);
}

test('Plan 8 Kids: carga, reintento, credencial civil, permiso del servidor y controles responsive', async ({
  page, context, baseURL,
}) => {
  test.setTimeout(90_000);
  const email = 'correo.muy.largo.para.comprobar.el.ajuste.del.perfil@example.test';
  const profile: StudentProfileView = {
    user: { id: 'test-student', name: 'Exploradora de prueba', email, role: 'student' },
    student: {
      id: 'test-student',
      ageSegment: 'kids',
      level: 'A1',
      canSwitchInterface: false,
      birthDate: '2013-06-09T00:00:00.000Z',
    },
  };

  await addSessionCookie(context, 'mock-student-token', baseURL);

  let releaseLoading: () => void = () => {};
  const loading = new Promise<void>((resolve) => { releaseLoading = resolve; });
  let unavailable = true;
  await page.route('**/api/v1/me', async (route) => {
    await loading;
    await route.fulfill(unavailable
      ? { status: 503, json: { message: 'Error interno de prueba' } }
      : { json: profile });
  });
  await page.route('**/api/v1/feature-flags', (route) =>
    route.fulfill({ json: { flags: { games: true, extra_content: true } } }),
  );

  const viewports = [
    { width: 390, height: 844 },
    { width: 800, height: 1280 },
    { width: 1280, height: 800 },
    { width: 320, height: 720 },
  ] as const;
  await page.setViewportSize(viewports[0]);
  await page.goto('/perfil');
  const main = page.getByRole('main');
  await expect(main.getByRole('status')).toHaveText('Cargando tu perfil…');
  releaseLoading();
  await expect(main.getByRole('alert')).toContainText('No pudimos cargar tu perfil');
  await expect(main.getByRole('alert')).not.toContainText('Error interno de prueba');
  const retry = main.getByRole('button', { name: 'Reintentar' });
  await expectTouchSize(retry, 52);
  unavailable = false;
  await retry.press('Enter');
  await expect(main.getByRole('heading', { name: /Credencial de Explorador/ })).toBeVisible();
  await expect(main.getByText('9/6/2013', { exact: true })).toBeVisible();
  await expect(main.getByText(email, { exact: true })).toBeVisible();
  await expect(main.getByText('Kids · Zorro Explorador')).toBeVisible();
  await expect(main.getByRole('button', { name: /^Teens/ })).toHaveCount(0);

  if (!profile.student) throw new Error('El fixture requiere un perfil de estudiante.');
  profile.student.canSwitchInterface = true;
  await page.reload();
  const kids = main.getByRole('button', { name: /^Kids/ });
  const teens = main.getByRole('button', { name: /^Teens/ });
  await expect(kids).toHaveAttribute('aria-pressed', 'true');
  await expect(teens).toHaveAttribute('aria-pressed', 'false');
  const layoutShift = await page.evaluate(async () => {
    let total = 0;
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const value = Reflect.get(entry, 'value');
        if (!Reflect.get(entry, 'hadRecentInput') && typeof value === 'number') total += value;
      }
    });
    observer.observe({ type: 'layout-shift', buffered: true });
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    observer.disconnect();
    return total;
  });
  expect(layoutShift).toBeLessThanOrEqual(0.1);
  const openEmail = main.getByRole('button', { name: 'Cambiar correo electrónico' });
  const cancel = main.getByRole('button', { name: 'Cancelar' });

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await expectTouchSize(kids, 96);
    await expectTouchSize(teens, 96);
    const [kidsBox, teensBox] = await Promise.all([kids.boundingBox(), teens.boundingBox()]);
    expect(kidsBox?.y === teensBox?.y).toBe(viewport.width >= 640);
    await expectTouchSize(openEmail);
    await openEmail.press('Enter');
    const emailInput = main.getByLabel('Nuevo correo electrónico');
    const passwordInput = main.getByLabel('Contraseña actual para confirmar');
    await expect(emailInput).toBeFocused();
    for (const input of [emailInput, passwordInput]) {
      await expectTouchSize(input);
      await expect(input).toHaveCSS('font-size', '16px');
    }
    await expectTouchSize(main.getByRole('button', { name: 'Solicitar cambio' }), 52);
    await expectTouchSize(cancel);
    const overflow = await page.locator('html').evaluate((root) => root.scrollWidth - root.clientWidth);
    expect(overflow, `Desborde a ${viewport.width}px`).toBe(0);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
    await cancel.press('Enter');
    await expect(openEmail).toBeFocused();
  }

  await page.route('**/api/v1/me/interface', async (route) => {
    const { ageSegment } = route.request().postDataJSON();
    expect(route.request().method()).toBe('PATCH');
    expect(['kids', 'teens']).toContain(ageSegment);
    if (profile.student) profile.student.ageSegment = ageSegment;
    await route.fulfill({ json: profile });
  });
  await teens.press('Enter');
  await expect(main.getByRole('heading', { name: 'Mi Perfil', level: 1 })).toBeVisible();
  await expect(main.getByRole('status')).toHaveText('¡Interfaz actualizada a Teens!');
  await expect(teens).toHaveAttribute('aria-pressed', 'true');
  await kids.press('Enter');
  await expect(main.getByRole('heading', { name: /Credencial de Explorador/, level: 1 })).toBeVisible();
  await expect(main.getByRole('status')).toHaveText('¡Interfaz actualizada a Kids!');
});
