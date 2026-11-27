import { Router } from "express";
import {
  getProject,
  listAllActiveUsersIncludingAdmins,
} from "../db/projects-repo.ts";
import {
  getTask,
  listTasksByProject,
  listTasksWithoutProject,
  updateTask,
} from "../db/tasks-repo.ts";
import { isAdminRole } from "../domain/roles.ts";
import { HttpError } from "../lib/http-error.ts";
import { updateTaskSchema } from "../schemas/task.ts";

export const tasksEditRouter = Router();

// Sin proyecto no hay líder que delegue — el responsable hace de líder.
function isLeaderOrAdmin(
  user: { id: string; role: string },
  project: { leaderId: string } | undefined,
  ownerId: string,
): boolean {
  return (
    isAdminRole(user.role) ||
    (!!project && user.id === project.leaderId) ||
    (!project && user.id === ownerId)
  );
}

tasksEditRouter.get("/tareas/:id/editar", async (req, res) => {
  if (!req.user) {
    res.redirect("/login");
    return;
  }

  const task = await getTask(req.params.id);
  if (!task) {
    throw new HttpError(404, "tarea no encontrada");
  }
  const project = await getProject(task.projectId);
  if (!isLeaderOrAdmin(req.user, project, task.ownerId)) {
    throw new HttpError(
      403,
      "solo el líder del proyecto o un admin pueden editar la tarea",
    );
  }
  if (task.status === "completada" || task.status === "cancelada") {
    throw new HttpError(
      400,
      "no se puede editar una tarea completada o cancelada",
    );
  }

  const [allUsers, allTasks] = await Promise.all([
    listAllActiveUsersIncludingAdmins(),
    task.projectId
      ? listTasksByProject(task.projectId)
      : listTasksWithoutProject(),
  ]);

  res.render("tareas/editar", {
    user: req.user,
    task,
    project,
    allUsers,
    allTasks: allTasks.filter((t) => t.id !== task.id),
    error: null,
  });
});

tasksEditRouter.post("/tareas/:id/editar", async (req, res) => {
  if (!req.user) {
    res.redirect("/login");
    return;
  }

  const task = await getTask(req.params.id);
  if (!task) {
    throw new HttpError(404, "tarea no encontrada");
  }
  const project = await getProject(task.projectId);
  if (!isLeaderOrAdmin(req.user, project, task.ownerId)) {
    throw new HttpError(
      403,
      "solo el líder del proyecto o un admin pueden editar la tarea",
    );
  }

  const parsed = updateTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    const [allUsers, allTasks] = await Promise.all([
      listAllActiveUsersIncludingAdmins(),
      task.projectId
        ? listTasksByProject(task.projectId)
        : listTasksWithoutProject(),
    ]);
    res.status(400).render("tareas/editar", {
      user: req.user,
      task,
      project,
      allUsers,
      allTasks: allTasks.filter((t) => t.id !== task.id),
      error: "Revisa los campos obligatorios de la edición.",
    });
    return;
  }

  await updateTask(
    task.id,
    {
      title: parsed.data.title,
      deliverable: parsed.data.deliverable,
      description: parsed.data.description,
      ownerId: parsed.data.ownerId,
      priority: parsed.data.priority,
      weight: task.weight,
      estimate: String(parsed.data.estimate),
      dependencyId: parsed.data.dependencyId,
      due: parsed.data.due,
      dueTime: parsed.data.dueTime,
    },
    req.user.id,
    parsed.data.motivo,
  );

  res.redirect(303, `/tareas/${task.id}`);
});
