import { expect, test } from '@playwright/test';
import {
  ActivityListResponseSchema,
  ActivityType,
  AssignmentViewSchema,
  CreateAssignmentResponseSchema,
  GroupViewSchema,
  ReviewListResponseSchema,
  StudentListResponseSchema,
} from '@upward-english/shared';

const email = process.env.ENGLOVE_SMOKE_EMAIL;
const password = process.env.ENGLOVE_SMOKE_PASSWORD;
const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

test('Detalle de asignación con API y datos locales: métricas, entregas, enlaces y cancelación real', async ({
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

  await page.goto('/asignaciones');
  await expect(page.getByRole('heading', { level: 1, name: 'Asignaciones' })).toBeVisible();

  const firstDetailLink = page.getByRole('link', { name: /Ver detalle/ }).first();
  await expect(firstDetailLink).toBeVisible();

  const detailResponsePromise = page.waitForResponse(
    (res) =>
      /^\/api\/v1\/assignments\/[^/]+$/.test(new URL(res.url()).pathname) &&
      res.request().method() === 'GET',
  );
  const membersResponsePromise = page.waitForResponse((res) =>
    /^\/api\/v1\/groups\/[^/]+\/members$/.test(new URL(res.url()).pathname),
  );
  const queueResponsePromise = page.waitForResponse(
    (res) => new URL(res.url()).pathname === '/api/v1/reviews/queue',
  );
  const gradedResponsePromise = page.waitForResponse(
    (res) => new URL(res.url()).pathname === '/api/v1/reviews/graded',
  );

  await firstDetailLink.click();
  await expect(page).toHaveURL(/\/asignaciones\/[^/]+$/);

  const [detailRes, membersRes, queueRes, gradedRes] = await Promise.all([
    detailResponsePromise,
    membersResponsePromise,
    queueResponsePromise,
    gradedResponsePromise,
  ]);
  expect(detailRes.status()).toBe(200);
  expect(membersRes.status()).toBe(200);
  expect(queueRes.status()).toBe(200);
  expect(gradedRes.status()).toBe(200);

  const assignment = AssignmentViewSchema.parse(await detailRes.json());
  const members = StudentListResponseSchema.parse(await membersRes.json());
  ReviewListResponseSchema.parse(await queueRes.json());
  ReviewListResponseSchema.parse(await gradedRes.json());

  const main = page.getByRole('main');
  await expect(
    main.getByRole('heading', { level: 1, name: assignment.activity.title }),
  ).toBeVisible();
  await expect(main.getByText('Hora de Colombia (America/Bogota)')).toBeVisible();
  await expect(main.getByRole('link', { name: 'Ver ficha del grupo' })).toHaveAttribute(
    'href',
    `/grupos/${assignment.group.id}`,
  );
  await expect(main.getByRole('link', { name: 'Ver editor de actividad' })).toHaveAttribute(
    'href',
    `/actividades/${assignment.activity.id}`,
  );

  if (members.items.length > 0 && members.items[0]) {
    await expect(main.getByRole('link', { name: members.items[0].name })).toBeVisible();
  }

  // Verificar navegación conectada hacia la ficha del grupo y enlaces a revisión/alumno
  await main.getByRole('link', { name: 'Ver ficha del grupo' }).click();
  await expect(page).toHaveURL(new RegExp(`/grupos/${assignment.group.id}$`));
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/asignaciones/${assignment.id}$`));

  await expect(main.getByRole('link', { name: 'Ir a revisión' })).toHaveAttribute(
    'href',
    '/revision',
  );
  if (members.items.length > 0 && members.items[0]) {
    await main.getByRole('link', { name: members.items[0].name }).click();
    await expect(page).toHaveURL(new RegExp(`/alumnos/${members.items[0].id}$`));
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`/asignaciones/${assignment.id}$`));
  }

  // Crear asignación temporal para verificar cancelación definitiva en PostgreSQL sin alterar los datos del seed
  const activitiesRes = await page.request.get(
    `${apiBaseUrl}/api/v1/activities?status=published&limit=20`,
  );
  expect(activitiesRes.status()).toBe(200);
  const activitiesData = ActivityListResponseSchema.parse(await activitiesRes.json());
  const assignableActivity = activitiesData.items.find((a) => a.type !== ActivityType.game);
  expect(assignableActivity).toBeDefined();
  if (!assignableActivity) return;

  const origin = new URL(page.url()).origin;
  const tempGroupRes = await page.request.post(`${apiBaseUrl}/api/v1/groups`, {
    headers: { Origin: origin },
    data: { name: `Plan07 Smoke ${Date.now()}` },
  });
  expect(tempGroupRes.status()).toBe(201);
  const tempGroup = GroupViewSchema.parse(await tempGroupRes.json());

  try {
    const now = Date.now();
    const createAssignmentRes = await page.request.post(`${apiBaseUrl}/api/v1/assignments`, {
      headers: { Origin: origin },
      data: {
        activityId: assignableActivity.id,
        groupIds: [tempGroup.id],
        opensAt: new Date(now - 3600_000).toISOString(),
        dueAt: new Date(now + 86_400_000).toISOString(),
      },
    });
    expect(createAssignmentRes.status()).toBe(201);
    const createdPayload = CreateAssignmentResponseSchema.parse(await createAssignmentRes.json());
    const tempAssignment = createdPayload.items[0];
    expect(tempAssignment).toBeDefined();
    if (!tempAssignment) return;

    await page.goto(`/asignaciones/${tempAssignment.id}`);
    await expect(
      page.getByRole('heading', { level: 1, name: assignableActivity.title }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Cancelar asignación' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/cierre efectivo \+ 24 h/)).toBeVisible();

    const cancelPromise = page.waitForResponse(
      (res) =>
        new URL(res.url()).pathname === `/api/v1/assignments/${tempAssignment.id}/cancel` &&
        res.request().method() === 'POST',
    );
    await dialog.getByRole('button', { name: 'Cancelar asignación' }).click();
    const cancelRes = await cancelPromise;
    expect(cancelRes.status()).toBe(200);

    await expect(page.getByText('Asignación cancelada', { exact: true })).toBeVisible();
    await expect(page.getByText('Cancelada', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancelar asignación' })).toHaveCount(0);

    await page.reload();
    await expect(page.getByText('Cancelada', { exact: true })).toBeVisible();
    await expect(page.getByText('Excluida', { exact: true })).toBeVisible();
  } finally {
    await page.request.post(`${apiBaseUrl}/api/v1/groups/${tempGroup.id}/archive`, {
      headers: { Origin: origin },
    });
  }
});
