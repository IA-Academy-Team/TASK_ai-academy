import { Router } from "express";
import { getProject, listAllActiveUsers } from "../db/projects-repo.ts";
import {
  createRequest,
  getRequest,
  listPendingApplyForLeader,
  listPendingForUserEnriched,
  resolveRequest,
} from "../db/support-requests-repo.ts";
import {
  getTask,
  listRequestableTasksForUser,
  listSupport,
  REQUESTABLE_SUPPORT_STATUSES,
} from "../db/tasks-repo.ts";
import { getUser } from "../db/users-repo.ts";
import { HttpError } from "../lib/http-error.ts";
import { publish } from "../lib/sse-hub.ts";
import { requestSupportSchema } from "../schemas/task.ts";

export const supportsRouter = Router();

// Una invitación la resuelve el destinatario; una postulación la resuelve el
// líder del proyecto (o un admin) — nunca un tercero cualquiera.
async function assertCanResolveRequest(
  requestId: string,
  user: { id: string; role: string },
): Promise<void> {
  const request = await getRequest(requestId);
  if (!request) {
    throw new HttpError(404, "solicitud no encontrada");
  }

  if (request.mode === "invite") {
    if (user.id !== request.targetUserId) {
      throw new HttpError(
        403,
        "solo la persona invitada puede resolver esta solicitud",
      );
    }
    return;
  }

  if (user.role === "admin") return;
  const task = await getTask(request.taskId);
  const project = task ? await getProject(task.projectId) : undefined;
  // Sin proyecto no hay líder que delegue — el responsable hace de líder.
  const canResolve = project
    ? user.id === project.leaderId
    : !!task && user.id === task.ownerId;
  if (!canResolve) {
    throw new HttpError(
      403,
      "solo el líder del proyecto o un admin pueden resolver esta postulación",
    );
  }
}

supportsRouter.get("/solicitudes", async (req, res) => {
  if (!req.user) {
    res.redirect("/login");
    return;
  }

  const [forMe, forLeader, requestable, allUsers] = await Promise.all([
    listPendingForUserEnriched(req.user.id),
    req.user.role === "admin"
      ? Promise.resolve([])
      : listPendingApplyForLeader(req.user.id),
    listRequestableTasksForUser(req.user.id, req.user.role),
    listAllActiveUsers(),
  ]);

  res.render("solicitudes/index", {
    user: req.user,
    forMe,
    forLeader,
    requestable,
    allUsers,
    error: null,
  });
});

supportsRouter.post("/solicitudes/:id/aceptar", async (req, res) => {
  if (!req.user) {
    res.redirect("/login");
    return;
  }
  await assertCanResolveRequest(req.params.id, req.user);
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
  await assertCanResolveRequest(req.params.id, req.user);
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
  if (!REQUESTABLE_SUPPORT_STATUSES.includes(task.status)) {
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

  const requestedByUser = await getUser(req.user.id);
  publish(parsed.data.targetUserId, "support-request", {
    taskId: task.id,
    taskTitle: task.title,
    projectName: project?.name ?? "",
    requestedByName: requestedByUser?.name ?? req.user.email,
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
