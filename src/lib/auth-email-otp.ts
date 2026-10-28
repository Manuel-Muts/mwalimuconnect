import { createCipheriv, createDecipheriv, createHmac, randomBytes, randomInt, scryptSync } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

type PendingAuthSession = {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
};

function getKeys() {
  const secret = process.env.AUTH_OTP_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_OTP_SECRET must contain at least 32 characters.");
  }
  const material = scryptSync(secret, "mwalimuconnect-auth-email-otp-v1", 64);
  return { encryption: material.subarray(0, 32), hashing: material.subarray(32) };
}

export function hashOtp(challengeId: string, code: string) {
  return createHmac("sha256", getKeys().hashing).update(`${challengeId}:${code}`).digest("hex");
}

export function encryptAuthSession(session: PendingAuthSession) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKeys().encryption, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(session), "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptAuthSession(payload: string): PendingAuthSession {
  const [ivPart, tagPart, encryptedPart] = payload.split(".");
  if (!ivPart || !tagPart || !encryptedPart) throw new Error("The pending sign-in session is invalid.");
  const decipher = createDecipheriv("aes-256-gcm", getKeys().encryption, Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
  const session: unknown = JSON.parse(plaintext);
  if (
    !session
    || typeof session !== "object"
    || typeof (session as PendingAuthSession).access_token !== "string"
    || typeof (session as PendingAuthSession).refresh_token !== "string"
  ) {
    throw new Error("The pending sign-in session is invalid.");
  }
  return session as PendingAuthSession;
}

export function generateOtp() {
  return String(randomInt(100000, 1000000));
}

export function createAuthOtpAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server credentials are not configured.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export function createAuthOtpUserClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase authentication is not configured.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function sendOtpEmail(email: string, code: string) {
  const host = process.env.BREVO_SMTP_HOST || "smtp-relay.brevo.com";
  const port = Number(process.env.BREVO_SMTP_PORT || "587");
  const user = process.env.BREVO_SMTP_USER;
  const password = process.env.BREVO_SMTP_KEY;
  const from = process.env.AUTH_OTP_FROM_EMAIL;
  if (!user || !password || !from) {
    throw new Error("Configure BREVO_SMTP_USER, BREVO_SMTP_KEY and AUTH_OTP_FROM_EMAIL to enable email sign-in codes.");
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
  await transporter.sendMail({
    from,
    to: email,
    subject: "Your MwalimuConnect sign-in code",
    text: `Your MwalimuConnect sign-in code is ${code}. It expires in 10 minutes. If you did not request this code, you can ignore this email.`,
    html: `<p>Your MwalimuConnect sign-in code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:8px">${code}</p><p>This code expires in 10 minutes. If you did not request it, you can ignore this email.</p>`,
  });
}
