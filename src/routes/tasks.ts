import { Router } from "express";
import { z } from "zod";
import {
  createTask,
  filterTasks,
  listTasks,
  updateStatus,
} from "../db/tasks-repo.ts";
import { createTaskSchema } from "../schemas/task.ts";

const statusEnum = z.enum(["pendiente", "en_progreso", "completada"]);

export const tasksRouter = Router();

tasksRouter.get("/tareas", async (req, res) => {
  if (!req.user) {
    res.redirect("/login");
    return;
  }

  const estadoParsed = statusEnum
    .optional()
    .safeParse(req.query.estado || undefined);
  if (!estadoParsed.success) {
    res.status(400).send("estado inválido");
    return;
  }

  const estado = estadoParsed.data;
  const tasks = estado ? await filterTasks(estado) : await listTasks();
  res.render("tareas/index", {
    tasks,
    estado: estado ?? null,
    user: req.user,
    error: null,
  });
});

tasksRouter.post("/tareas", async (req, res) => {
  if (!req.user) {
    res.redirect("/login");
    return;
  }

  const parsed = createTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    const tasks = await listTasks();
    res.status(400).render("tareas/index", {
      tasks,
      estado: null,
      user: req.user,
      error: "El título es obligatorio.",
    });
    return;
  }

  await createTask(parsed.data);
  res.redirect(303, "/tareas");
});

tasksRouter.post("/tareas/:id/estado", async (req, res) => {
  if (!req.user) {
    res.redirect("/login");
    return;
  }

  const parsed = statusEnum.safeParse(req.body.status);
  if (!parsed.success) {
    res.status(400).send("status inválido");
    return;
  }

  const updated = await updateStatus(req.params.id, parsed.data);
  if (!updated) {
    res.status(404).send("tarea no encontrada");
    return;
  }

  res.redirect(303, "/tareas");
});
