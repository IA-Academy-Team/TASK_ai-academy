import { eq } from "drizzle-orm";
import supertest from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { user } from "../../src/db/auth-schema.ts";
import { db } from "../../src/db/client.ts";
import { createProject } from "../../src/db/projects-repo.ts";

async function signUpAndGetCookie(
  app: ReturnType<typeof createApp>,
  email: string,
) {
  const res = await supertest(app)
    .post("/api/auth/sign-up/email")
    .send({ email, password: "supersecret123", name: "Test" });
  return res.headers["set-cookie"];
}

describe("admin usuarios", () => {
  it("admin GET /admin/usuarios responde 200", async () => {
    const app = createApp();
    const email = "adminx1@test.local";
    const cookie = await signUpAndGetCookie(app, email);
    await db.update(user).set({ role: "admin" }).where(eq(user.email, email));

    const res = await supertest(app)
      .get("/admin/usuarios")
      .set("Cookie", cookie);
    expect(res.status).toBe(200);
  });

  it("usuario comun GET /admin/usuarios responde 403", async () => {
    const app = createApp();
    const cookie = await signUpAndGetCookie(app, "userx2@test.local");
    const res = await supertest(app)
      .get("/admin/usuarios")
      .set("Cookie", cookie);
    expect(res.status).toBe(403);
  });

  it("POST /admin/usuarios crea con role usuario", async () => {
    const app = createApp();
    const email = "adminx3@test.local";
    const cookie = await signUpAndGetCookie(app, email);
    await db.update(user).set({ role: "admin" }).where(eq(user.email, email));

    const res = await supertest(app)
      .post("/admin/usuarios")
      .set("Cookie", cookie)
      .type("form")
      .send({
        email: "nuevo1@test.local",
        password: "supersecret999",
        name: "Nuevo",
      });
    expect(res.status).toBe(303);

    const [created] = await db
      .select()
      .from(user)
      .where(eq(user.email, "nuevo1@test.local"));
    expect(created.role).toBe("usuario");
  });

  it("POST /admin/usuarios/:id/desactivar pone isActive=false", async () => {
    const app = createApp();
    const email = "adminx4@test.local";
    const cookie = await signUpAndGetCookie(app, email);
    await db.update(user).set({ role: "admin" }).where(eq(user.email, email));

    await signUpAndGetCookie(app, "target1@test.local");
    const [target] = await db
      .select()
      .from(user)
      .where(eq(user.email, "target1@test.local"));

    const res = await supertest(app)
      .post(`/admin/usuarios/${target.id}/desactivar`)
      .set("Cookie", cookie);
    expect(res.status).toBe(303);

    const [after] = await db
      .select()
      .from(user)
      .where(eq(user.email, "target1@test.local"));
    expect(after.isActive).toBe(false);
  });

  it("POST /admin/usuarios/:id/eliminar borra al usuario", async () => {
    const app = createApp();
    const email = "adminx5@test.local";
    const cookie = await signUpAndGetCookie(app, email);
    await db.update(user).set({ role: "admin" }).where(eq(user.email, email));

    await signUpAndGetCookie(app, "target2@test.local");
    const [target] = await db
      .select()
      .from(user)
      .where(eq(user.email, "target2@test.local"));

    const res = await supertest(app)
      .post(`/admin/usuarios/${target.id}/eliminar`)
      .set("Cookie", cookie);
    expect(res.status).toBe(303);

    const remaining = await db
      .select()
      .from(user)
      .where(eq(user.email, "target2@test.local"));
    expect(remaining.length).toBe(0);
  });

  it("POST /admin/usuarios/:id/eliminar rechaza auto-eliminación", async () => {
    const app = createApp();
    const email = "adminx6@test.local";
    const cookie = await signUpAndGetCookie(app, email);
    await db.update(user).set({ role: "admin" }).where(eq(user.email, email));
    const [self] = await db.select().from(user).where(eq(user.email, email));

    const res = await supertest(app)
      .post(`/admin/usuarios/${self.id}/eliminar`)
      .set("Cookie", cookie);
    expect(res.status).toBe(400);

    const [after] = await db.select().from(user).where(eq(user.email, email));
    expect(after).toBeDefined();
  });

  it("POST /admin/usuarios/:id/eliminar rechaza si lidera un proyecto", async () => {
    const app = createApp();
    const adminEmail = "adminx7@test.local";
    const adminCookie = await signUpAndGetCookie(app, adminEmail);
    await db
      .update(user)
      .set({ role: "admin" })
      .where(eq(user.email, adminEmail));

    await signUpAndGetCookie(app, "leader1@test.local");
    const [leader] = await db
      .select()
      .from(user)
      .where(eq(user.email, "leader1@test.local"));

    await createProject({
      name: "Proyecto con líder",
      code: "LID-001",
      objective: "Probar que no se puede eliminar al líder",
      leaderId: leader.id,
      start: "2026-01-01",
      due: "2026-02-01",
      limitActive: 2,
      limitReview: 2,
      memberIds: [leader.id],
    });

    const res = await supertest(app)
      .post(`/admin/usuarios/${leader.id}/eliminar`)
      .set("Cookie", adminCookie);
    expect(res.status).toBe(400);

    const [after] = await db
      .select()
      .from(user)
      .where(eq(user.email, "leader1@test.local"));
    expect(after).toBeDefined();
  });

  it("POST /admin/usuarios/:id/eliminar rechaza si tiene historial de auditoría", async () => {
    const { recordChange } = await import("../../src/db/audit-repo.ts");

    const app = createApp();
    const adminEmail = "adminx8@test.local";
    const adminCookie = await signUpAndGetCookie(app, adminEmail);
    await db
      .update(user)
      .set({ role: "admin" })
      .where(eq(user.email, adminEmail));
    const [admin] = await db
      .select()
      .from(user)
      .where(eq(user.email, adminEmail));

    await signUpAndGetCookie(app, "actor1@test.local");
    const [actor] = await db
      .select()
      .from(user)
      .where(eq(user.email, "actor1@test.local"));

    const project = await createProject({
      name: "Proyecto con historial",
      code: "AUD-001",
      objective: "Probar el bloqueo por audit_log",
      leaderId: admin.id,
      start: "2026-01-01",
      due: "2026-02-01",
      limitActive: 2,
      limitReview: 2,
      memberIds: [actor.id],
    });
    await recordChange({
      projectId: project.id,
      actorId: actor.id,
      action: "project_settings_updated",
      note: "registro de prueba",
    });

    const res = await supertest(app)
      .post(`/admin/usuarios/${actor.id}/eliminar`)
      .set("Cookie", adminCookie);
    expect(res.status).toBe(400);

    const [after] = await db
      .select()
      .from(user)
      .where(eq(user.email, "actor1@test.local"));
    expect(after).toBeDefined();
  });
});
