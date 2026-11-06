import { describe, expect, it } from "vitest";
import {
  activityIconKind,
  formatActivity,
  timeAgo,
} from "../../src/lib/activity-format.ts";

function entry(overrides: Partial<Parameters<typeof formatActivity>[0]> = {}) {
  return {
    action: "task_created",
    note: "",
    createdAt: new Date(),
    actorName: "Admin",
    projectName: "Nébula",
    taskTitle: "Tarea X",
    ...overrides,
  };
}

describe("formatActivity", () => {
  it("humaniza task_created", () => {
    expect(formatActivity(entry({ action: "task_created" }))).toBe(
      'Admin creó la tarea "Tarea X"',
    );
  });

  it("humaniza task_status_changed con el estado antes/después", () => {
    const result = formatActivity(
      entry({
        action: "task_status_changed",
        note: "revision → completada",
      }),
    );
    expect(result).toBe('Admin movió "Tarea X" de Revisión a Completada');
  });

  it("humaniza task_hours_logged con las horas registradas", () => {
    const result = formatActivity(
      entry({ action: "task_hours_logged", note: "3 h el 2026-11-05" }),
    );
    expect(result).toBe('Admin registró 3 h en "Tarea X"');
  });

  it("humaniza task_order_changed", () => {
    expect(formatActivity(entry({ action: "task_order_changed" }))).toBe(
      'Admin reordenó "Tarea X"',
    );
  });

  it("cae a Alguien cuando no hay actorName", () => {
    expect(
      formatActivity(entry({ action: "task_created", actorName: null })),
    ).toBe('Alguien creó la tarea "Tarea X"');
  });

  it("cae a un texto genérico para una acción desconocida", () => {
    expect(formatActivity(entry({ action: "algo_nuevo" }))).toBe(
      "Admin — algo_nuevo",
    );
  });
});

describe("activityIconKind", () => {
  it("mapea cada acción conocida a su ícono", () => {
    expect(activityIconKind("task_created")).toBe("plus");
    expect(activityIconKind("task_hours_logged")).toBe("clock");
  });

  it("cae a 'dot' para una acción desconocida", () => {
    expect(activityIconKind("algo_nuevo")).toBe("dot");
  });
});

describe("timeAgo", () => {
  it("reporta minutos, horas y días relativos a 'now'", () => {
    const now = new Date("2026-11-06T12:00:00Z");
    expect(timeAgo(new Date("2026-11-06T11:58:00Z"), now)).toBe("hace 2 min");
    expect(timeAgo(new Date("2026-11-06T10:00:00Z"), now)).toBe("hace 2 h");
    expect(timeAgo(new Date("2026-11-04T12:00:00Z"), now)).toBe("hace 2 d");
  });
});
