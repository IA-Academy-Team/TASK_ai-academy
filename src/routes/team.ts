import { Router } from "express";
import { teamLoad } from "../db/tasks-repo.ts";
import { capacityThreshold } from "../domain/chart-data.ts";

export const teamRouter = Router();

teamRouter.get("/equipo", async (req, res) => {
  if (!req.user) {
    res.redirect("/login");
    return;
  }

  const base = await teamLoad();
  const rows = base.map((r) => ({
    ...r,
    loadPct: r.weeklyCapacityHours
      ? Math.min(100, Math.round((r.openHours / r.weeklyCapacityHours) * 100))
      : 0,
    threshold: capacityThreshold(r.openHours, r.weeklyCapacityHours),
  }));

  res.render("equipo", {
    user: req.user,
    rows,
  });
});
