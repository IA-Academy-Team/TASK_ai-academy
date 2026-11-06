import { Router } from "express";
import { listAllActiveUsers, listProjects } from "../db/projects-repo.ts";
import { listTasksByProject } from "../db/tasks-repo.ts";
import { layoutDayBlocks } from "../domain/week-calendar.ts";

export const plannerRouter = Router();

const CALENDAR_START_HOUR = 8;
const CALENDAR_END_HOUR = 18;
const CALENDAR_HOURS = Array.from(
  { length: CALENDAR_END_HOUR - CALENDAR_START_HOUR },
  (_, i) => CALENDAR_START_HOUR + i,
);

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
    }));
    return {
      day,
      label: dayLabel(d, i),
      tasks: dayTasks,
      totalEstimate: dayTasks.reduce((sum, t) => sum + Number(t.estimate), 0),
      blocks: layoutDayBlocks(calendarTasks),
    };
  });
  const maxEstimate = Math.max(...byDayRaw.map((d) => d.totalEstimate), 1);
  const calendarHours = Math.max(
    CALENDAR_HOURS.length,
    ...byDayRaw.map((d) => d.totalEstimate),
  );
  const byDay = byDayRaw.map((d) => ({
    ...d,
    loadPct: Math.round((d.totalEstimate / maxEstimate) * 100),
  }));

  const capacity = await listAllActiveUsers();

  res.render("planeacion", {
    user: req.user,
    projects,
    projectFilter,
    weekOffset,
    byDay,
    today: toDateString(new Date()),
    capacity,
    calendarHourLabels: CALENDAR_HOURS,
    calendarHeight: calendarHours,
  });
});
