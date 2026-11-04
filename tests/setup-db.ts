import { afterEach } from "vitest";
import { user } from "../src/db/auth-schema.ts";
import { db } from "../src/db/client.ts";
import { tasks } from "../src/db/schema.ts";

afterEach(async () => {
  await db.delete(tasks);
  await db.delete(user);
});
