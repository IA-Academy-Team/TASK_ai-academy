export interface WeekPlanTask {
  due: string;
}

export interface WeekPlanDay<T extends WeekPlanTask> {
  date: string;
  label: string;
  tasks: T[];
}

const WEEKDAY_LABELS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];

export function groupTasksByWeekday<T extends WeekPlanTask>(
  tasks: T[],
  monday: string,
): WeekPlanDay<T>[] {
  const start = new Date(`${monday}T00:00:00`);

  return WEEKDAY_LABELS.map((label, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const dateString = date.toLocaleDateString("en-CA");

    return {
      date: dateString,
      label,
      tasks: tasks.filter((task) => task.due === dateString),
    };
  });
}
