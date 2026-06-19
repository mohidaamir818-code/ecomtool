import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { assertUserNotBlocked, UserBlockedError, userBlockedToJson } from "@/lib/user/block";

export function userBlockErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof UserBlockedError) {
    return NextResponse.json(userBlockedToJson(error), { status: 403 });
  }
  return null;
}

/** Validates profile exists and user is not blocked. Returns error response or null if OK. */
export async function requireActiveUser(userId: string): Promise<NextResponse | null> {
  const supabase = getSupabaseAdmin();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  try {
    await assertUserNotBlocked(userId);
  } catch (error) {
    const blocked = userBlockErrorResponse(error);
    if (blocked) return blocked;
    throw error;
  }

  return null;
}
