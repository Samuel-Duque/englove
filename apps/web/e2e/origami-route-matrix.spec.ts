import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  mockOrigamiRoutes,
  type OrigamiAudience,
} from "./origami-route-fixtures";

const studentRoutes = [
  ["/inicio", /hola/i],
  ["/juegos", /juegos/i],
  ["/actividad/origami-attempt", /Birds in the garden/i],
  ["/progreso", /progreso/i],
  ["/feedback", /feedback|retroalimentación/i],
  ["/extra", /extra|recursos/i],
  ["/perfil", /perfil/i],
] as const;

const routes = {
  public: [
    ["/", /una palabra, un pliegue/i],
    ["/login", /Upward English|iniciar sesión/i],
    ["/registro", /crea tu cuenta/i],
    ["/recuperar-contrasena", /recuperar contraseña/i],
    ["/restablecer/origami-token", /crear nueva contraseña/i],
    ["/terminos", /términos/i],
    ["/offline", /sin conexión|no hay internet/i],
    ["/terminos/origami-inexistente", /no encontrada|no encontramos/i],
  ],
  kids: studentRoutes,
  teens: studentRoutes,
  teacher: [
    ["/inicio", /panel docente|inicio/i],
    ["/actividades", /actividades/i],
    ["/actividades/nueva", /nueva actividad|crear actividad/i],
    ["/actividades/origami-activity", /editor de actividad/i],
    ["/asignaciones", /asignaciones/i],
    ["/asignaciones/nueva", /nueva asignación/i],
    [
      "/asignaciones/origami-assignment",
      /Birds in the garden|detalle de asignación/i,
    ],
    ["/revision", /revisión/i],
    ["/estadisticas", /estadísticas/i],
    ["/estadisticas/estudiantes/origami-student", /Estudiante de prueba/i],
    ["/grupos", /grupos/i],
    ["/grupos/origami-group", /Grupo de prueba/i],
    ["/alumnos", /alumnos/i],
    ["/alumnos/origami-student", /Estudiante de prueba/i],
    ["/alumnos/solicitudes", /gestión de alumnos/i],
    ["/alumnos/bloqueados", /gestión de alumnos/i],
    ["/contenido-extra", /contenido extra/i],
  ],
} satisfies Record<OrigamiAudience, ReadonlyArray<readonly [string, RegExp]>>;

const routeReference: Record<OrigamiAudience, string> = {
  public: "/",
  kids: "/juegos",
  teens: "/juegos",
  teacher: "/revision",
};

const dimensions = [
  { width: 390, height: 844 },
  { width: 800, height: 1280 },
  { width: 1280, height: 800 },
] as const;

for (const audience of ["public", "kids", "teens", "teacher"] as const) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`RF-1 y RF-9: matriz de rutas ${audience} — ${colorScheme}`, async ({
      page,
      context,
    }, testInfo) => {
      test.setTimeout(180_000);
      await mockOrigamiRoutes(context, audience);
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      const canvas =
        colorScheme === "dark" ? "rgb(36, 27, 22)" : "rgb(255, 241, 214)";
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      for (const [path, heading] of routes[audience]) {
        await test.step(path, async () => {
          await page.setViewportSize({ width: 320, height: 844 });
          const response = await page.goto(path);
          expect
            .soft(response?.status(), path)
            .toBe(path.endsWith("inexistente") ? 404 : 200);
          const main = page.getByRole("main");
          if (
            path === "/alumnos/solicitudes" ||
            path === "/alumnos/bloqueados"
          ) {
            const requests = path.endsWith("solicitudes");
            await expect
              .soft(page, path)
              .toHaveURL(
                requests ? "/alumnos?tab=requests" : "/alumnos?tab=locked",
              );
            await expect
              .soft(
                main.getByRole("button", {
                  name: requests ? "Solicitudes de registro" : "Bloqueados",
                  pressed: true,
                }),
                path,
              )
              .toBeVisible();
          } else {
            expect.soft(new URL(page.url()).pathname, path).toBe(path);
          }
          await expect.soft(main, path).toBeVisible();
          await expect
            .soft(main.getByRole("heading", { level: 1, name: heading }), path)
            .toBeVisible();
          await expect
            .soft(page.locator("body"), path)
            .toHaveCSS("background-color", canvas);
          if (audience === "kids" || audience === "teens") {
            await expect
              .soft(page.locator(".origami-student-frame"), path)
              .toHaveAttribute("data-theme", audience);
          }
          await expect
            .soft(
              page.evaluate(() => document.documentElement.scrollWidth),
              `${path} — reflujo a 320 px`,
            )
            .resolves.toBeLessThanOrEqual(320);

          if (path !== routeReference[audience]) return;

          for (const viewport of dimensions) {
            await page.setViewportSize(viewport);
            await page.screenshot({
              path: testInfo.outputPath(
                `${audience}-${colorScheme}-${viewport.width}.png`,
              ),
              animations: "disabled",
            });
          }
          const { violations } = await new AxeBuilder({ page })
            .include("main")
            .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
            .analyze();
          expect
            .soft(
              violations.map(({ id, nodes }) => ({
                id,
                targets: nodes.map(({ target }) => target),
              })),
            )
            .toEqual([]);
        });
      }
      expect(errors).toEqual([]);
    });
  }
}

test("RF-8: conserva las cuatro rutas de compatibilidad", async ({
  browser,
  baseURL,
}) => {
  for (const [audience, from, to] of [
    ["public", "/recuperar", "/recuperar-contrasena"],
    ["teacher", "/contenidos", "/actividades"],
    ["teacher", "/contenidos/onboarding", "/actividades/nueva"],
    ["kids", "/juegos/origami-activity", "/juegos"],
  ] as const) {
    const context = await browser.newContext({ baseURL });
    try {
      await mockOrigamiRoutes(context, audience);
      const page = await context.newPage();
      await page.goto(from);
      await expect(page).toHaveURL(to);
      await expect(page.getByRole("main")).toBeVisible();
    } finally {
      await context.close();
    }
  }
});
