import { expect, test } from "@playwright/test";

for (const failure of ["network", "500"] as const) {
  test(`SEG-01: ${failure} logout keeps retained HttpOnly cookies from reopening the old account`, async ({
    page,
    context,
  }) => {
    const session = {
      user: {
        id: "audit-teacher",
        email: "audit@example.invalid",
        name: "Docente de prueba",
        role: "teacher",
      },
      organizationId: "audit-org",
    };
    let restored = false;
    let refreshRequests = 0;
    await context.addCookies([
      {
        name: "englove_access_token",
        value: "synthetic-access",
        domain: "localhost",
        path: "/",
        httpOnly: true,
      },
      {
        name: "englove_local_access_token",
        value: "synthetic-access",
        domain: "localhost",
        path: "/",
        httpOnly: true,
      },
      {
        name: "englove_refresh_token",
        value: "synthetic-refresh",
        domain: "localhost",
        path: "/api/v1/auth",
        httpOnly: true,
      },
      {
        name: "englove_session_hint",
        value: "1",
        domain: "localhost",
        path: "/",
      },
    ]);
    await page.route("**/api/v1/auth/session", (route) =>
      route.fulfill({ status: 200, json: session }),
    );
    await page.route("**/api/v1/auth/refresh", (route) => {
      refreshRequests++;
      return route.fulfill({ status: 200, json: session });
    });
    await page.route("**/api/v1/dashboard/reminders", (route) =>
      route.fulfill({
        status: 200,
        json: {
          pendingRegistrations: 0,
          overdueReviews: 0,
          ungradedReminderDays: 3,
        },
      }),
    );
    await page.route("**/api/v1/auth/logout", async (route) => {
      if (restored) {
        await context.clearCookies();
        await route.fulfill({ status: 204 });
      } else if (failure === "network") await route.abort();
      else
        await route.fulfill({ status: 500, json: { code: "INTERNAL_ERROR" } });
    });
    await page.goto("/inicio");
    await expect(
      page.getByRole("button", { name: "Cerrar sesión", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Cerrar sesión", exact: true })
      .click();
    await expect(page).toHaveURL(/\/login/);
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "No se pudo confirmar el cierre" }),
    ).toContainText("No se pudo confirmar el cierre");
    expect(
      (await context.cookies()).some(
        (cookie) => cookie.name === "englove_access_token" && cookie.httpOnly,
      ),
    ).toBe(true);
    expect(refreshRequests).toBe(0);
    await page.goto("/inicio");
    await expect(page).toHaveURL(/\/login/);
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "No se pudo confirmar el cierre" }),
    ).toContainText("No se pudo confirmar el cierre");
    restored = true;
    await page.reload();
    await expect
      .poll(async () =>
        (await context.cookies()).some(
          (cookie) => cookie.name === "englove_logout_pending",
        ),
      )
      .toBe(false);
    await expect(page).toHaveURL(/\/login/);
  });
}

function makeUnsignedJwtCookie(role: "teacher" | "student"): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({ role, exp: Math.floor(Date.now() / 1000) + 3600 }),
  ).toString("base64url");
  return `${header}.${payload}.sig`;
}

