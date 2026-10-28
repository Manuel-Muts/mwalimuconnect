import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { createAuthOtpAdminClient, hashOtp, sendOtpEmail } from "@/lib/auth-email-otp";

type ResendResult = { status?: string; email?: string };

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid resend request." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || !("challenge_id" in body)
    || typeof body.challenge_id !== "string"
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.challenge_id)) {
    return NextResponse.json({ error: "Start sign-in again to request a new code." }, { status: 400 });
  }

  try {
    const code = String(randomInt(100000, 1000000));
    const adminClient = createAuthOtpAdminClient();
    const { data, error } = await adminClient.rpc("resend_auth_email_otp_challenge", {
      p_challenge_id: body.challenge_id,
      p_code_hash: hashOtp(body.challenge_id, code),
    });
    if (error) {
      return NextResponse.json({ error: `Could not request a new code: ${error.message}` }, { status: 500 });
    }
    const result = data as ResendResult | null;
    if (result?.status !== "resent" || typeof result.email !== "string") {
      const messages: Record<string, string> = {
        too_soon: "Wait a minute before requesting another code.",
        expired: "That sign-in code has expired. Start signing in again.",
        too_many_requests: "Too many code requests. Start signing in again later.",
        already_used: "That sign-in request has already been used. Start signing in again.",
      };
      return NextResponse.json({ error: messages[result?.status ?? ""] ?? "Could not resend the sign-in code." }, { status: 429 });
    }

    await sendOtpEmail(result.email, code);
    return NextResponse.json({ status: "sent" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not send a new sign-in code.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
