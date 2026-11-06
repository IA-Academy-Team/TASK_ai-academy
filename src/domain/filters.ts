export type StateFilter =
  | "todas"
  | "vencidas"
  | "urgentes"
  | "activa"
  | "revision"
  | "pendiente"
  | "bloqueada"
  | "completada"
  | "cancelada";

export type OrderKey = "sequence" | "due" | "priority";

const DONE_OR_CANCELED = new Set(["completada", "cancelada"]);
const PRIORITY_WEIGHT: Record<string, number> = {
  critica: 4,
  alta: 3,
  media: 2,
  baja: 1,
};

export interface TaskForFilter {
  status: string;
  due: string;
  priority: string;
}

export function matchTaskState(
  task: TaskForFilter,
  filter: StateFilter,
  today: string,
): boolean {
  if (filter === "todas") return task.status !== "cancelada";
  if (filter === "vencidas") {
    return !DONE_OR_CANCELED.has(task.status) && task.due < today;
  }
  if (filter === "urgentes") {
    return (
      !DONE_OR_CANCELED.has(task.status) &&
      (task.priority === "critica" || task.priority === "alta")
    );
  }
  return task.status === filter;
}

export interface TaskForRank extends TaskForFilter {
  order: number;
  dependencyId: string | null;
  dependencyDone: boolean;
}

export function priorityRank(task: TaskForRank, today: string): number {
  if (task.status === "bloqueada") return 0;
  if (task.status === "revision") return 1;
  if (!DONE_OR_CANCELED.has(task.status) && task.due < today) return 2;
  if (task.status === "activa") return 3;
  if (DONE_OR_CANCELED.has(task.status)) return 8;
  if (task.priority === "critica") return 4;
  if (task.priority === "alta") return 5;
  if (
    task.status === "pendiente" &&
    task.dependencyId &&
    !task.dependencyDone
  ) {
    return 7;
  }
  return 6;
}

export function compareTasks(
  a: TaskForRank,
  b: TaskForRank,
  orderKey: OrderKey,
  today: string,
): number {
  if (orderKey === "sequence") return a.order - b.order;
  if (orderKey === "due") {
    if (a.due !== b.due) return a.due < b.due ? -1 : 1;
    return a.order - b.order;
  }

  const rankA = priorityRank(a, today);
  const rankB = priorityRank(b, today);
  if (rankA !== rankB) return rankA - rankB;

  const weightA = PRIORITY_WEIGHT[a.priority] ?? 0;
  const weightB = PRIORITY_WEIGHT[b.priority] ?? 0;
  if (weightA !== weightB) return weightB - weightA;

  if (a.due !== b.due) return a.due < b.due ? -1 : 1;
  return a.order - b.order;
}
