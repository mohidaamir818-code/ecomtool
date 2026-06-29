import type { ListingPlatform } from "@/types/listing-generator";

export type BulkListingJobStatus = "queued" | "listing" | "listed" | "failed";

export interface BulkListingJob {
  id: string;
  userId: string;
  batchId: string;
  productUrl: string;
  platform: ListingPlatform;
  profitPercent: number | null;
  fixedPrice: number | null;
  status: BulkListingJobStatus;
  errorMessage: string | null;
  listingUrl: string | null;
  listedTitle: string | null;
  listedPrice: number | null;
  currency: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface BulkListingRowInput {
  productUrl: string;
  platform: ListingPlatform;
  profitPercent?: number | null;
  fixedPrice?: number | null;
}

export interface BulkListingStartPayload {
  userId: string;
  rows: BulkListingRowInput[];
  ebaySettings?: Record<string, unknown>;
  amazefSettings?: Record<string, unknown>;
}
