import { Router } from "express";
import { getProject, listAllActiveUsers } from "../db/projects-repo.ts";
import { getTask, listTasksByProject, updateTask } from "../db/tasks-repo.ts";
import { HttpError } from "../lib/http-error.ts";
import { updateTaskSchema } from "../schemas/task.ts";

export const tasksEditRouter = Router();

function isLeaderOrAdmin(
  user: { id: string; role: string },
  project: { leaderId: string } | undefined,
): boolean {
  return user.role === "admin" || (!!project && user.id === project.leaderId);
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
  if (!isLeaderOrAdmin(req.user, project)) {
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
    listAllActiveUsers(),
    listTasksByProject(task.projectId),
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
  if (!isLeaderOrAdmin(req.user, project)) {
    throw new HttpError(
      403,
      "solo el líder del proyecto o un admin pueden editar la tarea",
    );
  }

  const parsed = updateTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    const [allUsers, allTasks] = await Promise.all([
      listAllActiveUsers(),
      listTasksByProject(task.projectId),
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
      weight: parsed.data.weight,
      estimate: String(parsed.data.estimate),
      dependencyId: parsed.data.dependencyId,
      due: parsed.data.due,
    },
    req.user.id,
    parsed.data.motivo,
  );

  res.redirect(303, `/tareas/${task.id}`);
});
