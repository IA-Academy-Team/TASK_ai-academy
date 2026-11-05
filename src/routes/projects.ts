import { Router } from "express";
import {
  createProject,
  getProject,
  listAllActiveUsers,
  listMembers,
  listProjects,
  setMembers,
  updateSettings,
} from "../db/projects-repo.ts";
import {
  countByStatus,
  createTask,
  listTasksByProject,
} from "../db/tasks-repo.ts";
import { HttpError } from "../lib/http-error.ts";
import { authorize } from "../middleware/authorize.ts";
import {
  createProjectSchema,
  toArray,
  updateSettingsSchema,
} from "../schemas/project.ts";
import { createTaskSchema, statusEnum } from "../schemas/task.ts";

export const projectsRouter = Router();

projectsRouter.get("/proyectos", async (req, res) => {
  if (!req.user) {
    res.redirect("/login");
    return;
  }
  const items = await listProjects();
  res.render("proyectos/index", { items, user: req.user });
});

projectsRouter.get("/proyectos/nuevo", authorize("admin"), async (req, res) => {
  const users = await listAllActiveUsers();
  res.render("proyectos/nuevo", { users, user: req.user, error: null });
});

projectsRouter.post("/proyectos", authorize("admin"), async (req, res) => {
  const parsed = createProjectSchema.safeParse(req.body);
  if (!parsed.success) {
    const users = await listAllActiveUsers();
    res.status(400).render("proyectos/nuevo", {
      users,
      user: req.user,
      error: "Revisá los campos obligatorios del proyecto.",
    });
    return;
  }

  const project = await createProject({
    name: parsed.data.name,
    code: parsed.data.code,
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
  const tasksView = estadoParsed.data
    ? allTasks.filter((t) => t.status === estadoParsed.data)
    : allTasks;

  const members = await listMembers(project.id);
  const allUsers = await listAllActiveUsers();
  const activeCount = await countByStatus(project.id, "activa");
  const reviewCount = await countByStatus(project.id, "revision");

  res.render("proyectos/detalle", {
    project,
    tasks: tasksView,
    allTasks,
    members,
    allUsers,
    activeCount,
    reviewCount,
    estado: estadoParsed.data ?? null,
    user: req.user,
    isLeaderOrAdmin:
      req.user.role === "admin" || req.user.id === project.leaderId,
    error: null,
  });
});

projectsRouter.post("/proyectos/:id/tareas", async (req, res) => {
  if (!req.user) {
    res.redirect("/login");
    return;
  }

  const project = await getProject(req.params.id);
  if (!project) {
    throw new HttpError(404, "proyecto no encontrado");
  }

  const parsed = createTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    const allTasks = await listTasksByProject(project.id);
    const members = await listMembers(project.id);
    const allUsers = await listAllActiveUsers();
    res.status(400).render("proyectos/detalle", {
      project,
      tasks: allTasks,
      allTasks,
      members,
      allUsers,
      activeCount: await countByStatus(project.id, "activa"),
      reviewCount: await countByStatus(project.id, "revision"),
      estado: null,
      user: req.user,
      isLeaderOrAdmin:
        req.user.role === "admin" || req.user.id === project.leaderId,
      error: "Revisá los campos obligatorios de la tarea.",
    });
    return;
  }

  await createTask({
    projectId: project.id,
    title: parsed.data.title,
    deliverable: parsed.data.deliverable,
    description: parsed.data.description,
    ownerId: parsed.data.ownerId,
    priority: parsed.data.priority,
    weight: parsed.data.weight,
    estimate: String(parsed.data.estimate),
    dependencyId: parsed.data.dependencyId,
    due: parsed.data.due,
    supportIds: toArray(parsed.data.support),
    actorId: req.user.id,
  });

  res.redirect(303, `/proyectos/${project.id}`);
});

projectsRouter.post("/proyectos/:id/config", async (req, res) => {
  if (!req.user) {
    res.redirect("/login");
    return;
  }

  const project = await getProject(req.params.id);
  if (!project) {
    throw new HttpError(404, "proyecto no encontrado");
  }

  if (req.user.role !== "admin" && req.user.id !== project.leaderId) {
    throw new HttpError(
      403,
      "solo el líder del proyecto o un admin pueden editar la configuración",
    );
  }

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

  res.redirect(303, `/proyectos/${project.id}`);
});
