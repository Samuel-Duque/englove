import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  GroupStatsResponseSchema,
  StudentStatsResponseSchema,
} from "@upward-english/shared";

const email = process.env.ENGLOVE_SMOKE_EMAIL;
const password = process.env.ENGLOVE_SMOKE_PASSWORD;

test("Ficha estadística docente con API local: rutas, filtros, polling y diseño responsive", async ({
  page,
}) => {
  test.skip(
    !email || !password,
    "Requiere una cuenta docente sembrada en el entorno local.",
  );
  if (!email || !password) return;
  test.setTimeout(120_000);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Correo electrónico" }).fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL("/inicio", { timeout: 20_000 });

  const groupRequest = page.waitForResponse((response) =>
    new URL(response.url()).pathname.startsWith("/api/v1/stats/groups/"),
  );
  await page.goto("/estadisticas?tab=groups");
  const groupResponse = await groupRequest;
  expect(groupResponse.ok()).toBe(true);
  const group = GroupStatsResponseSchema.parse(await groupResponse.json());
  const student = group.students.find((item) => item.isCurrentMember);
  expect(
    student,
    "El grupo local necesita al menos un estudiante activo",
  ).toBeDefined();
  if (!student) return;

  const main = page.getByRole("main");
  const statsPath = `/api/v1/stats/students/${student.studentId}`;
  const statsPage = `/estadisticas/estudiantes/${student.studentId}`;
  const nextStats = () =>
    page.waitForResponse(
      (response) => new URL(response.url()).pathname === statsPath,
    );

  await page.clock.install();
  const detailRequest = nextStats();
  await main
    .getByRole("link", { name: student.studentName, exact: true })
    .click();
  await expect(page).toHaveURL(statsPage);
  const detailResponse = await detailRequest;
  expect(detailResponse.ok()).toBe(true);
  const detail = StudentStatsResponseSchema.parse(await detailResponse.json());
  expect(detail.student.id).toBe(student.studentId);
  await expect(
    main.getByRole("heading", { name: student.studentName, level: 1 }),
  ).toBeVisible();
  await expect(
    main
      .getByRole("list", { name: "Semanas del calendario de constancia" })
      .getByRole("listitem"),
  ).toHaveCount(12);
  await expect(
    main.getByRole("heading", { name: "Práctica en juegos" }),
  ).toBeVisible();

  const refreshRequest = nextStats();
  await main.getByRole("button", { name: "Refrescar" }).click();
  expect((await refreshRequest).ok()).toBe(true);
  await expect(main.getByRole("button", { name: "Refrescar" })).toBeEnabled();

  const pollingRequest = nextStats();
  await page.clock.fastForward(30_000);
  expect((await pollingRequest).ok()).toBe(true);

  const filterRequest = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      url.pathname === statsPath && url.searchParams.get("type") === "speaking"
    );
  });
  await main.getByLabel("Tipo evaluable").selectOption("speaking");
  expect((await filterRequest).ok()).toBe(true);
  await main.getByRole("button", { name: "Limpiar filtros" }).click();
  await expect(main.getByLabel("Tipo evaluable")).toHaveValue("");

  for (const label of ["Por Día", "Por Mes", "Por Semana"]) {
    const button = main.getByRole("button", { name: label });
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
  }

  for (const [width, height] of [
    [1440, 900],
    [1280, 800],
    [820, 1080],
    [390, 844],
    [320, 640],
  ] as const) {
    await page.setViewportSize({ width, height });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(width);
  }

  const accessibility = await new AxeBuilder({ page })
    .include("#main-content")
    .analyze();
  expect(accessibility.violations).toEqual([]);

  const profilePath = `/alumnos/${student.studentId}`;
  await main.getByRole("link", { name: "Ver ficha de alumno" }).click();
  await expect(page).toHaveURL(profilePath);
  await expect(
    main.getByRole("heading", { name: student.studentName, level: 1 }),
  ).toBeVisible();
  await page.goBack();
  await main
    .getByRole("navigation", { name: "Ruta de navegación" })
    .getByRole("link", { name: "Estadísticas" })
    .click();
  await expect(page).toHaveURL("/estadisticas");

  const missingId = "00000000-0000-4000-8000-000000000000";
  const missingRequest = page.waitForResponse((response) =>
    new URL(response.url()).pathname.endsWith(`/stats/students/${missingId}`),
  );
  await page.goto(`/estadisticas/estudiantes/${missingId}`);
  expect((await missingRequest).status()).toBe(404);
  await expect(main.getByRole("alert")).toBeVisible();
  const retryRequest = page.waitForResponse((response) =>
    new URL(response.url()).pathname.endsWith(`/stats/students/${missingId}`),
  );
  await main.getByRole("button", { name: "Reintentar" }).click();
  expect((await retryRequest).status()).toBe(404);
  await main.getByRole("link", { name: "Volver a estadísticas" }).click();
  await expect(page).toHaveURL("/estadisticas");
});

