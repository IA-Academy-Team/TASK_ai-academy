import { Router } from "express";
import {
  getProject,
  listAllActiveUsers,
  listProjects,
} from "../db/projects-repo.ts";
import {
  createTask,
  listTasksByProject,
  listTasksWithoutProject,
} from "../db/tasks-repo.ts";
import { isAdminRole } from "../domain/roles.ts";
import { HttpError } from "../lib/http-error.ts";
import { toArray } from "../schemas/project.ts";
import { createTaskSchema } from "../schemas/task.ts";

export const tasksCreateRouter = Router();

function isLeaderOrAdmin(
  user: { id: string; role: string },
  project: { leaderId: string } | undefined,
): boolean {
  return isAdminRole(user.role) || (!!project && user.id === project.leaderId);
}

tasksCreateRouter.get("/tareas/nueva", async (req, res) => {
  if (!req.user) {
    res.redirect("/login");
    return;
  }

  const projectParam =
    typeof req.query.project === "string" ? req.query.project : null;
  const pickingProject = req.query.tipo === "proyecto";
  const error = req.query.error === "1";

  if (!projectParam) {
    const projects = pickingProject ? await listProjects() : [];
    res.render("tareas/nueva", {
      user: req.user,
      project: null,
      independent: false,
      pickingProject,
      allUsers: [],
      allTasks: [],
      projects,
      error,
    });
    return;
  }

  if (projectParam === "independent") {
    const [allUsers, allTasks] = await Promise.all([
      listAllActiveUsers(),
      listTasksWithoutProject(),
    ]);
    res.render("tareas/nueva", {
      user: req.user,
      project: null,
      independent: true,
      allUsers,
      allTasks,
      projects: [],
      error,
    });
    return;
  }

  const project = await getProject(projectParam);
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
    independent: false,
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

  const projectIdRaw =
    typeof req.body.projectId === "string" ? req.body.projectId : "";
  const isIndependent = projectIdRaw === "";

  const parsed = createTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    res.redirect(
      303,
      `/tareas/nueva?project=${isIndependent ? "independent" : projectIdRaw}&error=1`,
    );
    return;
  }

  let project: Awaited<ReturnType<typeof getProject>>;
  if (!isIndependent) {
    project = await getProject(projectIdRaw);
    if (!project) {
      throw new HttpError(404, "proyecto no encontrado");
    }
    if (!isLeaderOrAdmin(req.user, project)) {
      throw new HttpError(
        403,
        "solo el líder del proyecto o un admin pueden crear tareas",
      );
    }
  }

  // Sin proyecto no hay líder que delegue el responsable — una tarea
  // independiente creada por un usuario siempre es para una misma. Un admin
  // sí puede elegir responsable aunque la tarea sea independiente.
  const ownerId =
    isIndependent && !isAdminRole(req.user.role)
      ? req.user.id
      : parsed.data.ownerId;

  await createTask({
    projectId: isIndependent ? null : (project?.id ?? null),
    title: parsed.data.title,
    deliverable: parsed.data.deliverable,
    description: parsed.data.description,
    ownerId,
    priority: parsed.data.priority,
    weight: 1,
    estimate: String(parsed.data.estimate),
    dependencyId: null,
    due: parsed.data.due,
    dueTime: parsed.data.dueTime,
    supportIds: toArray(parsed.data.support),
    actorId: req.user.id,
  });

  res.redirect(
    303,
    isIndependent ? "/mis-tareas" : `/proyectos/${project?.id}`,
  );
});
