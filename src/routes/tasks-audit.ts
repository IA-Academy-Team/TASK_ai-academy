import { Router } from "express";
import { listByTaskEnriched } from "../db/audit-repo.ts";
import { getTask } from "../db/tasks-repo.ts";
import { HttpError } from "../lib/http-error.ts";

export const tasksAuditRouter = Router();

tasksAuditRouter.get("/tareas/:id/auditoria", async (req, res) => {
  if (!req.user) {
    res.redirect("/login");
    return;
  }

  const task = await getTask(req.params.id);
  if (!task) {
    throw new HttpError(404, "tarea no encontrada");
  }

  const changes = await listByTaskEnriched(task.id);

  res.render("tareas/auditoria", {
    user: req.user,
    task,
    changes,
  });
});
