import { expect, test } from "@playwright/test";

for (const width of [320, 390, 768, 1023, 1024, 1280]) {
  test(`UX-01/02: navegación docente visible sin desbordamiento a ${width}px`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const token = `header.${Buffer.from(JSON.stringify({ role: "teacher" })).toString("base64url")}.signature`;
    await context.addCookies([
      {
        name: "upward_english_access_token",
        value: token,
        domain: "localhost",
        path: "/",
      },
      {
        name: "upward_english_local_access_token",
        value: token,
        domain: "localhost",
        path: "/",
      },
    ]);
    await page.route("**/api/v1/auth/session", (route) =>
      route.fulfill({
        status: 200,
        json: {
          user: {
            id: "teacher-audit",
            name: "Profesora",
            email: "audit@example.test",
            role: "teacher",
          },
          organizationId: "org-audit",
        },
      }),
    );
    await page.route("**/api/v1/dashboard/reminders", (route) =>
      route.fulfill({
        status: 200,
        json: {
          pendingApprovals: 0,
          overdueReviews: 0,
          studentsWithoutActivity: [],
        },
      }),
    );
    await page.goto("/inicio");
    const logout = page.getByRole("button", {
      name: "Cerrar sesión",
      exact: true,
    });
    await expect(logout).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(width);
    const menu = page.getByRole("button", { name: "Abrir menú principal" });
    if (width === 390) {
      await page.getByLabel("Apariencia").selectOption("dark");
      await expect(page.locator("html")).toHaveAttribute(
        "data-appearance",
        "dark",
      );
    }
    if (width < 1024) {
      await expect(
        page.getByRole("navigation", { name: "Navegación principal" }),
      ).toHaveCount(0);
      await menu.click();
      await expect(
        page.getByRole("dialog", { name: "Menú principal" }),
      ).toBeVisible();
    } else {
      await expect(menu).toBeHidden();
    }
    const nav = page.getByRole("navigation", {
      name: "Navegación principal",
      exact: true,
    });
    await expect(nav).toHaveCount(1);
    await expect(
      nav.getByRole("link", { name: "Inicio", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    for (const label of [
      "Inicio",
      "Actividades",
      "Asignaciones",
      "Revisión",
      "Estadísticas",
      "Grupos",
      "Alumnos",
      "Contenido extra",
    ]) {
      const link = nav.getByRole("link", { name: label, exact: true });
      await expect(link).toBeVisible();
      const bounds = await link.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds?.x).toBeGreaterThanOrEqual(0);
      expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(
        width,
      );
      expect(bounds?.height).toBeGreaterThanOrEqual(48);
      expect(bounds?.width).toBeGreaterThanOrEqual(48);
    }
    if (width < 1024) {
      await page.keyboard.press("Escape");
      await expect(
        page.getByRole("dialog", { name: "Menú principal" }),
      ).toBeHidden();
      await expect(menu).toBeFocused();
    }
    const bounds = await logout.boundingBox();
    expect(bounds?.height).toBeGreaterThanOrEqual(48);
    expect(bounds?.width).toBeGreaterThanOrEqual(48);
    await logout.focus();
    await expect(logout).toBeFocused();
  });
}

for (const { segment, width, flags, position } of [
  { segment: "kids", width: 320, flags: true, position: "fixed" },
  { segment: "kids", width: 1280, flags: false, position: "fixed" },
  { segment: "teens", width: 1023, flags: true, position: "fixed" },
  { segment: "teens", width: 1024, flags: true, position: "static" },
]) {
  test(`RF-5: navegación ${segment} a ${width}px respeta apariencia y permisos`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await context.addCookies([
      {
        name: "upward_english_access_token",
        value: "student-test-cookie",
        domain: "localhost",
        path: "/",
      },
      {
        name: "upward_english_local_access_token",
        value: "student-test-cookie",
        domain: "localhost",
        path: "/",
      },
    ]);
    const session = {
      user: {
        id: "student-test",
        name: "Estudiante de prueba",
        email: "student@example.invalid",
        role: "student",
      },
      student: {
        id: "student-test",
        ageSegment: segment,
        level: "A1",
        canSwitchInterface: true,
      },
      organizationId: "org-test",
    };
    await page.route("**/api/v1/auth/session", (route) =>
      route.fulfill({ json: session }),
    );
    await page.route("**/api/v1/me", (route) =>
      route.fulfill({ json: session }),
    );
    await page.route("**/api/v1/me/assignments", (route) =>
      route.fulfill({ json: { items: [] } }),
    );
    await page.route("**/api/v1/feature-flags", (route) =>
      route.fulfill({
        json: { flags: { games: flags, extra_content: flags } },
      }),
    );

    await page.goto("/inicio");
    const nav = page.getByRole("navigation", {
      name: "Navegación del estudiante",
    });
    await expect(nav).toHaveCount(1);
    await expect(nav).toHaveCSS("position", position);
    await expect(nav.getByRole("link", { name: "Inicio" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(nav.getByRole("link", { name: "Juegos" })).toHaveCount(
      flags ? 1 : 0,
    );
    await expect(
      nav.getByRole("link", { name: "Contenido extra" }),
    ).toHaveCount(flags ? 1 : 0);
    const appearance = page.getByLabel("Apariencia");
    await appearance.selectOption("dark");
    await expect(page.locator("html")).toHaveAttribute(
      "data-appearance",
      "dark",
    );
    await expect(page.locator(`[data-theme="${segment}"]`)).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(width);
    for (const link of await nav.getByRole("link").all()) {
      const box = await link.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(48);
      expect(box?.height).toBeGreaterThanOrEqual(48);
    }
  });
}
