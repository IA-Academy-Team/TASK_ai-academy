import { Router } from "express";
import { listAllActiveUsers, listProjects } from "../db/projects-repo.ts";
import {
  listTasksByProject,
  listTasksWithoutProject,
} from "../db/tasks-repo.ts";
import {
  dayGridHeightPx,
  dayTotalHours,
  layoutDayBlocks,
  positionDayBlocks,
  timeAxisMarks,
  WORKDAY_HOURS,
} from "../domain/week-calendar.ts";

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

const WEEKDAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie"];
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

function dayLabel(d: Date, index: number): string {
  return `${WEEKDAY_LABELS[index]} ${d.getDate()} ${MONTH_LABELS[d.getMonth()]}`;
}

plannerRouter.get("/planeacion", async (req, res) => {
  if (!req.user) {
    res.redirect("/login");
    return;
  }

  const weekOffset = Number.parseInt(String(req.query.semana ?? "0"), 10) || 0;
  const monday = mondayOf(new Date());
  monday.setDate(monday.getDate() + weekOffset * 7);
  const dayDates = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return d;
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
  // Las tareas independientes no pertenecen a ningún proyecto — se incluyen
  // siempre que no haya un filtro de proyecto activo.
  if (!projectFilter) {
    allTasks.push(...(await listTasksWithoutProject()));
  }

  const capacity = await listAllActiveUsers();
  const ownerNameById = new Map(capacity.map((u) => [u.id, u.name]));

  const byDayRaw = dayDates.map((d, i) => {
    const day = toDateString(d);
    const dayTasks = allTasks.filter(
      (t) =>
        t.due === day && t.status !== "cancelada" && t.status !== "completada",
    );
    const calendarTasks = dayTasks.map((t) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      estimate: Number(t.estimate),
      ownerName: ownerNameById.get(t.ownerId) ?? "",
    }));
    const dayBlocks = layoutDayBlocks(calendarTasks);
    return {
      day,
      label: dayLabel(d, i),
      blocks: positionDayBlocks(dayBlocks),
      totalHours: dayTotalHours(dayBlocks),
    };
  });

  const gridHeight = Math.max(
    ...byDayRaw.map((d) => dayGridHeightPx(d.blocks)),
  );
  const overflowHours = Math.max(
    0,
    ...byDayRaw.map((d) => d.totalHours - WORKDAY_HOURS),
  );

  res.render("planeacion", {
    user: req.user,
    projects,
    projectFilter,
    weekOffset,
    byDay: byDayRaw,
    today: toDateString(new Date()),
    gridHeight,
    marks: timeAxisMarks(overflowHours),
  });
});
