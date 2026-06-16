import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email/send-email";

interface SendEmailBody {
  to?: string;
  subject?: string;
  text?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SendEmailBody;

    if (!body.to?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.to)) {
      return NextResponse.json({ error: "Valid 'to' email is required." }, { status: 400 });
    }

    if (!body.subject?.trim()) {
      return NextResponse.json({ error: "'subject' is required." }, { status: 400 });
    }

    if (!body.text?.trim()) {
      return NextResponse.json({ error: "'text' is required." }, { status: 400 });
    }

    await sendEmail({
      to: body.to.trim(),
      subject: body.subject.trim(),
      text: body.text.trim(),
    });

    return NextResponse.json({ success: true, message: "Email sent successfully." });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to send email.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
