import { NextRequest, NextResponse } from "next/server";
import {
  setupSellerInventoryLocation,
  updateSellerInventoryLocationOnEbay,
} from "@/lib/ebay/inventory-location";
import { getSellerInventoryLocation } from "@/lib/ebay/seller-inventory-location-db";
import { requireActiveUser, userBlockErrorResponse } from "@/lib/user/block-api-helpers";

function toPublicLocation(location: Awaited<ReturnType<typeof getSellerInventoryLocation>>) {
  if (!location) {
    return {
      addressConfirmed: false,
      city: null,
      postalCode: null,
      country: null,
      merchantLocationKey: null,
    };
  }

  return {
    addressConfirmed: location.addressConfirmed,
    city: location.city,
    postalCode: location.postalCode,
    country: location.country,
    merchantLocationKey: location.addressConfirmed ? location.merchantLocationKey : null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId")?.trim();
    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    const accessDenied = await requireActiveUser(userId);
    if (accessDenied) return accessDenied;

    const location = await getSellerInventoryLocation(userId);
    return NextResponse.json({ success: true, ...toPublicLocation(location) });
  } catch (error) {
    const blocked = userBlockErrorResponse(error);
    if (blocked) return blocked;

    const message = error instanceof Error ? error.message : "Failed to load warehouse address.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      userId?: string;
      city?: string;
      postalCode?: string;
      country?: string;
    };

    const userId = body.userId?.trim();
    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    const accessDenied = await requireActiveUser(userId);
    if (accessDenied) return accessDenied;

    const location = await setupSellerInventoryLocation(userId, {
      city: body.city ?? "",
      postalCode: body.postalCode ?? "",
      country: body.country ?? "",
    });

    return NextResponse.json({
      success: true,
      addressConfirmed: location.addressConfirmed,
      city: location.city,
      postalCode: location.postalCode,
      country: location.country,
      merchantLocationKey: location.merchantLocationKey,
    });
  } catch (error) {
    const blocked = userBlockErrorResponse(error);
    if (blocked) return blocked;

    const message = error instanceof Error ? error.message : "Failed to save warehouse address.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      userId?: string;
      city?: string;
      postalCode?: string;
      country?: string;
    };

    const userId = body.userId?.trim();
    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    const accessDenied = await requireActiveUser(userId);
    if (accessDenied) return accessDenied;

    const location = await updateSellerInventoryLocationOnEbay(userId, {
      city: body.city ?? "",
      postalCode: body.postalCode ?? "",
      country: body.country ?? "",
    });

    return NextResponse.json({
      success: true,
      addressConfirmed: location.addressConfirmed,
      city: location.city,
      postalCode: location.postalCode,
      country: location.country,
      merchantLocationKey: location.merchantLocationKey,
    });
  } catch (error) {
    const blocked = userBlockErrorResponse(error);
    if (blocked) return blocked;

    const message = error instanceof Error ? error.message : "Failed to update warehouse address.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
