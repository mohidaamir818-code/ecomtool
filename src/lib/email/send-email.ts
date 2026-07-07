import "server-only";

import nodemailer from "nodemailer";
import { serverEnv } from "@/lib/env";

export interface SendEmailParams {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: serverEnv.smtpHost(),
      port: serverEnv.smtpPort(),
      secure: serverEnv.smtpPort() === 465,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
      auth: {
        user: serverEnv.smtpUser(),
        pass: serverEnv.smtpPass(),
      },
    });
  }

  return transporter;
}

export async function sendEmail({ to, subject, text, html }: SendEmailParams) {
  const mailer = getTransporter();

  await mailer.sendMail({
    from: `"EcomTools" <${serverEnv.smtpFrom()}>`,
    to,
    subject,
    text,
    html: html ?? text.replace(/\n/g, "<br>"),
  });
}
