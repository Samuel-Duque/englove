import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const origin = `https://${"practica".repeat(7)}.${"recursos".repeat(7)}.example.test`;
const profile = {
  user: {
    id: "student-teens",
    name: "Estudiante de prueba",
    email: "teens@example.test",
    role: "student",
  },
  student: {
    id: "student-teens",
    ageSegment: "teens",
    level: "B1",
    canSwitchInterface: true,
  },
};

test.beforeEach(async ({ baseURL, context, page }) => {
  for (const prefix of new Set([
    process.env.COOKIE_PREFIX ?? process.env.NEXT_PUBLIC_COOKIE_PREFIX,
    "englove_local_",
    "upward_english_local_",
    "upward_english_",
  ])) {
    if (prefix) {
      await context.addCookies([
        {
          name: `${prefix}access_token`,
          value: "mock-teens-token",
          url: baseURL,
        },
      ]);
    }
  }
  await page.route(/\/api\/v1\/(?:me|auth\/session)$/, (route) =>
    route.fulfill({ json: profile }),
  );
});

test("Plan 7 Teens: catálogo responsive, filtros, enlaces externos y aviso sin red", async ({
  context,
  page,
}) => {
  await page.route("**/api/v1/feature-flags", (route) =>
    route.fulfill({ json: { flags: { games: true, extra_content: true } } }),
  );
  let releaseResources: () => void = () => {};
  const pendingResources = new Promise<void>((resolve) => {
    releaseResources = resolve;
  });
  await page.route("**/api/v1/resources", async (route) => {
    await pendingResources;
    await route.fulfill({
      json: {
        items: [
          {
            id: "level",
            title: "Práctica B1",
            url: `${origin}/exercises`,
            level: "B1",
          },
          {
            id: "general",
            title: "Diccionario",
            url: "https://example.test/dictionary",
          },
          {
            id: "invalid",
            title: "Enlace antiguo",
            url: "http://example.test",
          },
        ],
      },
    });
  });
  await page.goto("/extra");
  const main = page.getByRole("main");
  await expect(main.getByText("Cargando recursos extra…")).toBeVisible();
  releaseResources();
  const list = main.getByRole("list", { name: "Tarjetas de contenido extra" });
  const links = list.getByRole("link", { name: "Abrir recurso externo" });
  await expect(links).toHaveCount(2);
  await expect(links.first()).toHaveAttribute("href", `${origin}/exercises`);
  await expect(links.first()).toHaveAttribute("target", "_blank");
  await expect(links.first()).toHaveAttribute("rel", "noopener noreferrer");
  await expect(list.getByText(origin, { exact: true })).toBeVisible();
  await expect(list.getByText("Enlace no disponible.")).toBeVisible();
  await expect(main.getByRole("button", { name: /Escuchar/i })).toHaveCount(0);
  await expect(main.locator("iframe, embed, object")).toHaveCount(0);

  const filters = main.getByRole("group", {
    name: "Filtrar contenido por nivel",
  });
  for (const [width, height] of [
    [320, 720],
    [390, 844],
    [680, 844],
    [681, 844],
    [800, 1280],
    [1280, 800],
  ] as const) {
    await page.setViewportSize({ width, height });
    const cards = await list
      .getByRole("listitem")
      .evaluateAll((items) =>
        items.map((item) => item.getBoundingClientRect().top),
      );
    expect(new Set(cards).size).toBe(width <= 680 ? 3 : 2);
    expect(
      await main.evaluate((area) => area.scrollWidth - area.clientWidth),
    ).toBeLessThanOrEqual(0);
    if (width !== 681) {
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
    }
    for (const control of [
      ...(await filters.getByRole("button").all()),
      ...(await links.all()),
    ]) {
      const box = await control.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(48);
      expect(box?.height).toBeGreaterThanOrEqual(48);
    }
  }

  const results = await new AxeBuilder({ page })
    .include("main")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);

  await filters.getByRole("button", { name: "Tu nivel" }).click();
  await expect(
    list.getByRole("heading", { name: "Práctica B1" }),
  ).toBeVisible();
  await expect(list.getByRole("heading", { name: "Diccionario" })).toHaveCount(
    0,
  );

  await filters.getByRole("button", { name: "Generales" }).click();
  await expect(
    list.getByRole("heading", { name: "Diccionario" }),
  ).toBeVisible();
  await expect(list.getByRole("heading", { name: "Práctica B1" })).toHaveCount(
    0,
  );

  await context.setOffline(true);
  await expect(
    main.getByText(
      "Necesitas conexión a internet para abrir enlaces externos.",
    ),
  ).toBeVisible();
  await context.setOffline(false);
  await expect(
    main.getByText(
      "Necesitas conexión a internet para abrir enlaces externos.",
    ),
  ).toHaveCount(0);
});

for (const enabled of [false, true]) {
  test(`Plan 7 Teens: sección no disponible con ${enabled ? "403 del catálogo" : "flag apagado"}`, async ({
    page,
  }) => {
    let resourceRequests = 0;
    await page.route("**/api/v1/feature-flags", (route) =>
      route.fulfill({
        json: { flags: { games: true, extra_content: enabled } },
      }),
    );
    await page.route("**/api/v1/resources", (route) => {
      resourceRequests += 1;
      return route.fulfill({
        status: 403,
        json: {
          statusCode: 403,
          code: "EXTRA_CONTENT_DISABLED",
          message: "Sección no disponible",
        },
      });
    });
    await page.goto("/extra");
    const main = page.getByRole("main");
    await expect(page.locator('[data-theme="teens"]')).toBeVisible();
    await expect(
      main.getByRole("heading", { name: "Contenido extra no disponible" }),
    ).toBeVisible();
    const back = main.getByRole("link", { name: "Volver al inicio" });
    expect((await back.boundingBox())?.height).toBeGreaterThanOrEqual(48);
    expect(resourceRequests > 0).toBe(enabled);
    await back.click();
    await expect(page).toHaveURL(/\/inicio$/);
  });
}
