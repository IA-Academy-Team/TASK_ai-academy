import { afterEach } from "vitest";
import { user } from "../src/db/auth-schema.ts";
import { db } from "../src/db/client.ts";
import { projects } from "../src/db/schema.ts";

afterEach(async () => {
  await db.delete(projects);
  await db.delete(user);
});
