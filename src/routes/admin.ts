import { eq } from "drizzle-orm";
import { Router } from "express";
import { user } from "../db/auth-schema.ts";
import { db } from "../db/client.ts";
import { auth } from "../lib/auth.ts";
import { authorize } from "../middleware/authorize.ts";
import { createUserSchema } from "../schemas/admin.ts";

export const adminRouter = Router();

adminRouter.get("/admin/usuarios", authorize("admin"), async (req, res) => {
  const users = await db.select().from(user);
  res.render("admin/usuarios", { users, user: req.user, error: null });
});

adminRouter.post("/admin/usuarios", authorize("admin"), async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    const users = await db.select().from(user);
    res.status(400).render("admin/usuarios", {
      users,
      user: req.user,
      error: "Email, nombre y contraseña (8+ caracteres) son obligatorios.",
    });
    return;
  }

  await auth.api.signUpEmail({ body: parsed.data });
  res.redirect(303, "/admin/usuarios");
});

adminRouter.post(
  "/admin/usuarios/:id/desactivar",
  authorize("admin"),
  async (req, res) => {
    await db
      .update(user)
      .set({ isActive: false })
      .where(eq(user.id, String(req.params.id)));
    res.redirect(303, "/admin/usuarios");
  },
);
