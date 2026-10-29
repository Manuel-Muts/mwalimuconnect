import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getVacancyLevelsForInstitutionType } from "@/lib/school-options";

type VacancyRequest = {
  title?: unknown;
  school_level?: unknown;
  employment_type?: unknown;
  category?: unknown;
  description?: unknown;
  application_deadline?: unknown;
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
    return NextResponse.json({ error: "A signed-in institution account is required." }, { status: 401 });
  }

  let payload: VacancyRequest;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid vacancy request." }, { status: 400 });
  }
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "Invalid vacancy request." }, { status: 400 });
  }

  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  const schoolLevel = typeof payload.school_level === "string" ? payload.school_level : "";
  const employmentType = typeof payload.employment_type === "string" ? payload.employment_type : "";
  const category = typeof payload.category === "string" ? payload.category : "";
  const description = typeof payload.description === "string" ? payload.description : "";
  const applicationDeadline = typeof payload.application_deadline === "string" ? payload.application_deadline : "";
  if (
    !title
    || !["Full-time", "Part-time", "Internship", "BOM"].includes(employmentType)
    || !["Teaching", "Internship"].includes(category)
    || !/^\d{4}-\d{2}-\d{2}$/.test(applicationDeadline)
    || !Number.isFinite(Date.parse(`${applicationDeadline}T00:00:00Z`))
    || new Date(`${applicationDeadline}T00:00:00Z`).toISOString().slice(0, 10) !== applicationDeadline
    || applicationDeadline < nairobiDateString()
  ) {
    return NextResponse.json({ error: "Enter a title, valid vacancy details, and an application deadline that is today or later." }, { status: 400 });
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
    .select("role,institution_id")
    .eq("id", userData.user.id)
    .single();
  if (profileError || profile?.role !== "institution" || !profile.institution_id) {
    return NextResponse.json({ error: "Only an authorized institution head can publish a vacancy." }, { status: 403 });
  }

  const { data: institution, error: institutionError } = await adminClient
    .from("institutions")
    .select("county,subcounty,school_level")
    .eq("id", profile.institution_id)
    .single();
  if (institutionError || !institution?.county || !institution.subcounty || !institution.school_level) {
    return NextResponse.json({ error: "Your institution needs a county, subcounty, and school type before posting vacancies." }, { status: 400 });
  }
  if (!getVacancyLevelsForInstitutionType(institution.school_level).includes(schoolLevel)) {
    return NextResponse.json({ error: "Select a teaching level that matches your institution type." }, { status: 400 });
  }

  const { data: vacancy, error: insertError } = await adminClient
    .from("vacancies")
    .insert({
      institution_id: profile.institution_id,
      title,
      county: institution.county,
      subcounty: institution.subcounty,
      school_level: schoolLevel,
      employment_type: employmentType,
      category,
      description,
      application_deadline: applicationDeadline,
      status: "published",
    })
    .select("id")
    .single();
  if (insertError || !vacancy) {
    return NextResponse.json({ error: insertError?.message ?? "Could not publish the vacancy." }, { status: 502 });
  }

  return NextResponse.json({ vacancy });
}
