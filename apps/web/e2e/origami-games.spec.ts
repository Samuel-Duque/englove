import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const games = [
  {
    id: "origami-match",
    title: "Match the animals",
    level: "A1",
    mechanic: "match",
    status: "not_started",
  },
  {
    id: "origami-memory",
    title: "Memory pairs",
    level: "A2",
    mechanic: "memory",
    status: "completed",
    bestStars: 2,
    bestScore: 3.5,
    attemptsCount: 3,
  },
  {
    id: "origami-order",
    title: "Make a sentence",
    level: "A2",
    mechanic: "order_words",
    status: "in_progress",
    inProgressAttemptId: "origami-resume",
  },
];

async function mockStudent(
  page: Page,
  ageSegment: "kids" | "teens",
  enabled = true,
) {
  await page.context().addCookies(
    ["upward_english_local_access_token", "upward_english_access_token"].map(
      (name) => ({
        name,
        value: "mock-student-token",
        domain: "localhost",
        path: "/",
      }),
    ),
  );

  const profile = {
    user: {
      id: "origami-student",
      name: "Alex",
      email: "alex@example.test",
      role: "student",
    },
    student: {
      id: "origami-student",
      level: "A1",
      ageSegment,
      canSwitchInterface: false,
      group: null,
    },
    organizationId: "origami-school",
  };
  await page.route("**/api/v1/auth/refresh", (route) =>
    route.fulfill({ json: profile }),
  );
  await page.route("**/api/v1/me", (route) => route.fulfill({ json: profile }));
  await page.route("**/api/v1/feature-flags", (route) =>
    route.fulfill({
      json: { flags: { games: enabled, extra_content: false } },
    }),
  );
  const gameRequests: string[] = [];
  await page.route("**/api/v1/me/games", (route) => {
    gameRequests.push(route.request().method());
    return route.fulfill({ json: { items: games, total: games.length } });
  });
  return gameRequests;
}

for (const segment of ["kids", "teens"] as const) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`RF-6: catálogo ${segment} en ${colorScheme} conserva práctica y usa gabinetes Origami`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.emulateMedia({ colorScheme });
      await page.addInitScript(() => {
        window.speechSynthesis.speak = (utterance) => {
          document.documentElement.dataset.spoken = utterance.text;
        };
      });
      const gameRequests = await mockStudent(page, segment);
      await page.goto("/juegos");

      const main = page.getByRole("main");
      await expect(
        main.getByRole("heading", { name: "Zona de Microjuegos" }),
      ).toBeVisible();
      await expect(page.locator("[data-theme]")).toHaveAttribute(
        "data-theme",
        segment,
      );

      const cards = main.getByRole("article");
      await expect(cards).toHaveCount(3);
      const memory = main.getByRole("article", { name: "Memory pairs" });
      const art = memory.locator('img[alt=""]');
      await expect(art).toBeVisible();
      await expect(art).toHaveAttribute("src", "/origami/games-memory.svg");
      await expect(art).toHaveCSS("aspect-ratio", "4 / 3");
      await expect(art).toHaveJSProperty("complete", true);
      expect(
        await art.evaluate(
          (img) => img instanceof HTMLImageElement && img.naturalWidth > 0,
        ),
      ).toBe(true);
      await expect(memory.getByText("Nivel A2")).toBeVisible();
      await expect(memory.getByText("Memoria")).toBeVisible();
      await expect(
        memory.getByRole("img", { name: "Estrellas de práctica: 2 de 3" }),
      ).toBeVisible();
      await expect(memory.getByText("3 partidas")).toBeVisible();
      await expect(
        memory.getByRole("button", { name: "Jugar de nuevo" }),
      ).toBeVisible();
      const voice = memory.getByRole("button", {
        name: "Escuchar Memory pairs",
      });
      await voice.focus();
      await expect(voice).toHaveCSS("outline-width", "3px");
      expect(
        await voice.evaluate((el) => {
          const { width, height } = el.getBoundingClientRect();
          return Math.min(width, height);
        }),
      ).toBeGreaterThanOrEqual(48);
      await expect(page.locator("html")).not.toHaveAttribute(
        "data-spoken",
        /.+/,
      );
      await voice.press("Enter");
      await expect(page.locator("html")).toHaveAttribute(
        "data-spoken",
        "Memory pairs",
      );
      await memory
        .getByRole("button", { name: "Detener lectura de Memory pairs" })
        .press("Enter");
      await expect(voice).toBeVisible();

      const palette =
        colorScheme === "dark" ? "rgb(53, 39, 31)" : "rgb(255, 248, 232)";
      await expect(memory).toHaveCSS("background-color", palette);
      const retry = memory.getByRole("button", { name: "Jugar de nuevo" });
      await expect(retry).toHaveCSS("background-color", "rgb(185, 44, 53)");
      expect(
        await retry.evaluate((el) => el.getBoundingClientRect().height),
      ).toBeGreaterThanOrEqual(segment === "kids" ? 56 : 48);

      for (const [width, columns] of [
        [320, 1],
        [390, 1],
        [800, 2],
        [1280, 3],
      ] as const) {
        await page.setViewportSize({ width, height: 844 });
        const rows = await cards.evaluateAll((items) =>
          items.map((card) => card.getBoundingClientRect().top),
        );
        expect(rows.filter((top) => top === rows[0])).toHaveLength(columns);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBe(width);
      }
      if (process.env.ORIGAMI_REFERENCE_SCREENSHOTS === "true") {
        await page.screenshot({
          path: testInfo.outputPath("catalogo.png"),
          fullPage: true,
          animations: "disabled",
        });
      }
      const { violations } = await new AxeBuilder({ page })
        .include("#main-content")
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(violations).toEqual([]);

      const completed = main.getByRole("button", { name: "Jugados (1)" });
      await completed.click();
      await expect(completed).toHaveAttribute("aria-pressed", "true");
      await expect(cards).toHaveCount(1);
      await expect(memory).toBeVisible();

      await main.getByRole("button", { name: "Por practicar (2)" }).click();
      await expect(cards).toHaveCount(2);
      await expect(
        main.getByRole("link", { name: "Reanudar partida" }),
      ).toHaveAttribute("href", "/actividad/origami-resume");

      const starts: string[] = [];
      const release = Promise.withResolvers<void>();
      await page.route(
        "**/api/v1/activities/origami-match/attempts",
        async (route) => {
          starts.push(route.request().method());
          await release.promise;
          return route.fulfill({ json: { attempt: { id: "origami-new" } } });
        },
      );
      await main.getByRole("button", { name: "Jugar", exact: true }).click();
      await expect(
        main.getByRole("button", { name: "Iniciando…" }),
      ).toBeDisabled();
      release.resolve();
      await expect(page).toHaveURL(/\/actividad\/origami-new$/);
      expect(starts).toEqual(["POST"]);
      expect(gameRequests).toContain("GET");
    });
  }
}

