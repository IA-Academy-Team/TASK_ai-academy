import { z } from "zod";

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
  due: z.string().min(1),
  support: z.union([z.string(), z.array(z.string())]).optional(),
});

export const transitionSchema = z.object({
  status: statusEnum,
  evidence: z.string().max(2000).optional(),
});

export const logHoursSchema = z.object({
  date: z.string().min(1),
  hours: z.coerce.number().positive().max(24),
});
