import { desc, eq } from "drizzle-orm";
import { db } from "./client.ts";
import { tasks } from "./schema.ts";

export async function createTask(input: { title: string }) {
  const [row] = await db
    .insert(tasks)
    .values({ title: input.title })
    .returning();
  return row;
}

export async function listTasks() {
  return db.select().from(tasks).orderBy(desc(tasks.createdAt));
}

export async function filterTasks(status: string) {
  return db
    .select()
    .from(tasks)
    .where(eq(tasks.status, status))
    .orderBy(desc(tasks.createdAt));
}

export async function updateStatus(id: string, status: string) {
  const [row] = await db
    .update(tasks)
    .set({ status, updatedAt: new Date() })
    .where(eq(tasks.id, id))
    .returning();
  return row;
}
