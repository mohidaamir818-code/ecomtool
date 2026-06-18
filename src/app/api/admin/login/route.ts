import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_OTP_EXPIRY_MINUTES,
  createAdminPendingToken,
  generateAdminOtpCode,
} from "@/lib/admin/pending";
import { getAdminEmail, getAdminPassword, isAdminConfigured } from "@/lib/admin/config";
import { isIpAllowed } from "@/lib/admin/ip";
import { sendEmail } from "@/lib/email/send-email";

function notFoundResponse(): NextResponse {
  return new NextResponse("Not Found", { status: 404, statusText: "Not Found" });
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export async function POST(request: NextRequest) {
  if (!isIpAllowed(request)) {
    return notFoundResponse();
  }

  if (!isAdminConfigured()) {
    return notFoundResponse();
  }

  try {
    const body = (await request.json()) as { email?: string; password?: string };
    const email = body.email?.trim() ?? "";
    const password = body.password ?? "";

    const validEmail = safeEqual(email, getAdminEmail());
    const validPassword = safeEqual(password, getAdminPassword());

    if (!validEmail || !validPassword) {
      return notFoundResponse();
    }

    const otp = generateAdminOtpCode();
    const pendingToken = createAdminPendingToken(email, otp);

    await sendEmail({
      to: getAdminEmail(),
      subject: "EcomTools admin verification code",
      text: [
        `Your admin verification code is: ${otp}`,
        "",
        `This code expires in ${ADMIN_OTP_EXPIRY_MINUTES} minutes.`,
        "If you did not request this, ignore this email.",
      ].join("\n"),
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #111827; margin-bottom: 16px;">Admin verification</h2>
          <p style="color: #374151; font-size: 16px;">Your verification code is:</p>
          <p style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #5842f4; margin: 24px 0;">${otp}</p>
          <p style="color: #6B7280; font-size: 14px;">This code expires in ${ADMIN_OTP_EXPIRY_MINUTES} minutes.</p>
        </div>
      `,
    });

    return NextResponse.json({
      success: true,
      pendingToken,
      expiresInMinutes: ADMIN_OTP_EXPIRY_MINUTES,
      message: "Verification code sent to the admin email.",
    });
  } catch {
    return notFoundResponse();
  }
}
