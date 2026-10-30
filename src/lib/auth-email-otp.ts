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
    subject: "Your MwalimuConnect verification code",
    text: `Hello,\n\nUse this one-time password to complete your sign-in to MwalimuConnect:\n\n${code}\n\nEnter it on the MwalimuConnect website to continue. This code expires in 10 minutes and can only be used once. Never share it with anyone.\n\nIf you did not request this code, you can safely ignore this email.\n\nThank you for choosing MwalimuConnect.\n\nDesigned and developed by MUTSTECH\n© MwalimuConnect. All rights reserved.`,
    html: `
      <div style="margin:0;padding:0;background-color:#f3f6fb;font-family:Arial,Helvetica,sans-serif;color:#1e293b">
        <div style="max-width:600px;margin:0 auto;padding:35px 15px">
          <div style="text-align:center;padding:25px 15px;background-color:#123b70;border-radius:12px 12px 0 0">
            <h1 style="margin:0;color:#fff;font-size:30px;font-weight:700">MwalimuConnect</h1>
            <p style="margin:8px 0 0;color:#dbeafe;font-size:13px">Connecting Education. Empowering Learning.</p>
          </div>
          <div style="padding:38px 30px;border:1px solid #e2e8f0;border-top:none;background-color:#fff">
            <h2 style="margin:0 0 18px;text-align:center;color:#123b70;font-size:25px">Your Verification Code</h2>
            <p style="font-size:15px;line-height:1.8;color:#475569">Hello,</p>
            <p style="font-size:15px;line-height:1.8;color:#475569">Use the one-time password below to complete your sign-in to MwalimuConnect.</p>
            <div style="margin:30px 0;padding:25px 15px;text-align:center;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:10px">
              <p style="margin:0 0 12px;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:2px">Your OTP Code</p>
              <div style="font-size:36px;font-weight:700;letter-spacing:10px;color:#123b70">${code}</div>
            </div>
            <p style="font-size:14px;line-height:1.8;color:#475569;text-align:center">Enter this code on the MwalimuConnect website to continue.</p>
            <div style="margin-top:28px;padding:15px;background-color:#f8fafc;border-left:4px solid #16a34a">
              <p style="margin:0;font-size:13px;line-height:1.7;color:#64748b"><strong>Security notice:</strong> This code expires in 10 minutes and can only be used once. Never share it with anyone.</p>
            </div>
            <p style="margin-top:24px;font-size:13px;line-height:1.7;color:#64748b">If you did not request this code, you can safely ignore this email.</p>
          </div>
          <div style="padding:22px 15px;text-align:center;background-color:#eaf0f8;border-radius:0 0 12px 12px">
            <p style="margin:0 0 8px;color:#334155;font-size:13px">Thank you for choosing MwalimuConnect.</p>
            <p style="margin:0;color:#64748b;font-size:12px">Designed and developed by <strong style="color:#123b70">MUTSTECH</strong></p>
            <p style="margin:12px 0 0;color:#94a3b8;font-size:11px">&copy; MwalimuConnect. All rights reserved.</p>
          </div>
        </div>
      </div>
    `,
  });
}
