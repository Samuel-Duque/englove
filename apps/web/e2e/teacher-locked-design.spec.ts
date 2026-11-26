import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const student = {
  id: 'std-locked',
  name: 'Sofía Gómez',
  email: 'sofia.gomez.cuenta.de.prueba@upwardenglish.example',
  birthDate: '2018-03-20',
  level: 'A1',
  ageSegment: 'kids',
  approvalStatus: 'approved',
};

test.beforeEach(async ({ context, page }) => {
  const token = `header.${Buffer.from(JSON.stringify({ role: 'teacher' })).toString('base64url')}.signature`;
  await context.addCookies(
    ['englove_local_', 'upward_english_local_', 'upward_english_'].map((prefix) => ({
      name: `${prefix}access_token`,
      value: token,
      domain: 'localhost',
      path: '/',
    })),
  );
  await page.route('**/api/v1/auth/session', (route) =>
    route.fulfill({
      json: {
        user: { id: 'teacher', name: 'Clara Gómez', email: 'teacher@example.test', role: 'teacher' },
        student: null,
      },
    }),
  );
  await page.route('**/api/v1/groups?*', (route) =>
    route.fulfill({ json: { items: [], total: 0 } }),
  );
});

for (const [width, height] of [
  [1440, 900],
  [1280, 800],
  [820, 1080],
  [390, 844],
  [320, 640],
] as const) {
  test(`Cuentas bloqueadas a ${width} × ${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const now = new Date('2026-11-26T02:25:00Z');
    const lockedUntil = '2026-11-26T02:30:00.000Z';
    await page.clock.setFixedTime(now);
    await page.route('**/api/v1/students/locked?limit=100', (route) =>
      route.fulfill({ json: { items: [{ ...student, lockedUntil }], total: 1 } }),
    );
    await page.goto('/alumnos/bloqueados');
    await expect(page).toHaveURL(/\/alumnos\?tab=locked$/);
    const panel = page.getByRole('tabpanel', { name: /Bloqueados/ });
    const badge = panel.getByText('Bloqueada (10 min)', { exact: true });
    await expect(badge).toHaveCSS('background-color', 'rgb(253, 236, 233)');
    const expiration = panel.getByText(/9:30/);
    await expect(expiration).toHaveAttribute('datetime', lockedUntil);
    await expect(expiration).toHaveCSS('font-variant-numeric', 'tabular-nums');
    await expect(panel.getByText('5:00 restantes')).toBeVisible();
    const unlock = panel.getByRole('button', { name: /Desbloquear cuenta/ });
    await expect(unlock).toHaveCSS('background-color', 'rgb(198, 71, 11)');
    expect((await unlock.boundingBox())?.height).toBeGreaterThanOrEqual(width < 1024 ? 48 : 40);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    expect(
      (await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze()).violations,
    ).toEqual([]);
  });
}

test('Desbloqueo con teclado, recuperación de error y actualización sin recarga', async ({ page }) => {
  let locked = true;
  let newRequest = true;
  let finishUnlock = () => {};
  const pendingUnlock = new Promise<void>((resolve) => { finishUnlock = resolve; });
  await page.route('**/api/v1/students/locked?limit=100', (route) =>
    route.fulfill({
      json: {
        items: locked ? [{ ...student, lockedUntil: new Date(Date.now() + 300_000).toISOString() }] : [],
        total: Number(locked),
      },
    }),
  );
  await page.route(`**/api/v1/students/${student.id}/unlock`, async (route) => {
    expect(route.request().method()).toBe('POST');
    if (newRequest) {
      newRequest = false;
      await route.fulfill({
        status: 500,
        json: { statusCode: 500, code: 'ERROR', message: 'No se pudo desbloquear la cuenta' },
      });
      return;
    }
    await pendingUnlock;
    locked = false;
    await route.fulfill({ status: 204 });
  });
  await page.goto('/alumnos/bloqueados');
  const panel = page.getByRole('tabpanel', { name: /Bloqueados/ });
  const action = panel.getByRole('button', { name: /Desbloquear cuenta/ });
  await action.press('Enter');
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'No se pudo desbloquear la cuenta',
  );
  await expect(action).toBeEnabled();
  await action.click();
  await expect(panel.getByRole('button', { name: /Desbloqueando/ })).toBeDisabled();
  const navigations: string[] = [];
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) navigations.push(frame.url());
  });
  finishUnlock();
  await expect(panel.getByRole('heading', { name: 'No hay cuentas bloqueadas en este momento.' }))
    .toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: /desbloqueada exitosamente/ })).toBeVisible();
  expect(navigations).toEqual([]);
});
