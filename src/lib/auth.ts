import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import * as authSchema from "../db/auth-schema.ts";
import { db } from "../db/client.ts";
import * as appSchema from "../db/schema.ts";
import { DEFAULT_ROLE } from "../domain/roles.ts";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { ...appSchema, ...authSchema },
  }),
  emailAndPassword: { enabled: true },
  // better-auth ya limita /sign-in* a 3 intentos cada 10s por defecto, pero
  // solo si está activo — por defecto solo se activa cuando NODE_ENV=production.
  // Lo dejamos explícito para no depender de esa variable de entorno.
  rateLimit: { enabled: true },
  user: {
    additionalFields: {
      role: { type: "string", defaultValue: DEFAULT_ROLE, input: false },
      isActive: { type: "boolean", defaultValue: true, input: false },
      weeklyCapacityHours: { type: "number", defaultValue: 40, input: false },
      mustChangePassword: {
        type: "boolean",
        defaultValue: false,
        input: false,
      },
      // Color distintivo elegido por cada usuario en /perfil — a diferencia
      // de role/isActive, este campo SÍ lo puede setear el propio usuario.
      color: { type: "string", defaultValue: "#7346CC", input: true },
    },
  },
});
