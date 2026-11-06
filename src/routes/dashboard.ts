import { Router } from "express";
import { listRecent } from "../db/audit-repo.ts";
import { countActiveProjects } from "../db/projects-repo.ts";
import {
  countAllByStatus,
  countOverdueForOwner,
  countTasksForOwner,
  hoursByDay,
} from "../db/tasks-repo.ts";
import { enumerateDays, seriesForDays } from "../domain/chart-data.ts";
import {
  activityIconKind,
  formatActivity,
  timeAgo,
} from "../lib/activity-format.ts";

export const dashboardRouter = Router();

const HOURS_WINDOW_DAYS = 14;

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
    activeProjects,
    myActiveTasks,
    myOverdueTasks,
    activity,
    statusCounts,
    dailyHours,
  ] = await Promise.all([
    countActiveProjects(),
    countTasksForOwner(req.user.id, ["activa", "revision"]),
    countOverdueForOwner(req.user.id, today),
    listRecent(8),
    countAllByStatus(),
    hoursByDay({ from, to: today }),
  ]);

  const hoursDays = enumerateDays(from, today);

  res.render("inicio", {
    user: req.user,
    activeProjects,
    myActiveTasks,
    myOverdueTasks,
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
