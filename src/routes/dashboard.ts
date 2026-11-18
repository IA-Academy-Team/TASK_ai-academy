import { Router } from "express";
import { listRecent } from "../db/audit-repo.ts";
import { listProjects } from "../db/projects-repo.ts";
import {
  countAllByStatus,
  countOverdueForOwner,
  countTasksForOwner,
  hoursByDay,
  listTasksForOwner,
} from "../db/tasks-repo.ts";
import { enumerateDays, seriesForDays } from "../domain/chart-data.ts";
import {
  activityIconKind,
  formatActivity,
  timeAgo,
} from "../lib/activity-format.ts";

export const dashboardRouter = Router();

const HOURS_WINDOW_DAYS = 14;

interface KpiProjectRow {
  code: string;
  name: string;
  leaderName: string;
}

// Agrupa filas de listTasksForOwner por proyecto (o "independiente") para
// los modales de los KPI del dashboard — un proyecto aparece una sola vez
// aunque tenga varias tareas en el bucket.
function projectSummaryFromTasks(
  rows: Awaited<ReturnType<typeof listTasksForOwner>>,
  leaderNameByProjectId: Map<string, string>,
): KpiProjectRow[] {
  const byKey = new Map<string, KpiProjectRow>();
  for (const r of rows) {
    const key = r.task.projectId ?? "independiente";
    if (byKey.has(key)) continue;
    byKey.set(
      key,
      r.task.projectId
        ? {
            code: r.projectCode ?? "",
            name: r.projectName ?? "",
            leaderName: leaderNameByProjectId.get(r.task.projectId) ?? "",
          }
        : { code: "", name: "Tareas independientes", leaderName: "—" },
    );
  }
  return [...byKey.values()];
}

dashboardRouter.get("/", async (req, res) => {
  if (!req.user) {
    res.redirect("/login");
    return;
  }

  // En hora local, no UTC: toISOString() adelanta la fecha varias horas antes
  // de la medianoche local, marcando tareas "vencidas" de más.
  const today = new Date().toLocaleDateString("en-CA");
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - (HOURS_WINDOW_DAYS - 1));
  const from = windowStart.toLocaleDateString("en-CA");

  const [
    myActiveTasksCount,
    myOverdueTasksCount,
    activity,
    statusCounts,
    dailyHours,
    ownedTasks,
    allProjects,
  ] = await Promise.all([
    countTasksForOwner(req.user.id, ["activa", "revision"]),
    countOverdueForOwner(req.user.id, today),
    listRecent(8),
    countAllByStatus(),
    hoursByDay({ from, to: today }),
    listTasksForOwner(req.user.id),
    listProjects(),
  ]);

  const hoursDays = enumerateDays(from, today);

  const leaderNameByProjectId = new Map(
    allProjects.map((p) => [p.id, p.leaderName]),
  );
  const activeProjectsList = allProjects
    .filter((p) => p.status === "activo")
    .map((p) => ({ code: p.code, name: p.name, leaderName: p.leaderName }));
  const myActiveTaskRows = ownedTasks.filter((r) =>
    ["activa", "revision"].includes(r.task.status),
  );
  const myOverdueTaskRows = ownedTasks.filter(
    (r) =>
      r.task.due < today &&
      !["completada", "cancelada"].includes(r.task.status),
  );

  res.render("inicio", {
    user: req.user,
    activeProjects: activeProjectsList.length,
    myActiveTasks: myActiveTasksCount,
    myOverdueTasks: myOverdueTasksCount,
    kpiProjects: activeProjectsList,
    kpiMyActiveProjects: projectSummaryFromTasks(
      myActiveTaskRows,
      leaderNameByProjectId,
    ),
    kpiMyOverdueProjects: projectSummaryFromTasks(
      myOverdueTaskRows,
      leaderNameByProjectId,
    ),
    activity: activity.map((a) => ({
      icon: activityIconKind(a.action),
      text: formatActivity(a),
      when: timeAgo(a.createdAt),
    })),
    statusCounts,
    hoursChart: {
      labels: hoursDays.map((d) => d.slice(5)),
      values: seriesForDays(hoursDays, dailyHours),
    },
  });
});
