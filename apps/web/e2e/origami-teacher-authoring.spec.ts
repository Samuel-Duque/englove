import { expect, test, type Locator, type Page } from "@playwright/test";

const groupName = "Grupo " + "conUnNombreLargo".repeat(9);
const activity = {
  id: "activity-origami",
  title: "Vocabulary " + "withALongTitle".repeat(9),
  type: "fill_blank",
  level: "A1",
  version: 1,
  status: "published",
};

test.beforeEach(async ({ page, context }) => {
  await context.addCookies(
    ["upward_english_local_access_token", "upward_english_access_token"].map(
      (name) => ({
        name,
        value: "mock-teacher-token",
        domain: "localhost",
        path: "/",
      }),
    ),
  );
  await page.route("**/api/v1/auth/refresh", (route) =>
    route.fulfill({
      json: {
        user: {
          id: "author-test",
          email: "author@example.test",
          name: "Profesora de prueba",
          role: "teacher",
        },
        organizationId: "org-origami",
      },
    }),
  );
});

test("RF-7: las asignaciones son fichas operativas legibles en modo oscuro a 320 px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.route("**/api/v1/groups?*", (route) =>
    route.fulfill({
      json: {
        items: [{ id: "group-origami", name: groupName, level: "A1" }],
        total: 1,
      },
    }),
  );
  await page.route("**/api/v1/assignments?*", (route) =>
    route.fulfill({
      json: {
        items: [
          {
            id: "assignment-origami",
            activity,
            group: { id: "group-origami", name: groupName },
            opensAt: "2026-11-01T10:00:00Z",
            dueAt: "2026-11-20T10:00:00Z",
            availability: "open",
          },
        ],
        total: 1,
      },
    }),
  );
  await page.goto("/asignaciones");
  const card = page.getByRole("article", { name: activity.title });
  await expect(card).toBeVisible({ timeout: 15_000 });
  await expect(card).toHaveCSS("background-color", "rgb(53, 39, 31)");
  await expect(card.getByText(groupName)).toHaveCSS("white-space", "normal");
  const details = card.getByRole("link", { name: "Ver detalles" });
  await expect(details).toHaveAttribute(
    "href",
    "/asignaciones/assignment-origami",
  );
  expect((await details.boundingBox())?.height).toBeGreaterThanOrEqual(48);
  expect(
    await page.locator("html").evaluate((node) => node.scrollWidth),
  ).toBeLessThanOrEqual(320);
});

test("RF-8: un error del catálogo permite volver a cargar sin mostrar un vacío falso", async ({
  page,
}) => {
  let recovered = false;
  await page.route("**/api/v1/activities?*", (route) =>
    recovered
      ? route.fulfill({
          json: { items: [activity], total: 1, limit: 100, offset: 0 },
        })
      : route.fulfill({
          status: 400,
          json: {
            statusCode: 400,
            code: "INVALID",
            message: "No pudimos cargar el catálogo",
          },
        }),
  );
  await page.goto("/actividades");
  const error = page
    .getByRole("alert")
    .filter({ hasText: "No pudimos cargar el catálogo" });
  await expect(error).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Aún no tienes actividades")).toBeHidden();
  recovered = true;
  await error.getByRole("button", { name: "Reintentar" }).click();
  await expect(
    page.getByRole("heading", { name: activity.title }),
  ).toBeVisible();
  await expect(error).toBeHidden();
});

test("RF-1 y RF-7: el editor refluye con todos los tipos de actividad y conserva la previsualización", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.goto("/actividades/nueva");
  const title = page.getByLabel("Título de la actividad");
  const type = page.getByLabel("Tipo de actividad", { exact: true });
  const preview = page.getByRole("button", {
    name: "Previsualizar",
    exact: true,
  });
  await title.fill("Actividad de prueba");
  await expect(title).toHaveCSS("background-color", "rgb(53, 39, 31)");
  expect((await title.boundingBox())?.height).toBeGreaterThanOrEqual(48);

  for (const value of [
    "fill_blank",
    "exam",
    "open_question",
    "speaking",
    "game",
  ]) {
    await type.selectOption(value);
    expect(
      await page.locator("html").evaluate((node) => node.scrollWidth),
    ).toBeLessThanOrEqual(320);
    await preview.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", {
      name: "Previsualización Docente",
    });
    await expect(
      dialog.getByRole("heading", { name: "Actividad de prueba" }),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Teens", pressed: false }).click();
    await expect(
      dialog.getByRole("button", { name: "Teens", pressed: true }),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Kids", pressed: false }).click();
    await page.keyboard.press("Escape");
    await expect(preview).toBeFocused();
  }
});

