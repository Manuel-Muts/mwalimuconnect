import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type ApplicationRequest = {
  vacancy_id?: unknown;
};

function nairobiDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.SUPABASE_PUBLISHABLE_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const accessToken = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!supabaseUrl || !publishableKey || !secretKey || !accessToken) {
    return NextResponse.json({ error: "A signed-in teacher account is required." }, { status: 401 });
  }

  let payload: ApplicationRequest;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid application request." }, { status: 400 });
  }
  if (!payload || typeof payload !== "object"
    || typeof payload.vacancy_id !== "string"
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.vacancy_id)) {
    return NextResponse.json({ error: "Select a valid vacancy before applying." }, { status: 400 });
  }

  const userClient = createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: authError } = await userClient.auth.getUser(accessToken);
  if (authError || !userData.user) {
    return NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });
  }

  const adminClient = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();
  if (profileError || profile?.role !== "teacher") {
    return NextResponse.json({ error: "Only a teacher account can apply to vacancies." }, { status: 403 });
  }

  const { data: cv, error: cvError } = await adminClient
    .from("teacher_cvs")
    .select("candidate_statement")
    .eq("teacher_id", userData.user.id)
    .maybeSingle();
  if (cvError) {
    return NextResponse.json({ error: `Could not verify your saved CV: ${cvError.message}` }, { status: 502 });
  }
  if (!cv?.candidate_statement.trim()) {
    return NextResponse.json({ error: "Complete and save your CV and candidate statement before applying." }, { status: 400 });
  }

  const { data: vacancy, error: vacancyError } = await adminClient
    .from("vacancies")
    .select("id,status,application_deadline")
    .eq("id", payload.vacancy_id)
    .maybeSingle();
  if (vacancyError) {
    return NextResponse.json({ error: `Could not verify the selected vacancy: ${vacancyError.message}` }, { status: 502 });
  }
  if (!vacancy || vacancy.status !== "published" || vacancy.application_deadline < nairobiDateString()) {
    return NextResponse.json({ error: "This vacancy is not accepting applications." }, { status: 400 });
  }

  const { data: application, error: insertError } = await adminClient
    .from("applications")
    .insert({ vacancy_id: vacancy.id, teacher_id: userData.user.id })
    .select("id")
    .single();
  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json({ error: "You have already applied for this vacancy." }, { status: 409 });
    }
    return NextResponse.json({ error: `Could not submit your application: ${insertError.message}` }, { status: 502 });
  }

  return NextResponse.json({ application });
}
