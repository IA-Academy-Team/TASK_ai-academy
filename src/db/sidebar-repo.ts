import { isAdminRole } from "../domain/roles.ts";
import {
  listPendingApplyForLeader,
  listPendingForUserEnriched,
} from "./support-requests-repo.ts";
import {
  listBudgetPendingForLeader,
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
  const leaderId = isAdminRole(role) ? null : userId;

  const [reviewPending, overdue, budgetPending, forMe, forLeader] =
    await Promise.all([
      listReviewPendingForLeader(leaderId),
      listOverdueForOwner(userId, today),
      listBudgetPendingForLeader(leaderId),
      listPendingForUserEnriched(userId),
      isAdminRole(role)
        ? Promise.resolve([])
        : listPendingApplyForLeader(userId),
    ]);

  return {
    notifications: reviewPending.length + overdue.length + budgetPending.length,
    supports: forMe.length + forLeader.length,
  };
}
