import { Router } from "express";
import {
  DAILY_ESTIMATE_LIMIT_HOURS,
  listTasksForOwner,
  listTasksForSupport,
  teamLoad,
} from "../db/tasks-repo.ts";
import { capacityThreshold } from "../domain/chart-data.ts";
import {
  fridayOf,
  mondayOf,
  monthEndOf,
  monthStartOf,
  toDateString,
} from "../domain/dates.ts";
import { HttpError } from "../lib/http-error.ts";

export const teamRouter = Router();

const PERIODS = ["dia", "semana", "mes"] as const;
type Period = (typeof PERIODS)[number];

function isPeriod(value: string): value is Period {
  return (PERIODS as readonly string[]).includes(value);
}

// Rango de fechas de vencimiento para cada período del filtro de carga.
function periodDueRange(period: Period): { from: string; to: string } {
  const today = new Date();
  if (period === "dia") {
    const day = toDateString(today);
    return { from: day, to: day };
  }
  if (period === "mes") {
    return { from: monthStartOf(today), to: monthEndOf(today) };
  }
  const monday = mondayOf(today);
  return { from: toDateString(monday), to: toDateString(fridayOf(monday)) };
}

// Referencia de capacidad por período: el diario reusa el límite de 4h/día
// que ya rige el plan semanal; el semanal usa la capacidad configurada por
// persona; el mensual la aproxima a 4 semanas.
function capacityForPeriod(period: Period, weeklyCapacityHours: number) {
  if (period === "dia") return DAILY_ESTIMATE_LIMIT_HOURS;
  if (period === "mes") return weeklyCapacityHours * 4;
  return weeklyCapacityHours;
}

teamRouter.get("/equipo", async (req, res) => {
  if (!req.user) {
    res.redirect("/login");
    return;
  }

  const periodRaw =
    typeof req.query.periodo === "string" ? req.query.periodo : "semana";
  const period: Period = isPeriod(periodRaw) ? periodRaw : "semana";

  const base = await teamLoad(periodDueRange(period));
  const rows = base.map((r) => {
    const capacity = capacityForPeriod(period, r.weeklyCapacityHours);
    return {
      ...r,
      capacity,
      loadPct: capacity
        ? Math.min(100, Math.round((r.openHours / capacity) * 100))
        : 0,
      threshold: capacityThreshold(r.openHours, capacity),
    };
  });
  const summary = {
    people: rows.length,
    pending: rows.reduce((total, row) => total + row.pending, 0),
    active: rows.reduce((total, row) => total + row.active, 0),
    openHours: rows.reduce((total, row) => total + row.openHours, 0),
  };

  res.render("equipo", {
    user: req.user,
    rows,
    period,
    summary,
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
