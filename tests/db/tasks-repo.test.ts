import { describe, expect, it } from "vitest";
import {
  createTask,
  listTasks,
  updateStatus,
} from "../../src/db/tasks-repo.ts";

describe("tasks-repo", () => {
  it("createTask inserta con status pendiente por default", async () => {
    const row = await createTask({ title: "Test repo task" });
    expect(row.status).toBe("pendiente");
  });

  it("listTasks ordena por createdAt descendente", async () => {
    await createTask({ title: "Primera" });
    await createTask({ title: "Segunda" });
    const rows = await listTasks();
    const idxFirst = rows.findIndex((r) => r.title === "Primera");
    const idxSecond = rows.findIndex((r) => r.title === "Segunda");
    expect(idxSecond).toBeLessThan(idxFirst);
  });

  it("updateStatus en un id inexistente devuelve undefined", async () => {
    const result = await updateStatus(
      "00000000-0000-0000-0000-000000000000",
      "completada",
    );
    expect(result).toBeUndefined();
  });
});
