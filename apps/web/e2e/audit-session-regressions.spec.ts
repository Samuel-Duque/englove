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
