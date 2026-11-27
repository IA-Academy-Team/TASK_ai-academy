import { describe, expect, it } from "vitest";
import {
  type TaskImportRow,
  validateTaskImportRow,
} from "../../src/domain/task-import.ts";

function row(overrides: Partial<TaskImportRow> = {}): TaskImportRow {
  return {
    title: "Preparar guiones",
    deliverable: "Guion aprobado",
    description: "",
    ownerEmail: "santiago@aiacademy.local",
    supportEmails: "",
    priority: "media",
    weight: "1",
    estimate: "4",
    due: "2026-12-01",
    dueTime: "10:00",
    ...overrides,
  };
}

const usersByEmail = new Map([
  ["santiago@aiacademy.local", "user-santiago"],
  ["valentina@aiacademy.local", "user-valentina"],
]);

describe("validateTaskImportRow", () => {
  it("acepta una fila válida y resuelve emails a IDs", () => {
    const result = validateTaskImportRow(
      row({ supportEmails: "valentina@aiacademy.local" }),
      2,
      usersByEmail,
      usersByEmail,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.task.ownerId).toBe("user-santiago");
      expect(result.task.supportIds).toEqual(["user-valentina"]);
      expect(result.task.priority).toBe("media");
    }
  });

  it("rechaza si falta el título", () => {
    const result = validateTaskImportRow(
      row({ title: "" }),
      2,
      usersByEmail,
      usersByEmail,
    );
    expect(result).toEqual({ ok: false, row: 2, message: "falta el título" });
  });

  it("rechaza un email de responsable que no existe", () => {
    const result = validateTaskImportRow(
      row({ ownerEmail: "nadie@aiacademy.local" }),
      3,
      usersByEmail,
      usersByEmail,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("nadie@aiacademy.local");
  });

  it("rechaza un email de apoyo que no existe", () => {
    const result = validateTaskImportRow(
      row({ supportEmails: "nadie@aiacademy.local" }),
      4,
      usersByEmail,
      usersByEmail,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("apoyo");
  });

  it("rechaza una prioridad inválida", () => {
    const result = validateTaskImportRow(
      row({ priority: "urgentisima" }),
      5,
      usersByEmail,
      usersByEmail,
    );
    expect(result.ok).toBe(false);
  });

  it("rechaza un peso fuera de rango", () => {
    const result = validateTaskImportRow(
      row({ weight: "11" }),
      6,
      usersByEmail,
      usersByEmail,
    );
    expect(result.ok).toBe(false);
  });

  it("rechaza horas estimadas no numéricas", () => {
    const result = validateTaskImportRow(
      row({ estimate: "cuatro" }),
      7,
      usersByEmail,
      usersByEmail,
    );
    expect(result.ok).toBe(false);
  });

  it("rechaza una fecha límite con formato inválido", () => {
    const result = validateTaskImportRow(
      row({ due: "01/12/2026" }),
      8,
      usersByEmail,
      usersByEmail,
    );
    expect(result.ok).toBe(false);
  });

  it("acepta varios emails de apoyo separados por coma", () => {
    const result = validateTaskImportRow(
      row({
        supportEmails: "santiago@aiacademy.local, valentina@aiacademy.local",
      }),
      9,
      usersByEmail,
      usersByEmail,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.task.supportIds).toEqual([
        "user-santiago",
        "user-valentina",
      ]);
    }
  });
});
