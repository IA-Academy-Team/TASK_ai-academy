import { Router } from "express";
import { listAllActiveUsers, listProjects } from "../db/projects-repo.ts";
import {
  listTasksByProject,
  listTasksWithoutProject,
} from "../db/tasks-repo.ts";
import { groupTasksByColumn } from "../domain/kanban.ts";

export const plannerRouter = Router();

plannerRouter.get("/planeacion", async (req, res) => {
  if (!req.user) {
    res.redirect("/login");
    return;
  }

  const projects = await listProjects();
  const projectFilter =
    typeof req.query.proyecto === "string" && req.query.proyecto
      ? req.query.proyecto
      : null;

  const projectsToLoad = projectFilter
    ? projects.filter((p) => p.id === projectFilter)
    : projects;

  const taskLists = await Promise.all(
    projectsToLoad.map((p) => listTasksByProject(p.id)),
  );
  const allTasks = taskLists.flat();
  // Las tareas independientes no pertenecen a ningún proyecto — se incluyen
  // siempre que no haya un filtro de proyecto activo.
  if (!projectFilter) {
    allTasks.push(...(await listTasksWithoutProject()));
  }

  const users = await listAllActiveUsers();
  const ownerNameById = new Map(users.map((u) => [u.id, u.name]));

  const columns = groupTasksByColumn(
    allTasks.map((t) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      status: t.status,
      due: t.due,
      estimate: Number(t.estimate),
      ownerName: ownerNameById.get(t.ownerId) ?? "",
    })),
  );

  res.render("planeacion", {
    user: req.user,
    projects,
    projectFilter,
    columns,
  });
});
