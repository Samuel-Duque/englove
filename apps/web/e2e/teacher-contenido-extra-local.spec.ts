import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import type { Response } from "@playwright/test";
import {
  ExternalResourceItemSchema,
  FeatureFlagsResponseSchema,
} from "@upward-english/shared";

const email = process.env.ENGLOVE_SMOKE_EMAIL;
const password = process.env.ENGLOVE_SMOKE_PASSWORD;
const resourcesPath = "/api/v1/resources";
const flagsPath = "/api/v1/feature-flags";

function matches(response: Response, path: string, method: string) {
  return (
    new URL(response.url()).pathname === path &&
    response.request().method() === method
  );
}

test("Gestiona el catálogo desde el panel docente con la API local", async ({
  page,
  baseURL,
}) => {
  test.skip(
    !email || !password,
    "Requiere la cuenta docente del entorno local.",
  );
  if (!email || !password) return;
  test.setTimeout(90_000);
  const loopback = ['localhost', '127.0.0.1', '[::1]'];
  if (!baseURL || !loopback.includes(new URL(baseURL).hostname)) {
    throw new Error("La prueba de integración requiere un frontend local.");
  }
  const headers = { origin: new URL(baseURL).origin };

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Correo electrónico" }).fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  const loggedIn = page.waitForResponse((response) =>
    matches(response, "/api/v1/auth/login", "POST"),
  );
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  expect((await loggedIn).status()).toBe(200);
  await expect(page).toHaveURL(/\/inicio$/, { timeout: 15_000 });

  const nav = page.getByRole("navigation", { name: "Navegación docente" });
  const extra = nav.getByRole("link", { name: "Contenido extra" });
  const loaded = page.waitForResponse((response) =>
    matches(response, resourcesPath, "GET"),
  );
  await extra.click();
  const catalog = await loaded;
  expect(catalog.ok()).toBe(true);
  expect(loopback).toContain(new URL(catalog.url()).hostname);
  await expect(extra).toHaveAttribute("aria-current", "page");

  const main = page.getByRole("main");
  const testTitle = `Prueba local ${randomUUID()}`;
  const created = new Map<string, string>();
  const visibility = main.getByRole("button", {
    name: /(?:Visible|Oculto) para estudiantes/,
  });
  await expect(visibility).toHaveAttribute("aria-pressed", /true|false/);
  const originalVisibility =
    (await visibility.getAttribute("aria-pressed")) === "true";
  let restoreVisibility: string | undefined;

  try {
    const toggled = page.waitForResponse((response) =>
      matches(response, `${flagsPath}/extra_content`, "PATCH"),
    );
    await visibility.click();
    const flagResponse = await toggled;
    expect(flagResponse.ok()).toBe(true);
    restoreVisibility = flagResponse.url();
    expect(
      FeatureFlagsResponseSchema.parse(await flagResponse.json()).flags
        ?.extra_content,
    ).toBe(!originalVisibility);
    await expect(visibility).toHaveAttribute(
      "aria-pressed",
      String(!originalVisibility),
    );

    for (const suffix of ["A", "B"]) {
      const title = `${testTitle} ${suffix}`;
      await main.getByRole("button", { name: /Nuevo enlace/ }).click();
      const dialog = page.getByRole("dialog", { name: "Nuevo enlace" });
      await dialog.getByLabel("Título del recurso").fill(title);
      await dialog
        .getByLabel("Enlace externo (https://)")
        .fill("https://example.com/english");
      await dialog.getByLabel("Nivel de visibilidad").selectOption("A1");
      const posted = page.waitForResponse((response) =>
        matches(response, resourcesPath, "POST"),
      );
      await dialog.getByRole("button", { name: "Crear enlace" }).click();
      const response = await posted;
      expect(response.status()).toBe(201);
      const { id } = ExternalResourceItemSchema.parse(await response.json());
      created.set(id, `${response.url()}/${id}`);
      await expect(main.getByRole("heading", { name: title })).toBeVisible();
    }

    const rows = main.getByRole("listitem").filter({ hasText: testTitle });
    const moved = page.waitForResponse((response) =>
      matches(response, `${resourcesPath}/reorder`, "PUT"),
    );
    await rows.last().getByRole("button", { name: /Subir/ }).click();
    expect((await moved).ok()).toBe(true);
    await expect(rows.first().getByRole("heading")).toHaveText(
      `${testTitle} B`,
    );

    const filtered = page.waitForResponse(
      (response) =>
        matches(response, resourcesPath, "GET") &&
        new URL(response.url()).searchParams.get("level") === "A1",
    );
    await main.getByRole("button", { name: "Nivel A1" }).click();
    expect((await filtered).ok()).toBe(true);
    await expect(
      rows.first().getByRole("button", { name: /Subir/ }),
    ).toBeDisabled();

    const [firstId] = created.keys();
    const firstRow = rows.filter({ hasText: `${testTitle} A` });
    await firstRow.getByRole("button", { name: "Editar" }).click();
    const editor = page.getByRole("dialog", { name: "Editar enlace" });
    await editor
      .getByLabel("Descripción (opcional)")
      .fill("Descripción editada en el entorno local");
    const updated = page.waitForResponse((response) =>
      matches(response, `${resourcesPath}/${firstId}`, "PATCH"),
    );
    await editor.getByRole("button", { name: "Guardar cambios" }).click();
    expect((await updated).ok()).toBe(true);
    await expect(
      firstRow.getByText("Descripción editada en el entorno local"),
    ).toBeVisible();

    await firstRow.getByRole("button", { name: "Eliminar" }).click();
    const deleted = page.waitForResponse((response) =>
      matches(response, `${resourcesPath}/${firstId}`, "DELETE"),
    );
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Eliminar enlace" })
      .click();
    expect((await deleted).status()).toBe(204);
    if (firstId) created.delete(firstId);
    await expect(firstRow).toHaveCount(0);
    await nav.getByRole("link", { name: "Inicio", exact: true }).click();
    await expect(page).toHaveURL(/\/inicio$/);
  } finally {
    const cleanups = [...created.values()].map((url) =>
      page.request.delete(url, { headers }),
    );
    if (restoreVisibility) {
      cleanups.push(
        page.request.patch(restoreVisibility, {
          headers,
          data: { enabled: originalVisibility },
        }),
      );
    }
    for (const response of await Promise.all(cleanups))
      expect(response.ok()).toBe(true);
  }
});
