import { describe, expect, it } from "vitest";
import {
  bucketTasksByUrgency,
  capacityThreshold,
  enumerateDays,
  seriesForDays,
} from "../../src/domain/chart-data.ts";

describe("enumerateDays", () => {
  it("incluye ambos extremos del rango", () => {
    expect(enumerateDays("2026-11-01", "2026-11-03")).toEqual([
      "2026-11-01",
      "2026-11-02",
      "2026-11-03",
    ]);
  });

  it("devuelve un solo día cuando from === to", () => {
    expect(enumerateDays("2026-11-01", "2026-11-01")).toEqual(["2026-11-01"]);
  });
});

describe("seriesForDays", () => {
  it("rellena con 0 los días sin datos", () => {
    const days = ["2026-11-01", "2026-11-02", "2026-11-03"];
    const samples = [{ date: "2026-11-02", hours: 4 }];
    expect(seriesForDays(days, samples)).toEqual([0, 4, 0]);
  });
});

describe("capacityThreshold", () => {
  it("es 'ok' por debajo del 70%", () => {
    expect(capacityThreshold(20, 40)).toBe("ok");
  });

  it("es 'warn' entre 70% y 90%", () => {
    expect(capacityThreshold(30, 40)).toBe("warn");
  });

  it("es 'over' por encima del 90%", () => {
    expect(capacityThreshold(38, 40)).toBe("over");
  });

  it("es 'ok' con 0 horas y 0 capacidad", () => {
    expect(capacityThreshold(0, 0)).toBe("ok");
  });
});

describe("bucketTasksByUrgency", () => {
  const today = "2026-11-06";

  it("clasifica cada tarea en un único balde, con prioridad vencida > urgente", () => {
    const buckets = bucketTasksByUrgency(
      [
        { status: "completada", due: "2026-11-01", priority: "baja" },
        { status: "cancelada", due: "2026-11-01", priority: "alta" },
        { status: "activa", due: "2026-11-01", priority: "alta" }, // vencida, aunque también sea alta
        { status: "activa", due: "2026-11-10", priority: "critica" },
        { status: "pendiente", due: "2026-11-10", priority: "media" },
      ],
      today,
    );

    expect(buckets).toEqual({
      vencidas: 1,
      urgentes: 1,
      enCurso: 1,
      completadas: 1,
    });
  });
});
