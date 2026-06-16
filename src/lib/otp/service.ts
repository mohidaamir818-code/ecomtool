import "server-only";

import { sendEmail } from "@/lib/email/send-email";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const OTP_EXPIRY_MINUTES = 10;

export function generateOtpCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function createAndSendOtp(userId: string, email: string) {
  const supabase = getSupabaseAdmin();
  const otpCode = generateOtpCode();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await supabase.from("email_otps").delete().eq("user_id", userId);

  const { error: insertError } = await supabase.from("email_otps").insert({
    user_id: userId,
    otp_code: otpCode,
    expires_at: expiresAt.toISOString(),
  });

  if (insertError) {
    throw new Error(
      insertError.message.includes("does not exist")
        ? "OTP table missing. Run supabase/migrations/003_email_otps.sql in Supabase SQL Editor."
        : `Failed to store OTP: ${insertError.message}`,
    );
  }

  await sendEmail({
    to: email,
    subject: "Your EcomTools verification code",
    text: [
      "Welcome to EcomTools!",
      "",
      `Your verification code is: ${otpCode}`,
      "",
      `This code expires in ${OTP_EXPIRY_MINUTES} minutes.`,
      "",
      "If you did not request this, you can safely ignore this email.",
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #5842F4;">Verify your email</h2>
        <p>Welcome to EcomTools! Use the code below to verify your email address:</p>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #111827; text-align: center; padding: 16px; background: #F3F0FF; border-radius: 12px;">
          ${otpCode}
        </p>
        <p style="color: #6B7280; font-size: 14px;">This code expires in ${OTP_EXPIRY_MINUTES} minutes.</p>
      </div>
    `,
  });

  return { expiresInMinutes: OTP_EXPIRY_MINUTES };
}

export async function verifyOtpCode(userId: string, otpCode: string) {
  const supabase = getSupabaseAdmin();

  const { data: otpRecord, error: fetchError } = await supabase
    .from("email_otps")
    .select("id, otp_code, expires_at, verified")
    .eq("user_id", userId)
    .eq("verified", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError || !otpRecord) {
    return { valid: false, message: "No verification code found. Please request a new one." };
  }

  if (new Date(otpRecord.expires_at) < new Date()) {
    return { valid: false, message: "Verification code has expired. Please request a new one." };
  }

  if (otpRecord.otp_code !== otpCode.trim()) {
    return { valid: false, message: "Incorrect verification code. Please try again." };
  }

  await supabase
    .from("email_otps")
    .update({ verified: true })
    .eq("id", otpRecord.id);

  await supabase
    .from("profiles")
    .update({ email_verified: true })
    .eq("id", userId);

  return { valid: true, message: "Email verified successfully." };
}
