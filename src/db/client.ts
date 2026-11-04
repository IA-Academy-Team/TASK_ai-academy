import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as authSchema from "./auth-schema.ts";
import * as appSchema from "./schema.ts";

const schema = { ...appSchema, ...authSchema };

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });
