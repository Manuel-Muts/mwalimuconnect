import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSubscriptionPlan, SUBSCRIPTION_PLAN_KEYS, type ConfiguredSubscriptionPlan } from "@/lib/subscription-plans";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const payload = body as { phone_number?: unknown; plan_key?: unknown };
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const intasendSecretKey = process.env.INTASEND_SECRET_KEY;
  const publicKey = process.env.INTASEND_PUBLIC_KEY;
  const apiUrl = process.env.INTASEND_API_URL ?? "https://api.intasend.com/api/v1/payment/mpesa-stk-push/";

  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!supabaseUrl || !publishableKey || !accessToken) {
    return NextResponse.json({ error: "Sign in with your teacher or institution account to continue." }, { status: 401 });
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
  if (profileError || !profile || !["institution", "teacher"].includes(profile.role) || (profile.role === "institution" && !profile.institution_id)) {
    return NextResponse.json({ error: "Only an authorized teacher or institution account can start a subscription." }, { status: 403 });
  }

  const planKey = payload.plan_key;
  if (typeof planKey !== "string" || !(SUBSCRIPTION_PLAN_KEYS as readonly string[]).includes(planKey)) {
    return NextResponse.json({ error: "Choose a valid subscription plan." }, { status: 400 });
  }
  let plan: ConfiguredSubscriptionPlan;
  try {
    plan = getSubscriptionPlan(planKey);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The selected subscription plan is invalid.";
    return NextResponse.json({ error: message }, { status: message.includes("pricing has not been configured") ? 503 : 500 });
  }
  if (profile.role === "institution" && plan.key === "weekly") {
    return NextResponse.json({ error: "Weekly subscriptions are available to teachers only." }, { status: 400 });
  }
  if (!intasendSecretKey || !publicKey) {
    return NextResponse.json({ error: "Subscription payment is not configured yet. Ask the platform administrator to set up billing." }, { status: 503 });
  }
  if (!supabaseSecretKey) {
    return NextResponse.json({ error: "Subscription records are not configured. Ask the platform administrator for help." }, { status: 503 });
  }

  const phone = typeof payload.phone_number === "string" ? payload.phone_number.replace(/[\s-]/g, "") : "";
  if (!phone || !/^(?:\+?254|0)?7\d{8}$/.test(phone)) {
    return NextResponse.json({ error: "Enter a valid Kenyan mobile number." }, { status: 400 });
  }

  const normalizedPhone = phone.startsWith("+") ? phone.slice(1) : phone.startsWith("0") ? `254${phone.slice(1)}` : phone.startsWith("254") ? phone : `254${phone}`;
  const reference = `mwalimuconnect-${crypto.randomUUID()}`;
  const adminClient = createClient(supabaseUrl, supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: insertError } = await adminClient.from("subscriptions").insert({
    institution_id: profile.role === "institution" ? profile.institution_id : null,
    teacher_id: profile.role === "teacher" ? userData.user.id : null,
    plan_key: plan.key,
    provider_reference: reference,
    amount_kes: plan.amountKes,
    duration_days: plan.durationDays,
    status: "pending",
  });
  if (insertError) {
    return NextResponse.json({ error: `Could not create the pending subscription: ${insertError.message}` }, { status: 502 });
  }

  let response: Response;
  try {
    response = await fetch(apiUrl, {
      method: "POST",
      headers: {
      Authorization: `Bearer ${intasendSecretKey}`,
      "Content-Type": "application/json",
    },
      body: JSON.stringify({
      public_key: publicKey,
      amount: plan.amountKes,
      phone_number: normalizedPhone,
      narrative: "MwalimuConnect school subscription",
      api_ref: reference,
      }),
      cache: "no-store",
    });
  } catch (error) {
    const { error: updateError } = await adminClient
      .from("subscriptions")
      .update({ status: "failed" })
      .eq("provider_reference", reference);
    const message = error instanceof Error ? error.message : "The payment provider could not be reached.";
    return NextResponse.json({ error: updateError ? `${message} The pending subscription could not be marked failed: ${updateError.message}` : message }, { status: 502 });
  }

  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const { error: updateError } = await adminClient
      .from("subscriptions")
      .update({ status: "failed" })
      .eq("provider_reference", reference);
    const providerMessage = result?.detail ?? result?.message ?? "The payment provider could not start the STK push.";
    return NextResponse.json({ error: updateError ? `${providerMessage} The pending subscription could not be marked failed: ${updateError.message}` : providerMessage }, { status: 502 });
  }

  const invoiceId = result?.invoice?.invoice_id;
  if (typeof invoiceId === "string") {
    const { error: updateError } = await adminClient
      .from("subscriptions")
      .update({ provider_invoice_id: invoiceId })
      .eq("provider_reference", reference);
    if (updateError) {
      return NextResponse.json({ error: `The STK push was started, but the provider invoice could not be recorded: ${updateError.message}` }, { status: 502 });
    }
  }
  return NextResponse.json({ status: "pending", payment: result });
}
