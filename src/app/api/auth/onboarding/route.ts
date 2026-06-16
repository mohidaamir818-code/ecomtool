import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { OnboardingPayload, SellingPlatform } from "@/types/auth";

const ALLOWED_PLATFORMS: SellingPlatform[] = ["Amazef", "eBay"];
const SUPPLIER = "AliExpress";

function validateBody(body: OnboardingPayload) {
  const { userId, heardAboutUs, platform } = body;

  if (!userId?.trim()) {
    return "Invalid session. Please sign up again.";
  }

  if (!heardAboutUs?.trim() || heardAboutUs.trim().length < 2) {
    return "Please tell us where you heard about us.";
  }

  if (!platform || !ALLOWED_PLATFORMS.includes(platform)) {
    return "Please select a valid platform (Amazef or eBay).";
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as OnboardingPayload;
    const validationError = validateBody(body);

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: profile, error: fetchError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", body.userId)
      .single();

    if (fetchError || !profile) {
      return NextResponse.json(
        { error: "Profile not found. Please sign up again." },
        { status: 404 },
      );
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        heard_about_us: body.heardAboutUs.trim(),
        platform: body.platform,
        supplier: SUPPLIER,
        onboarding_completed: true,
      })
      .eq("id", body.userId);

    if (updateError) {
      const message = updateError.message.includes("does not exist")
        ? "Onboarding columns missing. Run supabase/migrations/002_onboarding_fields.sql in your Supabase SQL Editor."
        : `Failed to save onboarding details: ${updateError.message}`;

      return NextResponse.json({ error: message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Onboarding completed successfully!",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Onboarding failed. Please try again.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
