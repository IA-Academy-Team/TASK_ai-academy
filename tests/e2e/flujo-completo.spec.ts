import { expect, test } from "@playwright/test";

const ADMIN_EMAIL = "admin@aiacademy.local";
const ADMIN_PASSWORD = "dev-admin-password-1234";

test("flujo completo: login, crear proyecto, crear tarea, workflow de estado, crear usuario", async ({
  page,
}) => {
  const stamp = Date.now();
  const projectName = `Proyecto E2E ${stamp}`;
  const taskTitle = `Tarea E2E ${stamp}`;
  const userEmail = `usuarioe2e-${stamp}@test.local`;

  // 1. login
  await page.goto("/login");
  await page.fill("#email", ADMIN_EMAIL);
  await page.fill("#password", ADMIN_PASSWORD);
  await page.click("button[type=submit]");
  await page.waitForURL("**/proyectos");

  // 2. crear proyecto
  await page.click('a:has-text("Nuevo proyecto")');
  await page.waitForURL("**/proyectos/nuevo");
  await page.fill('input[name="name"]', projectName);
  await page.fill('input[name="code"]', `E2E-${stamp}`);
  await page.fill('textarea[name="objective"]', "Objetivo de prueba E2E");
  await page.fill('input[name="start"]', "2026-01-01");
  await page.fill('input[name="due"]', "2026-12-31");
  await page.click('button:has-text("Crear proyecto")');
  await page.waitForURL(/\/proyectos\/[0-9a-f-]+$/);

  // 3. crear tarea dentro del proyecto
  await page.fill('input[name="title"]', taskTitle);
  await page.fill('input[name="deliverable"]', "Entregable E2E");
  await page.fill('input[name="estimate"]', "4");
  await page.fill('input[name="due"]', "2026-12-01");
  await page.click('button:has-text("Crear tarea")');
  await expect(page.locator("table")).toContainText(taskTitle);

  // 4. abrir la tarea y moverla por el workflow completo
  await page.click(`tr:has-text("${taskTitle}")`);
  await page.waitForURL(/\/tareas\/[0-9a-f-]+$/);
  await expect(page.locator(".badge", { hasText: "pendiente" })).toBeVisible();

  await page.click('button:has-text("Iniciar")');
  await expect(page.locator(".badge", { hasText: "activa" })).toBeVisible();

  await page.click('button:has-text("Enviar a revisión")');
  await expect(page.locator(".badge", { hasText: "revision" })).toBeVisible();

  await page.fill('input[name="evidence"]', "Evidencia E2E");
  await page.click('button:has-text("Aprobar")');
  await expect(page.locator(".badge", { hasText: "completada" })).toBeVisible();

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
