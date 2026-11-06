import { Router } from "express";
import { getProject } from "../db/projects-repo.ts";
import {
  createRequest,
  listPendingApplyForLeader,
  listPendingForUserEnriched,
  resolveRequest,
} from "../db/support-requests-repo.ts";
import { getTask, listSupport } from "../db/tasks-repo.ts";
import { HttpError } from "../lib/http-error.ts";
import { requestSupportSchema } from "../schemas/task.ts";

export const supportsRouter = Router();

supportsRouter.get("/solicitudes", async (req, res) => {
  if (!req.user) {
    res.redirect("/login");
    return;
  }

  const forMe = await listPendingForUserEnriched(req.user.id);
  const forLeader =
    req.user.role === "admin"
      ? []
      : await listPendingApplyForLeader(req.user.id);

  res.render("solicitudes/index", {
    user: req.user,
    forMe,
    forLeader,
    error: null,
  });
});

supportsRouter.post("/solicitudes/:id/aceptar", async (req, res) => {
  if (!req.user) {
    res.redirect("/login");
    return;
  }
  const resolved = await resolveRequest(req.params.id, "aceptada", req.user.id);
  if (!resolved) {
    throw new HttpError(404, "solicitud no encontrada");
  }
  res.redirect(303, "/solicitudes");
});

supportsRouter.post("/solicitudes/:id/rechazar", async (req, res) => {
  if (!req.user) {
    res.redirect("/login");
    return;
  }
  const resolved = await resolveRequest(
    req.params.id,
    "rechazada",
    req.user.id,
  );
  if (!resolved) {
    throw new HttpError(404, "solicitud no encontrada");
  }
  res.redirect(303, "/solicitudes");
});

supportsRouter.post("/tareas/:id/apoyo", async (req, res) => {
  if (!req.user) {
    res.redirect("/login");
    return;
  }

  const task = await getTask(req.params.id);
  if (!task) {
    throw new HttpError(404, "tarea no encontrada");
  }
  const project = await getProject(task.projectId);
  const isLeaderOrAdmin =
    req.user.role === "admin" ||
    (!!project && req.user.id === project.leaderId);
  if (req.user.id !== task.ownerId && !isLeaderOrAdmin) {
    throw new HttpError(
      403,
      "solo el responsable o el líder pueden solicitar apoyo",
    );
  }
  if (!["pendiente", "activa", "bloqueada"].includes(task.status)) {
    throw new HttpError(
      400,
      "solo se puede pedir apoyo en pendiente, activa o bloqueada",
    );
  }

  const parsed = requestSupportSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(400, "solicitud de apoyo inválida");
  }

  await createRequest({
    taskId: task.id,
    requestedBy: req.user.id,
    targetUserId: parsed.data.targetUserId,
    mode: parsed.data.mode,
    reason: parsed.data.reason,
  });

  res.redirect(303, `/tareas/${task.id}`);
});

supportsRouter.get("/tareas/:id/horas-apoyo", async (req, res) => {
  if (!req.user) {
    res.redirect("/login");
    return;
  }

  const task = await getTask(req.params.id);
  if (!task) {
    throw new HttpError(404, "tarea no encontrada");
  }
  const support = await listSupport(task.id);
  if (!support.some((s) => s.userId === req.user?.id)) {
    throw new HttpError(403, "solo un apoyo aceptado puede registrar horas");
  }
  if (task.status !== "activa" && task.status !== "revision") {
    throw new HttpError(
      400,
      "solo se registran horas de apoyo en activa o revisión",
    );
  }

  res.render("tareas/horas-apoyo", {
    user: req.user,
    task,
    error: null,
  });
});
