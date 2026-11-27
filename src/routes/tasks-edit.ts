import { Router } from "express";
import {
  getProject,
  listAllActiveUsersIncludingAdmins,
} from "../db/projects-repo.ts";
import {
  listPendingByTask,
  updateRequestTarget,
} from "../db/support-requests-repo.ts";
import {
  getTask,
  listTasksByProject,
  listTasksWithoutProject,
  updateTask,
} from "../db/tasks-repo.ts";
import { getUser } from "../db/users-repo.ts";
import { isAdminRole } from "../domain/roles.ts";
import { HttpError } from "../lib/http-error.ts";
import {
  reassignSupportRequestSchema,
  updateTaskSchema,
} from "../schemas/task.ts";

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

// Junta lo que necesita el formulario de edición: usuarios asignables,
// tareas de dependencia, y las solicitudes de apoyo pendientes de esta
// tarea con el nombre de su destinatario resuelto por id directo — así
// una solicitud que apunta a una cuenta desactivada/eliminada se puede
// seguir viendo y reasignar en vez de quedar atascada.
async function loadEditFormData(task: {
  id: string;
  projectId: string | null;
}) {
  const [allUsers, allTasks, pending] = await Promise.all([
    listAllActiveUsersIncludingAdmins(),
    task.projectId
      ? listTasksByProject(task.projectId)
      : listTasksWithoutProject(),
    listPendingByTask(task.id),
  ]);

  const targetIds = pending
    .map((r) => r.targetUserId)
    .filter((id, index, all) => all.indexOf(id) === index);
  const targetUsers = await Promise.all(targetIds.map((id) => getUser(id)));
  const targetNameById = new Map(
    targetUsers.filter((u) => u !== undefined).map((u) => [u.id, u.name]),
  );

  return {
    allUsers,
    allTasks: allTasks.filter((t) => t.id !== task.id),
    pendingRequests: pending.map((r) => ({
      request: r,
      targetName: targetNameById.get(r.targetUserId) ?? null,
    })),
  };
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

  const { allUsers, allTasks, pendingRequests } = await loadEditFormData(task);

  res.render("tareas/editar", {
    user: req.user,
    task,
    project,
    allUsers,
    allTasks,
    pendingRequests,
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
    const { allUsers, allTasks, pendingRequests } =
      await loadEditFormData(task);
    res.status(400).render("tareas/editar", {
      user: req.user,
      task,
      project,
      allUsers,
      allTasks,
      pendingRequests,
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

// Reasigna el destinatario de una solicitud de apoyo pendiente — para
// cuando esa cuenta fue desactivada/eliminada y la solicitud quedó sin
// nadie que la pueda resolver.
tasksEditRouter.post(
  "/tareas/:id/solicitudes/:requestId/reasignar",
  async (req, res) => {
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
        "solo el líder del proyecto o un admin pueden reasignar una solicitud",
      );
    }

    const parsed = reassignSupportRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "destinatario inválido");
    }

    const updated = await updateRequestTarget(
      req.params.requestId,
      parsed.data.targetUserId,
    );
    if (!updated) {
      throw new HttpError(404, "solicitud no encontrada");
    }

    res.redirect(303, `/tareas/${task.id}/editar`);
  },
);
