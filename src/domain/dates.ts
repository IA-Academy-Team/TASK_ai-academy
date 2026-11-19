// Formato AAAA-MM-DD en hora local, no UTC — toISOString() adelanta la
// fecha varias horas antes de medianoche local y corre el día.
export function toDateString(d: Date): string {
  return d.toLocaleDateString("en-CA");
}

export function mondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function fridayOf(date: Date): Date {
  const friday = mondayOf(date);
  friday.setDate(friday.getDate() + 4);
  return friday;
}

export function monthStartOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

export function monthEndOf(date: Date): string {
  // Día 0 del mes siguiente = último día del mes actual.
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return toDateString(end);
}
