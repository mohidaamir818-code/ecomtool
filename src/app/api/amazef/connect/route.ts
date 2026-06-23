import { NextRequest, NextResponse } from "next/server";
import { connectAmazefAccount } from "@/lib/amazef/connection";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      userId?: string;
      email?: string;
      password?: string;
    };
    const userId = body.userId?.trim();
    const email = body.email?.trim();
    const password = body.password ?? "";

    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdmin();
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const status = await connectAmazefAccount(userId, email, password);

    if (!status.connected) {
      return NextResponse.json(
        { success: false, connected: false, error: "Invalid Amazef email or password." },
        { status: 401 },
      );
    }

    return NextResponse.json({ success: true, ...status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to connect Amazef account.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
