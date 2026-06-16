import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { SignUpPayload } from "@/types/auth";

function validateBody(body: SignUpPayload) {
  const { fullName, email, password, phone } = body;

  if (!fullName?.trim() || fullName.trim().length < 2) {
    return "Full name must be at least 2 characters.";
  }

  if (!email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "Please enter a valid email address.";
  }

  if (!password || password.length < 8) {
    return "Password must be at least 8 characters.";
  }

  if (!phone?.trim() || phone.trim().length < 7) {
    return "Please enter a valid phone number.";
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SignUpPayload;
    const validationError = validateBody(body);

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const fullName = body.fullName.trim();
    const email = body.email.trim().toLowerCase();
    const phone = body.phone.trim();

    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email,
        password: body.password,
        email_confirm: true,
        user_metadata: { full_name: fullName, phone },
      });

    if (authError) {
      const message =
        authError.message.includes("already been registered")
          ? "An account with this email already exists."
          : authError.message;

      return NextResponse.json({ error: message }, { status: 409 });
    }

    const userId = authData.user.id;

    const { error: profileError } = await supabase.from("profiles").insert({
      id: userId,
      full_name: fullName,
      email,
      phone,
    });

    if (profileError) {
      await supabase.auth.admin.deleteUser(userId);
      return NextResponse.json(
        {
          error:
            profileError.message.includes("does not exist")
              ? "Database table 'profiles' not found. Run supabase/migrations/001_profiles.sql in your Supabase SQL Editor."
              : `Failed to save profile: ${profileError.message}`,
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Account created successfully. Your 7-day free trial has started!",
        userId,
      },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Sign-up failed. Please try again.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
