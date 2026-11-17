export interface HourLog {
  hours: string;
}

export interface TaskForHours {
  status: string;
  estimate: string | null;
  weight: number;
}

export function declaredHours(logs: HourLog[]): number {
  return logs.reduce((sum, log) => sum + Number(log.hours), 0);
}

export function approvedHours(task: TaskForHours, logs: HourLog[]): number {
  return task.status === "completada" ? declaredHours(logs) : 0;
}

export interface OpenHoursItem {
  estimate: string | null;
  logs: HourLog[];
}

/**
 * Horas abiertas de una tarea: lo que falta por registrar sobre su estimado,
 * nunca negativo. Llamar solo con tareas no completadas ni canceladas — el
 * caller filtra eso antes (ver teamLoad y /proyectos/:id).
 */
export function openHoursRemaining(items: OpenHoursItem[]): number {
  return items.reduce(
    (sum, item) =>
      sum + Math.max(Number(item.estimate ?? 0) - declaredHours(item.logs), 0),
    0,
  );
}

function isVigente(task: TaskForHours): boolean {
  return task.status !== "cancelada";
}

export function plannedBudget(tasks: TaskForHours[]): number {
  return tasks
    .filter((t) => isVigente(t) && t.estimate !== null)
    .reduce((sum, t) => sum + Number(t.estimate), 0);
}

export function weightedProgress(tasks: TaskForHours[]): number {
  const vigentes = tasks.filter(isVigente);
  const totalWeight = vigentes.reduce((sum, t) => sum + t.weight, 0);
  if (totalWeight === 0) return 0;
  const doneWeight = vigentes
    .filter((t) => t.status === "completada")
    .reduce((sum, t) => sum + t.weight, 0);
  return Math.round((doneWeight / totalWeight) * 100);
}

export interface ProjectStatsItem {
  task: TaskForHours;
  logs: HourLog[];
}

export interface ProjectStats {
  logged: number;
  confirmed: number;
  unconfirmed: number;
  closedBudget: number;
  deviation: number;
}

export function projectStats(items: ProjectStatsItem[]): ProjectStats {
  const logged = items.reduce((sum, item) => sum + declaredHours(item.logs), 0);
  const confirmed = items.reduce(
    (sum, item) => sum + approvedHours(item.task, item.logs),
    0,
  );
  const closedBudget = items
    .filter((item) => item.task.status === "completada")
    .reduce((sum, item) => sum + Number(item.task.estimate ?? 0), 0);

  return {
    logged,
    confirmed,
    unconfirmed: logged - confirmed,
    closedBudget,
    deviation: confirmed - closedBudget,
  };
}
