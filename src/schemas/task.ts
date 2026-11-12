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

export const createTaskSchema = z.object({
  projectId: z.string().min(1).optional(),
  title: z.string().min(1).max(200),
  deliverable: z.string().min(1).max(300),
  description: z.string().max(2000).optional().default(""),
  ownerId: z.string().min(1),
  priority: priorityEnum,
  weight: z.coerce.number().int().min(1).max(10),
  estimate: z.coerce.number().positive().max(999),
  dependencyId: z
    .string()
    .optional()
    .transform((v) => (v ? v : null)),
  due: dateString,
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
});

export const updateTaskSchema = z.object({
  motivo: z.string().min(1).max(500),
  title: z.string().min(1).max(200),
  deliverable: z.string().min(1).max(300),
  description: z.string().max(2000).optional().default(""),
  ownerId: z.string().min(1),
  priority: priorityEnum,
  weight: z.coerce.number().int().min(1).max(10),
  estimate: z.coerce.number().positive().max(999),
  dependencyId: z
    .string()
    .optional()
    .transform((v) => (v ? v : null)),
  due: dateString,
});

export const requestSupportSchema = z.object({
  targetUserId: z.string().min(1),
  mode: z.enum(["invite", "apply"]),
  reason: z.string().max(1000).optional().default(""),
});

export const resolveSupportRequestSchema = z.object({
  status: z.enum(["aceptada", "rechazada"]),
});

export const deliverySchema = z.object({
  date: dateString,
  hours: z.coerce.number().positive().max(24),
  evidence: z.string().min(1).max(2000),
});
