import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

const sampleActivities = [
  {
    id: 'act-fb-1',
    title: 'Colors and Animals Fill Blank',
    type: 'fill_blank',
    level: 'A1',
    status: 'published',
    version: 2,
    createdAt: '2026-10-20T10:00:00Z',
    updatedAt: '2026-10-20T10:00:00Z',
  },
  {
    id: 'act-oq-2',
    title: 'Weekend Plans Open Question',
    type: 'open_question',
    level: 'A2',
    status: 'draft',
    version: 1,
    createdAt: '2026-10-21T10:00:00Z',
    updatedAt: '2026-10-21T10:00:00Z',
  },
  {
    id: 'act-sp-3',
    title: 'Daily Routine Speaking',
    type: 'speaking',
    level: 'B1',
    status: 'published',
    version: 1,
    createdAt: '2026-10-22T10:00:00Z',
    updatedAt: '2026-10-22T10:00:00Z',
  },
  {
    id: 'act-gm-4',
    title: 'Irregular Verbs Memory',
    type: 'game',
    level: 'A2',
    status: 'published',
    version: 3,
    createdAt: '2026-10-23T10:00:00Z',
    updatedAt: '2026-10-23T10:00:00Z',
  },
  {
    id: 'act-ex-5',
    title: 'Midterm Grammar Exam',
    type: 'exam',
    level: 'B2',
    status: 'draft',
    version: 1,
    createdAt: '2026-10-24T10:00:00Z',
    updatedAt: '2026-10-24T10:00:00Z',
  },
];

const archivedActivities = [
  {
    id: 'act-arch-1',
    title: 'Legacy Alphabet Review',
    type: 'fill_blank',
    level: 'A1',
    status: 'archived',
    version: 1,
    createdAt: '2026-09-10T10:00:00Z',
    updatedAt: '2026-09-15T10:00:00Z',
  },
];

test.beforeEach(async ({ context, page }) => {
  const token = `header.${Buffer.from(JSON.stringify({ role: 'teacher' })).toString('base64url')}.signature`;
  await context.addCookies([
    { name: `${process.env.COOKIE_PREFIX ?? 'englove_local_'}access_token`, value: token, domain: 'localhost', path: '/' },
    { name: 'upward_english_local_access_token', value: token, domain: 'localhost', path: '/' },
    { name: 'upward_english_access_token', value: token, domain: 'localhost', path: '/' },
  ]);
  await page.route('**/api/v1/auth/session', (route) => route.fulfill({
    json: {
      user: { id: 'teacher-act', name: 'Clara Gómez', email: 'teacher@example.test', role: 'teacher' },
      organizationId: 'org-act',
    },
  }));
});

for (const [width, height] of [[1440, 900], [1280, 800], [820, 1080], [390, 844], [320, 640]] as const) {
  test(`Catálogo de Actividades: diseño editorial, responsive y WCAG 2.2 AA a ${width} × ${height}`, async ({ page }) => {
    await page.route('**/api/v1/activities?*', (route) => route.fulfill({
      json: { items: sampleActivities, total: sampleActivities.length, offset: 0, limit: 100 },
    }));

    await page.setViewportSize({ width, height });
    await page.goto('/actividades');

    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { level: 1, name: 'Catálogo de Actividades' })).toBeVisible();
    await expect(main.getByRole('link', { name: /Crear actividad/ })).toHaveAttribute('href', '/actividades/nueva');

    // Los 5 tipos oficiales visibles en la tabla
    for (const label of ['Completar espacios', 'Pregunta abierta', 'Expresión oral (Speaking)', 'Microjuego', 'Examen']) {
      await expect(main.getByRole('cell', { name: label, exact: true })).toBeVisible();
    }

    // Atributo lang="en" en títulos y badges de estado
    await expect(main.locator('[lang="en"]', { hasText: 'Colors and Animals Fill Blank' })).toBeVisible();
    await expect(main.getByText('Publicada')).toHaveCount(3);
    await expect(main.getByText('Borrador')).toHaveCount(2);

    // Nota aclaratoria Decisión 95
    await expect(main.getByText(/Archivar una actividad la oculta del catálogo activo/)).toBeVisible();

    // Eliminar solo en borradores (2 de 5 filas)
    await expect(main.getByRole('button', { name: /^Eliminar borrador:/ })).toHaveCount(2);
    await expect(main.getByRole('link', { name: 'Editar actividad: Colors and Animals Fill Blank' })).toHaveAttribute('href', '/actividades/act-fb-1');

    // Navegación docente activa
    if (width < 1024) {
      const menu = page.getByRole('button', { name: 'Menú docente' });
      await expect(menu).toHaveAttribute('aria-expanded', 'false');
      await menu.press('Enter');
      await expect(menu).toHaveAttribute('aria-expanded', 'true');
    }
    await expect(page.getByRole('navigation', { name: 'Navegación docente' }).getByRole('link', { name: 'Actividades', exact: true })).toHaveAttribute('aria-current', 'page');

    // Sin desborde horizontal del viewport y sin violaciones WCAG 2.2 AA
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    expect((await new AxeBuilder({ page }).withTags(wcagTags).analyze()).violations).toEqual([]);
  });
}

