import { z } from "zod";
import { USER_COLORS } from "../domain/user-colors.ts";

export const updateProfileColorSchema = z.object({
  color: z.enum(USER_COLORS, { message: "color inválido" }),
});
