import { NextRequest, NextResponse } from "next/server";
import { flagDescriptionPhotos } from "@/lib/listings/description-image-flags";
import { requireActiveUser, userBlockErrorResponse } from "@/lib/user/block-api-helpers";
import type { ListingPhotoDraft } from "@/types/listing-generator";

export async function POST(request: NextRequest) {
  let userId: string | null = null;

  try {
    const body = (await request.json()) as {
      userId?: string;
      photos?: ListingPhotoDraft[];
    };

    userId = body.userId?.trim() ?? null;
    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    if (!body.photos?.length) {
      return NextResponse.json({ success: true, photos: body.photos ?? [] });
    }

    const accessDenied = await requireActiveUser(userId);
    if (accessDenied) return accessDenied;

    const photos = await flagDescriptionPhotos(body.photos);
    return NextResponse.json({ success: true, photos });
  } catch (error: unknown) {
    const blocked = userBlockErrorResponse(error);
    if (blocked) return blocked;

    const message =
      error instanceof Error ? error.message : "Failed to scan description images.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
