export interface ActivityEntry {
  action: string;
  note: string;
  createdAt: Date;
  actorName: string | null;
  projectName: string | null;
  taskTitle: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  pendiente: "Pendiente",
  activa: "Activa",
  revision: "Revisión",
  completada: "Completada",
  bloqueada: "Bloqueada",
  cancelada: "Cancelada",
};

function statusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
}

export function formatActivity(entry: ActivityEntry): string {
  const actor = entry.actorName || "Alguien";
  const task = entry.taskTitle ? `"${entry.taskTitle}"` : "una tarea";
  const project = entry.projectName ? `"${entry.projectName}"` : "un proyecto";

  switch (entry.action) {
    case "task_created":
      return `${actor} creó la tarea ${task}`;
    case "task_status_changed": {
      const match = entry.note.match(/^(\w+) → (\w+)/);
      if (!match) return `${actor} cambió el estado de ${task}`;
      return `${actor} movió ${task} de ${statusLabel(match[1])} a ${statusLabel(match[2])}`;
    }
    case "task_hours_logged": {
      const match = entry.note.match(/^([\d.]+) h/);
      if (!match) return `${actor} registró horas en ${task}`;
      return `${actor} registró ${match[1]} h en ${task}`;
    }
    case "task_order_changed":
      return `${actor} reordenó ${task}`;
    case "task_updated":
      return `${actor} editó ${task}`;
    case "project_settings_updated":
      return `${actor} actualizó la configuración de ${project}`;
    case "support_request_resolved":
      if (entry.note.includes("aceptada"))
        return `${actor} aceptó una solicitud de apoyo en ${task}`;
      if (entry.note.includes("rechazada"))
        return `${actor} rechazó una solicitud de apoyo en ${task}`;
      return `${actor} resolvió una solicitud de apoyo en ${task}`;
    default:
      return `${actor} — ${entry.action}`;
  }
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export function timeAgo(date: Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < MINUTE_MS) return "hace un momento";
  if (diffMs < HOUR_MS) return `hace ${Math.floor(diffMs / MINUTE_MS)} min`;
  if (diffMs < DAY_MS) return `hace ${Math.floor(diffMs / HOUR_MS)} h`;
  return `hace ${Math.floor(diffMs / DAY_MS)} d`;
}

const ACTIVITY_ICON: Record<string, string> = {
  task_created: "plus",
  task_status_changed: "swap",
  task_hours_logged: "clock",
  task_order_changed: "reorder",
  task_updated: "edit",
  project_settings_updated: "settings",
  support_request_resolved: "handshake",
};

export function activityIconKind(action: string): string {
  return ACTIVITY_ICON[action] ?? "dot";
}
