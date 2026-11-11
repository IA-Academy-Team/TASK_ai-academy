import { Router } from "express";
import {
  createProject,
  deleteProject,
  generateProjectCode,
  getProject,
  listAllActiveUsers,
  listMembers,
  listProjects,
} from "../db/projects-repo.ts";
import {
  countByStatus,
  listLogs,
  listTasksByProject,
} from "../db/tasks-repo.ts";
import {
  declaredHours,
  plannedBudget,
  projectStats,
  weightedProgress,
} from "../domain/hours.ts";
import { projectRiskInfo } from "../domain/project-risk.ts";
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

projectsRouter.post("/proyectos", authorize("admin"), async (req, res) => {
  const parsed = createProjectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.redirect(303, "/proyectos?error=1");
    return;
  }

  const code = await generateProjectCode(parsed.data.name);
  const project = await createProject({
    name: parsed.data.name,
    code,
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
  authorize("admin"),
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
  // horas ya declaradas sobre esas tareas — misma definición que "Equipo y
  // cargas", pero acotada a este proyecto.
  const candidates = leader
    ? [leader, ...members.filter((m) => m.id !== leader.id)]
    : members;
  const openTasks = allTasks.filter(
    (t) => t.status !== "completada" && t.status !== "cancelada",
  );
  const openLogsByTask = new Map<string, { hours: string }[]>();
  for (const t of openTasks) {
    openLogsByTask.set(t.id, await listLogs(t.id));
  }
  const peopleLoad = candidates.map((person) => {
    const personOpenTasks = openTasks.filter((t) => t.ownerId === person.id);
    const openHours = personOpenTasks.reduce(
      (sum, t) => sum + declaredHours(openLogsByTask.get(t.id) ?? []),
      0,
    );
    return {
      id: person.id,
      name: person.name,
      isLeader: person.id === project.leaderId,
      taskCount: personOpenTasks.length,
      openHours,
    };
  });

  const responsableFilter =
    typeof req.query.responsable === "string" &&
    candidates.some((p) => p.id === req.query.responsable)
      ? req.query.responsable
      : null;

  let tasksView = estadoParsed.data
    ? allTasks.filter((t) => t.status === estadoParsed.data)
    : allTasks;
  if (responsableFilter) {
    tasksView = tasksView.filter((t) => t.ownerId === responsableFilter);
  }

  res.render("proyectos/detalle", {
    project,
    tasks: tasksView,
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
      req.user.role === "admin" || req.user.id === project.leaderId,
    error: null,
  });
});
