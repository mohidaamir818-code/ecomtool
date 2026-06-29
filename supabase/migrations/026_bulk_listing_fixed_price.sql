-- Bulk listing: optional fixed listing price per row.
-- When set, the product is listed at this exact price instead of using a profit %.

alter table public.bulk_listing_jobs
  add column if not exists fixed_price numeric(12, 2);
