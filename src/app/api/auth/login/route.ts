import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  createAuthOtpAdminClient,
  createAuthOtpUserClient,
  encryptAuthSession,
  generateOtp,
  hashOtp,
  sendOtpEmail,
} from "@/lib/auth-email-otp";

type ChallengeResult = { status?: string; challenge_id?: string };

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid sign-in request." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || !("email" in body) || !("password" in body)
    || typeof body.email !== "string" || typeof body.password !== "string" || !body.email.trim() || !body.password) {
    return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });
  }

  try {
    const userClient = createAuthOtpUserClient();
    const { data: authData, error: authError } = await userClient.auth.signInWithPassword({
      email: body.email.trim().toLowerCase(),
      password: body.password,
    });
    if (authError || !authData.user || !authData.session) {
      return NextResponse.json({ error: "Email or password is incorrect, or the email has not been confirmed." }, { status: 401 });
    }

    const { data: profile, error: profileError } = await userClient
      .from("profiles")
      .select("role")
      .eq("id", authData.user.id)
      .maybeSingle();
    if (profileError) {
      return NextResponse.json({ error: `Could not verify account access: ${profileError.message}` }, { status: 500 });
    }
    if (!profile || !["teacher", "institution", "admin"].includes(profile.role)) {
      return NextResponse.json({ error: "This account does not have an authorized workspace." }, { status: 403 });
    }

    const email = authData.user.email;
    if (!email) return NextResponse.json({ error: "This account does not have a verified email address." }, { status: 403 });
    const challengeId = randomUUID();
    const code = generateOtp();
    const encryptedSession = encryptAuthSession({
      access_token: authData.session.access_token,
      refresh_token: authData.session.refresh_token,
      expires_at: authData.session.expires_at,
    });
    const adminClient = createAuthOtpAdminClient();
    const { data, error } = await adminClient.rpc("create_auth_email_otp_challenge", {
      p_challenge_id: challengeId,
      p_user_id: authData.user.id,
      p_email: email,
      p_code_hash: hashOtp(challengeId, code),
      p_session_ciphertext: encryptedSession,
    });
    if (error) {
      return NextResponse.json({ error: `Could not start email verification: ${error.message}` }, { status: 500 });
    }
    const result = data as ChallengeResult | null;
    if (result?.status === "rate_limited") {
      return NextResponse.json({ error: "Too many sign-in code requests. Wait a minute and try again." }, { status: 429 });
    }
    if (result?.status !== "created") {
      return NextResponse.json({ error: "Could not start email verification." }, { status: 500 });
    }

    try {
      await sendOtpEmail(email, code);
    } catch (error) {
      const { error: deleteError } = await adminClient.from("auth_email_otp_challenges").delete().eq("id", challengeId);
      const message = error instanceof Error ? error.message : "Could not send the sign-in code.";
      return NextResponse.json({
        error: deleteError ? `${message} The pending verification could not be cleared: ${deleteError.message}` : message,
      }, { status: 502 });
    }

    return NextResponse.json({ challenge_id: challengeId, email: maskEmail(email) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not start email sign-in verification.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!name || !domain) return email;
  return `${name[0]}${"*".repeat(Math.max(2, name.length - 1))}@${domain}`;
}
