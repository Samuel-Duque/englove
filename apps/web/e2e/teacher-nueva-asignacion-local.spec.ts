import { signInForSmoke, smokeApiUrl } from './session';
import { expect, test } from '@playwright/test';


test('Nueva asignación con API y PostgreSQL locales: exclusión de game, creación real, conflicto 409 y limpieza', async ({ page }) => {
  test.setTimeout(90_000);

  await signInForSmoke(page, 'teacher');

  await page.goto('/asignaciones');
  const activitiesPromise = page.waitForResponse((res) => {
    const url = new URL(res.url());
    return url.pathname === '/api/v1/activities' && url.searchParams.get('status') === 'published';
  });
  const groupsPromise = page.waitForResponse((res) => {
    const url = new URL(res.url());
    return url.pathname === '/api/v1/groups' && url.searchParams.get('archived') === 'false';
  });
  await page.getByRole('main').getByRole('link', { name: /Nueva asignación/ }).click();
  await expect(page).toHaveURL(/\/asignaciones\/nueva$/);

  const [activitiesRes, groupsRes] = await Promise.all([activitiesPromise, groupsPromise]);
  expect(activitiesRes.status()).toBe(200);
  expect(groupsRes.status()).toBe(200);

  const { ActivityListResponseSchema, GroupListResponseSchema, AssignmentListResponseSchema, CreateAssignmentResponseSchema, ActivityType } =
    await import('@upward-english/shared');
  const publishedActivities = ActivityListResponseSchema.parse(await activitiesRes.json()).items;
  const activeGroups = GroupListResponseSchema.parse(await groupsRes.json()).items;

  // Verificar que los microjuegos publicados de la semilla local nunca aparecen en el formulario
  const gameActivities = publishedActivities.filter((a) => a.type === ActivityType.game);
  for (const game of gameActivities) {
    await expect(page.getByRole('radio', { name: new RegExp(game.title, 'i') })).toHaveCount(0);
  }

  const assignableActivities = publishedActivities.filter((a) => a.type !== ActivityType.game);
  expect(assignableActivities.length).toBeGreaterThan(0);
  expect(activeGroups.length).toBeGreaterThan(0);

  // Buscar un par (actividad, grupo) que no tenga ya una asignación activa en la semilla local
  const existingRes = await page.request.get(`${smokeApiUrl}/api/v1/assignments?limit=100`);
  expect(existingRes.status()).toBe(200);
  const existingAssignments = AssignmentListResponseSchema.parse(await existingRes.json()).items;
  const nowMs = Date.now();
  const activePairs = new Set(
    existingAssignments
      .filter((a) => a.cancelledAt === null && new Date(a.dueAt).getTime() >= nowMs)
      .map((a) => `${a.activity.id}::${a.group.id}`),
  );

  let targetActivity = assignableActivities[0];
  let targetGroup = activeGroups[0];
  let foundFreePair = false;
  for (const act of assignableActivities) {
    for (const grp of activeGroups) {
      if (!activePairs.has(`${act.id}::${grp.id}`)) {
        targetActivity = act;
        targetGroup = grp;
        foundFreePair = true;
        break;
      }
    }
    if (foundFreePair) break;
  }

  expect(foundFreePair).toBe(true);
  if (!targetActivity || !targetGroup) return;

  // 1. Crear asignación real
  await page.getByRole('radio', { name: new RegExp(targetActivity.title) }).check();
  await page.getByRole('checkbox', { name: new RegExp(targetGroup.name) }).check();

  const createPromise = page.waitForResponse(
    (res) => new URL(res.url()).pathname === '/api/v1/assignments' && res.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Programar asignación' }).click();
  const createRes = await createPromise;
  expect(createRes.status()).toBe(201);
  const createdBody = CreateAssignmentResponseSchema.parse(await createRes.json());
  const createdId = createdBody.items[0]?.id;
  expect(createdId).toBeTruthy();

  await expect(page).toHaveURL(/\/asignaciones\?notice=Asignaci%C3%B3n%20creada/);

  // 2. Intentar duplicar exactamente el mismo par -> conflicto real 409 ASSIGNMENT_ALREADY_ACTIVE
  await page.goto('/asignaciones/nueva');
  await page.getByRole('radio', { name: new RegExp(targetActivity.title) }).check();
  await page.getByRole('checkbox', { name: new RegExp(targetGroup.name) }).check();

  const conflictPromise = page.waitForResponse(
    (res) => new URL(res.url()).pathname === '/api/v1/assignments' && res.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Programar asignación' }).click();
  const conflictRes = await conflictPromise;
  expect(conflictRes.status()).toBe(409);

  const alert = page.getByRole('main').getByRole('alert');
  await expect(alert).toBeVisible();
  await expect(alert).toContainText(
    'La actividad ya tiene una asignación activa en uno de los grupos seleccionados',
  );
  await expect(alert).toBeFocused();

  // 3. Limpiar cancelando la asignación de prueba creada
  if (createdId) {
    const cancelRes = await page.request.post(`${smokeApiUrl}/api/v1/assignments/${createdId}/cancel`, {
      headers: { Origin: new URL(page.url()).origin },
    });
    expect(cancelRes.status()).toBe(200);
  }
});
