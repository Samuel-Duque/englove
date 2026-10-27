export interface RemindersResponse {
  pendingRegistrations: number;
  pendingApprovals?: number;
  overdueReviews: number;
  ungradedReminderDays: number;
  thresholdDays?: number;
}
