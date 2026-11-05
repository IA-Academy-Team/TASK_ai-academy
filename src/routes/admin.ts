import { count, eq, or } from "drizzle-orm";
import { Router } from "express";
import { user } from "../db/auth-schema.ts";
import { db } from "../db/client.ts";
import {
  auditLog,
  projects,
  supportRequests,
  taskLogs,
  tasks,
} from "../db/schema.ts";
import { auth } from "../lib/auth.ts";
import { authorize } from "../middleware/authorize.ts";
import { createUserSchema } from "../schemas/admin.ts";

export const adminRouter = Router();

adminRouter.get("/admin/usuarios", authorize("admin"), async (req, res) => {
  const users = await db.select().from(user);
  res.render("admin/usuarios", { users, user: req.user, error: null });
});

adminRouter.post("/admin/usuarios", authorize("admin"), async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    const users = await db.select().from(user);
    res.status(400).render("admin/usuarios", {
      users,
      user: req.user,
      error: "Email, nombre y contraseña (8+ caracteres) son obligatorios.",
    });
    return;
  }

  await auth.api.signUpEmail({ body: parsed.data });
  res.redirect(303, "/admin/usuarios");
});

adminRouter.post(
  "/admin/usuarios/:id/desactivar",
  authorize("admin"),
  async (req, res) => {
    await db
      .update(user)
      .set({ isActive: false })
      .where(eq(user.id, String(req.params.id)));
    res.redirect(303, "/admin/usuarios");
  },
);

adminRouter.post(
  "/admin/usuarios/:id/eliminar",
  authorize("admin"),
  async (req, res) => {
    if (!req.user) {
      res.redirect(303, "/login");
      return;
    }
    const id = String(req.params.id);

    if (id === req.user.id) {
      const users = await db.select().from(user);
      res.status(400).render("admin/usuarios", {
        users,
        user: req.user,
        error: "No podés eliminar tu propia cuenta.",
      });
      return;
    }

    const [{ value: ledProjects }] = await db
      .select({ value: count() })
      .from(projects)
      .where(eq(projects.leaderId, id));
    const [{ value: ownedTasks }] = await db
      .select({ value: count() })
      .from(tasks)
      .where(eq(tasks.ownerId, id));
    const [{ value: loggedHours }] = await db
      .select({ value: count() })
      .from(taskLogs)
      .where(eq(taskLogs.userId, id));
    const [{ value: auditRows }] = await db
      .select({ value: count() })
      .from(auditLog)
      .where(eq(auditLog.actorId, id));
    const [{ value: supportRequestRows }] = await db
      .select({ value: count() })
      .from(supportRequests)
      .where(
        or(
          eq(supportRequests.requestedBy, id),
          eq(supportRequests.targetUserId, id),
        ),
      );

    if (
      ledProjects > 0 ||
      ownedTasks > 0 ||
      loggedHours > 0 ||
      auditRows > 0 ||
      supportRequestRows > 0
    ) {
      const users = await db.select().from(user);
      res.status(400).render("admin/usuarios", {
        users,
        user: req.user,
        error:
          "No se puede eliminar: el usuario tiene actividad registrada en el sistema (proyectos, tareas, horas, solicitudes de apoyo o historial). Desactivalo en su lugar.",
      });
      return;
    }

    await db.delete(user).where(eq(user.id, id));
    res.redirect(303, "/admin/usuarios");
  },
);
