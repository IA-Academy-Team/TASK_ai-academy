const DAY_MS = 24 * 60 * 60 * 1000;

export function enumerateDays(from: string, to: string): string[] {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  const days: string[] = [];
  for (let t = start.getTime(); t <= end.getTime(); t += DAY_MS) {
    days.push(new Date(t).toLocaleDateString("en-CA"));
  }
  return days;
}

export interface DaySample {
  date: string;
  hours: number;
}

export function seriesForDays(days: string[], samples: DaySample[]): number[] {
  const byDate = new Map(samples.map((s) => [s.date, s.hours]));
  return days.map((d) => byDate.get(d) ?? 0);
}

export type CapacityThreshold = "ok" | "warn" | "over";

const WARN_RATIO = 0.7;
const OVER_RATIO = 0.9;

export function capacityThreshold(
  hours: number,
  capacity: number,
): CapacityThreshold {
  if (capacity <= 0) return hours > 0 ? "over" : "ok";
  const ratio = hours / capacity;
  if (ratio > OVER_RATIO) return "over";
  if (ratio >= WARN_RATIO) return "warn";
  return "ok";
}

export interface TaskForUrgencyBucket {
  status: string;
  due: string;
  priority: string;
}

export interface UrgencyBuckets {
  vencidas: number;
  urgentes: number;
  enCurso: number;
  completadas: number;
}

export function bucketTasksByUrgency(
  tasks: TaskForUrgencyBucket[],
  today: string,
): UrgencyBuckets {
  const buckets: UrgencyBuckets = {
    vencidas: 0,
    urgentes: 0,
    enCurso: 0,
    completadas: 0,
  };

  for (const task of tasks) {
    if (task.status === "cancelada") continue;
    if (task.status === "completada") {
      buckets.completadas++;
    } else if (task.due < today) {
      buckets.vencidas++;
    } else if (task.priority === "alta" || task.priority === "critica") {
      buckets.urgentes++;
    } else {
      buckets.enCurso++;
    }
  }

  return buckets;
}
