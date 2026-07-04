import { NextRequest, NextResponse } from "next/server";
import { verifyOtpCode } from "@/lib/otp/service";

interface PracticeVerifyOtpBody {
  userId?: string;
  otp?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PracticeVerifyOtpBody;

    if (!body.userId?.trim()) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    if (!body.otp?.trim() || !/^\d{6}$/.test(body.otp.trim())) {
      return NextResponse.json(
        { error: "Please enter a valid 6-digit verification code." },
        { status: 400 },
      );
    }

    const result = await verifyOtpCode(body.userId.trim(), body.otp.trim());

    if (!result.valid) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: result.message });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Verification failed. Please try again.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
