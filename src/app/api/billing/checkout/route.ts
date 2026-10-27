import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const intasendSecretKey = process.env.INTASEND_SECRET_KEY;
  const publicKey = process.env.INTASEND_PUBLIC_KEY;
  const amount = Number(process.env.SUBSCRIPTION_AMOUNT_KES);
  const apiUrl = process.env.INTASEND_API_URL ?? "https://api.intasend.com/api/v1/payment/mpesa-stk-push/";

  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!supabaseUrl || !publishableKey || !accessToken) {
    return NextResponse.json({ error: "Sign in with your institution account to continue." }, { status: 401 });
  }

  const userClient = createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: authError } = await userClient.auth.getUser(accessToken);
  if (authError || !userData.user) {
    return NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });
  }

  const { data: profile, error: profileError } = await userClient
    .from("profiles")
    .select("role,institution_id")
    .eq("id", userData.user.id)
    .single();
  if (profileError || profile?.role !== "institution" || !profile.institution_id) {
    return NextResponse.json({ error: "Only an authorized institution account can start a subscription." }, { status: 403 });
  }

  if (!intasendSecretKey || !publicKey || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Subscription payment is not configured yet. Ask the platform administrator to set up billing." }, { status: 503 });
  }
  if (!supabaseSecretKey) {
    return NextResponse.json({ error: "Subscription records are not configured. Ask the platform administrator for help." }, { status: 503 });
  }

  let payload: { phone_number?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const phone = payload.phone_number?.replace(/[\s-]/g, "");
  if (!phone || !/^(?:\+?254|0)?7\d{8}$/.test(phone)) {
    return NextResponse.json({ error: "Enter a valid Kenyan mobile number." }, { status: 400 });
  }

  const normalizedPhone = phone.startsWith("+") ? phone.slice(1) : phone.startsWith("0") ? `254${phone.slice(1)}` : phone.startsWith("254") ? phone : `254${phone}`;
  const reference = `mwalimuconnect-${crypto.randomUUID()}`;
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${intasendSecretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      public_key: publicKey,
      amount,
      phone_number: normalizedPhone,
      narrative: "MwalimuConnect school subscription",
      api_ref: reference,
    }),
    cache: "no-store",
  });

  const result = await response.json().catch(() => null);
  if (!response.ok) {
    return NextResponse.json({ error: result?.detail ?? result?.message ?? "The payment provider could not start the STK push." }, { status: 502 });
  }
  const adminClient = createClient(supabaseUrl, supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: insertError } = await adminClient.from("subscriptions").insert({
    institution_id: profile.institution_id,
    provider_reference: reference,
    amount_kes: amount,
    status: "pending",
  });
  if (insertError) {
    return NextResponse.json({ error: "The STK push was initiated, but the subscription record could not be saved. Contact platform support before retrying." }, { status: 502 });
  }
  return NextResponse.json({ status: "pending", payment: result });
}
