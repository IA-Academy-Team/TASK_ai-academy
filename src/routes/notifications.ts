import { Router } from "express";
import { listPendingForUserEnriched } from "../db/support-requests-repo.ts";
import {
  listBudgetPendingForLeader,
  listOverdueForOwner,
  listReviewPendingForLeader,
} from "../db/tasks-repo.ts";
import { subscribe, unsubscribe } from "../lib/sse-hub.ts";

const SSE_HEARTBEAT_MS = 25_000;

export const notificationsRouter = Router();

notificationsRouter.get("/notificaciones/stream", (req, res) => {
  if (!req.user) {
    res.status(401).end();
    return;
  }
  const userId = req.user.id;

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.write(":ok\n\n");
  subscribe(userId, res);

  const heartbeat = setInterval(() => {
    res.write(":ping\n\n");
  }, SSE_HEARTBEAT_MS);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe(userId, res);
  });
});

notificationsRouter.get("/notificaciones", async (req, res) => {
  if (!req.user) {
    res.redirect("/login");
    return;
  }

  const today = new Date().toLocaleDateString("en-CA");
  const leaderId = req.user.role === "admin" ? null : req.user.id;

  const [reviewPending, overdue, supportPending, budgetPending] =
    await Promise.all([
      listReviewPendingForLeader(leaderId),
      listOverdueForOwner(req.user.id, today),
      listPendingForUserEnriched(req.user.id),
      listBudgetPendingForLeader(leaderId),
    ]);

  res.render("notificaciones", {
    user: req.user,
    reviewPending,
    overdue,
    supportPending,
    budgetPending,
  });
});
