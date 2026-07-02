import { NextRequest, NextResponse } from "next/server";
import { createAndSendOtp, verifyOtpCode } from "@/lib/otp/service";
import { getUserQuotas } from "@/lib/quota/service";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireActiveUser, userBlockErrorResponse } from "@/lib/user/block-api-helpers";

type SettingsAction = "send_otp" | "verify_otp" | "change_email" | "change_password";

interface SettingsBody {
  userId?: string;
  action?: SettingsAction;
  otp?: string;
  newEmail?: string;
  newPassword?: string;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validatePassword(value: string): string | null {
  if (value.length < 8) return "Password must be at least 8 characters.";
  return null;
}

async function canUseOtp(userId: string, otpCode: string): Promise<{ ok: boolean; message: string }> {
  const supabase = getSupabaseAdmin();
  const { data: otpRecord, error } = await supabase
    .from("email_otps")
    .select("otp_code, expires_at, verified")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !otpRecord) {
    return { ok: false, message: "No verification code found. Please request a new one." };
  }
  if (otpRecord.verified) {
    return { ok: false, message: "This code was already used. Please request a new one." };
  }
  if (new Date(otpRecord.expires_at) < new Date()) {
    return { ok: false, message: "Verification code has expired. Please request a new one." };
  }
  if (otpRecord.otp_code !== otpCode.trim()) {
    return { ok: false, message: "Incorrect verification code. Please try again." };
  }

  return { ok: true, message: "Code verified." };
}

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId")?.trim();
    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    const accessDenied = await requireActiveUser(userId);
    if (accessDenied) return accessDenied;

    const supabase = getSupabaseAdmin();
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", userId)
      .single();

    if (profileError || !profile?.email) {
      return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    }

    const { quotas } = await getUserQuotas(userId);
    const dailyUsed = quotas.reduce((sum, quota) => sum + quota.usedToday, 0);
    const hasUnlimited = quotas.some((quota) => quota.dailyLimit === null);
    const dailyLimit = hasUnlimited
      ? null
      : quotas.reduce((sum, quota) => sum + (quota.dailyLimit ?? 0), 0);

    return NextResponse.json({
      success: true,
      email: String(profile.email),
      dailyUsed,
      dailyLimit,
    });
  } catch (error) {
    const blocked = userBlockErrorResponse(error);
    if (blocked) return blocked;
    const message = error instanceof Error ? error.message : "Failed to load settings.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SettingsBody;
    const userId = body.userId?.trim();
    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    const accessDenied = await requireActiveUser(userId);
    if (accessDenied) return accessDenied;

    const supabase = getSupabaseAdmin();
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", userId)
      .single();

    if (profileError || !profile?.email) {
      return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    }

    const currentEmail = String(profile.email).toLowerCase();
    const action = body.action;

    if (action === "send_otp") {
      const result = await createAndSendOtp(userId, currentEmail);
      return NextResponse.json({
        success: true,
        message: "Verification code sent to your current email.",
        expiresInMinutes: result.expiresInMinutes,
      });
    }

    if (action === "verify_otp") {
      const otp = body.otp?.trim() ?? "";
      if (!/^\d{6}$/.test(otp)) {
        return NextResponse.json({ error: "Please enter a valid 6-digit code." }, { status: 400 });
      }
      const canUse = await canUseOtp(userId, otp);
      if (!canUse.ok) {
        return NextResponse.json({ error: canUse.message }, { status: 400 });
      }
      return NextResponse.json({ success: true, message: "Code verified. You can continue." });
    }

    if (action === "change_email") {
      const otp = body.otp?.trim() ?? "";
      const newEmail = body.newEmail?.trim().toLowerCase() ?? "";
      if (!/^\d{6}$/.test(otp)) {
        return NextResponse.json({ error: "Please enter a valid 6-digit code." }, { status: 400 });
      }
      if (!isValidEmail(newEmail)) {
        return NextResponse.json({ error: "Please enter a valid new email." }, { status: 400 });
      }
      if (newEmail === currentEmail) {
        return NextResponse.json({ error: "New email must be different from current email." }, { status: 400 });
      }

      const verifyResult = await verifyOtpCode(userId, otp);
      if (!verifyResult.valid) {
        return NextResponse.json({ error: verifyResult.message }, { status: 400 });
      }

      const { error: authUpdateError } = await supabase.auth.admin.updateUserById(userId, {
        email: newEmail,
        email_confirm: true,
      });
      if (authUpdateError) {
        return NextResponse.json({ error: authUpdateError.message }, { status: 400 });
      }

      const { error: profileUpdateError } = await supabase
        .from("profiles")
        .update({ email: newEmail, email_verified: true })
        .eq("id", userId);
      if (profileUpdateError) {
        return NextResponse.json({ error: profileUpdateError.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: "Email updated successfully.", email: newEmail });
    }

    if (action === "change_password") {
      const otp = body.otp?.trim() ?? "";
      const newPassword = body.newPassword ?? "";
      if (!/^\d{6}$/.test(otp)) {
        return NextResponse.json({ error: "Please enter a valid 6-digit code." }, { status: 400 });
      }
      const passwordError = validatePassword(newPassword);
      if (passwordError) {
        return NextResponse.json({ error: passwordError }, { status: 400 });
      }

      const verifyResult = await verifyOtpCode(userId, otp);
      if (!verifyResult.valid) {
        return NextResponse.json({ error: verifyResult.message }, { status: 400 });
      }

      const { error: authUpdateError } = await supabase.auth.admin.updateUserById(userId, {
        password: newPassword,
      });
      if (authUpdateError) {
        return NextResponse.json({ error: authUpdateError.message }, { status: 400 });
      }

      return NextResponse.json({ success: true, message: "Password updated successfully." });
    }

    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  } catch (error) {
    const blocked = userBlockErrorResponse(error);
    if (blocked) return blocked;
    const message = error instanceof Error ? error.message : "Failed to update settings.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
