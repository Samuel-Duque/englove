import { expect, test, type Page } from "@playwright/test";

const ids = ["1", "2", "3", "4"].map(
  (n) =>
    `${n.repeat(8)}-${n.repeat(4)}-4${n.repeat(3)}-8${n.repeat(3)}-${n.repeat(12)}`,
);
const [first, second, third, fourth] = ids;
const cards = ids.map((id, index) => ({
  id,
  text: ["Dog", "Cat", "Perro", "Gato"][index],
}));

for (const [mechanic, settings] of [
  ["match", { left: cards.slice(0, 2), right: cards.slice(2) }],
  [
    "order_words",
    {
      tokens: [
        { id: first, text: "The" },
        { id: second, text: "bird" },
      ],
    },
  ],
  [
    "drag_drop",
    {
      objects: cards.slice(0, 2),
      targets: [
        { id: third, text: "Mascotas" },
        { id: fourth, text: "Otros" },
      ],
    },
  ],
  ["memory", { cards }],
  [
    "timed_choice",
    {
      timeLimitSeconds: 20,
      questions: [
        { id: third, prompt: "Which one barks?", options: cards.slice(0, 2) },
      ],
    },
  ],
] as const) {
  test(`RF-6/RF-8: ${mechanic} permite completar por teclado`, async ({
    page,
  }) => {
    await mockStudent(page);
    await page.setViewportSize({ width: 320, height: 844 });
    await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
    const base = "**/api/v1/attempts/origami-keyboard";
    const attempt = {
      id: "origami-keyboard",
      assignmentId: null,
      attemptNumber: 1,
      status: "in_progress",
    };
    await page.route(base, (route) =>
      route.fulfill({
        json: {
          attempt,
          activity: {
            id: "game",
            title: "A keyboard practice",
            type: "game",
            level: "A1",
            config: { type: "game", mechanic, settings },
          },
          answers: {},
          attemptToken: "synthetic",
        },
      }),
    );
    await page.route(`${base}/events`, (route) =>
      route.fulfill({ json: { acceptedEventIds: [] } }),
    );
    let payload: unknown;
    await page.route(`${base}/complete`, (route) => {
      payload = route.request().postDataJSON();
      return route.fulfill({
        json: {
          attempt: { ...attempt, status: "graded", score: 3.5, stars: 2 },
          newBadges: [],
        },
      });
    });
    await page.goto("/actividad/origami-keyboard");
    const main = page.getByRole("main");
    switch (mechanic) {
      case "match":
        await main
          .getByRole("button", { name: "Dog", exact: true })
          .press("Enter");
        await main
          .getByRole("button", { name: "Perro", exact: true })
          .press("Space");
        await expect(main.getByText("1 de 2 parejas formadas")).toBeVisible();
        await main.getByRole("button", { name: /finalizar/i }).press("Enter");
        break;
      case "order_words":
        await main
          .getByRole("button", { name: "+ The", exact: true })
          .press("Enter");
        await main
          .getByRole("button", { name: "+ bird", exact: true })
          .press("Enter");
        await main
          .getByRole("button", { name: /comprobar y finalizar/i })
          .press("Enter");
        break;
      case "drag_drop": {
        const object = main.getByRole("button", { name: /Dog/ });
        await object.press("Space");
        await expect(object).toHaveAttribute("aria-pressed", "true");
        await main
          .getByRole("button", { name: /Colocar ítem en categoría Mascotas/ })
          .press("Enter");
        await main
          .getByRole("button", { name: /Finalizar clasificación/ })
          .press("Enter");
        break;
      }
      case "memory":
        await expect(
          main.getByRole("button", { name: "Tarjeta oculta" }),
        ).toHaveCount(4);
        await main
          .getByRole("button", { name: "Tarjeta oculta" })
          .first()
          .press("Enter");
        await main
          .getByRole("button", { name: "Tarjeta oculta" })
          .first()
          .press("Enter");
        await main
          .getByRole("button", { name: /finalizar juego de memoria/i })
          .press("Enter");
        break;
      case "timed_choice":
        await main
          .getByRole("button", { name: "Dog", exact: true })
          .press("Enter");
        break;
    }
    await expect(
      main.getByRole("heading", { name: "¡Partida completada!" }),
    ).toBeVisible();
    expect(payload).toEqual({
      answers:
        mechanic === "match"
          ? { pairs: { [String(first)]: third } }
          : mechanic === "order_words"
            ? { tokenIds: [first, second] }
            : mechanic === "drag_drop"
              ? { placements: { [String(first)]: third } }
              : mechanic === "memory"
                ? {
                    selections: [
                      expect.arrayContaining([
                        expect.any(String),
                        expect.any(String),
                      ]),
                    ],
                  }
                : { choices: { [String(third)]: first } },
    });
    await expect(
      main.getByRole("img", { name: "Estrellas de práctica: 2 de 3" }),
    ).toBeVisible();
  });
}

