import { Router } from "express";
import {
  createProjectWithCode,
  deleteProject,
  getProject,
  listAllActiveUsers,
  listMembers,
  listProjects,
} from "../db/projects-repo.ts";
import {
  countByStatus,
  listLogsByTaskIds,
  listSupportUserIdsByTaskIds,
  listTasksByProject,
} from "../db/tasks-repo.ts";
import {
  openHoursRemaining,
  plannedBudget,
  projectStats,
  weightedProgress,
} from "../domain/hours.ts";
import { projectRiskInfo } from "../domain/project-risk.ts";
import { ADMIN_ROLE, isAdminRole } from "../domain/roles.ts";
import { HttpError } from "../lib/http-error.ts";
import { authorize } from "../middleware/authorize.ts";
import { createProjectSchema, toArray } from "../schemas/project.ts";
import { statusEnum } from "../schemas/task.ts";

export const projectsRouter = Router();

projectsRouter.get("/proyectos", async (req, res) => {
  if (!req.user) {
    res.redirect("/login");
    return;
  }
  const today = new Date().toLocaleDateString("en-CA");
  const [rows, users] = await Promise.all([
    listProjects(),
    listAllActiveUsers(),
  ]);
  const items = rows.map((p) => {
    const logsByTask = new Map<string, { hours: string }[]>();
    for (const log of p.logs) {
      const forTask = logsByTask.get(log.taskId) ?? [];
      forTask.push({ hours: log.hours });
      logsByTask.set(log.taskId, forTask);
    }
    const statsItems = p.tasks.map((t) => ({
      task: { status: t.status, estimate: t.estimate, weight: t.weight },
      logs: logsByTask.get(t.id) ?? [],
    }));

    return {
      ...p,
      risk: projectRiskInfo(p, today),
      weightedPct: weightedProgress(p.tasks),
      budget: plannedBudget(p.tasks),
      stats: projectStats(statsItems),
    };
  });
  res.render("proyectos/index", {
    items,
    users,
    user: req.user,
    openNewProjectModal: req.query.error === "1",
    error:
      req.query.error === "1"
        ? "Revisa los campos obligatorios del proyecto."
        : null,
  });
});

projectsRouter.post("/proyectos", authorize(ADMIN_ROLE), async (req, res) => {
  const parsed = createProjectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.redirect(303, "/proyectos?error=1");
    return;
  }

  const project = await createProjectWithCode({
    name: parsed.data.name,
    objective: parsed.data.objective,
    leaderId: parsed.data.leaderId,
    start: parsed.data.start,
    due: parsed.data.due,
    limitActive: parsed.data.limitActive,
    limitReview: parsed.data.limitReview,
    memberIds: toArray(parsed.data.members),
  });

  res.redirect(303, `/proyectos/${project.id}`);
});

projectsRouter.post(
  "/proyectos/:id/eliminar",
  authorize(ADMIN_ROLE),
  async (req, res) => {
    const project = await getProject(String(req.params.id));
    if (!project) {
      throw new HttpError(404, "proyecto no encontrado");
    }
    await deleteProject(project.id);
    res.redirect(303, "/proyectos");
  },
);

projectsRouter.get("/proyectos/:id", async (req, res) => {
  if (!req.user) {
    res.redirect("/login");
    return;
  }

  const project = await getProject(req.params.id);
  if (!project) {
    throw new HttpError(404, "proyecto no encontrado");
  }

  const estadoParsed = statusEnum
    .optional()
    .safeParse(req.query.estado || undefined);
  if (!estadoParsed.success) {
    throw new HttpError(400, "estado inválido");
  }

  const allTasks = await listTasksByProject(project.id);

  const members = await listMembers(project.id);
  const allUsers = await listAllActiveUsers();
  const leader = allUsers.find((u) => u.id === project.leaderId) ?? null;
  const activeCount = await countByStatus(project.id, "activa");
  const reviewCount = await countByStatus(project.id, "revision");

  // Carga por persona: tareas abiertas (sin contar completadas/canceladas) y
  // lo que falta por registrar sobre su estimado — misma definición que
  // "Equipo y cargas" (ver teamLoad), acotada a este proyecto.
  const candidates = leader
    ? [leader, ...members.filter((m) => m.id !== leader.id)]
    : members;
  const openTasks = allTasks.filter(
    (t) => t.status !== "completada" && t.status !== "cancelada",
  );
  const openLogsByTask = await listLogsByTaskIds(openTasks.map((t) => t.id));
  const peopleLoad = candidates.map((person) => {
    const personOpenTasks = openTasks.filter((t) => t.ownerId === person.id);
    const openHours = openHoursRemaining(
      personOpenTasks.map((t) => ({
        estimate: t.estimate,
        logs: openLogsByTask.get(t.id) ?? [],
      })),
    );
    return {
      id: person.id,
      name: person.name,
      color: person.color,
      isLeader: person.id === project.leaderId,
      taskCount: personOpenTasks.length,
      openHours,
    };
  });

  const responsableRaw = req.query.responsable;
  const responsableIds = Array.isArray(responsableRaw)
    ? responsableRaw.filter((v): v is string => typeof v === "string")
    : typeof responsableRaw === "string" && responsableRaw
      ? [responsableRaw]
      : [];
  const responsableFilter = responsableIds.filter((id) =>
    candidates.some((p) => p.id === id),
  );

  let tasksView = estadoParsed.data
    ? allTasks.filter((t) => t.status === estadoParsed.data)
    : allTasks;
  if (responsableFilter.length > 0) {
    tasksView = tasksView.filter((t) => responsableFilter.includes(t.ownerId));
  }

  const supportByTask = await listSupportUserIdsByTaskIds(
    tasksView.map((t) => t.id),
  );
  const supportTaskIdsForUser = new Set(
    [...supportByTask.entries()]
      .filter(([, userIds]) => userIds.includes(req.user?.id ?? ""))
      .map(([taskId]) => taskId),
  );

  res.render("proyectos/detalle", {
    project,
    tasks: tasksView,
    supportTaskIdsForUser,
    allTasks,
    members,
    leader,
    allUsers,
    activeCount,
    reviewCount,
    estado: estadoParsed.data ?? null,
    peopleLoad,
    responsable: responsableFilter,
    user: req.user,
    isLeaderOrAdmin:
      isAdminRole(req.user.role) || req.user.id === project.leaderId,
    error: null,
  });
});
