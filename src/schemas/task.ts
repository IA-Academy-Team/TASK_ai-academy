import { z } from "zod";
import { dateString } from "./shared.ts";

export const priorityEnum = z.enum(["baja", "media", "alta", "critica"]);
export const statusEnum = z.enum([
  "pendiente",
  "activa",
  "revision",
  "completada",
  "bloqueada",
  "cancelada",
]);

export const TASK_ESTIMATE_MAX_HOURS = 16;

export function isValidTaskDueTime(value: string): boolean {
  return (
    value >= "08:00" &&
    value <= "18:00" &&
    !(value >= "12:00" && value < "14:00")
  );
}

const dueTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
  .refine(isValidTaskDueTime, {
    message: "la hora debe estar entre 08:00–12:00 o 14:00–18:00",
  });

export const createTaskSchema = z.object({
  projectId: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().min(1).optional(),
  ),
  title: z.string().min(1).max(200),
  deliverable: z.string().min(1).max(300),
  description: z.string().max(2000).optional().default(""),
  ownerId: z.string().min(1),
  priority: priorityEnum,
  estimate: z.coerce.number().positive().max(TASK_ESTIMATE_MAX_HOURS),
  due: dateString,
  dueTime: dueTimeSchema,
  support: z.union([z.string(), z.array(z.string())]).optional(),
});

export const transitionSchema = z.object({
  status: statusEnum,
  evidence: z.string().max(2000).optional(),
  note: z.string().max(2000).optional(),
});

export const logHoursSchema = z.object({
  date: dateString,
  hours: z.coerce.number().positive().max(24),
  description: z.string().max(1000).optional().default(""),
});

export const updateTaskSchema = z.object({
  motivo: z.string().min(1).max(500),
  title: z.string().min(1).max(200),
  deliverable: z.string().min(1).max(300),
  description: z.string().max(2000).optional().default(""),
  ownerId: z.string().min(1),
  priority: priorityEnum,
  estimate: z.coerce.number().positive().max(TASK_ESTIMATE_MAX_HOURS),
  dependencyId: z
    .string()
    .optional()
    .transform((v) => (v ? v : null)),
  due: dateString,
  dueTime: dueTimeSchema,
});

export const requestSupportSchema = z.object({
  targetUserId: z.string().min(1),
  mode: z.enum(["invite", "apply"]),
  reason: z.string().max(1000).optional().default(""),
});

export const reassignSupportRequestSchema = z.object({
  targetUserId: z.string().min(1),
});

export const resolveSupportRequestSchema = z.object({
  status: z.enum(["aceptada", "rechazada"]),
});

export const deliverySchema = z.object({
  date: dateString,
  hours: z.coerce.number().positive().max(24),
  evidence: z.string().min(1).max(2000),
});
