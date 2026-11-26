import { eq } from "drizzle-orm";
import supertest from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { user } from "../../src/db/auth-schema.ts";
import { db } from "../../src/db/client.ts";
import { createProject } from "../../src/db/projects-repo.ts";
import { ADMIN_ROLE } from "../../src/domain/roles.ts";
import { signUpAndGetCookie } from "../helpers/auth.ts";

describe("admin usuarios", () => {
  it("admin GET /admin/usuarios responde 200", async () => {
    const app = createApp();
    const email = "adminx1@test.local";
    const cookie = await signUpAndGetCookie(email);
    await db
      .update(user)
      .set({ role: ADMIN_ROLE })
      .where(eq(user.email, email));

    const res = await supertest(app)
      .get("/admin/usuarios")
      .set("Cookie", cookie);
    expect(res.status).toBe(200);
  });

  it("usuario comun GET /admin/usuarios responde 403", async () => {
    const app = createApp();
    const cookie = await signUpAndGetCookie("userx2@test.local");
    const res = await supertest(app)
      .get("/admin/usuarios")
      .set("Cookie", cookie);
    expect(res.status).toBe(403);
  });

  it("POST /admin/usuarios crea con el rol elegido", async () => {
    const app = createApp();
    const email = "adminx3@test.local";
    const cookie = await signUpAndGetCookie(email);
    await db
      .update(user)
      .set({ role: ADMIN_ROLE })
      .where(eq(user.email, email));

    const res = await supertest(app)
      .post("/admin/usuarios")
      .set("Cookie", cookie)
      .type("form")
      .send({
        email: "nuevo1@test.local",
        name: "Nuevo",
        role: "trainer",
      });
    expect(res.status).toBe(303);

    const [created] = await db
      .select()
      .from(user)
      .where(eq(user.email, "nuevo1@test.local"));
    expect(created.role).toBe("trainer");
  });

  it("POST /admin/usuarios/:id/desactivar pone isActive=false", async () => {
    const app = createApp();
    const email = "adminx4@test.local";
    const cookie = await signUpAndGetCookie(email);
    await db
      .update(user)
      .set({ role: ADMIN_ROLE })
      .where(eq(user.email, email));

    await signUpAndGetCookie("target1@test.local");
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

  it("POST /admin/usuarios/:id/desactivar rechaza auto-desactivación", async () => {
    const app = createApp();
    const email = "adminx4c@test.local";
    const cookie = await signUpAndGetCookie(email);
    await db
      .update(user)
      .set({ role: ADMIN_ROLE })
      .where(eq(user.email, email));
    const [self] = await db.select().from(user).where(eq(user.email, email));

    const res = await supertest(app)
      .post(`/admin/usuarios/${self.id}/desactivar`)
      .set("Cookie", cookie);
    expect(res.status).toBe(400);

    const [after] = await db.select().from(user).where(eq(user.email, email));
    expect(after.isActive).toBe(true);
  });

  it("desactivar corta el acceso de una sesión ya abierta", async () => {
    const app = createApp();
    const email = "adminx4b@test.local";
    const cookie = await signUpAndGetCookie(email);
    await db
      .update(user)
      .set({ role: ADMIN_ROLE })
      .where(eq(user.email, email));

    const targetCookie = await signUpAndGetCookie("target1b@test.local");
    const [target] = await db
      .select()
      .from(user)
      .where(eq(user.email, "target1b@test.local"));

    await supertest(app)
      .post(`/admin/usuarios/${target.id}/desactivar`)
      .set("Cookie", cookie);

    const res = await supertest(app)
      .get("/proyectos")
      .set("Cookie", targetCookie);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/login");
  });

  it("POST /admin/usuarios/:id/eliminar borra al usuario", async () => {
    const app = createApp();
    const email = "adminx5@test.local";
    const cookie = await signUpAndGetCookie(email);
    await db
      .update(user)
      .set({ role: ADMIN_ROLE })
      .where(eq(user.email, email));

    await signUpAndGetCookie("target2@test.local");
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
    const cookie = await signUpAndGetCookie(email);
    await db
      .update(user)
      .set({ role: ADMIN_ROLE })
      .where(eq(user.email, email));
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
    const adminCookie = await signUpAndGetCookie(adminEmail);
    await db
      .update(user)
      .set({ role: ADMIN_ROLE })
      .where(eq(user.email, adminEmail));

    await signUpAndGetCookie("leader1@test.local");
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
    const adminCookie = await signUpAndGetCookie(adminEmail);
    await db
      .update(user)
      .set({ role: ADMIN_ROLE })
      .where(eq(user.email, adminEmail));
    const [admin] = await db
      .select()
      .from(user)
      .where(eq(user.email, adminEmail));

    await signUpAndGetCookie("actor1@test.local");
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

  it("usuario comun no puede restablecer contraseñas (403)", async () => {
    const app = createApp();
    const cookie = await signUpAndGetCookie("noadmin-reset@test.local");
    await signUpAndGetCookie("target-reset1@test.local");
    const [target] = await db
      .select()
      .from(user)
      .where(eq(user.email, "target-reset1@test.local"));

    const res = await supertest(app)
      .post(`/admin/usuarios/${target.id}/restablecer-password`)
      .set("Cookie", cookie);
    expect(res.status).toBe(403);
  });

  it("admin restablece la contraseña de otro usuario a la genérica", async () => {
    const { GENERIC_PASSWORD } = await import("../../src/schemas/admin.ts");

    const app = createApp();
    const adminEmail = "adminx9@test.local";
    const adminCookie = await signUpAndGetCookie(adminEmail);
    await db
      .update(user)
      .set({ role: ADMIN_ROLE })
      .where(eq(user.email, adminEmail));

    const targetEmail = "target-reset2@test.local";
    await signUpAndGetCookie(targetEmail, "unaPasswordVieja1");
    const [target] = await db
      .select()
      .from(user)
      .where(eq(user.email, targetEmail));

    const res = await supertest(app)
      .post(`/admin/usuarios/${target.id}/restablecer-password`)
      .set("Cookie", adminCookie);
    expect(res.status).toBe(303);

    const [after] = await db
      .select()
      .from(user)
      .where(eq(user.email, targetEmail));
    expect(after.mustChangePassword).toBe(true);

    const oldPasswordRes = await supertest(app)
      .post("/api/auth/sign-in/email")
      .send({ email: targetEmail, password: "unaPasswordVieja1" });
    expect(oldPasswordRes.status).toBe(401);

    const newPasswordRes = await supertest(app)
      .post("/api/auth/sign-in/email")
      .send({ email: targetEmail, password: GENERIC_PASSWORD });
    expect(newPasswordRes.status).toBe(200);
  });

  it("admin no puede restablecer su propia contraseña desde esta ruta", async () => {
    const app = createApp();
    const email = "adminx10@test.local";
    const cookie = await signUpAndGetCookie(email);
    await db
      .update(user)
      .set({ role: ADMIN_ROLE })
      .where(eq(user.email, email));
    const [self] = await db.select().from(user).where(eq(user.email, email));

    const res = await supertest(app)
      .post(`/admin/usuarios/${self.id}/restablecer-password`)
      .set("Cookie", cookie);
    expect(res.status).toBe(400);
  });

  it("admin cambia el rol de otro usuario", async () => {
    const app = createApp();
    const adminEmail = "adminx12@test.local";
    const adminCookie = await signUpAndGetCookie(adminEmail);
    await db
      .update(user)
      .set({ role: ADMIN_ROLE })
      .where(eq(user.email, adminEmail));

    await signUpAndGetCookie("target-role1@test.local");
    const [target] = await db
      .select()
      .from(user)
      .where(eq(user.email, "target-role1@test.local"));
    expect(target.role).toBe("colaborador");

    const res = await supertest(app)
      .post(`/admin/usuarios/${target.id}/rol`)
      .set("Cookie", adminCookie)
      .type("form")
      .send({ role: "trainer" });
    expect(res.status).toBe(303);

    const [after] = await db
      .select()
      .from(user)
      .where(eq(user.email, "target-role1@test.local"));
    expect(after.role).toBe("trainer");
  });

  it("admin no puede cambiar su propio rol", async () => {
    const app = createApp();
    const email = "adminx13@test.local";
    const cookie = await signUpAndGetCookie(email);
    await db
      .update(user)
      .set({ role: ADMIN_ROLE })
      .where(eq(user.email, email));
    const [self] = await db.select().from(user).where(eq(user.email, email));

    const res = await supertest(app)
      .post(`/admin/usuarios/${self.id}/rol`)
      .set("Cookie", cookie)
      .type("form")
      .send({ role: "trainer" });
    expect(res.status).toBe(400);

    const [after] = await db.select().from(user).where(eq(user.email, email));
    expect(after.role).toBe(ADMIN_ROLE);
  });

  it("POST /admin/usuarios/:id/rol con rol inválido responde 400", async () => {
    const app = createApp();
    const adminEmail = "adminx14@test.local";
    const adminCookie = await signUpAndGetCookie(adminEmail);
    await db
      .update(user)
      .set({ role: ADMIN_ROLE })
      .where(eq(user.email, adminEmail));

    await signUpAndGetCookie("target-role2@test.local");
    const [target] = await db
      .select()
      .from(user)
      .where(eq(user.email, "target-role2@test.local"));

    const res = await supertest(app)
      .post(`/admin/usuarios/${target.id}/rol`)
      .set("Cookie", adminCookie)
      .type("form")
      .send({ role: "invalido" });
    expect(res.status).toBe(400);
  });

  it("usuario comun no puede cambiar roles (403)", async () => {
    const app = createApp();
    const cookie = await signUpAndGetCookie("noadmin-role@test.local");
    await signUpAndGetCookie("target-role3@test.local");
    const [target] = await db
      .select()
      .from(user)
      .where(eq(user.email, "target-role3@test.local"));

    const res = await supertest(app)
      .post(`/admin/usuarios/${target.id}/rol`)
      .set("Cookie", cookie)
      .type("form")
      .send({ role: "trainer" });
    expect(res.status).toBe(403);
  });

  it("POST /admin/usuarios sin rol responde 400", async () => {
    const app = createApp();
    const email = "adminx11@test.local";
    const cookie = await signUpAndGetCookie(email);
    await db
      .update(user)
      .set({ role: ADMIN_ROLE })
      .where(eq(user.email, email));

    const res = await supertest(app)
      .post("/admin/usuarios")
      .set("Cookie", cookie)
      .type("form")
      .send({ email: "sinrol@test.local", name: "Sin Rol" });
    expect(res.status).toBe(400);
  });
});
