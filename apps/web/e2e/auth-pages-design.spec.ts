import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

for (const [width, height] of [[1280, 800], [800, 1280], [390, 844]] as const) {
  for (const [path, heading, cardWidth] of [
    ['/login', 'Inicia sesión', 460],
    ['/registro', 'Crea tu cuenta', 560],
  ] as const) {
    test(`${path}: diseño y accesibilidad a ${width} × ${height}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto(path);
      const main = page.getByRole('main');
      const title = main.getByRole('heading', { name: heading });
      await expect(title).toBeVisible();
      await page.evaluate(() => document.fonts.ready);

      await expect(main).toHaveCSS('background-color', 'rgb(255, 249, 236)');
      await expect(title).toHaveCSS('font-size', width < 640 ? '26px' : '30px');
      await expect(title).toHaveCSS('font-family', /Bricolage/i);
      await expect(main.getByRole('article')).toHaveCSS('max-width', `${cardWidth}px`);
      await expect(main.getByRole('article')).toHaveCSS('border-radius', '22px');
      await expect(main.getByRole('button', { name: /^(Entrar|Enviar solicitud)$/ })).toHaveCSS(
        'background-color', 'rgb(198, 71, 11)',
      );

      const controls = main.locator('a, button, input');
      for (const control of await controls.all()) {
        const box = await control.boundingBox();
        expect(box?.width).toBeGreaterThanOrEqual(48);
        expect(box?.height).toBeGreaterThanOrEqual(48);
        if (await control.evaluate((element) => element.matches('input:not([type=checkbox])'))) {
          await expect(control).toHaveCSS('font-size', '16px');
        }
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

      await page.keyboard.press('Tab');
      await expect(page.getByRole('link', { name: 'Saltar al contenido principal' })).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(main).toBeFocused();
      await page.keyboard.press('Tab');
      const back = main.getByRole('link', { name: 'Volver al inicio' });
      await expect(back).toBeFocused();
      await expect(back).toHaveCSS('outline', 'rgb(29, 78, 216) solid 3px');
      await expect(back).toHaveCSS('outline-offset', '2px');
      await page.keyboard.press('Tab');
      await expect(main.getByRole('textbox', { name: path === '/login' ? 'Correo electrónico' : 'Nombre completo del alumno' })).toBeFocused();

      expect((await new AxeBuilder({ page }).withTags(wcagTags).analyze()).violations).toEqual([]);
    });
  }
}

test('Login conecta con Registro, Recuperar contraseña y la portada', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('link', { name: 'Regístrate aquí' }).click();
  await expect(page).toHaveURL(/\/registro$/);
  const terms = page.getByRole('link', { name: 'términos y condiciones' });
  await expect(terms).toHaveAttribute('rel', 'noopener noreferrer');
  const [termsPage] = await Promise.all([page.waitForEvent('popup'), terms.click()]);
  await expect(termsPage).toHaveURL(/\/terminos$/);
  expect(await termsPage.getByRole('heading', { level: 1 }).count()).toBe(1);
  await termsPage.close();
  await page.getByRole('link', { name: 'Inicia sesión', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole('link', { name: '¿Olvidaste tu contraseña?' }).click();
  await expect(page).toHaveURL(/\/recuperar-contrasena$/);
  await page.goBack();
  await page.getByRole('link', { name: 'Volver al inicio' }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('Login informa un fallo de conexión en español', async ({ page }) => {
  await page.route('**/api/v1/auth/login', (route) => route.abort());
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill('estudiante@example.com');
  await page.getByLabel('Contraseña', { exact: true }).fill('Password123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toHaveText(
    'No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.',
  );
});

test('Registro exige aceptar los términos y confirma sin iniciar sesión', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let submitted: unknown = null;
  await page.route('**/api/v1/auth/signup', async (route) => {
    submitted = route.request().postDataJSON();
    await route.fulfill({ status: 201, json: { message: 'Recibimos tu solicitud.' } });
  });
  await page.goto('/registro');
  await page.getByLabel('Nombre completo del alumno').fill('Estudiante de prueba');
  await page.getByLabel('Correo electrónico').fill('estudiante@example.com');
  await page.getByLabel('Fecha de nacimiento').fill('2016-05-15');
  await page.getByLabel('Contraseña', { exact: true }).fill('Password123');
  const send = page.getByRole('button', { name: 'Enviar solicitud' });
  await send.click();
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('Debes aceptar los términos y condiciones para continuar');
  expect(submitted).toBeNull();

  await page.getByRole('checkbox', { name: /Acepto los términos y condiciones/ }).check();
  await send.click();
  const title = page.getByRole('heading', { name: 'Solicitud de registro enviada' });
  await expect(title).toBeFocused();
  await expect(page.getByText('Recibimos tu solicitud.')).toBeVisible();
  await expect(page.getByText(/Tu profesora revisará/)).toBeVisible();
  await expect(page).toHaveURL(/\/registro$/);
  expect(submitted).toEqual({
    name: 'Estudiante de prueba', email: 'estudiante@example.com',
    birthDate: '2016-05-15', password: 'Password123', acceptTerms: true,
  });
  expect((await new AxeBuilder({ page }).withTags(wcagTags).analyze()).violations).toEqual([]);
  await page.getByRole('link', { name: 'Ir al inicio de sesión' }).click();
  await expect(page).toHaveURL(/\/login$/);
});