async function mockStudent(page: Page, segment: "kids" | "teens" = "kids") {
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
      id: "origami-profile",
      email: "long-student-address-for-layout@example.test",
      name: "Estudiante de prueba",
      role: "student",
    },
    student: {
      id: "origami-profile",
      level: "A2",
      ageSegment: segment,
      canSwitchInterface: segment === "teens",
      group: null,
    },
    organizationId: "origami-school",
  };
  await page.route("**/api/v1/me", (route) => route.fulfill({ json: profile }));
  await page.route("**/api/v1/auth/session", (route) =>
    route.fulfill({ json: profile }),
  );
  await page.route("**/api/v1/auth/refresh", (route) =>
    route.fulfill({ json: profile }),
  );
  await page.route("**/api/v1/feature-flags", (route) =>
    route.fulfill({ json: { flags: {} } }),
  );
}

for (const segment of ["kids", "teens"] as const) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`RF-1/RF-6: Perfil ${segment} en ${colorScheme} separa apariencia y segmento a 320 px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 320, height: 740 });
      await page.emulateMedia({ colorScheme });
      await mockStudent(page, segment);

      const interfaceRequests: string[] = [];
      await page.route("**/api/v1/me/interface", (route) => {
        interfaceRequests.push(route.request().method());
        return route.fulfill({ status: 204 });
      });

      await page.goto("/perfil");
      const main = page.getByRole("main");
      const appearance = main.getByRole("region", { name: "Apariencia" });
      await expect(
        main.getByRole("region", { name: "Datos de la cuenta" }),
      ).toBeVisible();
      await expect(appearance.getByRole("combobox")).toHaveValue("system");
      await expect(main).toHaveCSS("color-scheme", colorScheme);
      await appearance
        .getByRole("combobox")
        .selectOption(colorScheme === "light" ? "dark" : "light");
      await expect(page.locator("html")).toHaveAttribute(
        "data-appearance",
        colorScheme === "light" ? "dark" : "light",
      );
      await expect(page.locator("[data-theme]")).toHaveAttribute(
        "data-theme",
        segment,
      );
      await expect(main.getByRole("button", { name: /Teens/ })).toHaveCount(
        segment === "teens" ? 1 : 0,
      );
      expect(interfaceRequests).toEqual([]);
      expect(
        await page.locator("html").evaluate((element) => element.scrollWidth),
      ).toBe(320);
    });
  }
}

const gameAttempt = {
  id: "origami-game-attempt",
  assignmentId: null,
  attemptNumber: 1,
  status: "in_progress",
};
const pair = {
  "11111111-1111-4111-8111-111111111111":
    "33333333-3333-4333-8333-333333333333",
  "22222222-2222-4222-8222-222222222222":
    "44444444-4444-4444-8444-444444444444",
};
const matchActivity = {
  id: "origami-match",
  title: "Match the animals",
  type: "game",
  level: "A1",
  config: {
    type: "game",
    mechanic: "match",
    settings: {
      left: [
        { id: "11111111-1111-4111-8111-111111111111", text: "Perro" },
        { id: "22222222-2222-4222-8222-222222222222", text: "Gato" },
      ],
      right: [
        { id: "33333333-3333-4333-8333-333333333333", text: "Dog" },
        { id: "44444444-4444-4444-8444-444444444444", text: "Cat" },
      ],
    },
    instructions: "Une cada animal con su traducción",
  },
};

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`RF-6/RF-8: revela estrellas solo al entregar una práctica (${reducedMotion})`, async ({
    page,
  }) => {
    await mockStudent(page);
    await page.setViewportSize({ width: 320, height: 740 });
    await page.emulateMedia({ reducedMotion, colorScheme: "dark" });
    await page.addInitScript(() => {
      document.addEventListener("animationstart", (event) => {
        if (
          event.target instanceof HTMLElement &&
          event.target.dataset.reveal === "true"
        ) {
          document.documentElement.dataset.revealDuration = getComputedStyle(
            event.target,
          ).animationDuration;
          document.documentElement.dataset.revealStart = String(
            performance.now(),
          );
        }
      });
      document.addEventListener("animationend", (event) => {
        if (
          event.target instanceof HTMLElement &&
          event.target.dataset.reveal === "true"
        ) {
          document.documentElement.dataset.revealEnd = String(
            performance.now(),
          );
        }
      });
      new MutationObserver((records) => {
        if (
          records.some(({ addedNodes }) =>
            [...addedNodes].some((node) => node instanceof HTMLCanvasElement),
          )
        ) {
          document.documentElement.dataset.celebrationStart = String(
            performance.now(),
          );
        }
      }).observe(document, { childList: true, subtree: true });
    });

    const savedResult = {
      ...gameAttempt,
      status: "graded",
      score: 3.5,
      stars: 2,
    };
    let submissionCount = 0;
    await page.route("**/api/v1/attempts/origami-game-attempt", (route) =>
      route.fulfill({
        json: {
          attempt: submissionCount ? savedResult : gameAttempt,
          activity: matchActivity,
          answers: { pairs: pair },
          attemptToken: "origami-test-attempt-token",
        },
      }),
    );
    await page.route(
      "**/api/v1/attempts/origami-game-attempt/events",
      (route) => route.fulfill({ json: { acceptedEventIds: [] } }),
    );
    await page.route(
      "**/api/v1/attempts/origami-game-attempt/complete",
      (route) => {
        submissionCount += 1;
        return route.fulfill({ json: { attempt: savedResult, newBadges: [] } });
      },
    );
    await page.goto("/actividad/origami-game-attempt");
    const main = page.getByRole("main");
    await expect(main.getByText("2 de 2 parejas formadas")).toBeVisible();
    expect(
      await page.locator("html").evaluate((element) => element.scrollWidth),
    ).toBe(320);
    await expect(page.getByRole("contentinfo")).toHaveCount(0);
    await main.getByRole("button", { name: "Finalizar", exact: false }).click();
    await expect(
      main.getByRole("heading", { name: "¡Partida completada!" }),
    ).toBeFocused();
    await expect(
      main.getByRole("img", { name: "Estrellas de práctica: 2 de 3" }),
    ).toBeVisible();
    await expect(
      main.getByRole("button", { name: "Jugar de nuevo" }),
    ).toBeVisible();
    await expect(main.getByText("Nota:", { exact: false })).toHaveCount(0);

    const root = page.locator("html");
    if (reducedMotion === "no-preference") {
      await expect(root).toHaveAttribute("data-reveal-duration", "0.24s");
      await expect(root).toHaveAttribute("data-celebration-start", /\d+/);
      const timeline = await root.evaluate((element) => {
        const { revealStart, revealEnd, celebrationStart } = element.dataset;
        return {
          start: Number(revealStart),
          end: Number(revealEnd),
          celebration: Number(celebrationStart),
        };
      });
      expect(timeline.end).toBeGreaterThan(timeline.start);
      expect(timeline.celebration).toBeGreaterThanOrEqual(timeline.end);
    } else {
      await expect(root).not.toHaveAttribute("data-reveal-start", /\d+/);
      await expect(root).not.toHaveAttribute("data-celebration-start", /\d+/);
    }

    await page.reload();
    await expect(
      main.getByRole("img", { name: "Estrellas de práctica: 2 de 3" }),
    ).toBeVisible();
    await expect(root).not.toHaveAttribute("data-reveal-start", /\d+/);
    await expect(root).not.toHaveAttribute("data-celebration-start", /\d+/);
    expect(submissionCount).toBe(1);
  });
}

for (const disconnected of [false, true]) {
  test(`RF-6/RF-8: conserva el examen y ${disconnected ? "distingue un envío en cola de una entrega" : "muestra la nota confirmada sin estrellas"}`, async ({
    page,
  }) => {
    await mockStudent(page, "teens");
    await page.setViewportSize({ width: 320, height: 740 });
    await page.emulateMedia({ colorScheme: "light" });
    const itemId = "11111111-1111-4111-8111-111111111111";
    const blankId = "22222222-2222-4222-8222-222222222222";
    const studyId = "33333333-3333-4333-8333-333333333333";
    await page.route("**/api/v1/attempts/origami-exam", (route) =>
      route.fulfill({
        json: {
          attempt: {
            id: "origami-exam",
            assignmentId: "origami-exam-assignment",
            attemptNumber: 1,
            status: "in_progress",
          },
          activity: {
            id: "origami-exam-activity",
            type: "exam",
            level: "A2",
            title: "English exam",
            config: {
              items: [
                {
                  id: itemId,
                  weight: 100,
                  prompt: `We {{${blankId}}} at school.`,
                  blanks: [
                    {
                      id: blankId,
                      options: [
                        { id: studyId, text: "study" },
                        {
                          id: "44444444-4444-4444-8444-444444444444",
                          text: "studies",
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          },
          attemptToken: "origami-test-attempt-token",
        },
      }),
    );
    await page.route("**/api/v1/attempts/origami-exam/events", (route) =>
      route.fulfill({ json: { acceptedEventIds: [] } }),
    );
    await page.route("**/api/v1/attempts/origami-exam/complete", (route) => {
      expect(route.request().postDataJSON()).toMatchObject({
        answers: { [itemId]: { [blankId]: studyId } },
      });
      if (disconnected) return route.abort("internetdisconnected");
      return route.fulfill({
        json: {
          attempt: {
            id: "origami-exam",
            assignmentId: "origami-exam-assignment",
            attemptNumber: 1,
            status: "graded",
            score: 4.7,
            stars: 3,
          },
          newBadges: [],
        },
      });
    });

    await page.goto("/actividad/origami-exam");
    const main = page.getByRole("main");
    await expect(
      main.getByRole("heading", { name: "English exam" }),
    ).toBeVisible();
    await main
      .getByRole("combobox", { name: "Espacio 1 del ítem 1" })
      .selectOption({ label: "study" });
    await main.getByRole("button", { name: /Entregar actividad/ }).click();
    if (disconnected) {
      await expect(
        main.getByRole("heading", { name: "Entrega pendiente de envío" }),
      ).toBeFocused();
      await expect(
        main.getByText(/Todavía no se ha confirmado la entrega/),
      ).toBeVisible();
      await expect(main.getByText(/Nota:/)).toHaveCount(0);
    } else {
      await expect(
        main.getByRole("heading", { name: "¡Misión completada!" }),
      ).toBeFocused();
      await expect(main.getByText("Nota: 4,7 / 5,0")).toBeVisible();
    }
    await expect(
      main.getByRole("img", { name: /Estrellas de práctica/ }),
    ).toHaveCount(0);
    await expect(page.getByRole("contentinfo")).toHaveCount(0);
  });
}

test("RF-6: Inicio filtra las misiones reales y Progreso separa práctica de notas", async ({
  page,
}) => {
  await mockStudent(page, "teens");
  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.route("**/api/v1/feature-flags", (route) =>
    route.fulfill({ json: { flags: { games: true } } }),
  );

  const completed = {
    id: "mission-attempt",
    attemptNumber: 1,
    status: "graded",
    score: 4.7,
    stars: 3,
  };
  await page.route("**/api/v1/me/assignments", (route) =>
    route.fulfill({
      json: {
        items: [
          {
            id: "mission-next",
            activity: {
              id: "activity-next",
              title: "Pending mission",
              level: "A2",
              type: "fill_blank",
            },
            canStart: true,
          },
          {
            id: "mission-done",
            activity: {
              id: "activity-done",
              title: "Completed mission",
              level: "A2",
              type: "fill_blank",
            },
            canStart: false,
            latestAttempt: completed,
          },
        ],
      },
    }),
  );
  await page.route("**/api/v1/me/progress", (route) =>
    route.fulfill({
      json: {
        streak: { weeks: 2, forgivenessAvailable: true },
        activities: [
          {
            attemptId: completed.id,
            attemptNumber: 1,
            score: completed.score,
            stars: completed.stars,
            activityTitle: "Completed mission",
          },
        ],
      },
    }),
  );

  await page.goto("/inicio");
  const main = page.getByRole("main");
  await expect(main.getByText("Siguiente actividad")).toBeVisible();
  const pending = main.getByRole("button", { name: "Por hacer (1)" });
  await pending.focus();
  await pending.press("Enter");
  await expect(pending).toHaveAttribute("aria-pressed", "true");
  await expect(
    main.getByRole("heading", { name: "Pending mission" }),
  ).toBeVisible();
  await expect(
    main.getByRole("heading", { name: "Completed mission" }),
  ).toHaveCount(0);
  await main.getByRole("button", { name: "Entregadas (1)" }).click();
  await expect(main.getByText("Nota: 4,7 / 5,0")).toBeVisible();
  expect(
    await page.locator("html").evaluate((element) => element.scrollWidth),
  ).toBe(320);

  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Progreso" })
    .click();
  const history = main.getByRole("region", {
    name: "Historial de Actividades Entregadas",
  });
  const practice = main.getByRole("region", { name: "Práctica en juegos" });
  await expect(history.getByText("Nota: 4,7 / 5,0")).toBeVisible();
  await expect(history.getByText(/[★☆]/)).toHaveCount(0);
  await expect(
    practice.getByRole("link", { name: "Ver mis juegos" }),
  ).toHaveAttribute("href", "/juegos");
});
