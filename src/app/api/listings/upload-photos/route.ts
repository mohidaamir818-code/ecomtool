import { NextRequest, NextResponse } from "next/server";
import { uploadListingPhotos } from "@/lib/listings/upload-photos";
import { requireActiveUser, userBlockErrorResponse } from "@/lib/user/block-api-helpers";

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const userId = String(form.get("userId") ?? "").trim();

    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    const accessDenied = await requireActiveUser(userId);
    if (accessDenied) return accessDenied;

    const files = form
      .getAll("files")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);

    if (files.length === 0) {
      return NextResponse.json({ error: "Please drop or choose at least one photo." }, { status: 400 });
    }

    const urls = await uploadListingPhotos(userId, files);
    return NextResponse.json({ success: true, urls });
  } catch (error: unknown) {
    const blocked = userBlockErrorResponse(error);
    if (blocked) return blocked;

    const message = error instanceof Error ? error.message : "Failed to upload photos.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
