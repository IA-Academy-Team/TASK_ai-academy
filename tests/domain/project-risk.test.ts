import { describe, expect, it } from "vitest";
import { daysUntil, projectRiskInfo } from "../../src/domain/project-risk.ts";

describe("daysUntil", () => {
  it("cuenta los días entre hoy y la fecha límite", () => {
    expect(daysUntil("2026-11-13", "2026-11-06")).toBe(7);
  });

  it("devuelve negativo cuando ya venció", () => {
    expect(daysUntil("2026-11-01", "2026-11-06")).toBe(-5);
  });
});

describe("projectRiskInfo", () => {
  it("es 'done' cuando todas las tareas están completadas", () => {
    const info = projectRiskInfo(
      { due: "2026-12-01", taskCount: 3, doneCount: 3 },
      "2026-11-06",
    );
    expect(info.level).toBe("done");
  });

  it("es 'risk' cuando faltan 7 días o menos y no está completo", () => {
    const info = projectRiskInfo(
      { due: "2026-11-10", taskCount: 3, doneCount: 1 },
      "2026-11-06",
    );
    expect(info.level).toBe("risk");
  });

  it("es 'ok' cuando faltan más de 7 días y no está completo", () => {
    const info = projectRiskInfo(
      { due: "2026-12-01", taskCount: 3, doneCount: 1 },
      "2026-11-06",
    );
    expect(info.level).toBe("ok");
  });

  it("es 'risk' en vez de 'done' con 0 tareas, aunque doneCount === taskCount", () => {
    const info = projectRiskInfo(
      { due: "2026-11-10", taskCount: 0, doneCount: 0 },
      "2026-11-06",
    );
    expect(info.level).toBe("risk");
  });
});
