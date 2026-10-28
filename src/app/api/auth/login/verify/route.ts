import { NextResponse } from "next/server";
import { createAuthOtpAdminClient, decryptAuthSession, hashOtp } from "@/lib/auth-email-otp";

type ConsumeResult = { status?: string; session_ciphertext?: string };

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid verification request." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || !("challenge_id" in body) || !("code" in body)
    || typeof body.challenge_id !== "string"
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.challenge_id)
    || typeof body.code !== "string" || !/^\d{6}$/.test(body.code)) {
    return NextResponse.json({ error: "Enter the six-digit code from your email." }, { status: 400 });
  }

  try {
    const adminClient = createAuthOtpAdminClient();
    const { data, error } = await adminClient.rpc("consume_auth_email_otp_challenge", {
      p_challenge_id: body.challenge_id,
      p_code_hash: hashOtp(body.challenge_id, body.code),
    });
    if (error) {
      return NextResponse.json({ error: `Could not verify the sign-in code: ${error.message}` }, { status: 500 });
    }
    const result = data as ConsumeResult | null;
    if (result?.status !== "verified" || typeof result.session_ciphertext !== "string") {
      const messages: Record<string, string> = {
        invalid_code: "That code is incorrect. Check your email and try again.",
        expired: "That code has expired. Start signing in again to get a new code.",
        too_many_attempts: "Too many incorrect codes. Start signing in again to request a new code.",
        already_used: "That code has already been used. Start signing in again.",
      };
      return NextResponse.json({ error: messages[result?.status ?? ""] ?? "Could not verify the sign-in code." }, { status: 401 });
    }
    return NextResponse.json(
      { session: decryptAuthSession(result.session_ciphertext) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not verify the sign-in code.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
