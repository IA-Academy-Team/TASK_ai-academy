import { describe, expect, it } from "vitest";
import {
  compareTasks,
  matchTaskState,
  priorityRank,
  type TaskForRank,
} from "../../src/domain/filters.ts";

const today = "2026-11-05";

describe("domain/filters", () => {
  describe("matchTaskState", () => {
    it("todas excluye solo canceladas", () => {
      expect(
        matchTaskState(
          { status: "completada", due: today, priority: "baja" },
          "todas",
          today,
        ),
      ).toBe(true);
      expect(
        matchTaskState(
          { status: "cancelada", due: today, priority: "baja" },
          "todas",
          today,
        ),
      ).toBe(false);
    });

    it("vencidas excluye done/cancelada y exige due < today", () => {
      expect(
        matchTaskState(
          { status: "activa", due: "2026-11-01", priority: "baja" },
          "vencidas",
          today,
        ),
      ).toBe(true);
      expect(
        matchTaskState(
          { status: "completada", due: "2026-11-01", priority: "baja" },
          "vencidas",
          today,
        ),
      ).toBe(false);
      expect(
        matchTaskState(
          { status: "activa", due: "2026-11-10", priority: "baja" },
          "vencidas",
          today,
        ),
      ).toBe(false);
    });

    it("urgentes exige prioridad critica/alta y no done/cancelada", () => {
      expect(
        matchTaskState(
          { status: "activa", due: today, priority: "critica" },
          "urgentes",
          today,
        ),
      ).toBe(true);
      expect(
        matchTaskState(
          { status: "completada", due: today, priority: "critica" },
          "urgentes",
          today,
        ),
      ).toBe(false);
      expect(
        matchTaskState(
          { status: "activa", due: today, priority: "media" },
          "urgentes",
          today,
        ),
      ).toBe(false);
    });

    it("un estado literal compara igualdad exacta", () => {
      expect(
        matchTaskState(
          { status: "bloqueada", due: today, priority: "baja" },
          "bloqueada",
          today,
        ),
      ).toBe(true);
      expect(
        matchTaskState(
          { status: "activa", due: today, priority: "baja" },
          "bloqueada",
          today,
        ),
      ).toBe(false);
    });
  });

  describe("priorityRank", () => {
    function task(overrides: Partial<TaskForRank>): TaskForRank {
      return {
        status: "pendiente",
        due: today,
        priority: "media",
        order: 1,
        dependencyId: null,
        dependencyDone: true,
        ...overrides,
      };
    }

    it("respeta el orden de rango del SPEC", () => {
      expect(priorityRank(task({ status: "bloqueada" }), today)).toBe(0);
      expect(priorityRank(task({ status: "revision" }), today)).toBe(1);
      expect(
        priorityRank(task({ status: "activa", due: "2026-11-01" }), today),
      ).toBe(2);
      expect(priorityRank(task({ status: "activa" }), today)).toBe(3);
      expect(
        priorityRank(
          task({ status: "completada", priority: "critica" }),
          today,
        ),
      ).toBe(8);
      expect(priorityRank(task({ priority: "critica" }), today)).toBe(4);
      expect(priorityRank(task({ priority: "alta" }), today)).toBe(5);
      expect(
        priorityRank(
          task({ dependencyId: "dep-1", dependencyDone: false }),
          today,
        ),
      ).toBe(7);
      expect(priorityRank(task({}), today)).toBe(6);
      expect(priorityRank(task({ status: "cancelada" }), today)).toBe(8);
    });
  });

  describe("compareTasks", () => {
    function task(overrides: Partial<TaskForRank>): TaskForRank {
      return {
        status: "pendiente",
        due: today,
        priority: "media",
        order: 1,
        dependencyId: null,
        dependencyDone: true,
        ...overrides,
      };
    }

    it("sequence ordena por order", () => {
      const a = task({ order: 2 });
      const b = task({ order: 1 });
      expect(compareTasks(a, b, "sequence", today)).toBeGreaterThan(0);
    });

    it("due ordena por fecha límite, luego order", () => {
      const a = task({ due: "2026-12-01", order: 1 });
      const b = task({ due: "2026-11-10", order: 2 });
      expect(compareTasks(a, b, "due", today)).toBeGreaterThan(0);
    });

    it("priority ordena por rango, luego prioridad, luego fecha", () => {
      const blocked = task({ status: "bloqueada", order: 5 });
      const normal = task({ order: 1 });
      expect(compareTasks(blocked, normal, "priority", today)).toBeLessThan(0);

      const critica = task({ priority: "critica" });
      const media = task({ priority: "media" });
      expect(compareTasks(critica, media, "priority", today)).toBeLessThan(0);
    });
  });
});
