export const PROJECT_IMPORT_HEADERS = [
  "Nombre",
  "Objetivo",
  "Líder (email)",
  "Integrantes (emails separados por coma)",
  "Fecha de inicio (AAAA-MM-DD)",
  "Fecha límite (AAAA-MM-DD)",
  "Límite tareas activas (1-20, opcional, default 2)",
  "Límite tareas en revisión (1-20, opcional, default 2)",
] as const;

export interface ProjectImportRow {
  name: string;
  objective: string;
  leaderEmail: string;
  memberEmails: string;
  start: string;
  due: string;
  limitActive: string;
  limitReview: string;
}

export interface ProjectImportResolved {
  name: string;
  objective: string;
  leaderId: string;
  memberIds: string[];
  start: string;
  due: string;
  limitActive: number;
  limitReview: number;
}

export type ProjectImportOutcome =
  | { ok: true; row: number; project: ProjectImportResolved }
  | { ok: false; row: number; message: string };

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_LIMIT = 2;

function parseOptionalLimit(
  raw: string,
  label: string,
  row: number,
): { ok: true; value: number } | { ok: false; outcome: ProjectImportOutcome } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: DEFAULT_LIMIT };
  const value = Number(trimmed);
  if (!Number.isInteger(value) || value < 1 || value > 20) {
    return {
      ok: false,
      outcome: {
        ok: false,
        row,
        message: `${label} debe ser un entero entre 1 y 20`,
      },
    };
  }
  return { ok: true, value };
}

export function validateProjectImportRow(
  raw: ProjectImportRow,
  row: number,
  usersByEmail: Map<string, string>,
): ProjectImportOutcome {
  const name = raw.name.trim();
  if (!name) return { ok: false, row, message: "falta el nombre" };
  if (name.length > 120) {
    return { ok: false, row, message: "el nombre supera 120 caracteres" };
  }

  const objective = raw.objective.trim();
  if (!objective) return { ok: false, row, message: "falta el objetivo" };
  if (objective.length > 500) {
    return { ok: false, row, message: "el objetivo supera 500 caracteres" };
  }

  const leaderEmail = raw.leaderEmail.trim().toLowerCase();
  if (!leaderEmail) {
    return { ok: false, row, message: "falta el email del líder" };
  }
  const leaderId = usersByEmail.get(leaderEmail);
  if (!leaderId) {
    return {
      ok: false,
      row,
      message: `no existe un usuario activo con el email "${raw.leaderEmail.trim()}"`,
    };
  }

  const memberEmails = raw.memberEmails
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const memberIds: string[] = [];
  for (const email of memberEmails) {
    const id = usersByEmail.get(email);
    if (!id) {
      return {
        ok: false,
        row,
        message: `no existe un usuario activo con el email de integrante "${email}"`,
      };
    }
    memberIds.push(id);
  }

  const start = raw.start.trim();
  if (!DATE_PATTERN.test(start)) {
    return {
      ok: false,
      row,
      message: `fecha de inicio inválida "${raw.start}" (usa AAAA-MM-DD)`,
    };
  }

  const due = raw.due.trim();
  if (!DATE_PATTERN.test(due)) {
    return {
      ok: false,
      row,
      message: `fecha límite inválida "${raw.due}" (usa AAAA-MM-DD)`,
    };
  }

  const limitActive = parseOptionalLimit(
    raw.limitActive,
    "el límite de tareas activas",
    row,
  );
  if (!limitActive.ok) return limitActive.outcome;

  const limitReview = parseOptionalLimit(
    raw.limitReview,
    "el límite de tareas en revisión",
    row,
  );
  if (!limitReview.ok) return limitReview.outcome;

  return {
    ok: true,
    row,
    project: {
      name,
      objective,
      leaderId,
      memberIds,
      start,
      due,
      limitActive: limitActive.value,
      limitReview: limitReview.value,
    },
  };
}
