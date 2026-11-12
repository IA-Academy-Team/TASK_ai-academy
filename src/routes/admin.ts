import { Router } from "express";
import {
  deactivateUser,
  deleteUser,
  getUserActivityCounts,
  listAllUsers,
  setMustChangePassword,
} from "../db/users-repo.ts";
import { auth } from "../lib/auth.ts";
import { authorize } from "../middleware/authorize.ts";
import { createUserSchema, GENERIC_PASSWORD } from "../schemas/admin.ts";

export const adminRouter = Router();

adminRouter.get("/admin/usuarios", authorize("admin"), async (req, res) => {
  const users = await listAllUsers();
  res.render("admin/usuarios", {
    users,
    user: req.user,
    error: null,
    genericPassword: GENERIC_PASSWORD,
  });
});

adminRouter.post("/admin/usuarios", authorize("admin"), async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    const users = await listAllUsers();
    res.status(400).render("admin/usuarios", {
      users,
      user: req.user,
      error: "Email y nombre son obligatorios.",
      genericPassword: GENERIC_PASSWORD,
    });
    return;
  }

  const created = await auth.api.signUpEmail({
    body: { ...parsed.data, password: GENERIC_PASSWORD },
  });
  await setMustChangePassword(created.user.id, true);
  res.redirect(303, "/admin/usuarios");
});

adminRouter.post(
  "/admin/usuarios/:id/desactivar",
  authorize("admin"),
  async (req, res) => {
    if (!req.user) {
      res.redirect(303, "/login");
      return;
    }
    const id = String(req.params.id);

    if (id === req.user.id) {
      const users = await listAllUsers();
      res.status(400).render("admin/usuarios", {
        users,
        user: req.user,
        error: "No podés desactivar tu propia cuenta.",
        genericPassword: GENERIC_PASSWORD,
      });
      return;
    }

    await deactivateUser(id);
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
      const users = await listAllUsers();
      res.status(400).render("admin/usuarios", {
        users,
        user: req.user,
        error: "No podés eliminar tu propia cuenta.",
        genericPassword: GENERIC_PASSWORD,
      });
      return;
    }

    const activity = await getUserActivityCounts(id);
    const hasActivity = Object.values(activity).some((n) => n > 0);
    if (hasActivity) {
      const users = await listAllUsers();
      res.status(400).render("admin/usuarios", {
        users,
        user: req.user,
        error:
          "No se puede eliminar: el usuario tiene actividad registrada en el sistema (proyectos, tareas, horas, solicitudes de apoyo o historial). Desactivalo en su lugar.",
        genericPassword: GENERIC_PASSWORD,
      });
      return;
    }

    await deleteUser(id);
    res.redirect(303, "/admin/usuarios");
  },
);
