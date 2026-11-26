import { Router } from "express";
import {
  type DateRange,
  estimateVsActual,
  hoursByCollaborator,
  hoursByDay,
  hoursByPersonAndDay,
  hoursByProject,
  topTasksByHours,
} from "../db/tasks-repo.ts";
import { enumerateDays, seriesForDays } from "../domain/chart-data.ts";
import { isAdminRole } from "../domain/roles.ts";
import { toCsv } from "../lib/csv.ts";
import { HttpError } from "../lib/http-error.ts";

export const reportsRouter = Router();

type Rango = "dia" | "semana" | "mes";
const RANGOS: Rango[] = ["dia", "semana", "mes"];

function rangeFor(rango: Rango, today: string): DateRange {
  const date = new Date(`${today}T00:00:00`);
  if (rango === "dia") {
    return { from: today, to: today };
  }
  if (rango === "semana") {
    const from = new Date(date);
    from.setDate(from.getDate() - 6);
    return { from: from.toLocaleDateString("en-CA"), to: today };
  }
  const from = new Date(date.getFullYear(), date.getMonth(), 1);
  return { from: from.toLocaleDateString("en-CA"), to: today };
}

async function loadReport(rango: Rango) {
  const today = new Date().toLocaleDateString("en-CA");
  const range = rangeFor(rango, today);

  const [
    byProject,
    allTasks,
    byCollaborator,
    estimateVsReal,
    daily,
    byPersonDay,
  ] = await Promise.all([
    hoursByProject(range),
    topTasksByHours(range, 1000),
    hoursByCollaborator(range),
    estimateVsActual(),
    hoursByDay(range),
    hoursByPersonAndDay(range),
  ]);

  const totalHours = byProject.reduce((sum, p) => sum + p.hours, 0);

  const totalEstimate = estimateVsReal.reduce((sum, t) => sum + t.estimate, 0);
  const totalActual = estimateVsReal.reduce((sum, t) => sum + t.actual, 0);
  // % del presupuesto consumido (real/estimado) — coherente con la
  // diferencia real vs. estimado que se muestra al lado.
  const compliance =
    totalEstimate > 0 ? Math.round((totalActual / totalEstimate) * 100) : null;
  const variance = totalActual - totalEstimate;

  const days = enumerateDays(range.from, range.to);
  const dailyChart = {
    labels: days.map((d) => d.slice(5)),
    values: seriesForDays(days, daily),
  };

  const maxPersonDayHours = byPersonDay.reduce(
    (max, p) => Math.max(max, p.hours),
    0,
  );
  const heatmap = {
    days,
    maxHours: maxPersonDayHours,
    rows: Array.from(new Set(byPersonDay.map((p) => p.userId))).map(
      (userId) => {
        const name = byPersonDay.find((p) => p.userId === userId)?.name ?? "";
        return {
          name,
          cells: days.map(
            (day) =>
              byPersonDay.find((p) => p.userId === userId && p.date === day)
                ?.hours ?? 0,
          ),
        };
      },
    ),
  };

  return {
    range,
    totalHours,
    byProject,
    topTasks: allTasks.slice(0, 10),
    tasksWithHours: allTasks.length,
    byCollaborator,
    estimateVsReal,
    totalEstimate,
    totalActual,
    compliance,
    variance,
    dailyChart,
    heatmap,
  };
}

function parseRango(value: unknown): Rango {
  return RANGOS.includes(value as Rango) ? (value as Rango) : "semana";
}

reportsRouter.get("/productividad", async (req, res) => {
  if (!req.user) {
    res.redirect("/login");
    return;
  }
  if (!isAdminRole(req.user.role)) {
    throw new HttpError(403, "solo un admin puede ver este reporte");
  }

  const rango = parseRango(req.query.rango);
  const report = await loadReport(rango);

  res.render("productividad", { user: req.user, rango, ...report });
});

reportsRouter.get("/productividad/export.csv", async (req, res) => {
  if (!req.user) {
    res.redirect("/login");
    return;
  }
  if (!isAdminRole(req.user.role)) {
    throw new HttpError(403, "solo un admin puede ver este reporte");
  }

  const rango = parseRango(req.query.rango);
  const report = await loadReport(rango);

  const csv = toCsv(report.byProject, [
    { header: "Proyecto", value: (r) => r.projectName },
    { header: "Horas", value: (r) => r.hours },
  ]);

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="productividad-${rango}.csv"`,
  );
  res.send(csv);
});
