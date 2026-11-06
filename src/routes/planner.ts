import { Router } from "express";
import { listAllActiveUsers, listProjects } from "../db/projects-repo.ts";
import { listTasksByProject } from "../db/tasks-repo.ts";

export const plannerRouter = Router();

function mondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toDateString(d: Date): string {
  return d.toLocaleDateString("en-CA");
}

plannerRouter.get("/planeacion", async (req, res) => {
  if (!req.user) {
    res.redirect("/login");
    return;
  }

  const weekOffset = Number.parseInt(String(req.query.semana ?? "0"), 10) || 0;
  const monday = mondayOf(new Date());
  monday.setDate(monday.getDate() + weekOffset * 7);
  const days = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return toDateString(d);
  });

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

  const byDay = days.map((day) => ({
    day,
    tasks: allTasks.filter(
      (t) =>
        t.due === day && t.status !== "cancelada" && t.status !== "completada",
    ),
  }));

  const capacity = await listAllActiveUsers();

  res.render("planeacion", {
    user: req.user,
    projects,
    projectFilter,
    weekOffset,
    byDay,
    capacity,
  });
});
