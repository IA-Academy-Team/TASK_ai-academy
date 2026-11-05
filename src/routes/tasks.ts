import { Router } from "express";
import { getProject, listAllActiveUsers } from "../db/projects-repo.ts";
import {
  getTask,
  listLogs,
  listSupport,
  logHours,
  transitionTask,
} from "../db/tasks-repo.ts";
import { HttpError } from "../lib/http-error.ts";
import { logHoursSchema, transitionSchema } from "../schemas/task.ts";

export const tasksRouter = Router();

tasksRouter.get("/tareas/:id", async (req, res) => {
  if (!req.user) {
    res.redirect("/login");
    return;
  }

  const task = await getTask(req.params.id);
  if (!task) {
    throw new HttpError(404, "tarea no encontrada");
  }

  const project = await getProject(task.projectId);
  const support = await listSupport(task.id);
  const logs = await listLogs(task.id);
  const users = await listAllActiveUsers();
  const dependency = task.dependencyId
    ? await getTask(task.dependencyId)
    : null;
  const totalHours = logs.reduce((sum, l) => sum + Number(l.hours), 0);

  res.render("tareas/detalle", {
    task,
    project,
    support,
    logs,
    users,
    dependency,
    totalHours,
    user: req.user,
    isLeaderOrAdmin:
      req.user.role === "admin" ||
      (project && req.user.id === project.leaderId),
    isOwnerOrSupport:
      req.user.id === task.ownerId ||
      support.some((s) => s.userId === req.user?.id),
    error: null,
  });
});

tasksRouter.post("/tareas/:id/estado", async (req, res) => {
  if (!req.user) {
    res.redirect("/login");
    return;
  }

  const parsed = transitionSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(400, "transición inválida");
  }

  if (parsed.data.status === "completada") {
    const task = await getTask(req.params.id);
    if (!task) {
      throw new HttpError(404, "tarea no encontrada");
    }
    const project = await getProject(task.projectId);
    const isLeaderOrAdmin =
      req.user.role === "admin" ||
      (project && req.user.id === project.leaderId);
    if (!isLeaderOrAdmin) {
      throw new HttpError(
        403,
        "solo el líder del proyecto o un admin pueden aprobar la tarea",
      );
    }
  }

  const updated = await transitionTask(
    req.params.id,
    parsed.data.status,
    req.user.id,
    {
      evidence: parsed.data.evidence,
    },
  );
  if (!updated) {
    throw new HttpError(404, "tarea no encontrada");
  }

  res.redirect(303, `/tareas/${req.params.id}`);
});

tasksRouter.post("/tareas/:id/horas", async (req, res) => {
  if (!req.user) {
    res.redirect("/login");
    return;
  }

  const task = await getTask(req.params.id);
  if (!task) {
    throw new HttpError(404, "tarea no encontrada");
  }

  const parsed = logHoursSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(400, "registro de horas inválido");
  }

  const support = await listSupport(task.id);
  const role = req.user.id === task.ownerId ? "owner" : "support";
  if (role === "support" && !support.some((s) => s.userId === req.user?.id)) {
    throw new HttpError(
      403,
      "solo el responsable o el apoyo de la tarea pueden registrar horas",
    );
  }

  await logHours({
    taskId: task.id,
    userId: req.user.id,
    role,
    date: parsed.data.date,
    hours: String(parsed.data.hours),
  });

  res.redirect(303, `/tareas/${req.params.id}`);
});
