import { Router } from "express";
import { listRecent } from "../db/audit-repo.ts";
import { countActiveProjects } from "../db/projects-repo.ts";
import { countOverdueForOwner, countTasksForOwner } from "../db/tasks-repo.ts";

export const dashboardRouter = Router();

dashboardRouter.get("/", async (req, res) => {
  if (!req.user) {
    res.redirect("/login");
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const [activeProjects, myActiveTasks, myOverdueTasks, activity] =
    await Promise.all([
      countActiveProjects(),
      countTasksForOwner(req.user.id, ["activa", "revision"]),
      countOverdueForOwner(req.user.id, today),
      listRecent(8),
    ]);

  res.render("inicio", {
    user: req.user,
    activeProjects,
    myActiveTasks,
    myOverdueTasks,
    activity,
  });
});
