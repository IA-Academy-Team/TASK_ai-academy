import path from "node:path";
import { toNodeHandler } from "better-auth/node";
import express from "express";
import { auth } from "./lib/auth.ts";
import { attachSession } from "./middleware/session.ts";
import { healthRouter } from "./routes/health.ts";

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
      res.redirect("/tareas");
      return;
    }
    res.render("login");
  });

  return app;
}
