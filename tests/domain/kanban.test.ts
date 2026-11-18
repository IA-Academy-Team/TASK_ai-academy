import { describe, expect, it } from "vitest";
import {
  groupTasksByColumn,
  KANBAN_STATUSES,
  kanbanTransitionNeedsEvidence,
  kanbanTransitionNeedsNote,
} from "../../src/domain/kanban.ts";

function task(
  overrides: Partial<Parameters<typeof groupTasksByColumn>[0][number]>,
) {
  return {
    id: "t1",
    title: "Tarea",
    priority: "media",
    status: "pendiente",
    due: "2026-01-01",
    estimate: 1,
    ownerName: "Ana",
    ownerColor: "#7346CC",
    hasEvidence: false,
    ...overrides,
  };
}

describe("groupTasksByColumn", () => {
  it("devuelve una columna por cada estado del tablero, en orden", () => {
    const columns = groupTasksByColumn([]);
    expect(columns.map((c) => c.status)).toEqual([...KANBAN_STATUSES]);
  });

  it("agrupa cada tarea en la columna de su estado", () => {
    const columns = groupTasksByColumn([
      task({ id: "a", status: "activa" }),
      task({ id: "b", status: "pendiente" }),
    ]);
    const activa = columns.find((c) => c.status === "activa");
    const pendiente = columns.find((c) => c.status === "pendiente");
    expect(activa?.tasks.map((t) => t.id)).toEqual(["a"]);
    expect(pendiente?.tasks.map((t) => t.id)).toEqual(["b"]);
  });

  it("ignora tareas con un estado fuera del tablero (p. ej. cancelada)", () => {
    const columns = groupTasksByColumn([
      task({ id: "a", status: "cancelada" }),
    ]);
    expect(columns.every((c) => c.tasks.length === 0)).toBe(true);
  });

  it("ordena por prioridad dentro de la columna, crítica primero", () => {
    const columns = groupTasksByColumn([
      task({ id: "baja", status: "pendiente", priority: "baja" }),
      task({ id: "critica", status: "pendiente", priority: "critica" }),
      task({ id: "media", status: "pendiente", priority: "media" }),
    ]);
    const pendiente = columns.find((c) => c.status === "pendiente");
    expect(pendiente?.tasks.map((t) => t.id)).toEqual([
      "critica",
      "media",
      "baja",
    ]);
  });

  it("con la misma prioridad, ordena por fecha de vencimiento", () => {
    const columns = groupTasksByColumn([
      task({ id: "tarde", status: "activa", due: "2026-02-01" }),
      task({ id: "temprano", status: "activa", due: "2026-01-01" }),
    ]);
    const activa = columns.find((c) => c.status === "activa");
    expect(activa?.tasks.map((t) => t.id)).toEqual(["temprano", "tarde"]);
  });
});

describe("kanbanTransitionNeedsNote", () => {
  it("pide motivo para pasar a bloqueada", () => {
    expect(kanbanTransitionNeedsNote("activa", "bloqueada")).toBe(true);
  });

  it("pide motivo para devolver de revisión a activa", () => {
    expect(kanbanTransitionNeedsNote("revision", "activa")).toBe(true);
  });

  it("no pide motivo para iniciar una tarea pendiente", () => {
    expect(kanbanTransitionNeedsNote("pendiente", "activa")).toBe(false);
  });

  it("no pide motivo para enviar a revisión", () => {
    expect(kanbanTransitionNeedsNote("activa", "revision")).toBe(false);
  });
});

describe("kanbanTransitionNeedsEvidence", () => {
  it("pide evidencia al entrar a revisión sin evidencia cargada", () => {
    expect(kanbanTransitionNeedsEvidence("revision", false)).toBe(true);
  });

  it("no pide evidencia si la tarea ya la tiene", () => {
    expect(kanbanTransitionNeedsEvidence("revision", true)).toBe(false);
  });

  it("no pide evidencia para otras columnas", () => {
    expect(kanbanTransitionNeedsEvidence("activa", false)).toBe(false);
  });
});
