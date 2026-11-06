import { Router } from "express";
import { teamLoad } from "../db/tasks-repo.ts";

export const teamRouter = Router();

teamRouter.get("/equipo", async (req, res) => {
  if (!req.user) {
    res.redirect("/login");
    return;
  }

  const rows = await teamLoad();

  res.render("equipo", {
    user: req.user,
    rows,
  });
});
