import {
  date,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema.ts";

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  code: text("code").notNull(),
  objective: text("objective").notNull(),
  leaderId: text("leader_id")
    .notNull()
    .references(() => user.id),
  start: date("start").notNull(),
  due: date("due").notNull(),
  limitActive: integer("limit_active").notNull().default(2),
  limitReview: integer("limit_review").notNull().default(2),
  status: text("status").notNull().default("activo"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const projectMembers = pgTable(
  "project_members",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.userId] })],
);

// status: pendiente | activa | revision | completada | bloqueada | cancelada
// priority: baja | media | alta | critica
// Sin enum a nivel DB a propósito (misma convención que el resto del proyecto) — Zod es el gate.
export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Nullable a propósito: una tarea puede anclarse a un proyecto o existir
  // independiente, sin proyecto. "set null" para que borrar el proyecto
  // deje la tarea huérfana (independiente) en vez de destruirla.
  projectId: uuid("project_id").references(() => projects.id, {
    onDelete: "set null",
  }),
  order: integer("order").notNull().default(1),
  title: text("title").notNull(),
  deliverable: text("deliverable").notNull(),
  description: text("description").notNull().default(""),
  ownerId: text("owner_id")
    .notNull()
    .references(() => user.id),
  priority: text("priority").notNull().default("media"),
  weight: integer("weight").notNull().default(1),
  estimate: numeric("estimate", { precision: 6, scale: 1 }).notNull(),
  status: text("status").notNull().default("pendiente"),
  // Sin FK a nivel DB para evitar la referencia circular de la auto-relación;
  // la existencia se valida en el repo.
  dependencyId: uuid("dependency_id"),
  due: date("due").notNull(),
  // Nullable: la hora es opcional, la fecha límite sigue siendo obligatoria.
  dueTime: text("due_time"),
  evidence: text("evidence"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const taskSupport = pgTable(
  "task_support",
  {
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.taskId, t.userId] })],
);

// role: owner | support
export const taskLogs = pgTable("task_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  role: text("role").notNull(),
  date: date("date").notNull(),
  hours: numeric("hours", { precision: 5, scale: 1 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// action: task_created | task_status_changed | task_hours_logged |
//         task_updated | task_order_changed | project_settings_updated |
//         support_request_resolved
export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Nullable igual que tasks.projectId — una tarea independiente también
  // audita sus cambios, solo que sin proyecto asociado.
  projectId: uuid("project_id").references(() => projects.id, {
    onDelete: "set null",
  }),
  taskId: uuid("task_id").references(() => tasks.id, { onDelete: "cascade" }),
  // Sin cascade a propósito: es un registro histórico, igual que
  // taskLogs.userId — el borrado duro de un usuario queda bloqueado por esta
  // FK si alguna vez actuó en el sistema (desactivarlo sigue disponible).
  actorId: text("actor_id")
    .notNull()
    .references(() => user.id),
  action: text("action").notNull(),
  note: text("note").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// mode: invite | apply · status: pendiente | aceptada | rechazada
export const supportRequests = pgTable("support_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  // Sin cascade, misma razón que auditLog.actorId.
  requestedBy: text("requested_by")
    .notNull()
    .references(() => user.id),
  targetUserId: text("target_user_id")
    .notNull()
    .references(() => user.id),
  mode: text("mode").notNull(),
  reason: text("reason").notNull().default(""),
  status: text("status").notNull().default("pendiente"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});
