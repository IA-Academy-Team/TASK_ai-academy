import { Router } from "express";
import { updateUserColor } from "../db/users-repo.ts";
import { USER_COLORS } from "../domain/user-colors.ts";
import { HttpError } from "../lib/http-error.ts";
import { updateProfileColorSchema } from "../schemas/profile.ts";

export const profileRouter = Router();

profileRouter.get("/perfil", (req, res) => {
  if (!req.user) {
    res.redirect("/login");
    return;
  }

  res.render("perfil", {
    user: req.user,
    colors: USER_COLORS,
    saved: req.query.guardado === "1",
  });
});

profileRouter.post("/perfil/color", async (req, res) => {
  if (!req.user) {
    res.redirect("/login");
    return;
  }

  const parsed = updateProfileColorSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(400, "color inválido");
  }

  const updated = await updateUserColor(req.user.id, parsed.data.color);
  if (!updated) {
    throw new HttpError(404, "usuario no encontrado");
  }

  res.redirect(303, "/perfil?guardado=1");
});
