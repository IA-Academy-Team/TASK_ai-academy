import { Router } from "express";
import {
  createProject,
  getProject,
  listAllActiveUsers,
  listMembers,
  listProjects,
} from "../db/projects-repo.ts";
import { countByStatus, listTasksByProject } from "../db/tasks-repo.ts";
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
  const rows = await listProjects();
  const items = rows.map((p) => ({ ...p, risk: projectRiskInfo(p, today) }));
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
      error: "Revisa los campos obligatorios del proyecto.",
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
