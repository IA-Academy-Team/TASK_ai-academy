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

  const totalRows = owned;
  const vencidasRows = owned.filter((r) =>
    matchTaskState(r.task, "vencidas", today),
  );
  const urgentesRows = owned.filter((r) =>
    matchTaskState(r.task, "urgentes", today),
  );
  const completadasRows = owned.filter((r) => r.task.status === "completada");
  const activeRows = owned.filter((r) => r.task.status === "activa");
  const pendingRows = owned.filter((r) => r.task.status === "pendiente");
  const reviewRows = owned.filter((r) => r.task.status === "revision");
  const blockedRows = owned.filter((r) => r.task.status === "bloqueada");
  const cancelledRows = owned.filter((r) => r.task.status === "cancelada");

  const filtered = owned
    .filter((r) => matchTaskState(r.task, estado, today))
    .sort((a, b) => compareTasks(a.rank, b.rank, orden, today));

  const toKpiRow = (r: (typeof owned)[number]) => ({
    id: r.task.id,
    title: r.task.title,
    projectName: r.projectName || "Independiente",
    status: r.task.status,
    due: r.task.due,
  });

  res.render("mis-tareas", {
    user: req.user,
    tasks: filtered,
    support,
    total: totalRows.length,
    vencidas: vencidasRows.length,
    urgentes: urgentesRows.length,
    completadas: completadasRows.length,
    active: activeRows.length,
    pending: pendingRows.length,
    review: reviewRows.length,
    blocked: blockedRows.length,
    cancelled: cancelledRows.length,
    supportCount: support.length,
    kpiTotalRows: totalRows.map(toKpiRow),
    kpiVencidasRows: vencidasRows.map(toKpiRow),
    kpiUrgentesRows: urgentesRows.map(toKpiRow),
    kpiCompletadasRows: completadasRows.map(toKpiRow),
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
