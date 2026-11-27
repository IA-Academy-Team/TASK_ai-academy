export type ProjectRiskLevel = "done" | "risk" | "ok";

export interface ProjectForRisk {
  due: string;
  taskCount: number;
  doneCount: number;
}

export interface ProjectRiskInfo {
  level: ProjectRiskLevel;
  daysLeft: number;
}

const RISK_WINDOW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export function daysUntil(due: string, today: string): number {
  const dueDate = new Date(`${due}T00:00:00`);
  const todayDate = new Date(`${today}T00:00:00`);
  return Math.round((dueDate.getTime() - todayDate.getTime()) / DAY_MS);
}

export function projectRiskInfo(
  project: ProjectForRisk,
  today: string,
): ProjectRiskInfo {
  const daysLeft = daysUntil(project.due, today);
  if (project.taskCount > 0 && project.doneCount === project.taskCount) {
    return { level: "done", daysLeft };
  }
  if (daysLeft <= RISK_WINDOW_DAYS) {
    return { level: "risk", daysLeft };
  }
  return { level: "ok", daysLeft };
}

// Las mismas categorías que ya muestra la tarjeta de proyecto (badge
// "Completado" / "Venció" / "Vence en Xd" / "En ejecución"), para que el
// filtro de la lista de proyectos use el mismo criterio que lo que el
// usuario ve.
export const PROJECT_RISK_FILTERS = [
  "ejecucion",
  "por-vencer",
  "vencido",
  "completado",
] as const;

export type ProjectRiskFilter = (typeof PROJECT_RISK_FILTERS)[number];

export function matchesRiskFilter(
  risk: ProjectRiskInfo,
  filter: ProjectRiskFilter,
): boolean {
  switch (filter) {
    case "completado":
      return risk.level === "done";
    case "vencido":
      return risk.level === "risk" && risk.daysLeft < 0;
    case "por-vencer":
      return risk.level === "risk" && risk.daysLeft >= 0;
    case "ejecucion":
      return risk.level === "ok";
  }
}
