import { Router } from "express";
import {
  getProject,
  listAllActiveUsers,
  listMembers,
  setMembers,
  updateSettings,
} from "../db/projects-repo.ts";
import { listTasksByProject, moveTask } from "../db/tasks-repo.ts";
import { HttpError } from "../lib/http-error.ts";
import {
  moveTaskSchema,
  toArray,
  updateSettingsSchema,
} from "../schemas/project.ts";

export const projectSettingsRouter = Router();

function requireLeaderOrAdmin(
  user: { id: string; role: string },
  project: { leaderId: string },
) {
  if (user.role !== "admin" && user.id !== project.leaderId) {
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

  const [members, allUsers, tasks] = await Promise.all([
    listMembers(project.id),
    listAllActiveUsers(),
    listTasksByProject(project.id),
  ]);

  res.render("proyectos/configuracion", {
    user: req.user,
    project,
    members,
    allUsers,
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
  await setMembers(project.id, [
    ...toArray(parsed.data.members),
    project.leaderId,
  ]);

  res.redirect(303, `/proyectos/${project.id}/configuracion`);
});

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

    const parsed = moveTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "dirección inválida");
    }

    await moveTask(req.params.taskId, parsed.data.direction, req.user.id);

    res.redirect(303, `/proyectos/${project.id}/configuracion`);
  },
);
