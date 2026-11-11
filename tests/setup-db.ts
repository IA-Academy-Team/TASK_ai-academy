import { afterEach } from "vitest";
import { user } from "../src/db/auth-schema.ts";
import { db } from "../src/db/client.ts";
import { auditLog, projects, tasks } from "../src/db/schema.ts";

afterEach(async () => {
  // auditLog y tasks no cascadean al borrar su proyecto (projectId es
  // "set null" a propósito, ver schema.ts) y bloquean el delete de user si
  // quedan huérfanos — hay que limpiarlos explícitamente antes.
  await db.delete(auditLog);
  await db.delete(tasks);
  await db.delete(projects);
  await db.delete(user);
});
