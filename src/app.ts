import path from "node:path";
import { toNodeHandler } from "better-auth/node";
import express from "express";
import { getSidebarCounts } from "./db/sidebar-repo.ts";
import { auth } from "./lib/auth.ts";
import { errorHandler } from "./middleware/error-handler.ts";
import { pageErrorHandler } from "./middleware/page-error-handler.ts";
import { attachSession } from "./middleware/session.ts";
import { adminRouter } from "./routes/admin.ts";
import { changePasswordRouter } from "./routes/change-password.ts";
import { dashboardRouter } from "./routes/dashboard.ts";
import { healthRouter } from "./routes/health.ts";
import { mytasksRouter } from "./routes/mytasks.ts";
import { notificationsRouter } from "./routes/notifications.ts";
import { plannerRouter } from "./routes/planner.ts";
import { profileRouter } from "./routes/profile.ts";
import { projectSettingsRouter } from "./routes/project-settings.ts";
import { projectsRouter } from "./routes/projects.ts";
import { projectsImportRouter } from "./routes/projects-import.ts";
import { projectsNewRouter } from "./routes/projects-new.ts";
import { reportsRouter } from "./routes/reports.ts";
import { supportsRouter } from "./routes/supports.ts";
import { tasksRouter } from "./routes/tasks.ts";
import { tasksAuditRouter } from "./routes/tasks-audit.ts";
import { tasksCreateRouter } from "./routes/tasks-create.ts";
import { tasksDeliveryRouter } from "./routes/tasks-delivery.ts";
import { tasksEditRouter } from "./routes/tasks-edit.ts";
import { tasksImportRouter } from "./routes/tasks-import.ts";
import { teamRouter } from "./routes/team.ts";

export function createApp() {
  const app = express();

  app.set("view engine", "ejs");
  app.set("views", path.join(import.meta.dirname, "views"));

  app.use("/static", express.static(path.join(import.meta.dirname, "public")));

  // Servidos en la raíz (no bajo /static) para que el service worker controle
  // todo el origen por defecto, sin necesitar el header Service-Worker-Allowed.
  app.get("/manifest.json", (_req, res) => {
    res.sendFile(path.join(import.meta.dirname, "public", "manifest.json"));
  });
  app.get("/sw.js", (_req, res) => {
    res.type("application/javascript");
    res.sendFile(path.join(import.meta.dirname, "public", "sw.js"));
  });

  app.use(healthRouter);

  // Las cuentas las crea un admin en /admin/usuarios (auth.api.signUpEmail server-side, no pasa
  // por esta ruta). No hay alta pública: bloqueamos el endpoint de better-auth que la expone.
  app.post("/api/auth/sign-up/email", (_req, res) => {
    res.status(404).json({ success: false, error: "not found" });
  });

  app.all("/api/auth/*splat", toNodeHandler(auth));

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(attachSession);

  // Contadores del sidebar (Notificaciones, Solicitudes de apoyo) en un solo
  // lugar: así cada ruta no tiene que repetir las mismas cuatro queries.
  app.use(async (req, res, next) => {
    if (!req.user) {
      next();
      return;
    }
    res.locals.sidebarCounts = await getSidebarCounts(
      req.user.id,
      req.user.role,
    );
    next();
  });

  // Cuenta recién creada por un admin con la contraseña genérica: bloqueamos
  // todo excepto /cambiar-password hasta que la reemplace por una propia.
  app.use((req, res, next) => {
    if (req.user?.mustChangePassword && req.path !== "/cambiar-password") {
      res.redirect("/cambiar-password");
      return;
    }
    next();
  });

  app.get("/login", (req, res) => {
    if (req.user) {
      res.redirect("/");
      return;
    }
    res.render("login");
  });

  app.use(changePasswordRouter);
  app.use(profileRouter);
  app.use(dashboardRouter);
  app.use(projectsImportRouter);
  app.use(projectsNewRouter);
  app.use(projectsRouter);
  app.use(projectSettingsRouter);
  app.use(tasksCreateRouter);
  app.use(tasksEditRouter);
  app.use(tasksDeliveryRouter);
  app.use(tasksImportRouter);
  app.use(supportsRouter);
  app.use(tasksAuditRouter);
  app.use(tasksRouter);
  app.use(mytasksRouter);
  app.use(plannerRouter);
  app.use(teamRouter);
  app.use(notificationsRouter);
  app.use(reportsRouter);
  app.use(adminRouter);

  app.use(pageErrorHandler);
  app.use(errorHandler);

  return app;
}
