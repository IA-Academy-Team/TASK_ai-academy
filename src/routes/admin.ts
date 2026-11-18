import type { Request, Response } from "express";
import { Router } from "express";
import {
  deactivateUser,
  deleteUser,
  getUserActivityCounts,
  listAllUsers,
  resetUserPassword,
  setMustChangePassword,
  setUserRole,
} from "../db/users-repo.ts";
import { ADMIN_ROLE, ROLE_LABELS, ROLES } from "../domain/roles.ts";
import { auth } from "../lib/auth.ts";
import { authorize } from "../middleware/authorize.ts";
import { createUserSchema, GENERIC_PASSWORD } from "../schemas/admin.ts";

export const adminRouter = Router();

async function renderUsersPage(
  req: Request,
  res: Response,
  options: { status?: number; error?: string | null } = {},
) {
  const users = await listAllUsers();
  res.status(options.status ?? 200).render("admin/usuarios", {
    users,
    roles: ROLES,
    roleLabels: ROLE_LABELS,
    user: req.user,
    error: options.error ?? null,
    genericPassword: GENERIC_PASSWORD,
  });
}

adminRouter.get("/admin/usuarios", authorize(ADMIN_ROLE), async (req, res) => {
  await renderUsersPage(req, res);
});

adminRouter.post("/admin/usuarios", authorize(ADMIN_ROLE), async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    await renderUsersPage(req, res, {
      status: 400,
      error: "Email, nombre y rol son obligatorios.",
    });
    return;
  }

  const created = await auth.api.signUpEmail({
    body: {
      email: parsed.data.email,
      name: parsed.data.name,
      password: GENERIC_PASSWORD,
    },
  });
  await setUserRole(created.user.id, parsed.data.role);
  await setMustChangePassword(created.user.id, true);
  res.redirect(303, "/admin/usuarios");
});

adminRouter.post(
  "/admin/usuarios/:id/desactivar",
  authorize(ADMIN_ROLE),
  async (req, res) => {
    if (!req.user) {
      res.redirect(303, "/login");
      return;
    }
    const id = String(req.params.id);

    if (id === req.user.id) {
      await renderUsersPage(req, res, {
        status: 400,
        error: "No podés desactivar tu propia cuenta.",
      });
      return;
    }

    await deactivateUser(id);
    res.redirect(303, "/admin/usuarios");
  },
);

adminRouter.post(
  "/admin/usuarios/:id/restablecer-password",
  authorize(ADMIN_ROLE),
  async (req, res) => {
    if (!req.user) {
      res.redirect(303, "/login");
      return;
    }
    const id = String(req.params.id);

    if (id === req.user.id) {
      await renderUsersPage(req, res, {
        status: 400,
        error: "No podés restablecer tu propia contraseña desde acá.",
      });
      return;
    }

    await resetUserPassword(id, GENERIC_PASSWORD);
    await setMustChangePassword(id, true);
    res.redirect(303, "/admin/usuarios");
  },
);

adminRouter.post(
  "/admin/usuarios/:id/eliminar",
  authorize(ADMIN_ROLE),
  async (req, res) => {
    if (!req.user) {
      res.redirect(303, "/login");
      return;
    }
    const id = String(req.params.id);

    if (id === req.user.id) {
      await renderUsersPage(req, res, {
        status: 400,
        error: "No podés eliminar tu propia cuenta.",
      });
      return;
    }

    const activity = await getUserActivityCounts(id);
    const hasActivity = Object.values(activity).some((n) => n > 0);
    if (hasActivity) {
      await renderUsersPage(req, res, {
        status: 400,
        error:
          "No se puede eliminar: el usuario tiene actividad registrada en el sistema (proyectos, tareas, horas, solicitudes de apoyo o historial). Desactivalo en su lugar.",
      });
      return;
    }

    await deleteUser(id);
    res.redirect(303, "/admin/usuarios");
  },
);
