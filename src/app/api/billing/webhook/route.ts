import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type IntaSendCollectionEvent = {
  topic?: string;
  challenge?: string;
  api_ref?: string | null;
  invoice_id?: string;
  state?: string;
  value?: string | number;
  currency?: string;
  provider?: string;
  updated_at?: string;
};

function matchesChallenge(received: string, expected: string) {
  const receivedBytes = Buffer.from(received);
  const expectedBytes = Buffer.from(expected);
  return receivedBytes.length === expectedBytes.length && timingSafeEqual(receivedBytes, expectedBytes);
}

export async function POST(request: Request) {
  const challenge = process.env.INTASEND_WEBHOOK_CHALLENGE;
  if (!challenge) {
    return NextResponse.json({ error: "Payment webhook is not configured." }, { status: 503 });
  }

  let event: IntaSendCollectionEvent;
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
    }
    event = body as IntaSendCollectionEvent;
  } catch {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  if (typeof event.challenge !== "string" || !matchesChallenge(event.challenge, challenge)) {
    return NextResponse.json({ error: "Invalid webhook challenge." }, { status: 401 });
  }
  if (event.topic !== "collection_event") {
    return NextResponse.json({ status: "ignored" });
  }
  if (typeof event.api_ref !== "string" || !event.api_ref.startsWith("mwalimuconnect-")) {
    return NextResponse.json({ status: "ignored" });
  }

  const amount = typeof event.value === "number" ? event.value : Number(event.value);
  if (
    typeof event.invoice_id !== "string"
    || !event.invoice_id
    || typeof event.state !== "string"
    || typeof event.updated_at !== "string"
    || !Number.isFinite(Date.parse(event.updated_at))
    || !Number.isFinite(amount)
    || event.currency !== "KES"
    || event.provider !== "M-PESA"
  ) {
    return NextResponse.json({ error: "Invalid payment event." }, { status: 400 });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !secretKey) {
    return NextResponse.json({ error: "Subscription records are not configured." }, { status: 503 });
  }

  const adminClient = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: result, error } = await adminClient.rpc("process_intasend_subscription_event", {
    p_api_ref: event.api_ref,
    p_invoice_id: event.invoice_id,
    p_state: event.state,
    p_amount: amount,
    p_currency: event.currency,
    p_updated_at: event.updated_at,
  });
  if (error) {
    return NextResponse.json({ error: `Could not process payment event: ${error.message}` }, { status: 500 });
  }
  if (result === "invalid_payment") {
    return NextResponse.json({ error: "Payment details did not match the pending subscription." }, { status: 400 });
  }
  if (result === "not_found") {
    return NextResponse.json({ error: "The matching pending subscription was not found; retry the event." }, { status: 503 });
  }
  return NextResponse.json({ status: result });
}
