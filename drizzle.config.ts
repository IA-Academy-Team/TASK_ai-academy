import { defineConfig } from "drizzle-kit";

// drizzle-kit loads .env on its own (verified empirically: it connects correctly even
// with a deliberately wrong fallback below and a clean shell env) — no explicit loader needed.
export default defineConfig({
  dialect: "postgresql",
  schema: ["./src/db/schema.ts", "./src/db/auth-schema.ts"],
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://app:app@localhost:5433/ai_academy",
  },
});