test('Catálogo de Actividades: filtros, archivadas, vacío y eliminación con manejo de ACTIVITY_DELETE_NOT_ALLOWED', async ({ page }) => {
  let deleteAttempted = 0;

  await page.route('**/api/v1/activities?*', (route) => {
    const url = new URL(route.request().url());
    const status = url.searchParams.get('status');
    const type = url.searchParams.get('type');
    const level = url.searchParams.get('level');

    const source = status === 'archived' ? archivedActivities : sampleActivities;
    const filtered = source.filter((item) => {
      if (type && item.type !== type) return false;
      if (level && item.level !== level) return false;
      return true;
    });

    return route.fulfill({
      json: { items: filtered, total: filtered.length, offset: 0, limit: 100 },
    });
  });

  await page.route('**/api/v1/activities/act-oq-2', (route) => {
    if (route.request().method() === 'DELETE') {
      deleteAttempted += 1;
      if (deleteAttempted === 1) {
        return route.fulfill({
          status: 409,
          json: { statusCode: 409, code: 'ACTIVITY_DELETE_NOT_ALLOWED', message: 'No permitido' },
        });
      }
      return route.fulfill({ status: 204 });
    }
    return route.fallback();
  });

  await page.goto('/actividades');
  const main = page.getByRole('main');

  // Cambiar a Archivadas
  await main.getByRole('button', { name: 'Archivadas', exact: true }).click();
  await expect(main.getByText('Legacy Alphabet Review')).toBeVisible();
  await expect(main.getByRole('button', { name: 'Restaurar actividad: Legacy Alphabet Review' })).toBeVisible();
  await expect(main.getByRole('link', { name: 'Ver actividad: Legacy Alphabet Review' })).toHaveAttribute('href', '/actividades/act-arch-1');

  // Filtrar sin resultados -> estado vacío y Limpiar filtros
  await main.locator('#filter-level').selectOption('B2');
  await expect(main.getByText('No hay actividades que coincidan con estos filtros.')).toBeVisible();
  await main.getByRole('button', { name: 'Limpiar filtros', exact: true }).click();
  await expect(main.getByText('Colors and Animals Fill Blank')).toBeVisible();

  // Filtrar por Tipo = Completar espacios
  await main.locator('#filter-type').selectOption('fill_blank');
  await expect(main.getByText('1 actividad')).toBeVisible();
  await main.locator('#filter-type').selectOption('all');

  // Eliminar borrador con error ACTIVITY_DELETE_NOT_ALLOWED
  await main.getByRole('button', { name: 'Eliminar borrador: Weekend Plans Open Question' }).click();
  const dialog = page.getByRole('dialog', { name: 'Eliminar borrador' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Eliminar borrador', exact: true }).click();
  await expect(main.getByRole('alert')).toContainText('solo se pueden eliminar borradores sin asignaciones');

  // Segundo intento exitoso
  await main.getByRole('button', { name: 'Eliminar borrador: Weekend Plans Open Question' }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Eliminar borrador', exact: true }).click();
  await expect(main.getByRole('status')).toContainText('Borrador eliminado exitosamente');
});
