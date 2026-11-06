import {
  listPendingApplyForLeader,
  listPendingForUserEnriched,
} from "./support-requests-repo.ts";
import {
  listOverdueForOwner,
  listReviewPendingForLeader,
} from "./tasks-repo.ts";

export interface SidebarCounts {
  notifications: number;
  supports: number;
}

export async function getSidebarCounts(
  userId: string,
  role: string,
): Promise<SidebarCounts> {
  const today = new Date().toLocaleDateString("en-CA");
  const leaderId = role === "admin" ? null : userId;

  const [reviewPending, overdue, forMe, forLeader] = await Promise.all([
    listReviewPendingForLeader(leaderId),
    listOverdueForOwner(userId, today),
    listPendingForUserEnriched(userId),
    role === "admin" ? Promise.resolve([]) : listPendingApplyForLeader(userId),
  ]);

  return {
    notifications: reviewPending.length + overdue.length,
    supports: forMe.length + forLeader.length,
  };
}
