import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { user } from "../../src/db/auth-schema.ts";
import { db } from "../../src/db/client.ts";
import { createProject } from "../../src/db/projects-repo.ts";
import {
  createRequest,
  listPendingForUser,
  resolveRequest,
  updateRequestTarget,
} from "../../src/db/support-requests-repo.ts";
import { createTask, listSupport } from "../../src/db/tasks-repo.ts";
import { auth } from "../../src/lib/auth.ts";

async function makeUser(email: string) {
  await auth.api.signUpEmail({
    body: { email, password: "supersecret123", name: "Test" },
  });
  const [row] = await db.select().from(user).where(eq(user.email, email));
  return row;
}

async function makeTask(leaderId: string) {
  const project = await createProject({
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
  return createTask({
    projectId: project.id,
    title: "T",
    deliverable: "E",
    description: "",
    ownerId: leaderId,
    priority: "media",
    weight: 1,
    estimate: "1",
    dependencyId: null,
    due: "2026-01-10",
    supportIds: [],
    actorId: leaderId,
  });
}

describe("support-requests-repo", () => {
  it("createRequest queda pendiente y visible para el destinatario", async () => {
    const leader = await makeUser("sr-leader1@test.local");
    const target = await makeUser("sr-target1@test.local");
    const task = await makeTask(leader.id);

    await createRequest({
      taskId: task.id,
      requestedBy: leader.id,
      targetUserId: target.id,
      mode: "invite",
      reason: "Necesito apoyo",
    });

    const pending = await listPendingForUser(target.id);
    expect(pending.length).toBe(1);
    expect(pending[0].status).toBe("pendiente");
  });

  it("resolveRequest aceptada agrega al usuario como apoyo de la tarea", async () => {
    const leader = await makeUser("sr-leader2@test.local");
    const target = await makeUser("sr-target2@test.local");
    const task = await makeTask(leader.id);

    const request = await createRequest({
      taskId: task.id,
      requestedBy: leader.id,
      targetUserId: target.id,
      mode: "invite",
      reason: "Necesito apoyo",
    });

    const resolved = await resolveRequest(request.id, "aceptada", leader.id);
    expect(resolved?.status).toBe("aceptada");

    const support = await listSupport(task.id);
    expect(support.map((s) => s.userId)).toContain(target.id);
  });

  it("resolveRequest rechaza resolver una solicitud ya resuelta", async () => {
    const leader = await makeUser("sr-leader3@test.local");
    const target = await makeUser("sr-target3@test.local");
    const task = await makeTask(leader.id);

    const request = await createRequest({
      taskId: task.id,
      requestedBy: leader.id,
      targetUserId: target.id,
      mode: "invite",
      reason: "Necesito apoyo",
    });
    await resolveRequest(request.id, "rechazada", leader.id);

    await expect(
      resolveRequest(request.id, "aceptada", leader.id),
    ).rejects.toThrow(/ya fue resuelta/);
  });

  it("updateRequestTarget cambia el destinatario de una solicitud pendiente", async () => {
    const leader = await makeUser("sr-leader4@test.local");
    const target = await makeUser("sr-target4@test.local");
    const newTarget = await makeUser("sr-target4b@test.local");
    const task = await makeTask(leader.id);

    const request = await createRequest({
      taskId: task.id,
      requestedBy: leader.id,
      targetUserId: target.id,
      mode: "invite",
      reason: "Necesito apoyo",
    });

    const updated = await updateRequestTarget(request.id, newTarget.id);
    expect(updated?.targetUserId).toBe(newTarget.id);

    const pendingForNewTarget = await listPendingForUser(newTarget.id);
    expect(pendingForNewTarget.map((r) => r.id)).toContain(request.id);
  });

  it("updateRequestTarget rechaza reasignar una solicitud ya resuelta", async () => {
    const leader = await makeUser("sr-leader5@test.local");
    const target = await makeUser("sr-target5@test.local");
    const newTarget = await makeUser("sr-target5b@test.local");
    const task = await makeTask(leader.id);

    const request = await createRequest({
      taskId: task.id,
      requestedBy: leader.id,
      targetUserId: target.id,
      mode: "invite",
      reason: "Necesito apoyo",
    });
    await resolveRequest(request.id, "rechazada", leader.id);

    await expect(updateRequestTarget(request.id, newTarget.id)).rejects.toThrow(
      /ya fue resuelta/,
    );
  });
});
