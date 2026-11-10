import { Router } from "express";
import {
  getProject,
  listAllActiveUsers,
  listProjects,
} from "../db/projects-repo.ts";
import { createTask, listTasksByProject } from "../db/tasks-repo.ts";
import { HttpError } from "../lib/http-error.ts";
import { toArray } from "../schemas/project.ts";
import { createTaskSchema } from "../schemas/task.ts";

export const tasksCreateRouter = Router();

function isLeaderOrAdmin(
  user: { id: string; role: string },
  project: { leaderId: string } | undefined,
): boolean {
  return user.role === "admin" || (!!project && user.id === project.leaderId);
}

tasksCreateRouter.get("/tareas/nueva", async (req, res) => {
  if (!req.user) {
    res.redirect("/login");
    return;
  }

  const projectId =
    typeof req.query.project === "string" ? req.query.project : null;
  const error = req.query.error === "1";

  if (!projectId) {
    const projects = await listProjects();
    res.render("tareas/nueva", {
      user: req.user,
      project: null,
      allUsers: [],
      allTasks: [],
      projects,
      error,
    });
    return;
  }

  const project = await getProject(projectId);
  if (!project) {
    throw new HttpError(404, "proyecto no encontrado");
  }

  const [allUsers, allTasks] = await Promise.all([
    listAllActiveUsers(),
    listTasksByProject(project.id),
  ]);

  res.render("tareas/nueva", {
    user: req.user,
    project,
    allUsers,
    allTasks,
    projects: [],
    error,
  });
});

tasksCreateRouter.post("/tareas", async (req, res) => {
  if (!req.user) {
    res.redirect("/login");
    return;
  }

  const projectId =
    typeof req.body.projectId === "string" ? req.body.projectId : "";
  const parsed = createTaskSchema.safeParse(req.body);
  if (!projectId || !parsed.success) {
    res.redirect(303, `/tareas/nueva?project=${projectId}&error=1`);
    return;
  }

  const project = await getProject(projectId);
  if (!project) {
    throw new HttpError(404, "proyecto no encontrado");
  }
  if (!isLeaderOrAdmin(req.user, project)) {
    throw new HttpError(
      403,
      "solo el líder del proyecto o un admin pueden crear tareas",
    );
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
