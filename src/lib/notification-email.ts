import nodemailer from "nodemailer";

type NotificationEmail = {
  to: string;
  subject: string;
  title: string;
  message: string;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

export function isNotificationEmailConfigured() {
  const port = Number(process.env.BREVO_SMTP_PORT || "587");
  return Boolean(
    process.env.BREVO_SMTP_USER
    && process.env.BREVO_SMTP_KEY
    && process.env.AUTH_OTP_FROM_EMAIL
    && Number.isInteger(port)
    && port >= 1
    && port <= 65535,
  );
}

export async function sendNotificationEmail({ to, subject, title, message }: NotificationEmail) {
  const host = process.env.BREVO_SMTP_HOST || "smtp-relay.brevo.com";
  const port = Number(process.env.BREVO_SMTP_PORT || "587");
  const user = process.env.BREVO_SMTP_USER;
  const password = process.env.BREVO_SMTP_KEY;
  const from = process.env.AUTH_OTP_FROM_EMAIL;
  if (!user || !password || !from) {
    throw new Error("Configure BREVO_SMTP_USER, BREVO_SMTP_KEY and AUTH_OTP_FROM_EMAIL to send notification emails.");
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("BREVO_SMTP_PORT must be a valid TCP port.");
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: { user, pass: password },
  });
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  await transporter.sendMail({
    from,
    to,
    subject: subject.replace(/[\r\n]/g, " "),
    text: `${title}\n\n${message}\n\nMwalimuConnect`,
    html: `<div style="font-family:Arial,Helvetica,sans-serif;color:#263a2f;line-height:1.6"><h2>${safeTitle}</h2><p>${safeMessage}</p><p style="color:#748178">MwalimuConnect</p></div>`,
  });
}
