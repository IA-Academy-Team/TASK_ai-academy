import { describe, expect, it } from "vitest";
import {
  dayTotalHours,
  layoutDayBlocks,
  timeAxisMarks,
  totalHours,
} from "../../src/domain/week-calendar.ts";

describe("layoutDayBlocks", () => {
  it("apila las tareas una después de otra según sus horas", () => {
    const blocks = layoutDayBlocks([
      { id: "a", title: "A", priority: "media", estimate: 2 },
      { id: "b", title: "B", priority: "media", estimate: 3 },
    ]);
    expect(blocks.map((b) => b.topHours)).toEqual([0, 2]);
  });

  it("ordena por prioridad antes de apilar, sin importar el orden de entrada", () => {
    const blocks = layoutDayBlocks([
      { id: "low", title: "Baja", priority: "baja", estimate: 1 },
      { id: "crit", title: "Crítica", priority: "critica", estimate: 1 },
      { id: "med", title: "Media", priority: "media", estimate: 1 },
    ]);
    expect(blocks.map((b) => b.id)).toEqual(["crit", "med", "low"]);
    expect(blocks.map((b) => b.topHours)).toEqual([0, 1, 2]);
  });

  it("devuelve vacío para un día sin tareas", () => {
    expect(layoutDayBlocks([])).toEqual([]);
  });
});

describe("totalHours", () => {
  it("suma las horas estimadas de todas las tareas", () => {
    expect(
      totalHours([
        { id: "a", title: "A", priority: "media", estimate: 2.5 },
        { id: "b", title: "B", priority: "media", estimate: 1.5 },
      ]),
    ).toBe(4);
  });

  it("es 0 para una lista vacía", () => {
    expect(totalHours([])).toBe(0);
  });
});

describe("dayTotalHours", () => {
  it("devuelve el fin del último bloque apilado", () => {
    const blocks = layoutDayBlocks([
      { id: "a", title: "A", priority: "media", estimate: 5 },
      { id: "b", title: "B", priority: "media", estimate: 6 },
    ]);
    expect(dayTotalHours(blocks)).toBe(11);
  });

  it("es 0 sin bloques", () => {
    expect(dayTotalHours([])).toBe(0);
  });
});

describe("timeAxisMarks", () => {
  it("sin desborde, termina en 18:00", () => {
    const marks = timeAxisMarks(0);
    expect(marks.at(-1)?.label).toBe("18:00");
  });

  it("con desborde, agrega marcas por hora más allá de 18:00", () => {
    const marks = timeAxisMarks(3.2);
    const labels = marks.map((m) => m.label);
    expect(labels).toContain("19:00");
    expect(labels).toContain("20:00");
    expect(labels).toContain("21:00");
    expect(labels).toContain("22:00");
    expect(marks.at(-1)?.label).toBe("22:00");
    expect(marks.at(-1)?.anchor).toBe("end");
  });
});
