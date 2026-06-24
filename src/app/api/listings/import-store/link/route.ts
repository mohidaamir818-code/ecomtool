import { NextRequest, NextResponse } from "next/server";
import { linkImportStoreListing } from "@/lib/listings/import-store-service";
import { requireActiveUser, userBlockErrorResponse } from "@/lib/user/block-api-helpers";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      userId?: string;
      listingId?: string;
      aliexpressUrl?: string;
    };

    const userId = body.userId?.trim();
    const listingId = body.listingId?.trim();
    const aliexpressUrl = body.aliexpressUrl?.trim();

    if (!userId || !listingId || !aliexpressUrl) {
      return NextResponse.json(
        { error: "userId, listingId, and aliexpressUrl are required." },
        { status: 400 },
      );
    }

    const accessDenied = await requireActiveUser(userId);
    if (accessDenied) return accessDenied;

    await linkImportStoreListing(userId, listingId, aliexpressUrl);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const blocked = userBlockErrorResponse(error);
    if (blocked) return blocked;

    const message = error instanceof Error ? error.message : "Failed to link listing.";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
