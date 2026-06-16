import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { serverEnv } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { AuthNextStep, SignInPayload } from "@/types/auth";

function getAuthClient() {
  return createClient(
    serverEnv.supabaseUrl(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

function resolveNextStep(
  emailVerified: boolean,
  onboardingCompleted: boolean,
): AuthNextStep {
  if (!emailVerified) return "verify-email";
  if (!onboardingCompleted) return "onboarding";
  return "dashboard";
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SignInPayload;

    if (!body.email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    if (!body.password) {
      return NextResponse.json({ error: "Please enter your password." }, { status: 400 });
    }

    const email = body.email.trim().toLowerCase();
    const authClient = getAuthClient();

    const { data: authData, error: authError } =
      await authClient.auth.signInWithPassword({
        email,
        password: body.password,
      });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: "Invalid email or password. Please try again." },
        { status: 401 },
      );
    }

    const userId = authData.user.id;
    const admin = getSupabaseAdmin();

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("full_name, email, email_verified, onboarding_completed")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Account found but profile is missing. Please contact support." },
        { status: 404 },
      );
    }

    const nextStep = resolveNextStep(
      profile.email_verified ?? false,
      profile.onboarding_completed ?? false,
    );

    return NextResponse.json({
      success: true,
      message: "Signed in successfully.",
      userId,
      email: profile.email,
      fullName: profile.full_name,
      nextStep,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Sign-in failed. Please try again.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
