import { z } from "zod";

export const createProjectSchema = z.object({
  name: z.string().min(1).max(120),
  code: z.string().min(1).max(30),
  objective: z.string().min(1).max(500),
  leaderId: z.string().min(1),
  start: z.string().min(1),
  due: z.string().min(1),
  limitActive: z.coerce.number().int().min(1).max(20),
  limitReview: z.coerce.number().int().min(1).max(20),
  members: z.union([z.string(), z.array(z.string())]).optional(),
});

export const updateSettingsSchema = z.object({
  limitActive: z.coerce.number().int().min(1).max(20),
  limitReview: z.coerce.number().int().min(1).max(20),
  due: z.string().min(1),
  members: z.union([z.string(), z.array(z.string())]).optional(),
});

export function toArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}
