export type QuotaPlatform = "ebay" | "aliexpress" | "amazef";

export type QueuePlatform = "ebay" | "aliexpress";

export type QueueStatus = "pending" | "processing" | "completed" | "failed";

export interface PlatformQuota {
  platform: QuotaPlatform;
  dailyLimit: number | null;
  usedToday: number;
  totalUsed: number;
  remaining: number | null;
  lastResetAt: string;
  updatedBy: string | null;
  updatedAt: string;
  unlimited: boolean;
}

export interface UserQuotasResponse {
  quotas: PlatformQuota[];
  resetsAt: string;
}

export interface QueueItem {
  id: string;
  userId: string;
  platform: QueuePlatform;
  itemIds: string[];
  scheduledFor: string;
  status: QueueStatus;
  processedCount: number;
  totalCount: number;
  progressMessage: string | null;
  createdAt: string;
}

export interface QuotaExceededPayload {
  error: "quota_exceeded";
  message: string;
  platform: QuotaPlatform;
  used: number;
  limit: number | null;
  remaining: number;
  resetsAt: string;
}
