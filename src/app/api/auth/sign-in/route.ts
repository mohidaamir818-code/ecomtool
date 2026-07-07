import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { AuthNextStep, SignInPayload } from "@/types/auth";

const AUTH_TIMEOUT_MS = 20_000;

function withTimeout<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out. Please try again.`));
    }, ms);

    Promise.resolve(promise)
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error: unknown) => {
        clearTimeout(timer);
        reject(error);
      });
  });
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
    const supabase = getSupabaseAdmin();

    const { data: authData, error: authError } = await withTimeout(
      supabase.auth.signInWithPassword({
        email,
        password: body.password,
      }),
      AUTH_TIMEOUT_MS,
      "Sign-in",
    );

    if (authError || !authData.user) {
      const message = authError?.message?.toLowerCase() ?? "";

      if (message.includes("rate limit") || message.includes("too many")) {
        return NextResponse.json(
          { error: "Too many sign-in attempts. Please wait a minute and try again." },
          { status: 429 },
        );
      }

      return NextResponse.json(
        { error: "Invalid email or password. Please try again." },
        { status: 401 },
      );
    }

    const userId = authData.user.id;

    const { data: profile, error: profileError } = await withTimeout(
      supabase
        .from("profiles")
        .select("full_name, email, email_verified, onboarding_completed")
        .eq("id", userId)
        .single(),
      AUTH_TIMEOUT_MS,
      "Profile lookup",
    );

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Account found but profile is missing. Please contact support." },
        { status: 404 },
      );
    }

    const authEmailConfirmed = Boolean(authData.user.email_confirmed_at);
    const emailVerified = Boolean(profile.email_verified) || authEmailConfirmed;

    if (!profile.email_verified && authEmailConfirmed) {
      void supabase.from("profiles").update({ email_verified: true }).eq("id", userId);
    }

    const nextStep = resolveNextStep(
      emailVerified,
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
