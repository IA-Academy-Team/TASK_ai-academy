import { Router } from "express";
import { listPendingForUserEnriched } from "../db/support-requests-repo.ts";
import {
  listOverdueForOwner,
  listReviewPendingForLeader,
} from "../db/tasks-repo.ts";

export const notificationsRouter = Router();

notificationsRouter.get("/notificaciones", async (req, res) => {
  if (!req.user) {
    res.redirect("/login");
    return;
  }

  const today = new Date().toLocaleDateString("en-CA");
  const leaderId = req.user.role === "admin" ? null : req.user.id;

  const [reviewPending, overdue, supportPending] = await Promise.all([
    listReviewPendingForLeader(leaderId),
    listOverdueForOwner(req.user.id, today),
    listPendingForUserEnriched(req.user.id),
  ]);

  res.render("notificaciones", {
    user: req.user,
    reviewPending,
    overdue,
    supportPending,
  });
});
