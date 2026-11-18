import { Router } from "express";
import { getProject, listAllActiveUsers } from "../db/projects-repo.ts";
import {
  getTask,
  listLogs,
  listSupport,
  logHours,
  transitionTask,
} from "../db/tasks-repo.ts";
import { isAdminRole } from "../domain/roles.ts";
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

  // Sin proyecto no hay líder que delegue — el responsable hace de líder.
  const isLeaderOrAdmin =
    isAdminRole(req.user.role) ||
    (!!project && req.user.id === project.leaderId) ||
    (!project && req.user.id === task.ownerId);

  res.render("tareas/detalle", {
    task,
    project,
    support,
    logs,
    users,
    dependency,
    totalHours,
    user: req.user,
    isLeaderOrAdmin,
    canRequestSupport:
      (req.user.id === task.ownerId || isLeaderOrAdmin) &&
      ["pendiente", "activa", "bloqueada"].includes(task.status),
    justUpdated: req.query.updated === "1",
    error: null,
  });
});

tasksRouter.post("/tareas/:id/estado", async (req, res, next) => {
  if (!req.user) {
    res.redirect("/login");
    return;
  }

  // El tablero kanban llama esta misma ruta por fetch (Accept: application/json)
  // para no navegar lejos del tablero en cada arrastre — ver planeacion.ejs.
  const wantsJson = req.accepts(["html", "json"]) === "json";

  try {
    const parsed = transitionSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "transición inválida");
    }

    const current = await getTask(req.params.id);
    if (!current) {
      throw new HttpError(404, "tarea no encontrada");
    }

    const motivoObligatorio =
      parsed.data.status === "cancelada" ||
      parsed.data.status === "bloqueada" ||
      (current.status === "revision" && parsed.data.status === "activa");
    if (motivoObligatorio && !parsed.data.note) {
      throw new HttpError(400, "hace falta un motivo para esta transición");
    }

    const project = await getProject(current.projectId);
    const isLeaderOrAdmin =
      isAdminRole(req.user.role) ||
      (!!project && req.user.id === project.leaderId) ||
      (!project && req.user.id === current.ownerId);

    if (parsed.data.status === "completada") {
      if (!isLeaderOrAdmin) {
        throw new HttpError(
          403,
          "solo el líder del proyecto o un admin pueden aprobar la tarea",
        );
      }
    } else {
      const support = await listSupport(current.id);
      const isOwnerOrSupport =
        req.user.id === current.ownerId ||
        support.some((s) => s.userId === req.user?.id);
      if (!isLeaderOrAdmin && !isOwnerOrSupport) {
        throw new HttpError(
          403,
          "solo el responsable, el apoyo o el líder del proyecto pueden cambiar el estado",
        );
      }
    }

    const updated = await transitionTask(
      req.params.id,
      parsed.data.status,
      req.user.id,
      {
        evidence: parsed.data.evidence,
        note: parsed.data.note,
      },
    );
    if (!updated) {
      throw new HttpError(404, "tarea no encontrada");
    }

    if (wantsJson) {
      res.json({ success: true, status: updated.status });
      return;
    }
    res.redirect(303, `/tareas/${req.params.id}?updated=1`);
  } catch (err) {
    if (wantsJson && err instanceof HttpError) {
      res.status(err.status).json({ success: false, error: err.message });
      return;
    }
    next(err);
  }
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
