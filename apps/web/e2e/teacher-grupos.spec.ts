import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import {
  GroupListResponseSchema,
  GroupViewSchema,
} from "@upward-english/shared";

const wcagTags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const active = {
  id: "group-active",
  name: "Exploradores A1",
  activeStudentCount: 3,
  archivedAt: null,
};
const empty = {
  id: "group-empty",
  name: "Grupo de prueba",
  activeStudentCount: 0,
  archivedAt: null,
};
const archived = {
  id: "group-archived",
  name: "Taller anterior",
  activeStudentCount: 0,
  archivedAt: "2026-11-01T00:00:00Z",
};

test.describe("Directorio docente de grupos", () => {
  test.beforeEach(async ({ context, page }) => {
    const token = `header.${Buffer.from(JSON.stringify({ role: "teacher" })).toString("base64url")}.signature`;
    for (const name of new Set([
      `${process.env.COOKIE_PREFIX ?? "englove_local_"}access_token`,
      "upward_english_local_access_token",
      "upward_english_access_token",
    ])) {
      await context.addCookies([
        { name, value: token, domain: "localhost", path: "/" },
      ]);
    }
    await page.route("**/api/v1/auth/session", (route) =>
      route.fulfill({
        json: {
          user: {
            id: "teacher-groups",
            name: "Clara Gómez",
            email: "teacher@example.test",
            role: "teacher",
          },
          organizationId: "org-groups",
        },
      }),
    );
    await page.route("**/api/v1/groups?*", (route) => {
      const filter = new URL(route.request().url()).searchParams.get(
        "archived",
      );
      const items =
        filter === "true"
          ? [archived]
          : filter === "false"
            ? [active, empty]
            : [active, empty, archived];
      return route.fulfill({ json: { items, total: items.length } });
    });
  });

  for (const [width, height] of [
    [1440, 900],
    [1280, 800],
    [820, 1080],
    [390, 844],
    [320, 640],
  ] as const) {
    test(`diseño y accesibilidad en ${width} × ${height}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto("/grupos");
      const main = page.getByRole("main");
      await expect(
        main.getByRole("heading", { name: "Grupos", exact: true }),
      ).toBeVisible();
      const row = main.getByRole("row").filter({ hasText: active.name });
      await expect(row.getByText("Activo", { exact: true })).toBeVisible();
      await expect(row.getByRole("cell", { name: "3", exact: true })).toHaveCSS(
        "font-variant-numeric",
        "tabular-nums",
      );
      await expect(
        row.getByRole("link", { name: `Ver detalle de ${active.name}` }),
      ).toHaveAttribute("href", `/grupos/${active.id}`);

      await main
        .getByRole("button", { name: "Archivados", exact: true })
        .click();
      const archivedRow = main
        .getByRole("row")
        .filter({ hasText: archived.name });
      await expect(
        archivedRow.getByText("Archivado", { exact: true }),
      ).toBeVisible();
      await expect(
        archivedRow.getByRole("button", { name: /Renombrar|Archivar/ }),
      ).toHaveCount(0);
      await main.getByRole("button", { name: "Todos", exact: true }).click();
      await expect(
        main.getByRole("status", { name: "" }).filter({ hasText: "3 grupos" }),
      ).toBeVisible();
      await expect(archivedRow).toBeVisible();
      await expect(row).toBeVisible();

      await main
        .getByRole("button", { name: "Nuevo grupo", exact: true })
        .click();
      const form = main.getByRole("form", { name: "Crear grupo" });
      await expect(
        form.getByRole("textbox", { name: "Nombre del grupo" }),
      ).toBeFocused();
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
        .toBeLessThanOrEqual(width);
      const table = main.getByRole("table", { name: "Directorio de grupos" });
      await expect
        .poll(() =>
          table.evaluate(({ parentElement }) =>
            parentElement
              ? parentElement.scrollWidth - parentElement.clientWidth
              : -1,
          ),
        )
        .toBe(0);
      expect(
        (await new AxeBuilder({ page }).withTags(wcagTags).analyze())
          .violations,
      ).toEqual([]);
    });
  }

  test("bloquea el archivo, guía hacia Alumnos y maneja conflictos de datos desactualizados", async ({
    page,
  }) => {
    await page.route("**/api/v1/groups/group-empty/archive", (route) =>
      route.fulfill({
        status: 409,
        json: {
          code: "GROUP_HAS_ACTIVE_STUDENTS",
          message: "Grupo con alumnos vigentes",
        },
      }),
    );
    await page.route("**/api/v1/groups/group-empty", (route) =>
      route.fulfill({
        status: 409,
        json: { code: "GROUP_ARCHIVED", message: "Grupo archivado" },
      }),
    );
    await page.goto("/grupos");
    const main = page.getByRole("main");
    const alert = main.getByRole("alert");
    await main
      .getByRole("row")
      .filter({ hasText: active.name })
      .getByRole("button", { name: "Archivar" })
      .click();
    await expect(alert).toBeFocused();
    await expect(
      alert.getByRole("link", { name: "Ir a Alumnos" }),
    ).toHaveAttribute("href", "/alumnos");

    const row = main.getByRole("row").filter({ hasText: empty.name });
    const archive = row.getByRole("button", { name: "Archivar" });
    await archive.click();
    const dialog = page.getByRole("dialog", { name: "Archivar grupo" });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(archive).toBeFocused();
    await archive.click();
    await dialog.getByRole("button", { name: "Archivar grupo" }).click();
    await expect(alert).toContainText("Trasládalos a otro grupo");
    await expect(alert).toBeFocused();

    await row.getByRole("button", { name: "Renombrar" }).click();
    const name = row.getByRole("textbox", { name: /Nombre del grupo/ });
    await expect(name).toBeFocused();
    await name.fill("Nuevo nombre");
    await name.press("Enter");
    await expect(alert).toContainText("Este grupo ya está archivado");
    await expect(alert).toBeFocused();
    await expect(
      alert.getByRole("link", { name: "Ir a Alumnos" }),
    ).toHaveAttribute("href", "/alumnos");
  });

  test("muestra cuatro filas de carga y la invitación a crear el primer grupo", async ({
    page,
  }) => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/v1/groups?*", async (route) => {
      await gate;
      await route.fulfill({ json: { items: [], total: 0 } });
    });
    try {
      await page.goto("/grupos");
      const skeleton = page
        .getByRole("main")
        .getByRole("status")
        .filter({ hasText: "Cargando grupos…" });
      await expect(skeleton.locator('[aria-hidden="true"]')).toHaveCount(4);
    } finally {
      release();
    }
    await expect(
      page.getByRole("heading", { name: "Crea tu primer grupo" }),
    ).toBeVisible();
  });
});

test("Grupos con API local: listado, detalle, creación, renombrado y archivo", async ({
  page,
}) => {
  const email = process.env.ENGLOVE_SMOKE_EMAIL;
  const password = process.env.ENGLOVE_SMOKE_PASSWORD;
  test.skip(
    !email || !password,
    "Requiere una cuenta docente del entorno local.",
  );
  if (!email || !password) return;
  test.setTimeout(90_000);

  await page.goto("/login");
  await page.getByRole("textbox", { name: "Correo electrónico" }).fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  const loginResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/v1/auth/login" &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  const login = await loginResponse;
  expect(
    login.status(),
    `Inicio de sesión local. Retry-After: ${login.headers()["retry-after"] ?? "—"}`,
  ).toBe(200);
  await expect(page).toHaveURL(/\/inicio$/);

  const main = page.getByRole("main");
  const groupList = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      url.pathname === "/api/v1/groups" &&
      url.searchParams.get("limit") === "100" &&
      url.searchParams.get("archived") === "false" &&
      response.request().method() === "GET"
    );
  });
  await page
    .getByRole("navigation", { name: "Navegación docente" })
    .getByRole("link", { name: "Grupos", exact: true })
    .click();
  const listResponse = await groupList;
  expect(listResponse.status()).toBe(200);
  const groups = GroupListResponseSchema.parse(await listResponse.json());
  const occupied = groups.items.find((group) => group.activeStudentCount > 0);
  expect(
    occupied,
    "La base local debe contener un grupo con alumnos vigentes",
  ).toBeDefined();
  if (!occupied) return;

  const occupiedRow = main.getByRole("row").filter({
    has: page.getByRole("rowheader", { name: occupied.name, exact: true }),
  });
  await expect(
    occupiedRow.getByRole("cell", {
      name: String(occupied.activeStudentCount),
      exact: true,
    }),
  ).toBeVisible();
  await occupiedRow.getByRole("button", { name: "Archivar" }).click();
  await main
    .getByRole("alert")
    .getByRole("link", { name: "Ir a Alumnos" })
    .click();
  await expect(page).toHaveURL(/\/alumnos$/);
  await main.getByRole("link", { name: "Gestionar grupos" }).click();

  const detailResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === `/api/v1/groups/${occupied.id}`,
  );
  const membersResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
      `/api/v1/groups/${occupied.id}/members`,
  );
  await main
    .getByRole("link", { name: `Ver detalle de ${occupied.name}`, exact: true })
    .click();
  expect((await detailResponse).status()).toBe(200);
  expect((await membersResponse).status()).toBe(200);
  await expect(
    main.getByRole("heading", { name: occupied.name, exact: true }),
  ).toBeVisible();
  await page.goBack();

  const name = `Plan 13 ${randomUUID()}`;
  const renamed = `${name} renombrado`;
  const createdResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/v1/groups" &&
      response.request().method() === "POST",
  );
  await main.getByRole("button", { name: "Nuevo grupo", exact: true }).click();
  await main
    .getByRole("textbox", { name: "Nombre del grupo", exact: true })
    .fill(name);
  await main.getByRole("button", { name: "Crear grupo", exact: true }).click();
  const created = await createdResponse;
  expect(created.status()).toBe(201);
  const { id } = GroupViewSchema.parse(await created.json());
  const endpoint = new URL(created.url());
  endpoint.pathname += `/${id}`;
  try {
    const row = main.getByRole("row").filter({ hasText: name });
    await row.getByRole("button", { name: "Renombrar" }).click();
    const patch = page.waitForResponse(
      (response) =>
        response.url() === endpoint.href &&
        response.request().method() === "PATCH",
    );
    const input = row.getByRole("textbox", { name: /Nombre del grupo/ });
    await input.fill(renamed);
    await input.press("Enter");
    expect((await patch).status()).toBe(200);
    await expect(row.getByRole("rowheader", { name: renamed })).toBeVisible();

    const archive = page.waitForResponse(
      (response) =>
        response.url() === `${endpoint.href}/archive` &&
        response.request().method() === "POST",
    );
    await row.getByRole("button", { name: "Archivar" }).click();
    await page
      .getByRole("dialog", { name: "Archivar grupo" })
      .getByRole("button", { name: "Archivar grupo" })
      .click();
    const archivedResponse = await archive;
    expect(archivedResponse.status()).toBe(200);
    expect(
      GroupViewSchema.parse(await archivedResponse.json()).archivedAt,
    ).toBeTruthy();
    await expect(row).toHaveCount(0);
    await main.getByRole("button", { name: "Archivados", exact: true }).click();
    await expect(row.getByText("Archivado", { exact: true })).toBeVisible();
    await expect(row.getByRole("button", { name: "Renombrar" })).toHaveCount(0);
  } finally {
    const removed = await page.request.delete(endpoint.href, {
      headers: { Origin: new URL(page.url()).origin },
    });
    expect(removed.status()).toBe(204);
  }
});
