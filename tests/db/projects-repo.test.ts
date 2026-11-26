import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { user } from "../../src/db/auth-schema.ts";
import { db } from "../../src/db/client.ts";
import {
  createProject,
  deleteProject,
  generateProjectCode,
  getProject,
  listAllActiveUsers,
  listLeaderCandidates,
  listMembers,
  listProjects,
  setMembers,
  updateSettings,
} from "../../src/db/projects-repo.ts";
import { createTask } from "../../src/db/tasks-repo.ts";
import { ADMIN_ROLE } from "../../src/domain/roles.ts";
import { auth } from "../../src/lib/auth.ts";

async function makeUser(email: string) {
  await auth.api.signUpEmail({
    body: { email, password: "supersecret123", name: "Test" },
  });
  const [row] = await db.select().from(user).where(eq(user.email, email));
  return row;
}

describe("projects-repo", () => {
  it("createProject no agrega al líder como integrante", async () => {
    const leader = await makeUser("leader1@test.local");
    const project = await createProject({
      name: "Proyecto X",
      code: "PX-1",
      objective: "Objetivo",
      leaderId: leader.id,
      start: "2026-01-01",
      due: "2026-02-01",
      limitActive: 2,
      limitReview: 2,
      memberIds: [],
    });

    expect(project.name).toBe("Proyecto X");
    const members = await listMembers(project.id);
    expect(members.map((m) => m.id)).not.toContain(leader.id);
  });

  it("createProject filtra al líder si viene incluido en memberIds", async () => {
    const leader = await makeUser("leader1b@test.local");
    const other = await makeUser("other1b@test.local");
    const project = await createProject({
      name: "Proyecto X2",
      code: "PX2-1",
      objective: "Objetivo",
      leaderId: leader.id,
      start: "2026-01-01",
      due: "2026-02-01",
      limitActive: 2,
      limitReview: 2,
      memberIds: [leader.id, other.id],
    });

    const members = await listMembers(project.id);
    expect(members.map((m) => m.id).sort()).toEqual([other.id].sort());
  });

  it("listAllActiveUsers excluye administrador, listLeaderCandidates lo incluye", async () => {
    const admin = await makeUser("admin-candidate@test.local");
    await db
      .update(user)
      .set({ role: ADMIN_ROLE })
      .where(eq(user.id, admin.id));
    const colaborador = await makeUser("colaborador-candidate@test.local");

    const assignable = await listAllActiveUsers();
    expect(assignable.map((u) => u.id)).not.toContain(admin.id);
    expect(assignable.map((u) => u.id)).toContain(colaborador.id);

    const leaderCandidates = await listLeaderCandidates();
    expect(leaderCandidates.map((u) => u.id)).toContain(admin.id);
    expect(leaderCandidates.map((u) => u.id)).toContain(colaborador.id);
  });

  it("listProjects incluye el conteo de tareas", async () => {
    const leader = await makeUser("leader2@test.local");
    await createProject({
      name: "Proyecto Y",
      code: "PY-1",
      objective: "Objetivo",
      leaderId: leader.id,
      start: "2026-01-01",
      due: "2026-02-01",
      limitActive: 2,
      limitReview: 2,
      memberIds: [],
    });

    const list = await listProjects();
    const found = list.find((p) => p.code === "PY-1");
    expect(found?.taskCount).toBe(0);
  });

  it("updateSettings y setMembers actualizan el proyecto", async () => {
    const leader = await makeUser("leader3@test.local");
    const member = await makeUser("member3@test.local");
    const project = await createProject({
      name: "Proyecto Z",
      code: "PZ-1",
      objective: "Objetivo",
      leaderId: leader.id,
      start: "2026-01-01",
      due: "2026-02-01",
      limitActive: 2,
      limitReview: 2,
      memberIds: [],
    });

    await updateSettings(project.id, {
      limitActive: 5,
      limitReview: 5,
      due: "2026-03-01",
      actorId: leader.id,
    });
    await setMembers(project.id, [leader.id, member.id]);

    const members = await listMembers(project.id);
    expect(members.map((m) => m.id).sort()).toEqual(
      [leader.id, member.id].sort(),
    );
  });

  it("generateProjectCode arma el prefijo con las iniciales del nombre", async () => {
    const code = await generateProjectCode("Future Minds Labs");
    expect(code).toBe("FML-001");
  });

  it("generateProjectCode usa las primeras letras cuando el nombre es una sola palabra", async () => {
    const code = await generateProjectCode("Nébula");
    expect(code).toBe("NEB-001");
  });

  it("generateProjectCode sigue la secuencia si el prefijo ya existe", async () => {
    const leader = await makeUser("leader-code@test.local");
    await createProject({
      name: "Equipo Alfa Beta",
      code: "EAB-001",
      objective: "Objetivo",
      leaderId: leader.id,
      start: "2026-01-01",
      due: "2026-02-01",
      limitActive: 2,
      limitReview: 2,
      memberIds: [],
    });

    const code = await generateProjectCode("Equipo Alfa Beta");
    expect(code).toBe("EAB-002");
  });

  it("deleteProject borra el proyecto y sus tareas en cascada", async () => {
    const leader = await makeUser("leader-delete@test.local");
    const project = await createProject({
      name: "Proyecto a borrar",
      code: "PAB-001",
      objective: "Objetivo",
      leaderId: leader.id,
      start: "2026-01-01",
      due: "2026-02-01",
      limitActive: 2,
      limitReview: 2,
      memberIds: [],
    });
    await createTask({
      projectId: project.id,
      title: "Tarea",
      deliverable: "Entregable",
      description: "",
      ownerId: leader.id,
      priority: "media",
      weight: 1,
      estimate: "2",
      dependencyId: null,
      due: "2026-01-15",
      supportIds: [],
      actorId: leader.id,
    });

    await deleteProject(project.id);

    expect(await getProject(project.id)).toBeUndefined();
    const remaining = await listProjects();
    expect(remaining.map((p) => p.id)).not.toContain(project.id);
  });
});
