import path from "node:path";
import { toNodeHandler } from "better-auth/node";
import express from "express";
import { auth } from "./lib/auth.ts";
import { errorHandler } from "./middleware/error-handler.ts";
import { attachSession } from "./middleware/session.ts";
import { adminRouter } from "./routes/admin.ts";
import { dashboardRouter } from "./routes/dashboard.ts";
import { healthRouter } from "./routes/health.ts";
import { projectsRouter } from "./routes/projects.ts";
import { tasksRouter } from "./routes/tasks.ts";

export function createApp() {
  const app = express();

  app.set("view engine", "ejs");
  app.set("views", path.join(import.meta.dirname, "views"));

  app.use(healthRouter);

  app.all("/api/auth/*splat", toNodeHandler(auth));

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(attachSession);

  app.get("/login", (req, res) => {
    if (req.user) {
      res.redirect("/");
      return;
    }
    res.render("login");
  });

  app.use(dashboardRouter);
  app.use(projectsRouter);
  app.use(tasksRouter);
  app.use(adminRouter);

  app.use(errorHandler);

  return app;
}
