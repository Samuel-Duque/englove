import { addSessionCookie } from './session';
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const student = {
  id: "student-detail",
  name: "Camila Morales",
  email: "camila.morales.estudiante@example.test",
  birthDate: "2016-04-10",
  ageSegment: "kids",
  level: "A1",
  approvalStatus: "approved",
  groupId: "group-one",
};
const path = `/alumnos/${student.id}`;
const endpoint = `/api/v1/students/${student.id}`;
const groups = [
  { id: "group-one", name: "Exploradores de inglés", archivedAt: null },
  { id: "group-two", name: "English Readers", archivedAt: null },
] as const;

async function expectAccessible(page: Page, include: string) {
  const results = await new AxeBuilder({ page })
    .include(include)
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
}

test.beforeEach(async ({ context, page }) => {
  const token = `header.${Buffer.from(JSON.stringify({ role: "teacher" })).toString("base64url")}.signature`;
  await addSessionCookie(context, token);
  await page.route("**/api/v1/auth/session", (route) =>
    route.fulfill({
      json: {
        user: {
          id: "teacher-detail",
          name: "Clara Gómez",
          email: "teacher@example.test",
          role: "teacher",
        },
        organizationId: "org-detail",
      },
    }),
  );
  await page.route(`**${endpoint}`, (route) =>
    route.fulfill({ json: student }),
  );
  await page.route(`**${endpoint}/memberships?*`, (route) =>
    route.fulfill({
      json: {
        items: [
          {
            id: "history-one",
            groupId: groups[0].id,
            groupName: groups[0].name,
            joinedAt: "2026-11-25T02:00:00Z",
            leftAt: null,
          },
        ],
      },
    }),
  );
  await page.route("**/api/v1/groups?*", (route) =>
    route.fulfill({ json: { items: groups } }),
  );
});