test("Ficha estadística docente muestra entregas sin conexión y partidas en móvil", async ({
  context,
  page,
}) => {
  const token = `header.${Buffer.from(JSON.stringify({ role: "teacher" })).toString("base64url")}.signature`;
  const prefixes = new Set([
    process.env.COOKIE_PREFIX ?? "englove_local_",
    "upward_english_local_",
    "upward_english_",
  ]);
  await context.addCookies(
    Array.from(prefixes, (prefix) => ({
      name: `${prefix}access_token`,
      value: token,
      domain: "localhost",
      path: "/",
    })),
  );
  await page.route("**/api/v1/auth/session", (route) =>
    route.fulfill({
      json: {
        user: {
          id: "teacher",
          email: "teacher@example.test",
          name: "Profesora",
          role: "teacher",
        },
        organizationId: "org",
      },
    }),
  );
  await page.route("**/api/v1/stats/students/student-fixture*", (route) =>
    route.fulfill({
      json: {
        student: {
          id: "student-fixture",
          name: "Estudiante de prueba",
          level: "A1",
        },
        performance: { studentAverageScore: 4.8, groupAverageScore: 4.2 },
        consistency: {
          weeklyCalendar: [
            {
              weekKey: "2026-W48",
              weekStart: "2026-11-23",
              status: "current_pending",
            },
            {
              weekKey: "2026-W47",
              weekStart: "2026-11-16",
              status: "forgiven",
            },
          ],
          offlineUndeliveredAttempts: [
            {
              attemptId: "offline",
              activityTitle: "My Morning Routine",
              startedAt: "2026-11-24T00:30:00Z",
              completeUntil: "2026-11-24T01:00:00Z",
            },
          ],
        },
        gamesPractice: {
          totalSessions: 1,
          uniqueGamesPlayed: 1,
          totalPracticeTimeSeconds: 25,
          sessions: [
            {
              attemptId: "game",
              activityId: "activity",
              activityTitle: "Match the Animals",
              mechanic: "match",
              level: "A1",
              stars: 3,
              durationSeconds: 25,
              playedAtBogota: "23/11/2026 20:00",
            },
          ],
        },
      },
    }),
  );

  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/estadisticas/estudiantes/student-fixture");
  const main = page.getByRole("main");
  await expect(
    main.getByRole("heading", { name: "Estudiante de prueba" }),
  ).toBeVisible();
  await expect(main.getByText(/En curso/)).toHaveCSS(
    "background-color",
    "rgb(255, 240, 222)",
  );
  await expect(main.getByText(/Perdón aplicado/)).toHaveCSS(
    "background-color",
    "rgb(255, 241, 194)",
  );
  const offline = main.getByRole("table", {
    name: "Entregas que no llegaron a tiempo",
  });
  await expect(
    offline.getByRole("rowheader", { name: "My Morning Routine" }),
  ).toHaveAttribute("lang", "en");
  await expect(offline.getByRole("cell", { name: /23\/11/ })).toHaveCount(2);
  const games = main.getByRole("table", { name: "Historial de partidas" });
  await expect(
    games.getByRole("row", { name: /Match the Animals.*3 de 3.*25 s/ }),
  ).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(320);
  expect(
    (await new AxeBuilder({ page }).include("#main-content").analyze())
      .violations,
  ).toEqual([]);
});
