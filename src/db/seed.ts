import { eq } from "drizzle-orm";
import { auth } from "../lib/auth.ts";
import { user } from "./auth-schema.ts";
import { db } from "./client.ts";
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
    await createTask({ title: "Revisar propuesta comercial" });
    console.log(`seed: created admin ${ADMIN_EMAIL}`);
  } else {
    console.log(`seed: admin ${ADMIN_EMAIL} already exists, skipping`);
  }

  process.exit(0);
}

main();
