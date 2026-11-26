import { Router } from "express";
import {
  getTask,
  listLogs,
  logHours,
  transitionTask,
} from "../db/tasks-repo.ts";
import { HttpError } from "../lib/http-error.ts";
import { deliverySchema } from "../schemas/task.ts";

export const tasksDeliveryRouter = Router();

tasksDeliveryRouter.get("/tareas/:id/entrega", async (req, res) => {
  if (!req.user) {
    res.redirect("/login");
    return;
  }

  const task = await getTask(req.params.id);
  if (!task) {
    throw new HttpError(404, "tarea no encontrada");
  }
  if (task.status !== "activa") {
    throw new HttpError(400, "solo se puede entregar una tarea activa");
  }

  const logs = await listLogs(task.id);

  res.render("tareas/entrega", {
    user: req.user,
    task,
    logs,
    error: null,
  });
});

tasksDeliveryRouter.post("/tareas/:id/entrega", async (req, res) => {
  if (!req.user) {
    res.redirect("/login");
    return;
  }

  const task = await getTask(req.params.id);
  if (!task) {
    throw new HttpError(404, "tarea no encontrada");
  }

  const parsed = deliverySchema.safeParse(req.body);
  if (!parsed.success) {
    const logs = await listLogs(task.id);
    res.status(400).render("tareas/entrega", {
      user: req.user,
      task,
      logs,
      error: "Completa la fecha, las horas y la evidencia de la entrega.",
    });
    return;
  }

  await logHours({
    taskId: task.id,
    userId: req.user.id,
    role: req.user.id === task.ownerId ? "owner" : "support",
    date: parsed.data.date,
    hours: String(parsed.data.hours),
    description: parsed.data.evidence,
  });

  await transitionTask(task.id, "revision", req.user.id, {
    evidence: parsed.data.evidence,
  });

  res.redirect(303, `/tareas/${task.id}`);
});
