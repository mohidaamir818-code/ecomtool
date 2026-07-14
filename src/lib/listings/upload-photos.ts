import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/server";

const BUCKET = "listing-photos";
const MAX_FILES = 12;
const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
  return cleaned || "photo.jpg";
}

export async function uploadListingPhotos(
  userId: string,
  files: File[],
): Promise<string[]> {
  if (!files.length) return [];

  const supabase = getSupabaseAdmin();
  const usable = files.filter((file) => file && file.size > 0).slice(0, MAX_FILES);
  const urls: string[] = [];

  for (const file of usable) {
    if (file.size > MAX_FILE_BYTES) {
      throw new Error(`"${file.name}" is larger than the 8MB limit.`);
    }

    const contentType = (file.type || "").toLowerCase();
    if (!ALLOWED_TYPES.has(contentType)) {
      throw new Error(`"${file.name}" must be JPG, PNG, or WebP.`);
    }

    const arrayBuffer = await file.arrayBuffer();
    const safeName = sanitizeFileName(file.name);
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, arrayBuffer, { contentType, upsert: false });

    if (error) {
      if (error.message.toLowerCase().includes("bucket not found")) {
        throw new Error(
          "Storage bucket missing. Run supabase/migrations/030_listing_photos_storage.sql in Supabase.",
        );
      }
      throw new Error(error.message);
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    if (!data.publicUrl) {
      throw new Error(`Failed to get public URL for "${file.name}".`);
    }
    urls.push(data.publicUrl);
  }

  return urls;
}

export async function uploadListingPhotoBytes(
  userId: string,
  bytes: Buffer,
  options: { contentType?: string; fileName?: string },
): Promise<string> {
  const contentType = (options.contentType || "image/png").toLowerCase();
  const normalizedType = contentType === "image/jpg" ? "image/jpeg" : contentType;
  if (!ALLOWED_TYPES.has(normalizedType)) {
    throw new Error("AI photo must be JPG, PNG, or WebP.");
  }

  const supabase = getSupabaseAdmin();
  const safeName = sanitizeFileName(options.fileName || "ai-photo.png");
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: normalizedType,
    upsert: false,
  });

  if (error) {
    if (error.message.toLowerCase().includes("bucket not found")) {
      throw new Error(
        "Storage bucket missing. Run supabase/migrations/030_listing_photos_storage.sql in Supabase.",
      );
    }
    throw new Error(error.message);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  if (!data.publicUrl) {
    throw new Error("Failed to get public URL for AI photo.");
  }
  return data.publicUrl;
}
