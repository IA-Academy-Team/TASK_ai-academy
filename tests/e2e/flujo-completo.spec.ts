import { expect, test } from "@playwright/test";

const ADMIN_EMAIL = "admin@aiacademy.local";
const ADMIN_PASSWORD = "dev-admin-password-1234";

test("flujo completo: login, crear tarea, filtrar, cambiar estado, crear usuario", async ({
  page,
}) => {
  const taskTitle = `Tarea E2E ${Date.now()}`;
  const userEmail = `usuarioe2e-${Date.now()}@test.local`;

  // 1. login
  await page.goto("/login");
  await page.fill("#email", ADMIN_EMAIL);
  await page.fill("#password", ADMIN_PASSWORD);
  await page.click("button[type=submit]");
  await page.waitForURL("**/tareas");

  // 2. crear tarea
  await page.fill("#title", taskTitle);
  await page.click('button:has-text("Crear tarea")');
  await page.waitForURL("**/tareas");
  await expect(page.locator("table")).toContainText(taskTitle);

  const row = page.locator("tr", { hasText: taskTitle });
  await expect(row.locator(".badge")).toHaveText("pendiente");

  // 3. filtrar por pendiente
  await page.click('a:has-text("Pendiente")');
  await expect(page.locator("table")).toContainText(taskTitle);

  // 4. cambiar estado a completada
  await row.locator("select").selectOption("completada");
  await page.waitForURL("**/tareas");
  const rowAfter = page.locator("tr", { hasText: taskTitle });
  await expect(rowAfter.locator(".badge")).toHaveText("completada");

  // 5. admin crea usuario
  await page.goto("/admin/usuarios");
  await page.fill('input[name="name"]', "Usuario E2E");
  await page.fill('input[name="email"]', userEmail);
  await page.fill('input[name="password"]', "supersecret123");
  await page.click('button:has-text("Crear usuario")');
  await page.waitForURL("**/admin/usuarios");

  const userRow = page.locator("tr", { hasText: userEmail });
  await expect(userRow.locator(".badge").first()).toHaveText("usuario");
});
