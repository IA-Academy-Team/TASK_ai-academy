import {
  isValidTaskDueTime,
  priorityEnum,
  TASK_ESTIMATE_MAX_HOURS,
} from "../schemas/task.ts";

export const TASK_IMPORT_HEADERS = [
  "Título",
  "Entregable",
  "Descripción",
  "Responsable (email)",
  "Apoyo (emails separados por coma)",
  "Prioridad (baja/media/alta/critica)",
  "Peso (1-10)",
  "Horas estimadas",
  "Fecha límite (AAAA-MM-DD)",
  "Hora de entrega (HH:MM)",
] as const;

export interface TaskImportRow {
  title: string;
  deliverable: string;
  description: string;
  ownerEmail: string;
  supportEmails: string;
  priority: string;
  weight: string;
  estimate: string;
  due: string;
  dueTime: string;
}

export interface TaskImportResolved {
  title: string;
  deliverable: string;
  description: string;
  ownerId: string;
  supportIds: string[];
  priority: "baja" | "media" | "alta" | "critica";
  weight: number;
  estimate: number;
  due: string;
  dueTime: string;
}

export interface TaskImportError {
  row: number;
  message: string;
}

export type TaskImportOutcome =
  | { ok: true; row: number; task: TaskImportResolved }
  | { ok: false; row: number; message: string };

const DUE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function validateTaskImportRow(
  raw: TaskImportRow,
  row: number,
  ownerUsersByEmail: Map<string, string>,
  supportUsersByEmail: Map<string, string>,
): TaskImportOutcome {
  const title = raw.title.trim();
  if (!title) return { ok: false, row, message: "falta el título" };
  if (title.length > 200) {
    return { ok: false, row, message: "el título supera 200 caracteres" };
  }

  const deliverable = raw.deliverable.trim();
  if (!deliverable) return { ok: false, row, message: "falta el entregable" };
  if (deliverable.length > 300) {
    return { ok: false, row, message: "el entregable supera 300 caracteres" };
  }

  const ownerEmail = raw.ownerEmail.trim().toLowerCase();
  if (!ownerEmail) {
    return { ok: false, row, message: "falta el email del responsable" };
  }
  const ownerId = ownerUsersByEmail.get(ownerEmail);
  if (!ownerId) {
    return {
      ok: false,
      row,
      message: `no existe un usuario activo con el email "${raw.ownerEmail.trim()}"`,
    };
  }

  const supportEmails = raw.supportEmails
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const supportIds: string[] = [];
  for (const email of supportEmails) {
    const id = supportUsersByEmail.get(email);
    if (!id) {
      return {
        ok: false,
        row,
        message: `no existe un usuario activo con el email de apoyo "${email}"`,
      };
    }
    supportIds.push(id);
  }

  const priorityParsed = priorityEnum.safeParse(
    raw.priority.trim().toLowerCase(),
  );
  if (!priorityParsed.success) {
    return {
      ok: false,
      row,
      message: `prioridad inválida "${raw.priority}" (usa baja, media, alta o critica)`,
    };
  }

  const weight = Number(raw.weight);
  if (!Number.isInteger(weight) || weight < 1 || weight > 10) {
    return {
      ok: false,
      row,
      message: "el peso debe ser un entero entre 1 y 10",
    };
  }

  const estimate = Number(raw.estimate);
  if (
    !Number.isFinite(estimate) ||
    estimate <= 0 ||
    estimate > TASK_ESTIMATE_MAX_HOURS
  ) {
    return {
      ok: false,
      row,
      message: `las horas estimadas deben ser un número entre 0 y ${TASK_ESTIMATE_MAX_HOURS}`,
    };
  }

  const due = raw.due.trim();
  if (!DUE_DATE_PATTERN.test(due)) {
    return {
      ok: false,
      row,
      message: `fecha límite inválida "${raw.due}" (usa AAAA-MM-DD)`,
    };
  }

  const dueTime = raw.dueTime.trim();
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(dueTime)) {
    return {
      ok: false,
      row,
      message: `hora de entrega inválida "${raw.dueTime}" (usa HH:MM)`,
    };
  }
  if (!isValidTaskDueTime(dueTime)) {
    return {
      ok: false,
      row,
      message: "la hora de entrega debe estar entre 08:00–12:00 o 14:00–18:00",
    };
  }

  return {
    ok: true,
    row,
    task: {
      title,
      deliverable,
      description: raw.description.trim(),
      ownerId,
      supportIds,
      priority: priorityParsed.data,
      weight,
      estimate,
      due,
      dueTime,
    },
  };
}
