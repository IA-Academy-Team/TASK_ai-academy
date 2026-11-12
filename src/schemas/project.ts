import { z } from "zod";
import { dateString } from "./shared.ts";

export const createProjectSchema = z
  .object({
    name: z.string().min(1).max(120),
    objective: z.string().min(1).max(500),
    leaderId: z.string().min(1),
    start: dateString,
    due: dateString,
    limitActive: z.coerce.number().int().min(1).max(20),
    limitReview: z.coerce.number().int().min(1).max(20),
    members: z.union([z.string(), z.array(z.string())]).optional(),
  })
  .refine((data) => data.due >= data.start, {
    message: "la fecha de vencimiento no puede ser anterior al inicio",
    path: ["due"],
  });

export const updateSettingsSchema = z.object({
  limitActive: z.coerce.number().int().min(1).max(20),
  limitReview: z.coerce.number().int().min(1).max(20),
  due: dateString,
  members: z.union([z.string(), z.array(z.string())]).optional(),
});

export const moveTaskSchema = z.object({
  direction: z.enum(["subir", "bajar"]),
});

export function toArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}
