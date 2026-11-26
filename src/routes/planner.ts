import { Router } from "express";
import { listAllActiveUsers, listProjects } from "../db/projects-repo.ts";
import {
  listSupportUserIdsByTaskIds,
  listTasksByProject,
  listTasksWithoutProject,
  teamLoad,
} from "../db/tasks-repo.ts";
import { fridayOf, mondayOf, toDateString } from "../domain/dates.ts";
import { isAdminRole } from "../domain/roles.ts";
import { groupTasksByWeekday } from "../domain/week-plan.ts";

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
  const friday = fridayOf(monday);
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

  // El plan semanal muestra las tareas planificadas de lunes a viernes
  // y las distribuye por fecha para que el equipo vea la carga de cada día.
  const rawWeekTasks = allTasks.filter(
    (t) => t.due >= mondayStr && t.due <= fridayStr,
  );

  // Un admin o el líder de un proyecto ve toda la carga del equipo; el resto
  // solo ve las tareas en las que es responsable o apoyo.
  const leaderProjectIds = new Set(
    projects.filter((p) => p.leaderId === req.user?.id).map((p) => p.id),
  );
  const weekSupportByTask = await listSupportUserIdsByTaskIds(
    rawWeekTasks.map((t) => t.id),
  );
  const weekTasks = isAdminRole(req.user.role)
    ? rawWeekTasks
    : rawWeekTasks.filter(
        (t) =>
          t.ownerId === req.user?.id ||
          (t.projectId && leaderProjectIds.has(t.projectId)) ||
          (weekSupportByTask.get(t.id) ?? []).includes(req.user?.id ?? ""),
      );

  const [users, teamCapacity] = await Promise.all([
    listAllActiveUsers(),
    teamLoad({ from: mondayStr, to: fridayStr }),
  ]);
  const ownerNameById = new Map(users.map((u) => [u.id, u.name]));
  const ownerColorById = new Map(users.map((u) => [u.id, u.color]));

  const days = groupTasksByWeekday(
    weekTasks.map((t) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      status: t.status,
      due: t.due,
      estimate: Number(t.estimate),
      ownerName: ownerNameById.get(t.ownerId) ?? "",
      ownerColor: ownerColorById.get(t.ownerId) ?? "#7346CC",
    })),
    mondayStr,
  );

  res.render("planeacion", {
    user: req.user,
    projects,
    projectFilter,
    days,
    weekOffset,
    weekLabel: weekRangeLabel(monday, friday),
    teamCapacity: teamCapacity.map((person) => ({
      ...person,
      loadPct: person.weeklyCapacityHours
        ? Math.min(
            100,
            Math.round((person.openHours / person.weeklyCapacityHours) * 100),
          )
        : 0,
    })),
  });
});
