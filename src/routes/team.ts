import { Router } from "express";
import {
  listTasksForOwner,
  listTasksForSupport,
  teamLoad,
} from "../db/tasks-repo.ts";
import { capacityThreshold } from "../domain/chart-data.ts";
import { HttpError } from "../lib/http-error.ts";

export const teamRouter = Router();

teamRouter.get("/equipo", async (req, res) => {
  if (!req.user) {
    res.redirect("/login");
    return;
  }

  const base = await teamLoad();
  const rows = base.map((r) => ({
    ...r,
    loadPct: r.weeklyCapacityHours
      ? Math.min(100, Math.round((r.openHours / r.weeklyCapacityHours) * 100))
      : 0,
    threshold: capacityThreshold(r.openHours, r.weeklyCapacityHours),
  }));

  res.render("equipo", {
    user: req.user,
    rows,
  });
});

interface PersonProjectDetail {
  id: string;
  code: string;
  name: string;
  tasks: {
    id: string;
    title: string;
    status: string;
    priority: string;
    due: string;
    role: "owner" | "apoyo";
  }[];
}

teamRouter.get("/equipo/:userId/detalle", async (req, res) => {
  if (!req.user) {
    throw new HttpError(401, "no autenticado");
  }

  const [owned, support] = await Promise.all([
    listTasksForOwner(req.params.userId),
    listTasksForSupport(req.params.userId),
  ]);

  const byProject = new Map<string, PersonProjectDetail>();
  const independent: PersonProjectDetail["tasks"] = [];

  function add(
    row: {
      task: (typeof owned)[number]["task"];
      projectName: string | null;
      projectCode: string | null;
    },
    role: "owner" | "apoyo",
  ) {
    const entry = {
      id: row.task.id,
      title: row.task.title,
      status: row.task.status,
      priority: row.task.priority,
      due: row.task.due,
      role,
    };
    if (!row.task.projectId) {
      independent.push(entry);
      return;
    }
    const existing = byProject.get(row.task.projectId);
    if (existing) {
      existing.tasks.push(entry);
    } else {
      byProject.set(row.task.projectId, {
        id: row.task.projectId,
        code: row.projectCode ?? "",
        name: row.projectName ?? "",
        tasks: [entry],
      });
    }
  }

  owned.forEach((row) => {
    add(row, "owner");
  });
  support.forEach((row) => {
    add(row, "apoyo");
  });

  const projects = [...byProject.values()];
  if (independent.length > 0) {
    projects.push({
      id: "independiente",
      code: "",
      name: "Tareas independientes",
      tasks: independent,
    });
  }

  res.json({ projects });
});