test("RF-6: sin el permiso games se informa el estado y se omite consultar el catálogo", async ({
  page,
}) => {
  const gameRequests = await mockStudent(page, "teens", false);
  await page.goto("/juegos");

  const main = page.getByRole("main");
  await expect(
    main.getByRole("heading", { name: "Microjuegos no disponibles" }),
  ).toBeVisible();
  await expect(
    main.getByRole("link", { name: "Volver al inicio" }),
  ).toHaveAttribute("href", "/inicio");
  await expect(
    main.getByRole("button", { name: "Jugar", exact: true }),
  ).toHaveCount(0);
  expect(gameRequests).toEqual([]);
});

test("RF-6: la carga no muestra un catálogo vacío y distingue falta de acceso", async ({
  page,
}) => {
  await mockStudent(page, "kids");
  const release = Promise.withResolvers<void>();
  await page.route("**/api/v1/me/games", async (route) => {
    await release.promise;
    return route.fulfill({
      status: 403,
      json: { statusCode: 403, code: "FORBIDDEN", message: "Sin permiso" },
    });
  });
  await page.goto("/juegos");

  const main = page.getByRole("main");
  await expect(main.getByRole("status")).toHaveText(
    "Cargando la zona de juegos…",
  );
  await expect(main.getByRole("article")).toHaveCount(0);
  release.resolve();
  await expect(main.getByRole("alert")).toHaveText(
    "No tienes acceso al catálogo de juegos en este momento.",
  );
  await expect(
    main.getByRole("link", { name: "Volver al inicio" }),
  ).toHaveAttribute("href", "/inicio");
  await expect(
    main.getByRole("heading", { name: /Todavía no hay juegos/ }),
  ).toHaveCount(0);
});

test("RF-6: una selección vacía permite volver a todos los juegos", async ({
  page,
}) => {
  await mockStudent(page, "teens");
  await page.route("**/api/v1/me/games", (route) =>
    route.fulfill({ json: { items: games.slice(0, 1), total: 1 } }),
  );
  await page.goto("/juegos");

  const main = page.getByRole("main");
  await main.getByRole("button", { name: "Jugados (0)" }).click();
  await expect(
    main.getByRole("heading", { name: "No hay juegos en esta selección." }),
  ).toBeVisible();
  await expect(main.getByRole("article")).toHaveCount(0);
  await main.getByRole("button", { name: "Ver todos los juegos" }).click();
  const all = main.getByRole("button", { name: "Todos (1)" });
  await expect(all).toBeFocused();
  await expect(all).toHaveAttribute("aria-pressed", "true");
  await expect(
    main.getByRole("article", { name: "Match the animals" }),
  ).toBeVisible();
});
