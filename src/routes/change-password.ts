import { Router } from "express";
import { setMustChangePassword } from "../db/users-repo.ts";
import { auth } from "../lib/auth.ts";
import { changePasswordSchema } from "../schemas/auth.ts";

export const changePasswordRouter = Router();

changePasswordRouter.get("/cambiar-password", (req, res) => {
  if (!req.user) {
    res.redirect("/login");
    return;
  }
  res.render("change-password", { error: null });
});

changePasswordRouter.post("/cambiar-password", async (req, res) => {
  if (!req.user) {
    res.redirect("/login");
    return;
  }

  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).render("change-password", {
      error:
        "La contraseña nueva debe tener 8+ caracteres y coincidir con la confirmación.",
    });
    return;
  }

  try {
    await auth.api.changePassword({
      body: {
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
      },
      headers: new Headers(req.headers as Record<string, string>),
    });
  } catch {
    res.status(400).render("change-password", {
      error: "La contraseña actual no es correcta.",
    });
    return;
  }

  await setMustChangePassword(req.user.id, false);
  res.redirect(303, "/");
});
