import { expect, test } from '@playwright/test';

const group = {
  id: 'group-origami',
  name: 'Grupo A1',
  level: 'A1',
  activeStudentsCount: 2,
};
const submissions = [
  {
    id: 'review-one',
    title: 'My morning routine',
    answer: 'I have breakfast at seven.',
  },
  {
    id: 'review-two',
    title: 'My classroom',
    answer: 'There are six desks in my classroom.',
  },
].map(({ id, title, answer }) => ({
  student: {
    id: `student-${id}`,
    displayName: 'Alumna de prueba',
    ageSegment: 'kids',
  },
  group,
  activity: { id: `activity-${id}`, title, type: 'open_question' },
  assignment: { id: `assignment-${id}`, dueAt: '2026-11-27T18:00:00.000Z' },
  attempt: { attemptId: id, attemptNumber: 1, status: 'pending_review' },
  items: [{ id: 'question', question: 'Write about your day at school.' }],
  answers: { question: answer },
}));

test.beforeEach(async ({ page, context }) => {
  await context.addCookies(
    ['upward_english_local_access_token', 'upward_english_access_token'].map(
      (name) => ({
        name,
        value: 'mock-teacher-token',
        domain: 'localhost',
        path: '/',
      }),
    ),
  );
  await page.route('**/api/v1/auth/refresh', (route) =>
    route.fulfill({
      json: {
        user: {
          id: 'teacher-origami',
          email: 'teacher@example.test',
          name: 'Profesora Clara',
          role: 'teacher',
        },
        organizationId: 'org-origami',
      },
    }),
  );
  await page.route('**/api/v1/groups?*', (route) =>
    route.fulfill({ json: { items: [group], total: 1 } }),
  );
  await page.route('**/api/v1/reviews/queue*', (route) =>
    route.fulfill({ json: { items: submissions, total: submissions.length } }),
  );
  await page.route('**/api/v1/reviews/graded*', (route) =>
    route.fulfill({ json: { items: [], total: 0 } }),
  );
  for (const submission of submissions) {
    await page.route(
      `**/api/v1/attempts/${submission.attempt.attemptId}/review-detail`,
      (route) => route.fulfill({ json: submission }),
    );
  }
});

test('RF-7: desde 1024 px, cola de 320 px junto a la entrega seleccionada', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 800 });
  await page.goto('/revision');

  const firstDetail = page.getByRole('heading', { name: 'My morning routine' });
  await expect(firstDetail).toBeVisible();
  const queue = page.getByRole('region', { name: 'Cola de revisión' });
  await expect(queue).toHaveCSS('width', '320px');
  const [queueBox, detailBox] = await Promise.all([
    queue.boundingBox(),
    firstDetail.boundingBox(),
  ]);
  expect(detailBox?.x).toBeGreaterThanOrEqual((queueBox?.x ?? 0) + 320);
  await expect(
    page.getByRole('button', { name: 'Volver a la cola' }),
  ).toBeHidden();

  await queue.getByRole('button', { name: /My classroom/ }).click();
  const secondDetail = page.getByRole('heading', { name: 'My classroom' });
  await expect(secondDetail).toBeVisible();
  await page.setViewportSize({ width: 1023, height: 800 });
  await expect(queue).toBeHidden();
  await expect(secondDetail).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(queue).toBeVisible();
  await expect(secondDetail).toBeVisible();
});

test('RF-7: en móvil, volver a la cola conserva foco, filtros, selección y borrador', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/revision');

  const groupFilter = page.getByLabel('Grupo', { exact: true });
  await groupFilter.selectOption(group.id);
  const queue = page.getByRole('region', { name: 'Cola de revisión' });
  const row = page.getByRole('button', { name: /My classroom/ });
  const detail = page.getByRole('heading', { name: 'My classroom' });
  const back = page.getByRole('button', { name: 'Volver a la cola' });

  await expect(
    page.getByRole('heading', { name: 'My morning routine' }),
  ).toBeHidden();
  await row.focus();
  await row.press('Enter');
  await expect(queue).toBeHidden();
  await expect(groupFilter).toBeHidden();
  await expect(detail).toBeVisible();
  await expect(back).toBeFocused();
  await expect(
    page.getByText('There are six desks in my classroom.'),
  ).toBeVisible();

  const comment = page.getByLabel(/Comentario de Retroalimentación/i);
  await comment.fill('Buen uso de «there are».');
  await back.focus();
  await back.press('Enter');
  await expect(detail).toBeHidden();
  await expect(row).toBeFocused();
  await expect(row).toHaveAttribute('aria-current', 'true');
  await expect(groupFilter).toHaveValue(group.id);
  await row.press('Enter');
  await expect(comment).toHaveValue('Buen uso de «there are».');
});
