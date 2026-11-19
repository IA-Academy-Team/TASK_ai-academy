import { eq } from "drizzle-orm";
import { ADMIN_ROLE } from "../domain/roles.ts";
import { auth } from "../lib/auth.ts";
import { user } from "./auth-schema.ts";
import { db } from "./client.ts";

// El seed de despliegue no crea datos de demostración. Las credenciales pueden
// definirse en el entorno del VPS; los valores por defecto son solo para el
// primer acceso y el usuario deberá cambiarlos inmediatamente.
const ADMIN_EMAIL = process.env.INITIAL_ADMIN_EMAIL ?? "admin@aiacademy.local";
const ADMIN_NAME = process.env.INITIAL_ADMIN_NAME ?? "Administrador maestro";
const ADMIN_PASSWORD = process.env.INITIAL_ADMIN_PASSWORD ?? "Admin123!";

async function main() {
  const [existing] = await db
    .select()
    .from(user)
    .where(eq(user.email, ADMIN_EMAIL));

  if (existing) {
    await db
      .update(user)
      .set({ role: ADMIN_ROLE, isActive: true, mustChangePassword: true })
      .where(eq(user.id, existing.id));
    console.log(`seed: administrador maestro listo (${ADMIN_EMAIL})`);
    return;
  }

  const created = await auth.api.signUpEmail({
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, name: ADMIN_NAME },
  });
  await db
    .update(user)
    .set({ role: ADMIN_ROLE, isActive: true, mustChangePassword: true })
    .where(eq(user.id, created.user.id));
  console.log(`seed: administrador maestro creado (${ADMIN_EMAIL})`);
}

main()
  .catch((error: unknown) => {
    console.error("seed error", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$client.end();
  });
