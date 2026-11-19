import { Router } from "express";
import { listProjects } from "../db/projects-repo.ts";
import {
  countAllByStatus,
  countOverdueForOwner,
  countTasksForOwner,
  hoursByDay,
  listTasksForOwner,
} from "../db/tasks-repo.ts";
import { projectSummaryFromTasks } from "../domain/dashboard-summary.ts";

export const dashboardRouter = Router();

dashboardRouter.get("/", async (req, res) => {
  if (!req.user) {
    res.redirect("/login");
    return;
  }

  // En hora local, no UTC: toISOString() adelanta la fecha varias horas antes
  // de la medianoche local, marcando tareas "vencidas" de más.
  const today = new Date().toLocaleDateString("en-CA");
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const weekFrom = weekStart.toLocaleDateString("en-CA");

  const [
    myActiveTasksCount,
    myOverdueTasksCount,
    statusCounts,
    weeklyHours,
    ownedTasks,
    allProjects,
  ] = await Promise.all([
    countTasksForOwner(req.user.id, ["activa", "revision"]),
    countOverdueForOwner(req.user.id, today),
    countAllByStatus(),
    hoursByDay({ from: weekFrom, to: today }),
    listTasksForOwner(req.user.id),
    listProjects(),
  ]);

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
  const allProjectTasks = allProjects.flatMap((project) => project.tasks);
  const completedTasks = statusCounts.completada ?? 0;
  const urgentOrOverdueTasks = allProjectTasks.filter(
    (task) =>
      !["completada", "cancelada"].includes(task.status) &&
      (task.due < today || ["alta", "critica"].includes(task.priority)),
  ).length;
  const confirmedWeekHours = weeklyHours.reduce(
    (total, sample) => total + sample.hours,
    0,
  );
  const projectProgress = allProjects
    .filter((project) => project.status === "activo")
    .map((project) => {
      const totalWeight = project.tasks.reduce(
        (total, task) => total + task.weight,
        0,
      );
      const completedWeight = project.tasks
        .filter((task) => task.status === "completada")
        .reduce((total, task) => total + task.weight, 0);
      const estimatedHours = project.tasks.reduce(
        (total, task) => total + Number(task.estimate),
        0,
      );
      const loggedHours = project.logs.reduce(
        (total, log) => total + Number(log.hours),
        0,
      );
      return {
        id: project.id,
        code: project.code,
        name: project.name,
        taskCount: project.taskCount,
        doneCount: project.doneCount,
        completedWeight,
        totalWeight,
        estimatedHours,
        loggedHours,
        progress:
          totalWeight === 0
            ? 0
            : Math.round((completedWeight / totalWeight) * 100),
      };
    })
    .slice(0, 4);
  const priorityTasks = ownedTasks
    .filter((row) => !["completada", "cancelada"].includes(row.task.status))
    .sort((a, b) => {
      const urgencyA =
        a.task.due < today
          ? 0
          : a.task.priority === "critica"
            ? 1
            : a.task.priority === "alta"
              ? 2
              : 3;
      const urgencyB =
        b.task.due < today
          ? 0
          : b.task.priority === "critica"
            ? 1
            : b.task.priority === "alta"
              ? 2
              : 3;
      return urgencyA - urgencyB || a.task.due.localeCompare(b.task.due);
    })
    .slice(0, 4)
    .map((row) => ({
      id: row.task.id,
      title: row.task.title,
      due: row.task.due,
      status: row.task.status,
      priority: row.task.priority,
      projectName: row.projectName ?? "Tarea independiente",
    }));

  res.render("inicio", {
    user: req.user,
    activeProjects: activeProjectsList.length,
    myActiveTasks: myActiveTasksCount,
    myOverdueTasks: myOverdueTasksCount,
    completedTasks,
    urgentOrOverdueTasks,
    confirmedWeekHours,
    projectProgress,
    priorityTasks,
    kpiProjects: activeProjectsList,
    kpiMyActiveProjects: projectSummaryFromTasks(
      myActiveTaskRows,
      leaderNameByProjectId,
    ),
    kpiMyOverdueProjects: projectSummaryFromTasks(
      myOverdueTaskRows,
      leaderNameByProjectId,
    ),
  });
});
