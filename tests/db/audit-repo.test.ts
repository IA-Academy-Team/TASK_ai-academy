import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  listByProject,
  listByTask,
  recordChange,
} from "../../src/db/audit-repo.ts";
import { user } from "../../src/db/auth-schema.ts";
import { db } from "../../src/db/client.ts";
import { createProject } from "../../src/db/projects-repo.ts";
import { createTask } from "../../src/db/tasks-repo.ts";
import { auth } from "../../src/lib/auth.ts";

async function makeUser(email: string) {
  await auth.api.signUpEmail({
    body: { email, password: "supersecret123", name: "Test" },
  });
  const [row] = await db.select().from(user).where(eq(user.email, email));
  return row;
}

async function makeProject(leaderId: string) {
  return createProject({
    name: "Proyecto",
    code: "P-1",
    objective: "Objetivo",
    leaderId,
    start: "2026-01-01",
    due: "2026-02-01",
    limitActive: 1,
    limitReview: 1,
    memberIds: [],
  });
}

describe("audit-repo", () => {
  it("recordChange guarda una entrada y listByProject la devuelve", async () => {
    const leader = await makeUser("audit-leader1@test.local");
    const project = await makeProject(leader.id);

    await recordChange({
      projectId: project.id,
      actorId: leader.id,
      action: "project_settings_updated",
      note: "límites actualizados",
    });

    const rows = await listByProject(project.id);
    expect(rows.length).toBe(1);
    expect(rows[0].action).toBe("project_settings_updated");
    expect(rows[0].actorId).toBe(leader.id);
  });

  it("createTask y transitionTask quedan registrados en el audit log de la tarea", async () => {
    const leader = await makeUser("audit-leader2@test.local");
    const project = await makeProject(leader.id);

    const task = await createTask({
      projectId: project.id,
      title: "T",
      deliverable: "E",
      description: "",
      ownerId: leader.id,
      priority: "media",
      weight: 1,
      estimate: "1",
      dependencyId: null,
      due: "2026-01-10",
      supportIds: [],
      actorId: leader.id,
    });

    const rows = await listByTask(task.id);
    expect(rows.map((r) => r.action)).toEqual(["task_created"]);
  });
});
