export interface CalendarTask {
  id: string;
  title: string;
  priority: string;
  estimate: number;
}

export interface CalendarBlock extends CalendarTask {
  topHours: number;
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

/**
 * Ubica las tareas de un día en bloques apilados por prioridad, uno
 * después del otro según sus horas estimadas. Es una vista estimada de
 * carga, no un horario real: el sistema no registra hora de inicio/fin.
 */
export function layoutDayBlocks(tasks: CalendarTask[]): CalendarBlock[] {
  const sorted = [...tasks].sort(
    (a, b) => priorityRank(a.priority) - priorityRank(b.priority),
  );

  const blocks: CalendarBlock[] = [];
  let offset = 0;
  for (const task of sorted) {
    blocks.push({ ...task, topHours: offset });
    offset += task.estimate;
  }
  return blocks;
}

export function totalHours(tasks: CalendarTask[]): number {
  return tasks.reduce((sum, t) => sum + t.estimate, 0);
}
