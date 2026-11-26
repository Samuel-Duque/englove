import { expect, test } from '@playwright/test';

const email = process.env.ENGLOVE_SMOKE_EMAIL;
const password = process.env.ENGLOVE_SMOKE_PASSWORD;

test('Alumnos docente con API y datos locales: directorio, grupos, solicitudes y ficha', async ({
  page,
}) => {
  test.skip(!email || !password, 'Requiere una cuenta docente sembrada en el entorno local.');
  if (!email || !password) return;
  test.setTimeout(90_000);

  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Correo electrónico' }).fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/inicio$/);

  const studentsPromise = page.waitForResponse(
    (res) => new URL(res.url()).pathname === '/api/v1/students',
  );
  const requestsPromise = page.waitForResponse(
    (res) => new URL(res.url()).pathname === '/api/v1/students/requests',
  );
  const lockedPromise = page.waitForResponse(
    (res) => new URL(res.url()).pathname === '/api/v1/students/locked',
  );
  const groupsPromise = page.waitForResponse(
    (res) =>
      new URL(res.url()).pathname === '/api/v1/groups' &&
      new URL(res.url()).searchParams.get('archived') === 'false',
  );

  await page
    .getByRole('navigation', { name: 'Navegación docente' })
    .getByRole('link', { name: 'Alumnos', exact: true })
    .click();
  await expect(page).toHaveURL(/\/alumnos$/);

  const [studentsRes, requestsRes, lockedRes, groupsRes] = await Promise.all([
    studentsPromise,
    requestsPromise,
    lockedPromise,
    groupsPromise,
  ]);
  expect(studentsRes.status()).toBe(200);
  expect(requestsRes.status()).toBe(200);
  expect(lockedRes.status()).toBe(200);
  expect(groupsRes.status()).toBe(200);

  const { StudentListResponseSchema, GroupListResponseSchema, ApprovalStatus } = await import(
    '@upward-english/shared'
  );
  const studentsPayload = StudentListResponseSchema.parse(await studentsRes.json());
  const requestsPayload = StudentListResponseSchema.parse(await requestsRes.json());
  const groupsPayload = GroupListResponseSchema.parse(await groupsRes.json());

  const approvedStudents = studentsPayload.items.filter(
    (item) => item.approvalStatus !== ApprovalStatus.pending_approval,
  );
  const groupNameById = new Map(groupsPayload.items.map((g) => [g.id, g.name]));

  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { level: 1, name: 'Alumnos' })).toBeVisible();
  await expect(main.getByRole('tab', { name: 'Alumnos activos' })).toHaveAttribute(
    'aria-selected',
    'true',
  );

  if (requestsPayload.items.length > 0) {
    await expect(main.getByRole('tab', { name: /Solicitudes de registro/ })).toContainText(
      String(requestsPayload.items.length),
    );
  }

  for (const student of approvedStudents.slice(0, 3)) {
    const row = main.getByRole('row').filter({
      has: page.getByRole('rowheader', { name: student.name, exact: true }),
    });
    await expect(row).toBeVisible();
    if (student.groupId) {
      const groupName = groupNameById.get(student.groupId);
      if (groupName) {
        await expect(row.getByRole('link', { name: groupName, exact: true })).toBeVisible();
      }
    }
  }

  // Navigate to student detail and back
  const firstStudent = approvedStudents[0];
  if (firstStudent) {
    await main.getByRole('link', { name: `Ver ficha de ${firstStudent.name}`, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/alumnos/${firstStudent.id}$`));
    await expect(main.getByRole('heading', { name: firstStudent.name })).toBeVisible();
  }

  // Navigate to /alumnos/solicitudes and /alumnos/bloqueados redirects
  await page.goto('/alumnos/solicitudes');
  await expect(page).toHaveURL(/\/alumnos\?tab=requests$/);
  await expect(main.getByRole('tab', { name: /Solicitudes de registro/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );

  await page.goto('/alumnos/bloqueados');
  await expect(page).toHaveURL(/\/alumnos\?tab=locked$/);
  await expect(main.getByRole('tab', { name: /Bloqueados/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );

  // Navigate to /grupos via discreet link
  await page.goto('/alumnos');
  await main.getByRole('link', { name: 'Gestionar grupos' }).click();
  await expect(page).toHaveURL(/\/grupos$/);
});
