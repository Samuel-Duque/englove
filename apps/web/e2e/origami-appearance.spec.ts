import { expect, test } from "@playwright/test";

test("RF-1: Nunito variable se carga desde el mismo origen", async ({
  page,
}) => {
  const fonts: URL[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "font") fonts.push(new URL(request.url()));
  });
  await page.goto("/login");
  await expect(page.getByRole("banner")).toBeVisible();
  const loadedWeights = await page.evaluate(async () => {
    const sample = "¿Mañana o después? ¡Inglés!";
    const light = await document.fonts.load("400 16px Nunito", sample);
    const heavy = await document.fonts.load("900 16px Nunito", sample);
    return [light.length, heavy.length];
  });
  expect(loadedWeights).toEqual([1, 1]);
  expect(fonts.map(({ origin, pathname }) => [origin, pathname])).toEqual([
    [new URL(page.url()).origin, "/origami/nunito-variable.ttf"],
  ]);
});

test("RF-2: el selector público conserva la elección al recargar", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/login");
  const appearance = page.getByLabel("Apariencia");
  await expect(appearance).toHaveValue("system");
  await appearance.selectOption("dark");
  await expect(page.getByRole("banner")).toHaveCSS(
    "background-color",
    "rgb(53, 39, 31)",
  );
  await page.reload();
  await expect(appearance).toHaveValue("dark");
  await expect(page.getByRole("banner")).toHaveCSS(
    "background-color",
    "rgb(53, 39, 31)",
  );
});

test("RF-2: elegir apariencia funciona aunque el almacenamiento esté bloqueado", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "sessionStorage", {
      get() {
        throw new DOMException("Almacenamiento bloqueado", "SecurityError");
      },
    });
  });
  await page.goto("/login");
  await page.getByLabel("Apariencia").selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-appearance", "dark");
});

test("RF-2: la elección explícita se aplica antes de hidratar", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.route("**/_next/**/*.js*", (route) => route.abort());
  await page.addInitScript(() => {
    sessionStorage.setItem("upward_english_appearance", "light");
  });

  const response = await page.goto("/terminos");
  expect(response?.headers()["content-security-policy"]).toMatch(
    /script-src 'self'/,
  );
  const head = (await response?.text())?.split("</head>", 1)[0] ?? "";
  expect(
    /<head\b[^>]*>[\s\S]*<script src="\/origami-appearance\.js"><\/script>/.test(
      head,
    ),
  ).toBe(true);
  await expect(page.locator("html")).toHaveAttribute(
    "data-appearance",
    "light",
  );
});

test("RF-3: no restaura la apariencia de una sesión anterior antes de hidratar", async ({
  page,
}) => {
  await page.route("**/_next/**/*.js*", (route) => route.abort());
  await page.addInitScript(() => {
    sessionStorage.setItem("upward_english_appearance", "dark");
    sessionStorage.setItem("upward_english_appearance_epoch", "1");
    localStorage.setItem(
      "upward_english_session_epoch",
      JSON.stringify({ gen: 2, state: "active", uid: "synthetic-account" }),
    );
  });

  await page.goto("/terminos");
  await expect(page.locator("html[data-appearance]")).toHaveCount(0);
  const stored = await page.evaluate(() =>
    sessionStorage.getItem("upward_english_appearance"),
  );
  expect(stored).toBeNull();
});
