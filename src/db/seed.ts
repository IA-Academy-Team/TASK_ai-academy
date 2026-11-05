import { eq } from "drizzle-orm";
import { auth } from "../lib/auth.ts";
import { user } from "./auth-schema.ts";
import { db } from "./client.ts";
import { createProject } from "./projects-repo.ts";
import { createTask } from "./tasks-repo.ts";

const ADMIN_EMAIL = "admin@aiacademy.local";
const ADMIN_PASSWORD = "dev-admin-password-1234";

async function main() {
  const [existing] = await db
    .select()
    .from(user)
    .where(eq(user.email, ADMIN_EMAIL));

  if (!existing) {
    await auth.api.signUpEmail({
      body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, name: "Admin" },
    });
    await db
      .update(user)
      .set({ role: "admin" })
      .where(eq(user.email, ADMIN_EMAIL));

    const [admin] = await db
      .select()
      .from(user)
      .where(eq(user.email, ADMIN_EMAIL));

    const project = await createProject({
      name: "Nébula",
      code: "NEB-001",
      objective: "Actualizar la ruta formativa y dejar lista la plataforma.",
      leaderId: admin.id,
      start: "2026-10-27",
      due: "2026-11-20",
      limitActive: 2,
      limitReview: 2,
      memberIds: [admin.id],
    });

    await createTask({
      projectId: project.id,
      title: "Revisar propuesta comercial",
      deliverable: "Propuesta revisada y aprobada",
      description: "",
      ownerId: admin.id,
      priority: "media",
      weight: 1,
      estimate: "4",
      dependencyId: null,
      due: "2026-11-15",
      supportIds: [],
    });

    console.log(
      `seed: created admin ${ADMIN_EMAIL} and project ${project.code}`,
    );
  } else {
    console.log(`seed: admin ${ADMIN_EMAIL} already exists, skipping`);
  }

  process.exit(0);
}

main();
