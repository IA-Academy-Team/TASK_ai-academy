import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { user } from "../../src/db/auth-schema.ts";
import { db } from "../../src/db/client.ts";
import { createProject } from "../../src/db/projects-repo.ts";
import { getSidebarCounts } from "../../src/db/sidebar-repo.ts";
import { createRequest } from "../../src/db/support-requests-repo.ts";
import { createTask } from "../../src/db/tasks-repo.ts";
import { auth } from "../../src/lib/auth.ts";

async function makeUser(email: string) {
  await auth.api.signUpEmail({
    body: { email, password: "supersecret123", name: "Test" },
  });
  const [row] = await db.select().from(user).where(eq(user.email, email));
  return row;
}

describe("getSidebarCounts", () => {
  it("cuenta 0/0 para un usuario sin pendientes", async () => {
    const solo = await makeUser("sidebar-solo@test.local");

    const counts = await getSidebarCounts(solo.id, "usuario");

    expect(counts).toEqual({ notifications: 0, supports: 0 });
  });

  it("suma tareas vencidas y solicitudes de apoyo pendientes", async () => {
    const leader = await makeUser("sidebar-leader@test.local");
    const target = await makeUser("sidebar-target@test.local");

    const project = await createProject({
      name: "Proyecto",
      code: "SB-1",
      objective: "Objetivo",
      leaderId: leader.id,
      start: "2026-01-01",
      due: "2026-02-01",
      limitActive: 2,
      limitReview: 2,
      memberIds: [],
    });
    const task = await createTask({
      projectId: project.id,
      title: "Tarea vencida",
      deliverable: "Entregable",
      description: "",
      ownerId: leader.id,
      priority: "media",
      weight: 1,
      estimate: "1",
      dependencyId: null,
      due: "2020-01-01",
      supportIds: [],
      actorId: leader.id,
    });
    await createRequest({
      taskId: task.id,
      requestedBy: leader.id,
      targetUserId: target.id,
      mode: "invite",
      reason: "necesito ayuda",
    });

    const counts = await getSidebarCounts(target.id, "usuario");

    expect(counts.supports).toBe(1);
  });
});
