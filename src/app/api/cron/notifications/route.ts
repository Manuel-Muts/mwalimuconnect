import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isNotificationEmailConfigured, sendNotificationEmail } from "@/lib/notification-email";

type QueuedEmail = {
  notification_id: string;
  recipient_email: string;
  notification_type: "subscription_expiry" | "new_vacancy";
  title: string;
  message: string;
};

function matchesSecret(received: string, expected: string) {
  const receivedBytes = Buffer.from(received);
  const expectedBytes = Buffer.from(expected);
  return receivedBytes.length === expectedBytes.length && timingSafeEqual(receivedBytes, expectedBytes);
}

export async function POST(request: Request) {
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret || expectedSecret.length < 32) {
    return NextResponse.json({ error: "Notification scheduler is not configured." }, { status: 503 });
  }
  const receivedSecret = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] ?? "";
  if (!matchesSecret(receivedSecret, expectedSecret)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !secretKey) {
    return NextResponse.json({ error: "Notification storage is not configured." }, { status: 503 });
  }

  const adminClient = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: remindersCreated, error: reminderError } = await adminClient.rpc("create_subscription_expiry_notifications");
  if (reminderError) {
    return NextResponse.json({ error: `Could not create subscription reminders: ${reminderError.message}` }, { status: 500 });
  }
  if (!isNotificationEmailConfigured()) {
    return NextResponse.json({
      error: "Email reminders are queued but SMTP is not configured.",
      remindersCreated,
    }, { status: 503 });
  }

  const { data: queuedEmails, error: queueError } = await adminClient.rpc("claim_notification_emails", { p_limit: 100 });
  if (queueError) {
    return NextResponse.json({ error: `Could not claim notification emails: ${queueError.message}` }, { status: 500 });
  }

  let emailsSent = 0;
  let emailFailures = 0;
  for (const email of (queuedEmails ?? []) as QueuedEmail[]) {
    try {
      await sendNotificationEmail({
        to: email.recipient_email,
        subject: email.title,
        title: email.title,
        message: email.message,
      });
    } catch (error) {
      emailFailures += 1;
      const message = error instanceof Error ? error.message : "Email delivery failed.";
      console.error(`Notification email ${email.notification_id} failed: ${message}`);
      const { error: updateError } = await adminClient
        .from("notifications")
        .update({ email_error: message })
        .eq("id", email.notification_id);
      if (updateError) {
        return NextResponse.json({ error: `Email failed and its retry state could not be saved: ${updateError.message}` }, { status: 500 });
      }
      continue;
    }

    const { error: updateError } = await adminClient
      .from("notifications")
      .update({ email_sent_at: new Date().toISOString(), email_error: null })
      .eq("id", email.notification_id);
    if (updateError) {
      return NextResponse.json({ error: `Email was sent but its delivery state could not be saved: ${updateError.message}` }, { status: 500 });
    }
    emailsSent += 1;
  }

  return NextResponse.json({ remindersCreated, emailsSent, emailFailures });
}
