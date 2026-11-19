import { describe, expect, it } from "vitest";
import {
  fridayOf,
  mondayOf,
  monthEndOf,
  monthStartOf,
  toDateString,
} from "../../src/domain/dates.ts";

describe("mondayOf / fridayOf", () => {
  it("devuelve el mismo lunes para cualquier día de esa semana", () => {
    // 2026-01-14 es un miércoles.
    const monday = mondayOf(new Date(2026, 0, 14));
    expect(toDateString(monday)).toBe("2026-01-12");
  });

  it("retrocede al lunes anterior cuando el día es domingo", () => {
    const monday = mondayOf(new Date(2026, 0, 18));
    expect(toDateString(monday)).toBe("2026-01-12");
  });

  it("fridayOf devuelve el viernes de la semana de ese lunes", () => {
    const monday = mondayOf(new Date(2026, 0, 14));
    expect(toDateString(fridayOf(monday))).toBe("2026-01-16");
  });
});

describe("monthStartOf / monthEndOf", () => {
  it("devuelve el primer día del mes", () => {
    expect(monthStartOf(new Date(2026, 1, 20))).toBe("2026-02-01");
  });

  it("devuelve el último día de un mes de 28 días", () => {
    expect(monthEndOf(new Date(2026, 1, 5))).toBe("2026-02-28");
  });

  it("devuelve el último día de un mes de 31 días", () => {
    expect(monthEndOf(new Date(2026, 0, 5))).toBe("2026-01-31");
  });
});
