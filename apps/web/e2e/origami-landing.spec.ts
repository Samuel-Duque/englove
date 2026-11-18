import { expect, test } from "@playwright/test";

const heroHeading =
  "Una palabra, un pliegue, una nueva forma de aprender inglés.";

test("RF-4: la portada explica la práctica sin solicitar ni guardar respuestas", async ({
  page,
}) => {
  const attempts: string[] = [];
  await page.route(/\/attempts?(?:\/|\?|$)/i, (route) => {
    attempts.push(route.request().method());
    return route.abort();
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("heading", { name: heroHeading })).toBeVisible();
  const navigation = page.getByRole("navigation", {
    name: "Explorar la portada",
  });
  await navigation.getByRole("link", { name: "Cómo se aprende" }).click();
  await expect(page).toHaveURL(/#como-se-aprende$/);
  await expect(page.getByRole("heading", { level: 3 })).toHaveText([
    "Escucha una palabra",
    "Practica con una actividad",
    "Revisa lo aprendido",
    "Kids",
    "Teens",
    "Revisión de la profesora",
  ]);
  await navigation.getByRole("link", { name: "Por dentro" }).click();
  await expect(page).toHaveURL(/#por-dentro$/);
  const examples = page.getByRole("region", { name: "Por dentro" });
  await expect(
    examples.getByText("Ejemplo de actividad", { exact: true }),
  ).toBeVisible();
  await expect(examples.getByText("Une la palabra con su imagen.")).toHaveCount(
    2,
  );
  await expect(examples.getByRole("button")).toHaveCount(0);
  await expect(examples.locator("audio, video, form, input")).toHaveCount(0);
  expect(attempts).toEqual([]);
});

test("RF-4: acceso, registro y términos conservan sus destinos", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("banner")
    .getByRole("link", { name: "Iniciar sesión" })
    .click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  await page.goto("/");
  const hero = page.getByRole("region", { name: heroHeading });
  await expect(
    hero.getByRole("link", { name: "Entrar a mi portal" }),
  ).toHaveAttribute("href", "/login");
  await hero.getByRole("link", { name: "Crear cuenta de estudiante" }).click();
  await expect(page).toHaveURL(/\/registro$/);
  await expect(
    page.getByRole("heading", { name: "Crea tu cuenta" }),
  ).toBeVisible();

  await page.goto("/");
  await page
    .getByRole("contentinfo")
    .getByRole("link", { name: "Términos de uso" })
    .click();
  await expect(page).toHaveURL(/\/terminos$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test.describe("RF-4: portada móvil", () => {
  test.use({ viewport: { width: 320, height: 740 }, reducedMotion: "reduce" });

  test("permite navegar por teclado sin ocultar acceso ni apariencia", async ({
    page,
  }) => {
    await page.goto("/");
    const header = page.getByRole("banner");
    const menu = header
      .locator("summary")
      .filter({ hasText: "Menú de la portada" });
    const appearance = header.getByRole("combobox", { name: "Apariencia" });
    const login = header.getByRole("link", { name: "Iniciar sesión" });
    const inside = header.getByRole("link", { name: "Por dentro" });

    await menu.focus();
    await expect(menu).toBeFocused();
    await expect(menu).toHaveCSS("outline-width", "3px");
    await page.keyboard.press("Enter");
    await expect(inside).toBeVisible();
    await expect(login).toBeInViewport();
    await expect(appearance).toBeInViewport();
    await inside.focus();
    await page.keyboard.press("Escape");
    await expect(inside).toBeHidden();
    await expect(menu).toBeFocused();

    await page.keyboard.press("Space");
    await inside.click();
    await expect(page).toHaveURL(/#por-dentro$/);
    await expect(inside).toBeHidden();
    const section = page.getByRole("region", { name: "Por dentro" });
    await expect(section).toBeFocused();

    await appearance.selectOption("dark");
    await expect(page.locator("html")).toHaveAttribute(
      "data-appearance",
      "dark",
    );
    await expect(page.getByRole("main")).toHaveCSS(
      "background-color",
      "rgb(36, 27, 22)",
    );
    await expect(
      page.getByRole("heading", { name: heroHeading }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(320);
  });
});

test.describe("RF-4: portada sin animación, fuentes ni JavaScript", () => {
  test.use({
    javaScriptEnabled: false,
    viewport: { width: 800, height: 1280 },
    reducedMotion: "reduce",
  });

  test("mantiene visibles el titular, el ejemplo y los accesos", async ({
    page,
  }) => {
    await page.route("**/*.woff2", (route) => route.abort());
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: heroHeading }),
    ).toBeVisible();
    const hero = page.getByRole("region", { name: heroHeading });
    await expect(
      hero.getByRole("link", { name: "Entrar a mi portal" }),
    ).toBeVisible();
    await expect(
      hero.getByRole("link", { name: "Crear cuenta de estudiante" }),
    ).toBeVisible();
    await expect(
      page.getByText("Ejemplo ilustrado: de la palabra a la figura."),
    ).toBeVisible();
  });
});
