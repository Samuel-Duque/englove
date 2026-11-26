import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator } from '@playwright/test';
import type { StudentProfileView } from '@upward-english/shared';

async function expectTouchTarget(control: Locator, height = 48) {
  const box = await control.boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(48);
  expect(box?.height).toBeGreaterThanOrEqual(height);
}

test('Plan 8 Teens: credencial, permiso del servidor y cambio de correo accesible', async ({
  page, context, baseURL,
}) => {
  test.setTimeout(90_000);
  const email = 'valentina.correo.largo.para.probar.el.ajuste@example.test';
  const newEmail = 'valentina.nuevo.correo.largo.para.probar.el.ajuste@example.test';
  let canSwitchInterface = false;
  const profile: StudentProfileView = {
    user: { id: 'teens-profile', name: 'Valentina Cruz', email, role: 'student' },
    student: {
      id: 'teens-profile', ageSegment: 'teens', level: 'B1',
      canSwitchInterface, birthDate: '2013-06-09T00:00:00.000Z',
    },
  };

  for (const prefix of new Set([
    process.env.COOKIE_PREFIX ?? process.env.NEXT_PUBLIC_COOKIE_PREFIX,
    'englove_local_', 'upward_english_local_', 'upward_english_',
  ])) {
    if (prefix) {
      await context.addCookies([{ name: `${prefix}access_token`, value: 'mock-teens-token', url: baseURL }]);
    }
  }
  await page.route('**/api/v1/me', (route) => route.fulfill({
    json: { ...profile, student: { ...profile.student, canSwitchInterface } },
  }));
  await page.route('**/api/v1/feature-flags', (route) =>
    route.fulfill({ json: { flags: { games: true, extra_content: true } } }),
  );
  await page.route('**/api/v1/me/email-change', async (route) => {
    expect(route.request().method()).toBe('POST');
    expect(route.request().postDataJSON()).toEqual({ newEmail, password: 'test-password' });
    await route.fulfill({ status: 202, json: {} });
  });
  await page.route('**/api/v1/me/email-change/confirm', async (route) => {
    expect(route.request().method()).toBe('POST');
    const { otp } = route.request().postDataJSON();
    if (otp === '111111') {
      await route.fulfill({ status: 400, json: { message: 'Código incorrecto' } });
      return;
    }
    expect(otp).toBe('123456');
    profile.user.email = newEmail;
    await route.fulfill({ json: {} });
  });

  await page.goto('/perfil');
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { name: 'Mi Perfil', level: 1 })).toBeVisible();
  await expect(main.getByText('Valentina Cruz', { exact: true })).toBeVisible();
  await expect(main.getByText('9/6/2013', { exact: true })).toBeVisible();
  await expect(main.getByText('Nivel B1', { exact: true })).toBeVisible();
  await expect(main.getByText(email, { exact: true })).toBeVisible();
  await expect(main.getByText(/Solo tu profesora puede actualizar/)).toBeVisible();
  await expect(main.getByRole('button', { name: /^Teens/ })).toHaveCount(0);

  canSwitchInterface = true;
  await page.reload();
  const kids = main.getByRole('button', { name: /^Kids \(Zorro Explorador\)/ });
  const teens = main.getByRole('button', { name: /^Teens Interfaz limpia/ });
  const open = main.getByRole('button', { name: 'Cambiar correo electrónico' });
  const cancel = main.getByRole('button', { name: 'Cancelar' });
  const request = main.getByRole('button', { name: 'Solicitar cambio' });
  const confirm = main.getByRole('button', { name: 'Confirmar nuevo correo' });
  const otpInput = main.getByRole('textbox', { name: 'Código de verificación OTP' });

  await expect(teens).toHaveAttribute('aria-pressed', 'true');
  await expect(kids).toHaveAttribute('aria-pressed', 'false');
  await expect(main.getByText(/Cumplir años nunca cambia tu interfaz/)).toBeVisible();

  for (const viewport of [
    { width: 320, height: 720 },
    { width: 390, height: 844 },
    { width: 800, height: 1280 },
    { width: 1280, height: 800 },
  ]) {
    await page.setViewportSize(viewport);
    await expectTouchTarget(teens, 92);
    await expectTouchTarget(kids, 92);
    const [kidsBox, teensBox] = await Promise.all([kids.boundingBox(), teens.boundingBox()]);
    expect(kidsBox?.y === teensBox?.y).toBe(viewport.width >= 640);

    await expectTouchTarget(open);
    await open.press('Enter');
    const emailInput = main.getByRole('textbox', { name: 'Nuevo correo electrónico' });
    const password = main.getByLabel('Contraseña actual para confirmar');
    await expect(emailInput).toBeFocused();
    for (const input of [emailInput, password]) {
      await expectTouchTarget(input);
      await expect(input).toHaveCSS('font-size', '16px');
    }
    await expectTouchTarget(request);
    await expectTouchTarget(cancel);
    await emailInput.fill(newEmail);
    await password.fill('test-password');
    await request.press('Enter');
    await expect(otpInput).toBeFocused();
    await expectTouchTarget(otpInput);
    await expect(otpInput).toHaveCSS('font-size', '16px');
    await expectTouchTarget(confirm);
    await expectTouchTarget(cancel);
    await expect(confirm).toBeDisabled();
    expect(await page.locator('html').evaluate((root) => root.scrollWidth - root.clientWidth)).toBe(0);
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(result.violations).toEqual([]);

    if (viewport.width !== 1280) {
      await cancel.press('Enter');
      await expect(open).toBeFocused();
    }
  }

  await otpInput.fill('111111');
  await confirm.press('Enter');
  await expect(main.getByRole('alert')).toHaveText('Código incorrecto');
  await otpInput.fill('123456');
  await confirm.press('Enter');
  await expect(main.getByRole('status')).toContainText('Correo actualizado exitosamente');
  await expect(main.getByText(newEmail, { exact: true })).toBeVisible();
  await expect(open).toBeFocused();
});