test("RT-04: multi-tab logout clears second tab immediately and removes private identity", async ({
  context,
}) => {
  const teacherSession = {
    user: {
      id: "audit-teacher-1",
      email: "teacher@example.invalid",
      name: "AUDIT_PRIVATE_TEACHER_IDENTITY",
      role: "teacher",
    },
    organizationId: "audit-org",
  };
  let authorized = true;
  const pageErrors: string[] = [];

  await context.addCookies([
    {
      name: "englove_access_token",
      value: makeUnsignedJwtCookie("teacher"),
      domain: "localhost",
      path: "/",
      httpOnly: true,
    },
    {
      name: "englove_local_access_token",
      value: makeUnsignedJwtCookie("teacher"),
      domain: "localhost",
      path: "/",
      httpOnly: true,
    },
    {
      name: "englove_session_hint",
      value: "1",
      domain: "localhost",
      path: "/",
    },
  ]);

  await context.route("**/api/v1/auth/session", (route) =>
    authorized
      ? route.fulfill({ status: 200, json: teacherSession })
      : route.fulfill({ status: 401, json: { code: "AUTH_UNAUTHORIZED" } }),
  );
  await context.route("**/api/v1/auth/refresh", (route) =>
    authorized
      ? route.fulfill({ status: 200, json: teacherSession })
      : route.fulfill({ status: 401, json: { code: "AUTH_UNAUTHORIZED" } }),
  );
  await context.route("**/api/v1/dashboard/reminders", (route) =>
    authorized
      ? route.fulfill({
          status: 200,
          json: {
            pendingRegistrations: 0,
            overdueReviews: 0,
            ungradedReminderDays: 3,
          },
        })
      : route.fulfill({ status: 401, json: { code: "AUTH_UNAUTHORIZED" } }),
  );
  await context.route("**/api/v1/auth/logout", async (route) => {
    authorized = false;
    await context.clearCookies();
    await route.fulfill({ status: 204 });
  });

  const page1 = await context.newPage();
  const page2 = await context.newPage();
  page1.on("pageerror", (err) => pageErrors.push(err.message));
  page2.on("pageerror", (err) => pageErrors.push(err.message));

  await page1.goto("/inicio");
  await page2.goto("/inicio");

  await expect(page1.getByText("AUDIT_PRIVATE_TEACHER_IDENTITY").first()).toBeVisible();
  await expect(page2.getByText("AUDIT_PRIVATE_TEACHER_IDENTITY").first()).toBeVisible();

  await page1.getByRole("button", { name: "Cerrar sesión", exact: true }).click();
  await expect(page1).toHaveURL(/\/login/);

  await page2.bringToFront();
  await expect(page2).toHaveURL(/\/login/);
  await expect(page2.getByText("AUDIT_PRIVATE_TEACHER_IDENTITY")).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test("RT-04: multi-tab account switch clears stale teacher identity in background tab", async ({
  context,
}) => {
  const teacherSession = {
    user: {
      id: "audit-teacher-1",
      email: "teacher@example.invalid",
      name: "AUDIT_PRIVATE_TEACHER_IDENTITY",
      role: "teacher",
    },
    organizationId: "audit-org",
  };
  const studentSession = {
    user: {
      id: "audit-student-2",
      email: "student@example.invalid",
      name: "Alumno Nuevo",
      role: "student",
    },
    organizationId: "audit-org",
    student: {
      id: "std-2",
      ageSegment: "kids",
      canSwitchInterface: false,
      level: "A1",
    },
  };
  let activeSession: typeof teacherSession | typeof studentSession | null =
    teacherSession;

  await context.addCookies([
    {
      name: "englove_access_token",
      value: makeUnsignedJwtCookie("teacher"),
      domain: "localhost",
      path: "/",
      httpOnly: true,
    },
    {
      name: "englove_local_access_token",
      value: makeUnsignedJwtCookie("teacher"),
      domain: "localhost",
      path: "/",
      httpOnly: true,
    },
    {
      name: "englove_session_hint",
      value: "1",
      domain: "localhost",
      path: "/",
    },
    {
      name: "englove_local_session_hint",
      value: "1",
      domain: "localhost",
      path: "/",
    },
  ]);

  await context.route("**/api/v1/auth/session", (route) =>
    activeSession
      ? route.fulfill({ status: 200, json: activeSession })
      : route.fulfill({ status: 401, json: { code: "AUTH_UNAUTHORIZED" } }),
  );
  await context.route("**/api/v1/auth/refresh", (route) =>
    activeSession
      ? route.fulfill({ status: 200, json: activeSession })
      : route.fulfill({ status: 401, json: { code: "AUTH_UNAUTHORIZED" } }),
  );
  await context.route("**/api/v1/dashboard/reminders", (route) =>
    route.fulfill({
      status: 200,
      json: {
        pendingRegistrations: 0,
        overdueReviews: 0,
        ungradedReminderDays: 3,
      },
    }),
  );
  await context.route("**/api/v1/me", (route) =>
    route.fulfill({ status: 200, json: studentSession }),
  );
  await context.route("**/api/v1/me/assignments", (route) =>
    route.fulfill({ status: 200, json: { items: [] } }),
  );
  await context.route("**/api/v1/feature-flags", (route) =>
    route.fulfill({
      status: 200,
      json: { flags: { games: false, extra_content: false } },
    }),
  );

  const page1 = await context.newPage();
  const page2 = await context.newPage();

  await page1.goto("/inicio");
  await page2.goto("/inicio");
  await expect(page2.getByText("AUDIT_PRIVATE_TEACHER_IDENTITY").first()).toBeVisible();

  // Simulate another tab logging in as a different user (Student B) without touching page2
  await context.route("**/api/v1/auth/login", async (route) => {
    activeSession = studentSession;
    await context.addCookies([
      {
        name: "englove_access_token",
        value: makeUnsignedJwtCookie("student"),
        domain: "localhost",
        path: "/",
        httpOnly: true,
      },
      {
        name: "englove_local_access_token",
        value: makeUnsignedJwtCookie("student"),
        domain: "localhost",
        path: "/",
        httpOnly: true,
      },
      {
        name: "englove_session_hint",
        value: "1",
        domain: "localhost",
        path: "/",
      },
      {
        name: "englove_local_session_hint",
        value: "1",
        domain: "localhost",
        path: "/",
      },
    ]);
    await route.fulfill({ status: 200, json: studentSession });
  });

  await context.clearCookies();
  await page1.goto("/login");
  await page1.getByLabel("Correo electrónico").fill("student@example.invalid");
  await page1.getByLabel("Contraseña").fill("Secret123!");
  await page1.getByRole("button", { name: "Entrar" }).click();
  await expect(page1).toHaveURL(/\/inicio/);
  await expect(page1.getByText("Alumno Nuevo").first()).toBeVisible();

  await page2.bringToFront();
  await page2.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page2.getByText("AUDIT_PRIVATE_TEACHER_IDENTITY")).toHaveCount(0);
});
