import { signInForSmoke } from './session';
import { expect, test } from "@playwright/test";
import { StudentViewSchema } from "@upward-english/shared";


test("Ficha del alumno conecta el directorio con estadísticas y la API local", async ({
  page,
}) => {
  test.setTimeout(90_000);

  await signInForSmoke(page, 'teacher');

  await page
    .getByRole("navigation", { name: "Navegación docente" })
    .getByRole("link", { name: "Alumnos", exact: true })
    .click();
  await expect(page).toHaveURL(/\/alumnos$/);
  const main = page.getByRole("main");
  const detailLink = main.getByRole("link", { name: /^Ver ficha de / }).first();
  await expect(detailLink).toBeVisible();
  const detailHref = await detailLink.getAttribute("href");
  if (!detailHref) throw new Error("Falta la ruta de la ficha del alumno");

  const endpoint = `/api/v1/students/${detailHref.split("/").at(-1)}`;
  const [profile, memberships] = await Promise.all([
    page.waitForResponse(
      (response) => new URL(response.url()).pathname === endpoint,
    ),
    page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === `${endpoint}/memberships`,
    ),
    detailLink.click(),
  ]);
  expect(profile.status()).toBe(200);
  expect(memberships.status()).toBe(200);
  const student = StudentViewSchema.parse(await profile.json());
  await expect(
    main.getByRole("heading", { name: student.name, exact: true }),
  ).toBeVisible();
  await expect(
    main.getByRole("heading", { name: "Historial de membresías" }),
  ).toBeVisible();

  await main
    .getByRole("navigation", { name: "Ruta de la ficha" })
    .getByRole("link", { name: "Alumnos" })
    .click();
  await expect(page).toHaveURL(/\/alumnos$/);
  await main
    .getByRole("link", { name: `Ver ficha de ${student.name}`, exact: true })
    .click();

  const [stats] = await Promise.all([
    page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname ===
        `/api/v1/stats/students/${student.id}`,
    ),
    main.getByRole("link", { name: "Ver estadísticas" }).click(),
  ]);
  expect(stats.status()).toBe(200);
  await expect(page).toHaveURL(`/estadisticas/estudiantes/${student.id}`);
  await expect(
    main.getByRole("heading", { name: student.name, exact: true }),
  ).toBeVisible();
  await main.getByRole("link", { name: "Ver ficha de alumno" }).click();
  await expect(page).toHaveURL(detailHref);

  if (!student.groupId)
    throw new Error("El alumno de prueba debe tener un grupo activo");
  await page.goto(`/grupos/${student.groupId}`);
  await main
    .getByRole("link", { name: `Ver ficha de ${student.name}`, exact: true })
    .click();
  await expect(page).toHaveURL(detailHref);
  await expect(
    main.getByRole("heading", { name: student.name, exact: true }),
  ).toBeVisible();
});
