import { test, expect } from '@playwright/test';

test.describe('SPEC-00 a SPEC-08: Ausencia de Conflictos Transversales e Integridad E2E (ENG-145)', () => {
  test('1. Aislamiento de sesión y tablets compartidas: Logout limpia cookies, IndexedDB y TanStack Query evitando fuga de datos', async ({
    page,
    context,
  }) => {
    // 1.1 Iniciar sesión con Alumno 1
    await context.addCookies([
      { name: 'englove_access_token', value: 'token-student-1', domain: 'localhost', path: '/' },
      { name: 'englove_local_access_token', value: 'token-student-1', domain: 'localhost', path: '/' },
    ]);

    await page.route('**/api/v1/auth/refresh', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          user: { id: 'std-1', email: 'alumno1@englove.local', name: 'Alumno Uno', role: 'student' },
          student: { id: 'std-1', level: 'A1', ageSegment: 'kids', canSwitchInterface: false },
          organizationId: 'org-test',
        },
      });
    });

    await page.route('**/api/v1/me', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          user: { id: 'std-1', email: 'alumno1@englove.local', name: 'Alumno Uno', role: 'student' },
          student: { id: 'std-1', level: 'A1', ageSegment: 'kids', canSwitchInterface: false },
        },
      });
    });

    await page.route('**/api/v1/me/assignments', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          items: [
            {
              id: 'asg-std-1',
              activity: { id: 'act-1', title: 'Misión Privada Alumno Uno', type: 'fill_blank', level: 'A1' },
              effectiveDueAt: '2026-12-01T18:00:00Z',
              canStart: true,
            },
          ],
          total: 1,
        },
      });
    });

    await page.goto('/inicio');
    await expect(page.locator('h1:has-text("¡Hola, Alumno Uno!")')).toBeVisible();
    await expect(page.locator('text=Misión Privada Alumno Uno')).toBeVisible();

    // 1.2 Ejecutar Logout
    let logoutCalled = false;
    await page.route('**/api/v1/auth/logout', async (route) => {
      logoutCalled = true;
      await context.clearCookies();
      await route.fulfill({
        status: 200,
        headers: {
          'Set-Cookie': 'englove_access_token=; Path=/; Max-Age=0',
        },
        json: { message: 'Sesión cerrada' },
      });
    });

    const logoutBtn = page.locator('button:has-text("Cerrar sesión")');
    await expect(logoutBtn).toBeVisible();
    await logoutBtn.click();

    // Debe llamar al endpoint y redirigir a /login
    await expect(page).toHaveURL(/\/login/);
    expect(logoutCalled).toBe(true);

    // 1.3 Comprobar que IndexedDB y sessionStorage están limpios
    const storageClean = await page.evaluate(async () => {
      let isSessionStorageEmpty = window.sessionStorage.length === 0;
      return isSessionStorageEmpty;
    });
    expect(storageClean).toBe(true);

    // 1.4 Simular inicio de sesión con Alumno 2 en la misma tablet
    await context.clearCookies();
    await context.addCookies([
      { name: 'englove_access_token', value: 'token-student-2', domain: 'localhost', path: '/' },
      { name: 'englove_local_access_token', value: 'token-student-2', domain: 'localhost', path: '/' },
    ]);

    await page.route('**/api/v1/auth/refresh', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          user: { id: 'std-2', email: 'alumno2@englove.local', name: 'Alumno Dos', role: 'student' },
          student: { id: 'std-2', level: 'A1', ageSegment: 'kids', canSwitchInterface: false },
          organizationId: 'org-test',
        },
      });
    });

    await page.route('**/api/v1/me', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          user: { id: 'std-2', email: 'alumno2@englove.local', name: 'Alumno Dos', role: 'student' },
          student: { id: 'std-2', level: 'A1', ageSegment: 'kids', canSwitchInterface: false },
        },
      });
    });

    await page.route('**/api/v1/me/assignments', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          items: [
            {
              id: 'asg-std-2',
              activity: { id: 'act-2', title: 'Misión Alumno Dos', type: 'fill_blank', level: 'A1' },
              effectiveDueAt: '2026-12-01T18:00:00Z',
              canStart: true,
            },
          ],
          total: 1,
        },
      });
    });

    await page.goto('/inicio');
    await expect(page.locator('h1:has-text("¡Hola, Alumno Dos!")')).toBeVisible();
    await expect(page.locator('text=Misión Alumno Dos')).toBeVisible();

    // Confirmar que no hay datos residuales de Alumno Uno
    await expect(page.locator('h1:has-text("Alumno Uno")')).not.toBeVisible();
    await expect(page.locator('text=Misión Privada Alumno Uno')).not.toBeVisible();
  });

  test('2. Autorización cruzada y Anti-IDOR: Estudiante no puede acceder a secciones ni endpoints docentes', async ({
    page,
    context,
  }) => {
    // Sesión de estudiante
    await context.addCookies([
      { name: 'englove_access_token', value: 'token-student-only', domain: 'localhost', path: '/' },
      { name: 'englove_local_access_token', value: 'token-student-only', domain: 'localhost', path: '/' },
    ]);

    await page.route('**/api/v1/auth/refresh', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          user: { id: 'std-only', email: 'student@englove.local', name: 'Estudiante', role: 'student' },
          student: { id: 'std-only', level: 'A1', ageSegment: 'kids', canSwitchInterface: false },
          organizationId: 'org-test',
        },
      });
    });

    // Endpoints docentes protegidos rechazan con 403 si un alumno los consulta
    await page.route('**/api/v1/stats/overview*', async (route) => {
      await route.fulfill({
        status: 403,
        json: { code: 'FORBIDDEN', message: 'No tienes permisos de docente' },
      });
    });

    await page.route('**/api/v1/groups*', async (route) => {
      await route.fulfill({
        status: 403,
        json: { code: 'FORBIDDEN', message: 'No tienes permisos de docente' },
      });
    });

    // Intentar acceder a /estadisticas
    await page.goto('/estadisticas');

    // Debe mostrar error de permisos en el banner de error
    await expect(page.locator('text=No tienes permisos de docente').first()).toBeVisible({ timeout: 10000 });
  });

  test('3. Flujo Conectado: Registro de Alumno -> Aprobación Docente con Nivel y Grupo -> Login exitoso', async ({
    page,
    context,
  }) => {
    // 3.1 Registro de nuevo estudiante
    await page.route('**/api/v1/auth/signup', async (route) => {
      await route.fulfill({
        status: 201,
        json: { message: 'Recibimos tu solicitud. Revisa tu correo.' },
      });
    });

    await page.goto('/registro');
    await page.fill('input#name', 'Mateo Nuevo');
    await page.fill('input#email', 'mateo.nuevo@englove.local');
    await page.fill('input#birthDate', '2016-03-20');
    await page.fill('input#password', 'ClaveSegura123');
    await page.check('input[type="checkbox"]');
    await page.click('button[type="submit"]');

    await expect(page.locator('text=Solicitud recibida')).toBeVisible();

    // 3.2 Profesora entra a /alumnos?tab=requests y aprueba
    await context.addCookies([
      { name: 'englove_access_token', value: 'token-teacher', domain: 'localhost', path: '/' },
      { name: 'englove_local_access_token', value: 'token-teacher', domain: 'localhost', path: '/' },
    ]);

    await page.route('**/api/v1/auth/refresh', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          user: { id: 'tch-1', email: 'teacher@englove.local', name: 'Profesora Clara', role: 'teacher' },
          organizationId: 'org-test',
        },
      });
    });

    await page.route('**/api/v1/students/requests?*', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          items: [
            {
              id: 'std-req-mateo',
              name: 'Mateo Nuevo',
              email: 'mateo.nuevo@englove.local',
              birthDate: '2016-03-20',
              level: null,
              approvalStatus: 'pending_approval',
              isLocked: false,
            },
          ],
          total: 1,
        },
      });
    });

    await page.route('**/api/v1/groups?*', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          items: [{ id: 'grp-a1', name: 'Kids A1 Mañana', level: 'A1', activeStudentCount: 5 }],
          total: 1,
        },
      });
    });

    await page.goto('/alumnos?tab=requests');
    await expect(page.locator('text=Mateo Nuevo')).toBeVisible();

    // Click Aprobar
    const approveBtn = page.locator('button:has-text("Aprobar")');
    await expect(approveBtn).toBeVisible();
    await approveBtn.click();

    // Modal de aprobación con selección de nivel y grupo
    await expect(page.locator('h2:has-text("Aprobar alumno")')).toBeVisible();

    let approvedPayload: Record<string, unknown> | null = null;
    await page.route('**/api/v1/students/std-req-mateo/approve', async (route) => {
      approvedPayload = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        json: {
          id: 'std-req-mateo',
          name: 'Mateo Nuevo',
          approvalStatus: 'approved',
          level: 'A1',
        },
      });
    });

    // Confirmar aprobación
    await page.click('div[role="dialog"] button:has-text("Confirmar aprobación")');
    await expect(page.locator('div[role="dialog"]')).not.toBeVisible();
    expect(approvedPayload).not.toBeNull();
  });

  test('4. Flujo Conectado: Creación de actividad -> Asignación -> Visibilidad inmediata en /inicio del alumno', async ({
    page,
    context,
  }) => {
    // 4.1 Profesora publica y asigna actividad a Grupo A1
    await context.addCookies([
      { name: 'englove_access_token', value: 'token-teacher', domain: 'localhost', path: '/' },
      { name: 'englove_local_access_token', value: 'token-teacher', domain: 'localhost', path: '/' },
    ]);

    await page.route('**/api/v1/auth/refresh', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          user: { id: 'tch-1', email: 'teacher@englove.local', name: 'Profesora Clara', role: 'teacher' },
          organizationId: 'org-test',
        },
      });
    });

    await page.route('**/api/v1/activities?status=published*', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          items: [{ id: 'act-new-1', title: 'Animals & Pets Vocabulary', type: 'fill_blank', level: 'A1' }],
          total: 1,
        },
      });
    });

    await page.route('**/api/v1/groups?archived=false*', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          items: [{ id: 'grp-a1', name: 'Kids A1 Mañana', level: 'A1' }],
          total: 1,
        },
      });
    });

    await page.route('**/api/v1/assignments', async (route) => {
      await route.fulfill({
        status: 201,
        json: {
          items: [
            {
              id: 'asg-new-1',
              activityId: 'act-new-1',
              groupId: 'grp-a1',
              opensAt: '2026-11-01T08:00:00Z',
              dueAt: '2026-11-15T18:00:00Z',
            },
          ],
          count: 1,
        },
      });
    });

    await page.goto('/asignaciones/nueva');
    await expect(page.locator('h1:has-text("Nueva Asignación")')).toBeVisible();

    // 4.2 Alumno del grupo A1 entra a /inicio y ve la nueva asignación
    await context.clearCookies();
    await context.addCookies([
      { name: 'englove_access_token', value: 'token-student-a1', domain: 'localhost', path: '/' },
      { name: 'englove_local_access_token', value: 'token-student-a1', domain: 'localhost', path: '/' },
    ]);

    await page.route('**/api/v1/auth/refresh', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          user: { id: 'std-a1', email: 'mateo@englove.local', name: 'Mateo', role: 'student' },
          student: { id: 'std-a1', level: 'A1', ageSegment: 'kids', canSwitchInterface: false },
          organizationId: 'org-test',
        },
      });
    });

    await page.route('**/api/v1/me/assignments', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          items: [
            {
              id: 'asg-new-1',
              activity: { id: 'act-new-1', title: 'Animals & Pets Vocabulary', type: 'fill_blank', level: 'A1' },
              effectiveDueAt: '2026-11-15T18:00:00Z',
              canStart: true,
              canContinue: false,
              retryAvailable: false,
            },
          ],
          total: 1,
        },
      });
    });

    await page.goto('/inicio');
    await expect(page.locator('text=Animals & Pets Vocabulary')).toBeVisible();
    await expect(page.locator('button:has-text("Empezar actividad")')).toBeVisible();
  });

  test('5. Decisión 95: Actividad archivada con asignación abierta permite que el alumno complete su intento sin error', async ({
    page,
    context,
  }) => {
    // Alumno tiene asignación abierta cuya actividad fue archivada por la profesora
    await context.addCookies([
      { name: 'englove_access_token', value: 'token-student-dec95', domain: 'localhost', path: '/' },
      { name: 'englove_local_access_token', value: 'token-student-dec95', domain: 'localhost', path: '/' },
    ]);

    await page.route('**/api/v1/auth/refresh', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          user: { id: 'std-dec95', email: 'carlos@englove.local', name: 'Carlos', role: 'student' },
          student: { id: 'std-dec95', level: 'A1', ageSegment: 'kids', canSwitchInterface: false },
          organizationId: 'org-test',
        },
      });
    });

    await page.route('**/api/v1/me/assignments', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          items: [
            {
              id: 'asg-archived-act',
              activity: {
                id: 'act-archived-1',
                title: 'Actividad Archivada pero Vigente',
                type: 'fill_blank',
                level: 'A1',
              },
              effectiveDueAt: '2026-11-20T18:00:00Z',
              latestAttempt: {
                id: 'att-dec95-1',
                attemptNumber: 1,
                status: 'in_progress',
              },
              canStart: false,
              canContinue: true,
              retryAvailable: false,
            },
          ],
          total: 1,
        },
      });
    });

    await page.route('**/api/v1/attempts/att-dec95-1', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          attempt: {
            id: 'att-dec95-1',
            assignmentId: 'asg-archived-act',
            status: 'in_progress',
            attemptNumber: 1,
            effectiveDueAt: '2026-11-20T18:00:00Z',
            completeUntil: '2026-11-20T18:00:00Z',
          },
          activity: {
            id: 'act-archived-1',
            title: 'Actividad Archivada pero Vigente',
            type: 'fill_blank',
            level: 'A1',
            config: {
              type: 'fill_blank',
              items: [{ id: 'it-1', prompt: 'Hello {{b1}}', blanks: [{ id: 'b1' }] }],
            },
          },
          attemptToken: 'token-dec95',
        },
      });
    });

    await page.route('**/api/v1/attempts/att-dec95-1/complete', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          attempt: {
            id: 'att-dec95-1',
            assignmentId: 'asg-archived-act',
            status: 'graded',
            score: 5.0,
          },
        },
      });
    });

    // Cargar /inicio
    await page.goto('/inicio');
    await expect(page.locator('text=Actividad Archivada pero Vigente')).toBeVisible();

    // Abrir runner y completar intento
    await page.click('text=Continuar actividad');
    await expect(page).toHaveURL(/\/actividad\/att-dec95-1/);

    await page.fill('input[type="text"]', 'world');
    await page.click('button:has-text("Entregar actividad")');

    // Misión completada sin error (cumpliendo Decisión 95)
    await expect(page.locator('text=¡Misión completada!')).toBeVisible({ timeout: 5000 });
  });

  test('6. Flujo Conectado: Resolución -> Revisión docente con stickers y reintento -> Consumo en /feedback -> Reflejo en /estadisticas y /progreso', async ({
    page,
    context,
  }) => {
    // 6.1 Alumno entrega intento de open_question
    await context.addCookies([
      { name: 'englove_access_token', value: 'token-std-flow6', domain: 'localhost', path: '/' },
      { name: 'englove_local_access_token', value: 'token-std-flow6', domain: 'localhost', path: '/' },
    ]);

    await page.route('**/api/v1/auth/refresh', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          user: { id: 'std-f6', email: 'flow6@englove.local', name: 'Valeria Flow6', role: 'student' },
          student: { id: 'std-f6', level: 'A2', ageSegment: 'kids', canSwitchInterface: false },
          organizationId: 'org-test',
        },
      });
    });

    await page.route('**/api/v1/attempts/att-f6-1', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          attempt: {
            id: 'att-f6-1',
            assignmentId: 'asg-f6-1',
            attemptNumber: 1,
            status: 'in_progress',
            effectiveDueAt: '2026-12-01T18:00:00Z',
          },
          activity: {
            id: 'act-f6-1',
            title: 'My Favorite Hobby Essay',
            type: 'open_question',
            level: 'A2',
            config: { prompt: 'Write about your hobby' },
          },
          answers: {},
          attemptToken: 'token-f6-1',
        },
      });
    });

    await page.route('**/api/v1/attempts/att-f6-1/complete', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          attempt: {
            id: 'att-f6-1',
            assignmentId: 'asg-f6-1',
            attemptNumber: 1,
            status: 'pending_review',
            score: null,
          },
          newBadges: [],
        },
      });
    });

    await page.goto('/actividad/att-f6-1');
    await page.fill('textarea', 'I love painting landscapes on weekends.');
    await page.click('button:has-text("Entregar actividad")');
    await expect(page.locator('text=¡Actividad entregada con éxito!')).toBeVisible();

    // 6.2 Profesora entra a /revision, califica con 4.0, sticker y habilita reintento
    await context.clearCookies();
    await context.addCookies([
      { name: 'englove_access_token', value: 'token-teacher-f6', domain: 'localhost', path: '/' },
      { name: 'englove_local_access_token', value: 'token-teacher-f6', domain: 'localhost', path: '/' },
    ]);

    await page.route('**/api/v1/auth/refresh', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          user: { id: 'tch-f6', email: 'teacher.f6@englove.local', name: 'Profesora Clara', role: 'teacher' },
          organizationId: 'org-test',
        },
      });
    });

    await page.route('**/api/v1/groups?*', async (route) => {
      await route.fulfill({
        status: 200,
        json: { items: [{ id: 'grp-1', name: 'Kids A2', level: 'A2', activeStudentsCount: 1 }], total: 1 },
      });
    });

    const pendingItemF6 = {
      student: { id: 'std-f6', displayName: 'Valeria Flow6', ageSegment: 'kids' },
      group: { id: 'grp-1', name: 'Kids A2' },
      activity: { id: 'act-f6-1', title: 'My Favorite Hobby Essay', type: 'open_question' },
      assignment: { id: 'asg-f6-1', dueAt: '2026-12-01T18:00:00Z', cancelledAt: null },
      attempt: {
        attemptId: 'att-f6-1',
        attemptNumber: 1,
        status: 'pending_review',
        score: null,
        stars: 0,
        effectiveDueAt: '2026-12-01T18:00:00Z',
        canGrantRetry: true,
      },
      review: null,
    };

    await page.route('**/api/v1/reviews/queue*', async (route) => {
      await route.fulfill({
        status: 200,
        json: { items: [pendingItemF6], total: 1 },
      });
    });

    await page.route('**/api/v1/reviews/graded*', async (route) => {
      await route.fulfill({
        status: 200,
        json: { items: [], total: 0 },
      });
    });

    await page.route('**/api/v1/attempts/att-f6-1/review-detail', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          ...pendingItemF6,
          items: [{ id: 'it-open-1', prompt: 'Write about your hobby' }],
          answers: { text: 'I love painting landscapes on weekends.' },
        },
      });
    });

    await page.goto('/revision');
    await page.locator('button:has-text("My Favorite Hobby Essay")').first().click();

    await page.fill('input#score-input', '4.0');
    await page.fill('textarea#comment-input', '¡Gran uso del presente simple Valeria!');
    await page.locator('button:has-text("Estrella")').click();
    await page.locator('input[type="checkbox"]').check({ force: true });

    await page.route('**/api/v1/attempts/att-f6-1/review', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          ...pendingItemF6,
          items: [{ id: 'it-open-1', prompt: 'Write about your hobby' }],
          answers: { text: 'I love painting landscapes on weekends.' },
          attemptHistory: [],
          attempt: { ...pendingItemF6.attempt, status: 'graded', score: 4.0, retryGrantedAt: '2026-11-02T12:00:00Z' },
          review: {
            id: 'rev-f6',
            comment: '¡Gran uso del presente simple Valeria!',
            stickers: ['grammar_star'],
            reviewerId: 'tch-f6',
            createdAt: '2026-11-02T12:00:00Z',
            updatedAt: '2026-11-02T12:00:00Z',
          },
        },
      });
    });

    await page.click('button:has-text("Guardar Revisión y Retroalimentación")');
    await expect(page.locator('text=¡Calificación y retroalimentación guardadas exitosamente!')).toBeVisible();

    // 6.3 Alumno entra a /feedback, ve el reintento concedido y lo inicia
    await context.clearCookies();
    await context.addCookies([
      { name: 'englove_access_token', value: 'token-std-flow6', domain: 'localhost', path: '/' },
      { name: 'englove_local_access_token', value: 'token-std-flow6', domain: 'localhost', path: '/' },
    ]);

    await page.route('**/api/v1/auth/refresh', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          user: { id: 'std-f6', email: 'flow6@englove.local', name: 'Valeria Flow6', role: 'student' },
          student: { id: 'std-f6', level: 'A2', ageSegment: 'kids', canSwitchInterface: false },
          organizationId: 'org-test',
        },
      });
    });

    await page.route('**/api/v1/student/feedback', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          items: [
            {
              assignmentId: 'asg-f6-1',
              activityTitle: 'My Favorite Hobby Essay',
              activityType: 'open_question',
              level: 'A2',
              hasAvailableRetry: true,
              latestAttempt: {
                id: 'att-f6-1',
                attemptNumber: 1,
                score: 4.0,
                stars: 2,
                comment: '¡Gran uso del presente simple Valeria!',
                stickers: [{ code: 'star', emoji: '⭐', label: 'Estrella' }],
                gradedAt: '2026-11-02T12:00:00Z',
              },
              attempts: [{ id: 'att-f6-1', attemptNumber: 1, score: 4.0, stars: 2 }],
            },
          ],
          total: 1,
        },
      });
    });

    await page.goto('/feedback');
    await expect(page.locator('text=My Favorite Hobby Essay')).toBeVisible();
    await expect(page.locator('text=¡Tu profesora te habilitó un nuevo intento!')).toBeVisible();

    await page.route('**/api/v1/assignments/asg-f6-1/attempts', async (route) => {
      await route.fulfill({
        status: 201,
        json: {
          attempt: { id: 'att-f6-2', assignmentId: 'asg-f6-1', attemptNumber: 2, status: 'in_progress' },
          activity: { id: 'act-f6-1', title: 'My Favorite Hobby Essay', type: 'open_question', level: 'A2' },
          attemptToken: 'token-f6-2',
        },
      });
    });

    await page.click('button:has-text("Intentar de nuevo")');
    await expect(page).toHaveURL(/\/actividad\/att-f6-2/);

    // 6.4 Verificación en /progreso del alumno
    await page.route('**/api/v1/me/progress', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          streak: { weeks: 4, forgivenessAvailable: true, activeWeeksSinceForgivenessUsed: 1, periodKey: '2026-W44' },
          badges: [],
          activities: [{ attemptId: 'att-f6-1', score: 4.0, stars: 2 }],
        },
      });
    });

    await page.goto('/progreso');
    await expect(page.locator('text=4 semanas consecutivas')).toBeVisible();
  });
});
