import { describe, expect, it } from "vitest";
import {
  approvedHours,
  declaredHours,
  plannedBudget,
  projectStats,
  weightedProgress,
} from "../../src/domain/hours.ts";

describe("domain/hours", () => {
  it("declaredHours suma las horas de todos los logs", () => {
    expect(declaredHours([{ hours: "3" }, { hours: "2.5" }])).toBe(5.5);
    expect(declaredHours([])).toBe(0);
  });

  it("approvedHours solo cuenta si la tarea está completada", () => {
    const logs = [{ hours: "4" }];
    expect(
      approvedHours({ status: "completada", estimate: "4", weight: 1 }, logs),
    ).toBe(4);
    expect(
      approvedHours({ status: "activa", estimate: "4", weight: 1 }, logs),
    ).toBe(0);
  });

  it("plannedBudget suma estimate de tareas vigentes, excluye canceladas", () => {
    const tasks = [
      { status: "pendiente", estimate: "4", weight: 1 },
      { status: "cancelada", estimate: "10", weight: 1 },
      { status: "activa", estimate: null, weight: 1 },
    ];
    expect(plannedBudget(tasks)).toBe(4);
  });

  it("weightedProgress es el % de peso completado sobre el peso vigente", () => {
    const tasks = [
      { status: "completada", estimate: "1", weight: 3 },
      { status: "activa", estimate: "1", weight: 1 },
      { status: "cancelada", estimate: "1", weight: 5 },
    ];
    expect(weightedProgress(tasks)).toBe(75);
  });

  it("weightedProgress devuelve 0 si no hay tareas vigentes", () => {
    expect(
      weightedProgress([{ status: "cancelada", estimate: "1", weight: 1 }]),
    ).toBe(0);
  });

  it("projectStats calcula logged/confirmed/unconfirmed/closedBudget/deviation", () => {
    const stats = projectStats([
      {
        task: { status: "completada", estimate: "4", weight: 1 },
        logs: [{ hours: "5" }],
      },
      {
        task: { status: "activa", estimate: "2", weight: 1 },
        logs: [{ hours: "1" }],
      },
    ]);
    expect(stats.logged).toBe(6);
    expect(stats.confirmed).toBe(5);
    expect(stats.unconfirmed).toBe(1);
    expect(stats.closedBudget).toBe(4);
    expect(stats.deviation).toBe(1);
  });
});
