import { expect, test } from "@playwright/test";
import { StudentViewSchema } from "@upward-english/shared";

const email = process.env.ENGLOVE_SMOKE_EMAIL;
const password = process.env.ENGLOVE_SMOKE_PASSWORD;

test("Ficha del alumno conecta el directorio con estadísticas y la API local", async ({
  page,
}) => {
  test.skip(
    !email || !password,
    "Requiere una cuenta docente sembrada en el entorno local.",
  );
  if (!email || !password) return;
  test.setTimeout(90_000);

  await page.goto("/login");
  await page.getByRole("textbox", { name: "Correo electrónico" }).fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/inicio$/);

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
