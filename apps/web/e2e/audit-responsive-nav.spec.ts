import { expect, test } from '@playwright/test';

for (const width of [320, 390, 768, 1280]) {
  test(`UX-01/02: navegación docente visible sin desbordamiento a ${width}px`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const token = `header.${Buffer.from(JSON.stringify({ role: 'teacher' })).toString('base64url')}.signature`;
    await context.addCookies([
      { name: 'englove_access_token', value: token, domain: 'localhost', path: '/' },
      { name: 'englove_local_access_token', value: token, domain: 'localhost', path: '/' },
    ]);
    await page.route('**/api/v1/auth/session', (route) =>
      route.fulfill({
        status: 200,
        json: {
          user: { id: 'teacher-audit', name: 'Profesora', email: 'audit@example.test', role: 'teacher' },
          organizationId: 'org-audit',
        },
      }),
    );
    await page.route('**/api/v1/dashboard/reminders', (route) =>
      route.fulfill({
        status: 200,
        json: { pendingApprovals: 0, overdueReviews: 0, studentsWithoutActivity: [] },
      }),
    );
    await page.goto('/inicio');
    const logout = page.getByRole('button', { name: 'Cerrar sesión', exact: true });
    await expect(logout).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    for (const label of ['Inicio', 'Actividades', 'Asignaciones', 'Revisión', 'Estadísticas', 'Grupos', 'Alumnos', 'Contenido extra']) {
      const link = page.getByRole('navigation').getByRole('link', { name: label, exact: true }).filter({ visible: true });
      await expect(link).toBeVisible();
      const bounds = await link.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds?.x).toBeGreaterThanOrEqual(0);
      expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(width);
      expect(bounds?.height).toBeGreaterThanOrEqual(48);
      expect(bounds?.width).toBeGreaterThanOrEqual(48);
    }
    const bounds = await logout.boundingBox();
    expect(bounds?.height).toBeGreaterThanOrEqual(48);
    expect(bounds?.width).toBeGreaterThanOrEqual(48);
    await logout.focus();
    await expect(logout).toBeFocused();
  });
}
