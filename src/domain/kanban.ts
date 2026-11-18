export const KANBAN_STATUSES = [
  "pendiente",
  "activa",
  "revision",
  "bloqueada",
  "completada",
] as const;

export type KanbanStatus = (typeof KANBAN_STATUSES)[number];

export const KANBAN_STATUS_LABELS: Record<KanbanStatus, string> = {
  pendiente: "Pendiente",
  activa: "Activa",
  revision: "Revisión",
  bloqueada: "Bloqueada",
  completada: "Completada",
};

// Transiciones que el repo exige acompañar con un motivo — el tablero pide
// ese motivo antes de soltar la tarjeta en vez de dejar que el servidor
// rechace el POST. Misma regla que valida POST /tareas/:id/estado.
export function kanbanTransitionNeedsNote(
  fromStatus: string,
  toStatus: KanbanStatus,
): boolean {
  return (
    toStatus === "bloqueada" ||
    (fromStatus === "revision" && toStatus === "activa")
  );
}

// Entrar a revisión sin evidencia ya cargada exige una — mismo chequeo que
// transitionTask en el repo. Si la tarea ya tiene evidencia (por ejemplo
// cargada al "Entregar") no hace falta pedirla de nuevo.
export function kanbanTransitionNeedsEvidence(
  toStatus: KanbanStatus,
  hasEvidence: boolean,
): boolean {
  return toStatus === "revision" && !hasEvidence;
}

const PRIORITY_ORDER: Record<string, number> = {
  critica: 0,
  alta: 1,
  media: 2,
  baja: 3,
};

function priorityRank(priority: string): number {
  return PRIORITY_ORDER[priority] ?? 9;
}

export interface KanbanTaskInput {
  id: string;
  title: string;
  priority: string;
  status: string;
  due: string;
  estimate: number;
  ownerName: string;
  ownerColor: string;
  hasEvidence: boolean;
}

export interface KanbanColumn {
  status: KanbanStatus;
  label: string;
  tasks: KanbanTaskInput[];
}

/**
 * Agrupa tareas en las columnas del tablero kanban, ordenadas por prioridad
 * y luego por fecha de vencimiento dentro de cada columna. Tareas con un
 * estado fuera de KANBAN_STATUSES (p. ej. "cancelada") no entran al tablero.
 */
export function groupTasksByColumn(tasks: KanbanTaskInput[]): KanbanColumn[] {
  return KANBAN_STATUSES.map((status) => ({
    status,
    label: KANBAN_STATUS_LABELS[status],
    tasks: tasks
      .filter((t) => t.status === status)
      .sort((a, b) => {
        const byPriority = priorityRank(a.priority) - priorityRank(b.priority);
        if (byPriority !== 0) return byPriority;
        return a.due < b.due ? -1 : a.due > b.due ? 1 : 0;
      }),
  }));
}
