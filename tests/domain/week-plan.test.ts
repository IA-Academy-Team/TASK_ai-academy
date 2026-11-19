import { describe, expect, it } from "vitest";
import { groupTasksByWeekday } from "../../src/domain/week-plan.ts";

describe("groupTasksByWeekday", () => {
  it("distribuye las tareas de lunes a viernes según su fecha de planificación", () => {
    const days = groupTasksByWeekday(
      [
        { id: "monday", due: "2026-11-16" },
        { id: "wednesday", due: "2026-11-18" },
        { id: "outside", due: "2026-11-23" },
      ],
      "2026-11-16",
    );

    expect(days.map((day) => day.label)).toEqual([
      "Lunes",
      "Martes",
      "Miércoles",
      "Jueves",
      "Viernes",
    ]);
    expect(days[0].tasks.map((task) => task.id)).toEqual(["monday"]);
    expect(days[2].tasks.map((task) => task.id)).toEqual(["wednesday"]);
    expect(days[4].tasks).toEqual([]);
  });
});
