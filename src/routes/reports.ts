import { Router } from "express";
import {
  type DateRange,
  estimateVsActual,
  hoursByCollaborator,
  hoursByProject,
  topTasksByHours,
} from "../db/tasks-repo.ts";
import { toCsv } from "../lib/csv.ts";

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

  const [byProject, allTasks, byCollaborator, estimateVsReal] =
    await Promise.all([
      hoursByProject(range),
      topTasksByHours(range, 1000),
      hoursByCollaborator(range),
      estimateVsActual(),
    ]);

  const totalHours = byProject.reduce((sum, p) => sum + p.hours, 0);

  return {
    range,
    totalHours,
    byProject,
    topTasks: allTasks.slice(0, 10),
    tasksWithHours: allTasks.length,
    byCollaborator,
    estimateVsReal,
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

  const rango = parseRango(req.query.rango);
  const report = await loadReport(rango);

  res.render("productividad", { user: req.user, rango, ...report });
});

reportsRouter.get("/productividad/export.csv", async (req, res) => {
  if (!req.user) {
    res.redirect("/login");
    return;
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
