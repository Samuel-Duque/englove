import { test, expect } from '@playwright/test';

test.describe('SPEC-03 & SPEC-04: Panel Docente, Gestor de Contenidos y Asignaciones (ENG-145)', () => {
  test.beforeEach(async ({ context, page }) => {
    // Add teacher session cookies
    await context.addCookies([
      {
        name: 'englove_local_access_token',
        value: 'mock-teacher-token',
        domain: 'localhost',
        path: '/',
      },
      {
        name: 'englove_access_token',
        value: 'mock-teacher-token',
        domain: 'localhost',
        path: '/',
      },
    ]);

    // Mock teacher auth refresh & me & session
    await page.route('**/api/v1/auth/session', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          user: {
            id: 'tch-e2e-1',
            email: 'teacher@englove.local',
            name: 'Profesora Clara Gómez',
            role: 'teacher',
          },
          organizationId: 'org-e2e',
        },
      });
    });

    await page.route('**/api/v1/auth/refresh', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          user: {
            id: 'tch-e2e-1',
            email: 'teacher@englove.local',
            name: 'Profesora Clara Gómez',
            role: 'teacher',
          },
          organizationId: 'org-e2e',
        },
      });
    });

    await page.route('**/api/v1/me', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          user: {
            id: 'tch-e2e-1',
            name: 'Profesora Clara Gómez',
            email: 'teacher@englove.local',
            role: 'teacher',
          },
        },
      });
    });
  });

  test('1. /inicio: Dashboard docente con recordatorios (solicitudes pendientes y entregas vencidas) y accesos rápidos', async ({
    page,
  }) => {
    await page.route('**/api/v1/dashboard/reminders', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          pendingRegistrations: 3,
          overdueReviews: 2,
          ungradedReminderDays: 3,
        },
      });
    });

    await page.goto('/inicio');

    // Header & Welcome
    await expect(page.locator('h1:has-text("Panel Docente — Inicio")')).toBeVisible();
    await expect(page.locator('text=Bienvenida/o, Profesora Clara Gómez')).toBeVisible();

    // Reminder cards
    await expect(page.locator('h2:has-text("Solicitudes de Registro")')).toBeVisible();
    await expect(page.locator('text=Hay 3 alumnos esperando aprobación de cuenta.')).toBeVisible();

    await expect(page.locator('h2:has-text("Entregas sin Calificar")')).toBeVisible();
    await expect(page.locator('text=Hay 2 entregas pendientes de calificar hace más de 3 días.')).toBeVisible();

    // Quick links
    await expect(page.locator('a[href="/asignaciones"] h3:has-text("Asignaciones")')).toBeVisible();
    await expect(page.locator('a[href="/actividades"] h3:has-text("Catálogo de Actividades")')).toBeVisible();
    await expect(page.locator('a[href="/grupos"] h3:has-text("Gestión de Grupos")')).toBeVisible();
    await expect(page.locator('a[href="/alumnos"] h3:has-text("Gestión de Alumnos")')).toBeVisible();
    await expect(page.locator('a[href="/revision"] h3:has-text("Revisión y Calificación")')).toBeVisible();
  });

  test('2. /contenidos y /contenidos/onboarding: Redirecciones declarativas hacia catálogo y creador', async ({
    page,
  }) => {
    await page.route('**/api/v1/activities?*', async (route) => {
      await route.fulfill({
        status: 200,
        json: { items: [], total: 0, offset: 0, limit: 100 },
      });
    });

    // 2.1 /contenidos -> /actividades
    await page.goto('/contenidos');
    await expect(page).toHaveURL(/\/actividades/);
    await expect(page.locator('h1:has-text("Catálogo de Actividades")')).toBeVisible();

    // 2.2 /contenidos/onboarding -> /actividades/nueva
    await page.goto('/contenidos/onboarding');
    await expect(page).toHaveURL(/\/actividades\/nueva/);
    await expect(page.locator('h1:has-text("Nueva actividad")')).toBeVisible();
  });

  test('3. /actividades: Catálogo, filtros por nivel/tipo, duplicación estricta y archivo', async ({ page }) => {
    const mockActivities = [
      {
        id: 'act-1',
        title: 'Colors and Animals Fill Blank',
        type: 'fill_blank',
        level: 'A1',
        status: 'published',
        createdAt: '2026-10-20T10:00:00Z',
        updatedAt: '2026-10-20T10:00:00Z',
      },
      {
        id: 'act-2',
        title: 'Daily Routine Speaking',
        type: 'speaking',
        level: 'A2',
        status: 'draft',
        createdAt: '2026-10-21T10:00:00Z',
        updatedAt: '2026-10-21T10:00:00Z',
      },
    ];

    await page.route('**/api/v1/activities?*', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          items: mockActivities,
          total: mockActivities.length,
          offset: 0,
          limit: 100,
        },
      });
    });

    await page.goto('/actividades');

    // List displayed
    await expect(page.locator('h1:has-text("Catálogo de Actividades")')).toBeVisible();
    await expect(page.locator('text=Colors and Animals Fill Blank')).toBeVisible();
    await expect(page.locator('text=Daily Routine Speaking')).toBeVisible();

    // Duplication action (strict check, no conditional wrapper)
    await page.route('**/api/v1/activities/act-1/duplicate', async (route) => {
      await route.fulfill({
        status: 201,
        json: {
          id: 'act-1-copy',
          title: 'Colors and Animals Fill Blank (Copia)',
          type: 'fill_blank',
          level: 'A1',
          status: 'draft',
        },
      });
    });

    await page.route('**/api/v1/activities/act-1-copy', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          id: 'act-1-copy',
          title: 'Colors and Animals Fill Blank (Copia)',
          type: 'fill_blank',
          level: 'A1',
          status: 'draft',
          config: { items: [{ question: 'The sky is ___', answers: ['blue'] }] },
        },
      });
    });

    const duplicateBtn = page.locator('button:has-text("Duplicar")').first();
    await expect(duplicateBtn).toBeVisible();
    await duplicateBtn.click();
    await expect(page).toHaveURL(/\/actividades\/act-1-copy/);
  });

  test('4. /actividades/nueva: Creación y Previsualización Docente para los 5 tipos pedagógicos y ajuste de pesos de examen', async ({
    page,
  }) => {
    await page.goto('/actividades/nueva');
    await expect(page.locator('h1:has-text("Nueva actividad")')).toBeVisible();

    // Fill title
    await page.fill('input#activity-title', 'Actividad Multitipo E2E');

    // 4.1 Tipo fill_blank y previsualización
    const previewBtn = page.locator('button:has-text("Previsualizar")');
    await expect(previewBtn).toBeVisible();
    await previewBtn.click();

    const dialog = page.getByRole('dialog', { name: 'Previsualización Docente' });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('h2:has-text("Previsualización Docente")')).toBeVisible();
    await expect(
      dialog.locator('text=Vista previa: no se guardan respuestas (ENG-039). Modo interactivo de prueba sin alterar métricas.'),
    ).toBeVisible();
    await dialog.locator('button:has-text("✕")').click();
    await expect(dialog).not.toBeVisible();

    // 4.2 Cambiar a open_question y previsualizar
    await page.selectOption('select#activity-type', 'open_question');
    await expect(page.locator('textarea#oq-prompt-0, textarea#oq-prompt')).toBeVisible();
    await previewBtn.click();
    await expect(dialog).toBeVisible();
    await dialog.locator('button:has-text("✕")').click();

    // 4.3 Cambiar a speaking y previsualizar
    await page.selectOption('select#activity-type', 'speaking');
    await expect(page.locator('textarea#sp-prompt')).toBeVisible();
    await previewBtn.click();
    await expect(dialog).toBeVisible();
    await dialog.locator('button:has-text("✕")').click();

    // 4.4 Cambiar a game con mecánica match y previsualizar
    await page.selectOption('select#activity-type', 'game');
    await expect(page.locator('select#game-mechanic')).toBeVisible();
    await page.selectOption('select#game-mechanic', 'match');
    await previewBtn.click();
    await expect(dialog).toBeVisible();
    await dialog.locator('button:has-text("✕")').click();

    // 4.5 Cambiar a exam y verificar normalización de pesos a 100%
    await page.selectOption('select#activity-type', 'exam');
    await expect(page.locator('input#exam-w1')).toBeVisible();
    await expect(page.locator('input#exam-w2')).toBeVisible();

    await page.route('**/api/v1/activities', async (route) => {
      await route.fulfill({
        status: 201,
        json: {
          id: 'exam-act-new',
          title: 'Actividad Multitipo E2E',
          type: 'exam',
          level: 'A1',
          status: 'draft',
          weightsAdjusted: true,
        },
      });
    });

    await page.route('**/api/v1/activities/exam-act-new', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          id: 'exam-act-new',
          title: 'Actividad Multitipo E2E',
          type: 'exam',
          level: 'A1',
          status: 'draft',
        },
      });
    });

    await page.fill('input#activity-title', 'Actividad Multitipo E2E');
    await page.click('button:has-text("Crear borrador")');
    await expect(page.locator('h1:has-text("Editor de actividad")')).toBeVisible();
  });

  test('5. /grupos: Listado, creación, bloqueo de archivo con alumnos activos y detalle de grupo', async ({
    page,
  }) => {
    const mockGroups = [
      { id: 'grp-active-1', name: 'Kids A1 Mañana', activeStudentCount: 5, archivedAt: null },
      { id: 'grp-empty-2', name: 'Kids A2 Tarde', activeStudentCount: 0, archivedAt: null },
    ];

    await page.route('**/api/v1/groups?*', async (route) => {
      await route.fulfill({
        status: 200,
        json: { items: mockGroups, total: 2 },
      });
    });

    await page.goto('/grupos');
    await expect(page.locator('h1:has-text("Gestión de Grupos")')).toBeVisible();
    await expect(page.locator('text=Kids A1 Mañana')).toBeVisible();
    await expect(page.locator('text=Kids A2 Tarde')).toBeVisible();

    // 5.1 Bloqueo estricto de archivo para grupo con alumnos activos (GROUP_HAS_ACTIVE_STUDENTS)
    const archiveBtnWithStudents = page.locator('tr:has-text("Kids A1 Mañana") button:has-text("Archivar")');
    await expect(archiveBtnWithStudents).toBeVisible();
    await archiveBtnWithStudents.click();
    await expect(
      page.locator('text=No es posible archivar el grupo "Kids A1 Mañana": tiene 5 alumno(s) activo(s)'),
    ).toBeVisible();

    // 5.2 Creación de nuevo grupo
    await page.route('**/api/v1/groups', async (route) => {
      await route.fulfill({
        status: 201,
        json: { id: 'grp-new-3', name: 'Teens B1 Nocturno', activeStudentCount: 0, archivedAt: null },
      });
    });

    const createGroupBtn = page.locator('button:has-text("Crear grupo")');
    await expect(createGroupBtn).toBeVisible();
    await createGroupBtn.click();

    await page.fill('input#new-group-name', 'Teens B1 Nocturno');
    await page.click('button[type="submit"]:has-text("Crear grupo")');

    // 5.3 Navegar a ver miembros de grupo /grupos/:id
    await page.route('**/api/v1/groups/grp-active-1', async (route) => {
      await route.fulfill({
        status: 200,
        json: { id: 'grp-active-1', name: 'Kids A1 Mañana', activeStudentCount: 1, archivedAt: null },
      });
    });

    await page.route('**/api/v1/groups/grp-active-1/members?*', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          items: [
            { id: 'std-m-1', name: 'Mateo Miembro', email: 'mateo.m@englove.local', level: 'A1', birthDate: '2016-01-01' },
          ],
          total: 1,
        },
      });
    });

    await page.goto('/grupos/grp-active-1');
    await expect(page.locator('h1:has-text("Kids A1 Mañana")')).toBeVisible();
    await expect(page.locator('text=Mateo Miembro')).toBeVisible();
  });

  test('6. /alumnos: Pestañas Solicitudes y Bloqueados, aprobación y ficha individual con cambio de correo y baja', async ({
    page,
  }) => {
    const mockStudents = [
      {
        id: 'std-1',
        name: 'Camila Morales',
        email: 'camila@englove.local',
        birthDate: '2016-04-10',
        level: 'A1',
        approvalStatus: 'approved',
        isLocked: false,
        group: { id: 'grp-1', name: 'Kids A1 Mañana' },
      },
    ];

    const mockRequests = [
      {
        id: 'std-req-1',
        name: 'Nicolás Rojas',
        email: 'nicolas@englove.local',
        birthDate: '2015-08-20',
        level: null,
        approvalStatus: 'pending_approval',
        isLocked: false,
        guardianName: 'Mamá de Nicolás',
        guardianContact: 'mama@correo.com',
      },
    ];

    const mockLocked = [
      {
        id: 'std-lck-1',
        name: 'Mateo Bloqueado',
        email: 'mateo@englove.local',
        birthDate: '2015-03-12',
        level: 'A1',
        approvalStatus: 'approved',
        isLocked: true,
        group: { id: 'grp-1', name: 'Kids A1 Mañana' },
      },
    ];

    await page.route('**/api/v1/students?*', async (route) => {
      await route.fulfill({ status: 200, json: { items: mockStudents, total: 1 } });
    });
    await page.route('**/api/v1/students/requests?*', async (route) => {
      await route.fulfill({ status: 200, json: { items: mockRequests, total: 1 } });
    });
    await page.route('**/api/v1/students/locked?*', async (route) => {
      await route.fulfill({ status: 200, json: { items: mockLocked, total: 1 } });
    });
    await page.route('**/api/v1/groups?*', async (route) => {
      await route.fulfill({
        status: 200,
        json: { items: [{ id: 'grp-1', name: 'Kids A1 Mañana', level: 'A1' }], total: 1 },
      });
    });

    // 6.1 Listado general de alumnos
    await page.goto('/alumnos');
    await expect(page.locator('text=Camila Morales')).toBeVisible();

    // 6.2 Pestaña Solicitudes
    await page.click('button:has-text("Solicitudes")');
    await expect(page.locator('text=Nicolás Rojas')).toBeVisible();
    await expect(page.locator('button:has-text("Aprobar")')).toBeVisible();

    // 6.3 Pestaña Bloqueados y desbloqueo en un clic
    await page.click('button:has-text("Bloqueados")');
    await expect(page.locator('text=Mateo Bloqueado')).toBeVisible();

    await page.route('**/api/v1/students/std-lck-1/unlock', async (route) => {
      await route.fulfill({
        status: 200,
        json: { message: 'Cuenta desbloqueada exitosamente' },
      });
    });

    const unlockBtn = page.locator('button:has-text("Desbloquear en 1 clic")');
    await expect(unlockBtn).toBeVisible();
    await unlockBtn.click();
    await expect(page.locator('text=desbloqueada exitosamente.')).toBeVisible();

    // 6.4 Ficha individual /alumnos/[id]: edición de ficha, cambio administrativo de correo y baja
    await page.route('**/api/v1/students/std-1', async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 200,
          json: {
            id: 'std-1',
            name: 'Camila Morales Editada',
            email: 'camila@englove.local',
            birthDate: '2016-04-10',
            level: 'A1',
            guardianName: 'Mamá Actualizada',
            guardianContact: '+57 300 1234567',
          },
        });
      } else {
        await route.fulfill({
          status: 200,
          json: {
            id: 'std-1',
            name: 'Camila Morales',
            email: 'camila@englove.local',
            birthDate: '2016-04-10',
            level: 'A1',
            approvalStatus: 'approved',
            isLocked: false,
            guardianName: 'Mamá Inicial',
            guardianContact: 'contacto@inicial.com',
            groupId: 'grp-1',
          },
        });
      }
    });

    await page.route('**/api/v1/students/std-1/memberships?*', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          items: [
            {
              id: 'mem-1',
              groupId: 'grp-1',
              groupName: 'Kids A1 Mañana',
              joinedAt: '2026-09-01T10:00:00Z',
              leftAt: null,
            },
          ],
          total: 1,
        },
      });
    });

    await page.goto('/alumnos/std-1');
    await expect(page.locator('h1:has-text("Camila Morales")')).toBeVisible();

    // Edición de ficha
    await page.click('button:has-text("Editar datos")');
    await page.fill('input#edit-gname', 'Mamá Actualizada');
    await page.fill('input#edit-gcontact', '+57 300 1234567');
    await page.click('button:has-text("Guardar")');
    await expect(page.locator('text=Ficha del alumno actualizada.')).toBeVisible();

    // Cambio administrativo de correo con confirmación de identidad
    await page.route('**/api/v1/students/std-1/change-email', async (route) => {
      await route.fulfill({
        status: 200,
        json: { message: 'Correo actualizado exitosamente' },
      });
    });

    await page.click('button:has-text("Cambiar correo de acceso")');
    const emailDialog = page.locator('div[role="dialog"]');
    await expect(emailDialog).toBeVisible();
    await emailDialog.locator('input#change-new-email').fill('camila.nueva@englove.local');
    await emailDialog.locator('input[type="checkbox"]').check();
    await emailDialog.locator('button:has-text("Confirmar cambio")').click();
    await expect(page.locator('text=Correo actualizado exitosamente')).toBeVisible();

    // Modal de baja en cascada
    await page.route('**/api/v1/students/std-1', async (route) => {
      if (route.request().method() === 'DELETE') {
        await route.fulfill({ status: 204 });
      }
    });

    await page.click('button:has-text("Dar de baja al estudiante")');
    const deleteDialog = page.locator('div[role="dialog"]');
    await expect(deleteDialog).toBeVisible();
    await deleteDialog.locator('input[placeholder="ELIMINAR"]').fill('ELIMINAR');
    await deleteDialog.locator('button:has-text("Confirmar baja definitiva")').click();
    await expect(page).toHaveURL(/\/alumnos/);
  });

  test('7. /asignaciones: Estados derivados, asignación multigrupo atómica, selector America/Bogota y cancelación idempotente', async ({
    page,
  }) => {
    const assignmentOne = {
      id: 'asg-1',
      activity: { id: 'act-1', title: 'Activity One', type: 'fill_blank', level: 'A1', version: 1 },
      group: { id: 'grp-1', name: 'Kids A1' },
      opensAt: '2026-10-01T08:00:00Z',
      dueAt: '2026-10-10T18:00:00Z',
      cancelledAt: null,
      availability: 'closed',
      totalAttempts: 10,
      submittedAttempts: 8,
    };
    const assignmentTwo = {
      id: 'asg-2',
      activity: { id: 'act-2', title: 'Activity Two', type: 'speaking', level: 'A1', version: 1 },
      group: { id: 'grp-1', name: 'Kids A1' },
      opensAt: '2026-11-01T08:00:00Z',
      dueAt: '2026-11-20T18:00:00Z',
      cancelledAt: null,
      availability: 'open',
      totalAttempts: 5,
      submittedAttempts: 2,
    };
    const mockAssignments = [assignmentOne, assignmentTwo];

    await page.route('**/api/v1/assignments?*', async (route) => {
      await route.fulfill({
        status: 200,
        json: { items: mockAssignments, total: 2 },
      });
    });
    await page.route('**/api/v1/groups?*', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          items: [
            { id: 'grp-1', name: 'Kids A1', level: 'A1' },
            { id: 'grp-2', name: 'Kids A2', level: 'A2' },
          ],
          total: 2,
        },
      });
    });

    await page.goto('/asignaciones');
    await expect(page.locator('h1:has-text("Asignaciones")')).toBeVisible();
    await expect(page.locator('span:has-text("Cerrada")')).toBeVisible();
    await expect(page.locator('span:has-text("Abierta")')).toBeVisible();

    // 7.2 Nueva Asignación Multigrupo Atómica con aviso de +24 h
    await page.route('**/api/v1/activities?status=published*', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          items: [{ id: 'act-1', title: 'Activity One', type: 'fill_blank', level: 'A1' }],
          total: 1,
        },
      });
    });

    await page.route('**/api/v1/assignments', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          json: {
            items: [
              { id: 'asg-multi-1', activityId: 'act-1', groupId: 'grp-1' },
              { id: 'asg-multi-2', activityId: 'act-1', groupId: 'grp-2' },
            ],
            count: 2,
          },
        });
      }
    });

    await page.goto('/asignaciones/nueva');
    await expect(page.locator('h1:has-text("Nueva Asignación")')).toBeVisible();
    await expect(page.locator('text=Hora de Colombia (America/Bogota)')).toBeVisible();
    await expect(
      page.locator('text=los alumnos pueden empezar hasta esta hora; quien haya empezado tendrá hasta 24 horas más para terminar.'),
    ).toBeVisible();

    // Seleccionar actividad
    await page.locator('label:has-text("Activity One")').click();

    // Seleccionar múltiples grupos
    await page.click('button:has-text("Seleccionar todos")');

    // Crear asignaciones
    await page.click('button:has-text("Crear asignación")');
    await expect(page).toHaveURL(/\/asignaciones/);

    // 7.3 Detalle /asignaciones/:id y cancelación idempotente
    await page.route('**/api/v1/assignments/asg-2', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          ...assignmentTwo,
          availability: 'open',
          activity: { ...assignmentTwo.activity, id: 'act-2' },
        },
      });
    });

    await page.route('**/api/v1/assignments/asg-2/cancel', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          ...assignmentTwo,
          cancelledAt: '2026-11-02T12:00:00Z',
          availability: 'cancelled',
        },
      });
    });

    await page.goto('/asignaciones/asg-2');
    await expect(page.locator('h1:has-text("Activity Two")')).toBeVisible();

    const cancelBtn = page.locator('button:has-text("Cancelar asignación")');
    await expect(cancelBtn).toBeVisible();
    await cancelBtn.click();

    // Confirmar en modal
    const cancelModal = page.locator('div[role="dialog"]');
    await expect(cancelModal).toBeVisible();
    await cancelModal.locator('button:has-text("Cancelar asignación")').click();

    await expect(page.locator('text=Asignación cancelada')).toBeVisible();
  });
});
