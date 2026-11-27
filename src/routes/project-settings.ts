import { Router } from "express";
import {
  getProject,
  listAllActiveUsers,
  listAllActiveUsersIncludingAdmins,
  listMembers,
  setMembers,
  updateProject,
  updateSettings,
} from "../db/projects-repo.ts";
import { getTask, listTasksByProject, moveTask } from "../db/tasks-repo.ts";
import { ADMIN_ROLE, isAdminRole } from "../domain/roles.ts";
import { HttpError } from "../lib/http-error.ts";
import { authorize } from "../middleware/authorize.ts";
import {
  moveTaskSchema,
  toArray,
  updateProjectSchema,
  updateSettingsSchema,
} from "../schemas/project.ts";

export const projectSettingsRouter = Router();

function requireLeaderOrAdmin(
  user: { id: string; role: string },
  project: { leaderId: string },
) {
  if (!isAdminRole(user.role) && user.id !== project.leaderId) {
    throw new HttpError(
      403,
      "solo el líder del proyecto o un admin pueden editar la configuración",
    );
  }
}

projectSettingsRouter.get("/proyectos/:id/configuracion", async (req, res) => {
  if (!req.user) {
    res.redirect("/login");
    return;
  }

  const project = await getProject(req.params.id);
  if (!project) {
    throw new HttpError(404, "proyecto no encontrado");
  }
  requireLeaderOrAdmin(req.user, project);

  const [members, allUsers, leaderOptions, tasks] = await Promise.all([
    listMembers(project.id),
    listAllActiveUsers(),
    listAllActiveUsersIncludingAdmins(),
    listTasksByProject(project.id),
  ]);

  res.render("proyectos/configuracion", {
    user: req.user,
    project,
    members,
    allUsers,
    leaderOptions,
    tasks,
    error: null,
  });
});

projectSettingsRouter.post("/proyectos/:id/config", async (req, res) => {
  if (!req.user) {
    res.redirect("/login");
    return;
  }

  const project = await getProject(req.params.id);
  if (!project) {
    throw new HttpError(404, "proyecto no encontrado");
  }
  requireLeaderOrAdmin(req.user, project);

  const parsed = updateSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(400, "configuración inválida");
  }

  await updateSettings(project.id, {
    limitActive: parsed.data.limitActive,
    limitReview: parsed.data.limitReview,
    due: parsed.data.due,
    actorId: req.user.id,
  });
  // El líder dirige el proyecto pero no cuenta como integrante.
  await setMembers(
    project.id,
    toArray(parsed.data.members).filter((id) => id !== project.leaderId),
  );

  res.redirect(303, `/proyectos/${project.id}/configuracion`);
});

// Edición completa del proyecto (nombre, código, objetivo, líder, fechas) —
// a diferencia de /config arriba, esto es exclusivo de administradores,
// nunca del líder del proyecto.
projectSettingsRouter.post(
  "/proyectos/:id/editar",
  authorize(ADMIN_ROLE),
  async (req, res) => {
    const project = await getProject(String(req.params.id));
    if (!project) {
      throw new HttpError(404, "proyecto no encontrado");
    }

    const parsed = updateProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "datos de proyecto inválidos");
    }
    if (!req.user) {
      res.redirect("/login");
      return;
    }

    await updateProject(project.id, {
      name: parsed.data.name,
      code: parsed.data.code,
      objective: parsed.data.objective,
      leaderId: parsed.data.leaderId,
      start: parsed.data.start,
      due: parsed.data.due,
      actorId: req.user.id,
    });

    res.redirect(303, `/proyectos/${project.id}/configuracion`);
  },
);

projectSettingsRouter.post(
  "/proyectos/:id/tareas/:taskId/mover",
  async (req, res) => {
    if (!req.user) {
      res.redirect("/login");
      return;
    }

    const project = await getProject(req.params.id);
    if (!project) {
      throw new HttpError(404, "proyecto no encontrado");
    }
    requireLeaderOrAdmin(req.user, project);

    const task = await getTask(req.params.taskId);
    if (!task || task.projectId !== project.id) {
      throw new HttpError(404, "tarea no encontrada en este proyecto");
    }

    const parsed = moveTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "dirección inválida");
    }

    await moveTask(req.params.taskId, parsed.data.direction, req.user.id);

    res.redirect(303, `/proyectos/${project.id}/configuracion`);
  },
);
