export interface CalendarTask {
  id: string;
  title: string;
  priority: string;
  estimate: number;
  ownerName?: string;
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

/**
 * Grilla visual de la jornada laboral: mañana 8-12, almuerzo 12-14 (sin
 * tareas), tarde 14-18. No es un horario real — ver layoutDayBlocks.
 */
export const HOUR_HEIGHT_PX = 64;
export const LUNCH_GAP_PX = 40;
export const MORNING_HOURS = 4;
export const AFTERNOON_HOURS = 4;
export const WORKDAY_HOURS = MORNING_HOURS + AFTERNOON_HOURS;
export const WORKDAY_GRID_HEIGHT_PX =
  WORKDAY_HOURS * HOUR_HEIGHT_PX + LUNCH_GAP_PX;

export function hoursOffsetToPx(hoursOffset: number): number {
  const clamped = Math.max(0, hoursOffset);
  if (clamped <= MORNING_HOURS) return clamped * HOUR_HEIGHT_PX;
  return (
    MORNING_HOURS * HOUR_HEIGHT_PX +
    LUNCH_GAP_PX +
    (clamped - MORNING_HOURS) * HOUR_HEIGHT_PX
  );
}

export interface TimeAxisMark {
  label: string;
  top: number;
  anchor: "start" | "center" | "end";
}

export function timeAxisMarks(): TimeAxisMark[] {
  const marks: TimeAxisMark[] = [];
  for (let h = 0; h <= MORNING_HOURS; h++) {
    marks.push({
      label: `${8 + h}:00`,
      top: hoursOffsetToPx(h),
      anchor: h === MORNING_HOURS ? "end" : "center",
    });
  }
  for (let h = 0; h <= AFTERNOON_HOURS; h++) {
    marks.push({
      label: `${14 + h}:00`,
      top: hoursOffsetToPx(MORNING_HOURS + h),
      anchor: h === 0 ? "start" : "center",
    });
  }
  return marks;
}

export interface PositionedBlock extends CalendarBlock {
  topPx: number;
  heightPx: number;
}

const MIN_BLOCK_HEIGHT_PX = 30;

export function positionDayBlocks(blocks: CalendarBlock[]): PositionedBlock[] {
  return blocks.map((b) => {
    const topPx = hoursOffsetToPx(b.topHours);
    const heightPx = Math.max(
      MIN_BLOCK_HEIGHT_PX,
      hoursOffsetToPx(b.topHours + b.estimate) - topPx,
    );
    return { ...b, topPx, heightPx };
  });
}

export function dayGridHeightPx(blocks: PositionedBlock[]): number {
  const tallest = blocks.reduce(
    (max, b) => Math.max(max, b.topPx + b.heightPx),
    0,
  );
  return Math.max(WORKDAY_GRID_HEIGHT_PX, tallest);
}
