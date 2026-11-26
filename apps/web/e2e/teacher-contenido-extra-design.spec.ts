import { addSessionCookie } from './session';
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const tags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const teacher = {
  id: "22222222-2222-4222-8222-222222222222",
  email: "docente@example.com",
  name: "Profesora de prueba",
  role: "teacher",
  organizationId: "11111111-1111-4111-8111-111111111111",
};
const payload = Buffer.from(
  JSON.stringify({
    sub: teacher.id,
    role: teacher.role,
    org: teacher.organizationId,
  }),
).toString("base64url");
const token = `header.${payload}.sig`;

test("Contenido extra adapta el catálogo y los diálogos y conserva el cupo al filtrar", async ({
  context,
  page,
}) => {
  await addSessionCookie(context, token);
  await page.route("**/api/v1/auth/refresh", (route) =>
    route.fulfill({ json: { accessToken: token, user: teacher } }),
  );
  await page.route("**/api/v1/feature-flags", (route) =>
    route.fulfill({
      json: {
        flags: { games: true, extra_content: false },
        config: {
          passing_score: 3,
          retention_days: 30,
          pending_upload_ttl_days: 7,
          ungraded_reminder_days: 3,
        },
      },
    }),
  );
  const item = {
    id: "00000000-0000-4000-8000-000000000001",
    title: "Diccionario ilustrado",
    url: `https://${"a".repeat(62)}.${"b".repeat(62)}.example.org/recurso`,
    description: "Vocabulario para practicar.",
    level: "A1",
    position: 0,
  };
  const items = Array.from({ length: 200 }, (_, index) => ({
    ...item,
    id: String(index),
    title: index === 0 ? item.title : `Recurso ${index + 1}`,
    level: index === 0 ? item.level : null,
    position: index,
  }));
  await page.route("**/api/v1/resources*", (route) => {
    const level = new URL(route.request().url()).searchParams.get("level");
    const filtered = level === "A1" ? items.slice(0, 1) : level ? [] : items;
    return route.fulfill({ json: { items: filtered, total: filtered.length } });
  });
  await page.goto("/contenido-extra");
  const main = page.getByRole("main");
  await expect(
    main.getByRole("button", { name: /Oculto para estudiantes/ }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(main.getByText("200 / 200 enlaces")).toBeVisible();
  await expect(
    main.getByRole("button", { name: /Nuevo enlace/ }),
  ).toBeDisabled();
  await main.getByRole("button", { name: "Nivel A1" }).click();
  const row = main.getByRole("listitem");
  await expect(row).toHaveCount(1);
  await expect(main.getByText("200 / 200 enlaces")).toBeVisible();
  await expect(main.getByText(/Selecciona el filtro «Todos»/)).toBeVisible();
  await expect(row.getByRole("button", { name: /Subir/ })).toBeDisabled();
  await expect(row.getByRole("button", { name: /Bajar/ })).toBeDisabled();
  const link = row.getByRole("link", { name: "Abrir" });
  await expect(link).toHaveAttribute("href", item.url);
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(main.locator("iframe")).toHaveCount(0);

  for (const { width, height } of [
    { width: 1440, height: 900 },
    { width: 1280, height: 800 },
    { width: 820, height: 1080 },
    { width: 390, height: 844 },
    { width: 320, height: 568 },
  ]) {
    await page.setViewportSize({ width, height });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    const target = await row
      .getByRole("button", { name: /Subir/ })
      .boundingBox();
    expect(target?.height).toBeGreaterThanOrEqual(width < 1024 ? 48 : 44);
    expect(target?.width).toBeGreaterThanOrEqual(92);
  }

  expect(
    (await new AxeBuilder({ page }).withTags(tags).analyze()).violations,
  ).toEqual([]);
  await row.getByRole("button", { name: "Editar" }).click();
  const dialog = page.getByRole("dialog", { name: "Editar enlace" });
  await expect(dialog.getByLabel("Título del recurso")).toBeFocused();
  const urlInput = dialog.getByLabel("Enlace externo (https://)");
  await urlInput.fill("example.org/recurso");
  await dialog.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(urlInput).toHaveAttribute("aria-invalid", "true");
  await expect(dialog.getByRole("alert")).toHaveText(
    "Ingresa un enlace válido que comience con https://",
  );
  expect(
    (await new AxeBuilder({ page }).withTags(tags).analyze()).violations,
  ).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(row.getByRole("button", { name: "Editar" })).toBeFocused();

  await row.getByRole("button", { name: "Eliminar" }).click();
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "Cancelar" }),
  ).toBeFocused();
  expect(
    (await new AxeBuilder({ page }).withTags(tags).analyze()).violations,
  ).toEqual([]);
  await page.keyboard.press("Escape");
  await main.getByRole("button", { name: "Nivel B2" }).click();
  await expect(
    main.getByRole("heading", { name: "No hay enlaces para este filtro." }),
  ).toBeVisible();
  await expect(
    main.getByRole("button", { name: /Nuevo enlace/ }),
  ).toBeDisabled();
});
