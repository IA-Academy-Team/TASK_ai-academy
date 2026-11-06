import { Router } from "express";
import {
  getTask,
  listTasksForOwner,
  listTasksForSupport,
} from "../db/tasks-repo.ts";
import { bucketTasksByUrgency } from "../domain/chart-data.ts";
import {
  compareTasks,
  matchTaskState,
  type OrderKey,
  type StateFilter,
  type TaskForRank,
} from "../domain/filters.ts";

export const mytasksRouter = Router();

const STATE_FILTERS: StateFilter[] = [
  "todas",
  "vencidas",
  "urgentes",
  "pendiente",
  "activa",
  "revision",
  "bloqueada",
  "completada",
  "cancelada",
];
const ORDER_KEYS: OrderKey[] = ["sequence", "due", "priority"];

interface RankableTask {
  status: string;
  due: string;
  priority: string;
  order: number;
  dependencyId: string | null;
}

async function toRankedRow<T extends { task: RankableTask }>(
  row: T,
): Promise<T & { rank: TaskForRank }> {
  const dep = row.task.dependencyId
    ? await getTask(row.task.dependencyId)
    : null;
  return {
    ...row,
    rank: {
      status: row.task.status,
      due: row.task.due,
      priority: row.task.priority,
      order: row.task.order,
      dependencyId: row.task.dependencyId,
      dependencyDone: !row.task.dependencyId || dep?.status === "completada",
    },
  };
}

mytasksRouter.get("/mis-tareas", async (req, res) => {
  if (!req.user) {
    res.redirect("/login");
    return;
  }

  const today = new Date().toLocaleDateString("en-CA");
  const estadoRaw =
    typeof req.query.estado === "string" ? req.query.estado : "todas";
  const estado: StateFilter = STATE_FILTERS.includes(estadoRaw as StateFilter)
    ? (estadoRaw as StateFilter)
    : "todas";
  const ordenRaw =
    typeof req.query.orden === "string" ? req.query.orden : "priority";
  const orden: OrderKey = ORDER_KEYS.includes(ordenRaw as OrderKey)
    ? (ordenRaw as OrderKey)
    : "priority";

  const [ownedRaw, supportRaw] = await Promise.all([
    listTasksForOwner(req.user.id),
    listTasksForSupport(req.user.id),
  ]);

  const owned = await Promise.all(ownedRaw.map(toRankedRow));
  const support = await Promise.all(supportRaw.map(toRankedRow));

  const total = owned.length;
  const vencidas = owned.filter((r) =>
    matchTaskState(r.task, "vencidas", today),
  ).length;
  const urgentes = owned.filter((r) =>
    matchTaskState(r.task, "urgentes", today),
  ).length;
  const completadas = owned.filter(
    (r) => r.task.status === "completada",
  ).length;

  const filtered = owned
    .filter((r) => matchTaskState(r.task, estado, today))
    .sort((a, b) => compareTasks(a.rank, b.rank, orden, today));

  res.render("mis-tareas", {
    user: req.user,
    tasks: filtered,
    support,
    total,
    vencidas,
    urgentes,
    completadas,
    estado,
    orden,
    showing: filtered.length,
    of: owned.filter((r) => r.task.status !== "cancelada").length,
    urgencyBuckets: bucketTasksByUrgency(
      owned.map((r) => r.task),
      today,
    ),
  });
});