for (const [width, height] of [
  [1440, 900],
  [1280, 800],
  [820, 1080],
  [390, 844],
  [320, 640],
] as const) {
  test(`Ficha del alumno a ${width} × ${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto(path);
    const main = page.getByRole("main");
    await expect(
      main.getByRole("heading", { level: 1, name: student.name }),
    ).toBeVisible();
    await expect(main.getByRole("heading", { level: 2 })).toHaveCount(4);
    await expect(
      main.getByRole("link", { name: "Ver estadísticas" }),
    ).toHaveAttribute("href", `/estadisticas/estudiantes/${student.id}`);
    await expect(main.getByRole("cell", { name: "24/11/26" })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await expectAccessible(page, "main");

    await main
      .getByRole("button", { name: "Dar de baja al estudiante" })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Confirmar baja definitiva",
    });
    const close = dialog.getByRole("button", { name: "Cerrar modal" });
    const cancel = dialog.getByRole("button", { name: "Cancelar" });
    const confirm = dialog.getByRole("button", {
      name: "Confirmar baja definitiva",
    });
    await expect(close).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(cancel).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(close).toBeFocused();
    await expect(confirm).toBeDisabled();
    const text = dialog.getByLabel("Escribe ELIMINAR para confirmar la baja");
    await text.fill("eliminar");
    await expect(confirm).toBeDisabled();
    await text.fill("ELIMINAR");
    await expect(confirm).toBeEnabled();
    const box = await dialog.boundingBox();
    expect(box?.width).toBeLessThanOrEqual(Math.min(540, width - 32));
    await expectAccessible(page, '[role="dialog"]');
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(
      main.getByRole("button", { name: "Dar de baja al estudiante" }),
    ).toBeFocused();
  });
}

test("Traslado: muestra las actividades y solo confirma la pérdida tras aceptar", async ({
  page,
}) => {
  const calls: unknown[] = [];
  await page.route(`**${endpoint}/group`, async (route) => {
    const body = route.request().postDataJSON();
    expect(route.request().method()).toBe("PUT");
    calls.push(body);
    if (body.confirmLostRetries) {
      await route.fulfill({ json: { ...student, groupId: groups[1].id } });
      return;
    }
    await route.fulfill({
      status: 409,
      json: {
        statusCode: 409,
        code: "UNCONSUMED_RETRY_WARNING",
        message: "Hay reintentos pendientes.",
        details: {
          affectedActivities: [
            {
              assignmentId: "assignment-one",
              activityId: "activity-one",
              activityTitle: "Listening Practice",
              effectiveDueAt: "2026-12-01T13:00:00Z",
              attemptNumber: 1,
            },
          ],
        },
      },
    });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(path);
  await page
    .getByLabel("Seleccionar grupo de destino")
    .selectOption(groups[1].id);
  await page.getByRole("button", { name: "Cambiar de grupo" }).click();
  const dialog = page.getByRole("dialog", {
    name: "Pérdida definitiva de reintentos",
  });
  await expect(
    dialog.getByText("Listening Practice (Intento #1)"),
  ).toBeVisible();
  await expect(dialog.getByText(/incluso si el alumno vuelve/)).toBeVisible();
  expect(calls).toEqual([{ groupId: groups[1].id, confirmLostRetries: false }]);
  await expectAccessible(page, '[role="dialog"]');
  await dialog
    .getByRole("button", { name: "Confirmar traslado definitivo" })
    .click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Grupo actualizado exitosamente.")).toBeVisible();
  expect(calls).toEqual([
    { groupId: groups[1].id, confirmLostRetries: false },
    { groupId: groups[1].id, confirmLostRetries: true },
  ]);
});

test("Acceso: recuperación confirmada y conflicto de correo dentro del diálogo", async ({
  page,
}) => {
  await page.route(`**${endpoint}/reset-password`, (route) => {
    expect(route.request().method()).toBe("POST");
    return route.fulfill({ json: { message: "Enlace enviado." } });
  });
  await page.route(`**${endpoint}/change-email`, (route) => {
    expect(route.request().method()).toBe("POST");
    expect(route.request().postDataJSON()).toEqual({
      newEmail: "existente@example.test",
    });
    return route.fulfill({
      status: 409,
      json: { statusCode: 409, code: "EMAIL_TAKEN", message: "Conflicto" },
    });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(path);
  await page
    .getByRole("button", {
      name: "Enviar enlace de recuperación de contraseña",
    })
    .click();
  await page
    .getByRole("dialog", { name: "Recuperación de contraseña" })
    .getByRole("button", { name: "Enviar enlace" })
    .click();
  await expect(page.getByText("Enlace enviado.")).toBeVisible();

  const open = page.getByRole("button", { name: "Cambiar correo de acceso" });
  await open.click();
  const dialog = page.getByRole("dialog", { name: "Cambiar correo de acceso" });
  await expect(dialog.getByLabel("Correo actual")).toHaveValue(student.email);
  await expect(dialog.getByLabel("Correo actual")).not.toBeEditable();
  await dialog
    .getByLabel("Nuevo correo electrónico")
    .fill("existente@example.test");
  const checkbox = dialog.getByRole("checkbox", {
    name: /fuera de la plataforma/,
  });
  const confirm = dialog.getByRole("button", { name: "Confirmar cambio" });
  await expect(checkbox).not.toBeChecked();
  await expect(confirm).toBeDisabled();
  await expect(dialog.getByText(/cierra las sesiones activas/)).toBeVisible();
  await dialog.getByLabel("Nuevo correo electrónico").fill("correo-incompleto");
  await checkbox.check();
  await expect(confirm).toBeDisabled();
  await dialog
    .getByLabel("Nuevo correo electrónico")
    .fill("existente@example.test");
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "Ese correo no está disponible",
  );
  await expectAccessible(page, '[role="dialog"]');
  await dialog.getByRole("button", { name: "Cancelar" }).click();
  await open.click();
  await expect(checkbox).not.toBeChecked();
  await expect(confirm).toBeDisabled();
});

test("Ficha no encontrada ofrece volver al directorio", async ({ page }) => {
  await page.route(`**${endpoint}`, (route) =>
    route.fulfill({
      status: 404,
      json: { statusCode: 404, message: "Alumno no encontrado" },
    }),
  );
  await page.goto(path);
  const alert = page.getByRole("main").getByRole("alert");
  await expect(alert).toContainText("Alumno no encontrado.");
  await alert.getByRole("link", { name: "Volver a alumnos" }).click();
  await expect(page).toHaveURL(/\/alumnos$/);
});

test("Ficha: guarda cambios de perfil y envía la baja solo tras confirmarla", async ({
  page,
}) => {
  let name = student.name;
  let deleted = false;
  await page.route(`**${endpoint}`, async (route) => {
    const method = route.request().method();
    if (method === "DELETE") {
      deleted = true;
      await route.fulfill({ status: 204 });
      return;
    }
    if (method === "PATCH") {
      expect(route.request().postDataJSON()).toMatchObject({
        name: "Camila Mora",
        birthDate: student.birthDate,
        level: student.level,
        guardianName: "Marta Mora",
        guardianContact: "marta@example.test",
      });
      name = "Camila Mora";
    }
    await route.fulfill({ json: { ...student, name } });
  });
  await page.goto(path);
  await page.getByRole("button", { name: "Editar datos" }).click();
  await page.getByLabel("Nombre completo").fill("Camila Mora");
  await page.getByLabel("Nombre del acudiente").fill("Marta Mora");
  await page.getByLabel("Contacto del acudiente").fill("marta@example.test");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Camila Mora", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Ficha del alumno actualizada.")).toBeVisible();

  await page.getByRole("button", { name: "Dar de baja al estudiante" }).click();
  const dialog = page.getByRole("dialog", {
    name: "Confirmar baja definitiva",
  });
  const confirm = dialog.getByRole("button", {
    name: "Confirmar baja definitiva",
  });
  await dialog
    .getByLabel("Escribe ELIMINAR para confirmar la baja")
    .fill("ELIMINAR ");
  await expect(confirm).toBeDisabled();
  expect(deleted).toBe(false);
  await dialog
    .getByLabel("Escribe ELIMINAR para confirmar la baja")
    .fill("ELIMINAR");
  await confirm.click();
  await expect(page).toHaveURL(/\/alumnos$/);
  expect(deleted).toBe(true);
});
