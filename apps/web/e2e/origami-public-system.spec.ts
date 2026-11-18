import { expect, test } from "@playwright/test";

const pages = [
  ["/login", "Upward English", "Entrar"],
  ["/registro", "Crea tu cuenta", "Enviar solicitud"],
  ["/recuperar-contrasena", "Recuperar contraseña", "Enviar enlace"],
  [
    "/restablecer/example-token",
    "Crear nueva contraseña",
    "Guardar contraseña",
  ],
  ["/terminos", "Términos y Condiciones de Uso", null],
  ["/offline", "¡Ups! No hay internet", "Reintentar"],
  ["/terminos/origami-inexistente", "¡Ups! Página no encontrada", null],
] as const;

test.describe("Origami: acceso y recuperación", () => {
  test.use({
    viewport: { width: 320, height: 720 },
    reducedMotion: "reduce",
    hasTouch: true,
  });

  for (const [scheme, paperColor] of [
    ["light", "rgb(255, 248, 232)"],
    ["dark", "rgb(53, 39, 31)"],
  ] as const) {
    test(`hojas y controles táctiles a 320 px en modo ${scheme}`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: scheme });

      for (const [path, heading, buttonName] of pages) {
        await test.step(path, async () => {
          const load = await page.goto(path);
          expect(load?.status()).toBe(path.endsWith("inexistente") ? 404 : 200);
          const main = page.getByRole("main");
          await expect(
            main.getByRole("heading", { name: heading, level: 1, exact: true }),
          ).toBeVisible();
          await expect(main.locator(".origami-card")).toHaveCSS(
            "background-color",
            paperColor,
          );
          const hasHorizontalOverflow = await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          );
          expect(hasHorizontalOverflow).toBe(false);

          if (buttonName) {
            const button = main.getByRole("button", { name: buttonName });
            await expect(button).toHaveCSS("transition-duration", "0s");
            const box = await button.boundingBox();
            expect(box?.width).toBeGreaterThanOrEqual(48);
            expect(box?.height).toBeGreaterThanOrEqual(48);
          }
        });
      }
    });
  }

  test("conserva la redirección y permite reintentar desde el teclado", async ({
    page,
  }) => {
    await page.goto("/recuperar");
    await expect(page).toHaveURL(/\/recuperar-contrasena$/);
    await expect(
      page.getByRole("textbox", { name: "Correo electrónico" }),
    ).toHaveAttribute("autocomplete", "email");

    await page.goto("/terminos/origami-inexistente");
    const notFound = page.getByRole("main");
    await expect(
      notFound.getByRole("link", { name: /Ir al Inicio/i }),
    ).toHaveAttribute("href", "/inicio");
    await expect(
      notFound.getByRole("link", { name: "Iniciar sesión" }),
    ).toHaveAttribute("href", "/login");

    await page.goto("/offline");
    const retry = page.getByRole("button", { name: "Reintentar" });
    await retry.focus();
    await expect(retry).toHaveCSS("outline-width", "3px");
    await Promise.all([
      page.waitForEvent("framenavigated", {
        predicate: (frame) => frame === page.mainFrame(),
      }),
      retry.press("Enter"),
    ]);
    await expect(page).toHaveURL(/\/offline$/);
  });

  test("muestra el envío pendiente y anuncia la confirmación de recuperación", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    const response = Promise.withResolvers<void>();
    const message =
      "Si el correo tiene una cuenta, recibirás un enlace para restablecer tu contraseña.";
    await page.route("**/api/v1/auth/forgot-password", async (route) => {
      await response.promise;
      await route.fulfill({ status: 200, json: { message } });
    });

    await page.goto("/recuperar-contrasena");
    await page
      .getByRole("textbox", { name: "Correo electrónico" })
      .fill("estudiante@example.test");

    try {
      await page.getByRole("button", { name: "Enviar enlace" }).click();
      const pending = page.getByRole("button", { name: "Enviando…" });
      await expect(pending).toBeDisabled();
      await expect(pending).toHaveCSS("background-color", "rgb(81, 63, 50)");
      await expect(pending).toHaveCSS("color", "rgb(216, 191, 163)");
    } finally {
      response.resolve();
    }

    const confirmation = page.getByRole("heading", {
      name: "Revisa tu correo",
    });
    await expect(confirmation).toBeFocused();
    await expect(confirmation).toHaveAccessibleDescription(message);
    await expect(
      page.getByRole("link", { name: "Volver a iniciar sesión" }),
    ).toHaveAttribute("href", "/login");
  });
});