const previewCases: Array<{
  type: string;
  usePreview: (dialog: Locator) => Promise<void>;
}> = [
  {
    type: "fill_blank",
    async usePreview(dialog) {
      const blank = dialog.getByRole("combobox", {
        name: "Espacio 1",
        exact: true,
      });
      await expect(blank).toHaveValue("");
      const dog = await blank
        .getByRole("option", { name: "dog", exact: true })
        .getAttribute("value");
      expect(dog).toBeTruthy();
      await blank.selectOption({ label: "dog" });
      await expect(blank).toHaveValue(dog ?? "");
      await expect(
        dialog.getByText("(correcta)", { exact: false }),
      ).toHaveCount(0);
    },
  },
  {
    type: "exam",
    async usePreview(dialog) {
      const blank = dialog.getByRole("combobox", {
        name: "Espacio 1 del ítem 2",
        exact: true,
      });
      await expect(blank).toHaveValue("");
      const option = blank.getByRole("option", { name: "goes", exact: true });
      const answer = await option.getAttribute("value");
      expect(answer).toBeTruthy();
      await blank.selectOption({ label: "goes" });
      await expect(blank).toHaveValue(answer ?? "");
      await expect(
        dialog.getByText("(correcta)", { exact: false }),
      ).toHaveCount(0);
    },
  },
  {
    type: "open_question",
    async usePreview(dialog) {
      const answer = dialog.getByRole("textbox", {
        name: "Tu respuesta en inglés para pregunta 1",
      });
      await expect(answer).toHaveValue("");
      await answer.fill("I read a book.");
      await expect(answer).toHaveValue("I read a book.");
      await expect(dialog.getByText(/14 \/ 2000 caracteres/)).toBeVisible();
    },
  },
  {
    type: "speaking",
    async usePreview(dialog) {
      await dialog.getByRole("button", { name: "Empezar a grabar" }).click();
      await expect(dialog.getByRole("status")).toHaveText(
        "El micrófono no se activa en la previsualización.",
      );
      await expect(
        dialog.getByRole("button", { name: "Detener grabación" }),
      ).toHaveCount(0);
    },
  },
];

async function openPreview(page: Page, trigger: Locator) {
  await trigger.focus();
  await page.keyboard.press("Enter");
  return page.getByRole("dialog", { name: "Previsualización Docente" });
}

for (const { type, usePreview } of previewCases) {
  test(`RF-7: vista didáctica de ${type} responde sin crear ni subir intentos`, async ({
    page,
  }) => {
    const requests: string[] = [];
    page.on("request", (request) => {
      const path = new URL(request.url()).pathname;
      if (
        /^\/api\/v1\//.test(path) &&
        !path.startsWith("/api/v1/auth/") &&
        ["POST", "PUT", "PATCH", "DELETE"].includes(request.method())
      ) {
        requests.push(path);
      }
    });
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = async () => {
        document.documentElement.dataset.micRequested = "true";
        throw new Error(
          "La previsualización no debe pedir acceso al micrófono",
        );
      };
    });
    await page.goto("/actividades/nueva");
    const title = page.getByLabel("Título de la actividad");
    const trigger = page.getByRole("button", {
      name: "Previsualizar",
      exact: true,
    });
    await title.fill("Mi borrador");
    await page
      .getByLabel("Tipo de actividad", { exact: true })
      .selectOption(type);
    for (const theme of ["Kids", "Teens"]) {
      const dialog = await openPreview(page, trigger);
      await dialog.getByRole("button", { name: theme, exact: true }).click();
      await usePreview(dialog);
      await expect(
        dialog.getByRole("button", { name: /Entregar actividad/ }),
      ).toHaveCount(0);
      await page.keyboard.press("Escape");
      await expect(trigger).toBeFocused();
    }
    await expect(title).toHaveValue("Mi borrador");
    await expect(page.locator("html")).not.toHaveAttribute(
      "data-mic-requested",
      "true",
    );
    expect(requests).toEqual([]);
  });
}
