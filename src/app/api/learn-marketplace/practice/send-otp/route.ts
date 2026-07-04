import { NextRequest, NextResponse } from "next/server";
import { createAndSendOtp } from "@/lib/otp/service";
import { getSupabaseAdmin } from "@/lib/supabase/server";

interface PracticeSendOtpBody {
  userId?: string;
  email?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PracticeSendOtpBody;

    if (!body.userId?.trim()) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    if (!body.email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", body.userId.trim())
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const email = body.email.trim().toLowerCase();
    const result = await createAndSendOtp(body.userId.trim(), email);

    return NextResponse.json({
      success: true,
      message: "Verification code sent to your email.",
      expiresInMinutes: result.expiresInMinutes,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to send verification code.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
