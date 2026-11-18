import { Router } from "express";
import { listAllActiveUsers, listProjects } from "../db/projects-repo.ts";
import {
  listTasksByProject,
  listTasksWithoutProject,
} from "../db/tasks-repo.ts";
import { groupTasksByColumn } from "../domain/kanban.ts";

export const plannerRouter = Router();

const MONTH_LABELS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

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

function weekRangeLabel(monday: Date, friday: Date): string {
  const sameMonth = monday.getMonth() === friday.getMonth();
  const start = `${monday.getDate()}${sameMonth ? "" : ` ${MONTH_LABELS[monday.getMonth()]}`}`;
  const end = `${friday.getDate()} ${MONTH_LABELS[friday.getMonth()]}`;
  return `${start} – ${end}`;
}

plannerRouter.get("/planeacion", async (req, res) => {
  if (!req.user) {
    res.redirect("/login");
    return;
  }

  const weekOffset = Number.parseInt(String(req.query.semana ?? "0"), 10) || 0;
  const monday = mondayOf(new Date());
  monday.setDate(monday.getDate() + weekOffset * 7);
  const friday = new Date(monday);
  friday.setDate(friday.getDate() + 4);
  const mondayStr = toDateString(monday);
  const fridayStr = toDateString(friday);

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

  // El plan semanal muestra solo lo que vence de lunes a viernes de la
  // semana elegida — el tablero sigue siendo por estado, esto solo acota
  // qué tareas entran a cada columna.
  const weekTasks = allTasks.filter(
    (t) => t.due >= mondayStr && t.due <= fridayStr,
  );

  const users = await listAllActiveUsers();
  const ownerNameById = new Map(users.map((u) => [u.id, u.name]));

  const columns = groupTasksByColumn(
    weekTasks.map((t) => ({
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
    weekOffset,
    weekLabel: weekRangeLabel(monday, friday),
  });
});
