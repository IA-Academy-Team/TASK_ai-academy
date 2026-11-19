export interface KpiProjectRow {
  code: string;
  name: string;
  leaderName: string;
}

interface TaskProjectRow {
  task: { projectId: string | null };
  projectCode: string | null;
  projectName: string | null;
}

export function projectSummaryFromTasks(
  rows: TaskProjectRow[],
  leaderNameByProjectId: Map<string, string>,
): KpiProjectRow[] {
  const byKey = new Map<string, KpiProjectRow>();
  for (const row of rows) {
    const key = row.task.projectId ?? "independiente";
    if (byKey.has(key)) continue;
    byKey.set(
      key,
      row.task.projectId
        ? {
            code: row.projectCode ?? "",
            name: row.projectName ?? "",
            leaderName: leaderNameByProjectId.get(row.task.projectId) ?? "",
          }
        : { code: "", name: "Tareas independientes", leaderName: "—" },
    );
  }
  return [...byKey.values()];
}
