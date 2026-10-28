import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSubCountiesInCounty } from "kenya-locations/sub-counties";
import { INSTITUTION_TYPES, KENYAN_COUNTIES } from "@/lib/school-options";

function normalizeKenyanMobilePhone(value: string) {
  const digits = value.trim().replace(/[\s()-]/g, "").replace(/^(?:\+?254|0)/, "");
  return /^7\d{8}$/.test(digits) ? `+254${digits}` : null;
}

export async function GET(request: Request) {
  const page = Number(new URL(request.url).searchParams.get("page") ?? "1");
  if (!Number.isInteger(page) || page < 1) {
    return NextResponse.json({ error: "The requested institution page is invalid." }, { status: 400 });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const accessToken = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!supabaseUrl || !publishableKey || !secretKey || !accessToken) {
    return NextResponse.json({ error: "An authorized administrator session is required." }, { status: 401 });
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
  const { data: adminProfile, error: adminError } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();
  if (adminError || adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Only a super administrator can view registered institutions." }, { status: 403 });
  }

  const { data: institutions, count, error: institutionsError } = await adminClient
    .from("institutions")
    .select("id,name,county,subcounty,school_level", { count: "exact" })
    .order("name", { ascending: true })
    .range((page - 1) * 10, page * 10 - 1);
  if (institutionsError) {
    return NextResponse.json({ error: institutionsError.message }, { status: 502 });
  }

  const institutionIds = (institutions ?? []).map((institution) => institution.id);
  const { data: institutionHeads, error: headsError } = institutionIds.length
    ? await adminClient
      .from("profiles")
      .select("id,institution_id,full_name")
      .eq("role", "institution")
      .in("institution_id", institutionIds)
    : { data: [], error: null };
  if (headsError) {
    return NextResponse.json({ error: headsError.message }, { status: 502 });
  }

  const contactsByInstitutionId = new Map<string, { head_name: string | null; head_email: string | null; head_phone: string | null }>();
  for (const head of institutionHeads ?? []) {
    const { data, error } = await adminClient.auth.admin.getUserById(head.id);
    if (error || !data.user) {
      return NextResponse.json({
        error: error?.message ?? "Could not load contact details for an institution head.",
      }, { status: 502 });
    }
    contactsByInstitutionId.set(head.institution_id, {
      head_name: head.full_name || data.user.user_metadata.full_name || null,
      head_email: data.user.email ?? null,
      head_phone: data.user.phone || data.user.user_metadata.phone || null,
    });
  }

  const result = (institutions ?? []).map((institution) => ({
    ...institution,
    head_name: contactsByInstitutionId.get(institution.id)?.head_name ?? null,
    head_email: contactsByInstitutionId.get(institution.id)?.head_email ?? null,
    head_phone: contactsByInstitutionId.get(institution.id)?.head_phone ?? null,
  }));

  return NextResponse.json({ institutions: result, totalCount: count ?? 0 });
}

export async function POST(request: Request) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const accessToken = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!supabaseUrl || !publishableKey || !secretKey || !accessToken) {
    return NextResponse.json({ error: "An authorized administrator session is required." }, { status: 401 });
  }

  let payload: { name?: string; county?: string; subcounty?: string; school_level?: string; head_email?: string; head_name?: string; head_phone?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const name = payload.name?.trim();
  const county = payload.county?.trim();
  const subcounty = payload.subcounty?.trim();
  const schoolLevel = payload.school_level?.trim();
  const email = payload.head_email?.trim().toLowerCase();
  const headName = payload.head_name?.trim();
  const headPhone = normalizeKenyanMobilePhone(payload.head_phone ?? "");
  if (!name || !county || !subcounty || !schoolLevel || !headName || !email || !headPhone || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter the institution details, a valid head-of-institution name and email, and a valid Kenyan mobile number." }, { status: 400 });
  }
  if (!(KENYAN_COUNTIES as readonly string[]).includes(county)) {
    return NextResponse.json({ error: "Select a valid Kenyan county." }, { status: 400 });
  }
  if (!getSubCountiesInCounty(county).some((item) => item.name === subcounty)) {
    return NextResponse.json({ error: "Select a valid subcounty for the selected county." }, { status: 400 });
  }
  if (!(INSTITUTION_TYPES as readonly string[]).includes(schoolLevel)) {
    return NextResponse.json({ error: "Select Primary + JSS or Senior School as the institution type." }, { status: 400 });
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
  const { data: adminProfile, error: adminError } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();
  if (adminError || adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Only a super administrator can register institutions." }, { status: 403 });
  }

  const { data: institution, error: institutionError } = await adminClient
    .from("institutions")
    .insert({ name, county, subcounty, school_level: schoolLevel })
    .select("id")
    .single();
  if (institutionError || !institution) {
    const schemaNotReady = institutionError?.code === "42703"
      || institutionError?.code === "PGRST204"
      || institutionError?.code === "23514";
    return NextResponse.json({
      error: schemaNotReady
        ? `Institution registration could not be completed because the Supabase schema is missing required institution fields or constraints. Apply all SQL migrations in supabase/migrations and retry. Database detail: ${institutionError?.message ?? "Institution record could not be created."}`
        : institutionError?.message ?? "Could not register the institution.",
      stage: "institution_insert",
    }, { status: schemaNotReady ? 503 : 502 });
  }

  const redirectTo = new URL("/?setup=password", process.env.NEXT_PUBLIC_SITE_URL || request.url).toString();
  const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { full_name: headName, phone: headPhone },
    redirectTo,
  });
  if (inviteError || !inviteData.user) {
    const { error: cleanupError } = await adminClient.from("institutions").delete().eq("id", institution.id);
    return NextResponse.json({
      error: inviteError?.message ?? "The school was registered, but the invitation could not be sent.",
      cleanupWarning: cleanupError?.message,
      stage: "head_invitation",
    }, { status: 502 });
  }

  const { error: profileError } = await adminClient
    .from("profiles")
    .update({ role: "institution", institution_id: institution.id, full_name: headName })
    .eq("id", inviteData.user.id);
  if (profileError) {
    const { error: userCleanupError } = await adminClient.auth.admin.deleteUser(inviteData.user.id);
    const { error: institutionCleanupError } = await adminClient.from("institutions").delete().eq("id", institution.id);
    return NextResponse.json({
      error: "The invitation was created, but the institution account could not be configured.",
      cleanupWarning: userCleanupError?.message ?? institutionCleanupError?.message,
      stage: "head_profile_link",
    }, { status: 502 });
  }

  return NextResponse.json({ status: "created", institution_id: institution.id });
}

export async function PATCH(request: Request) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const accessToken = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!supabaseUrl || !publishableKey || !secretKey || !accessToken) {
    return NextResponse.json({ error: "An authorized administrator session is required." }, { status: 401 });
  }

  const userClient = createClient(supabaseUrl, publishableKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: userData, error: authError } = await userClient.auth.getUser(accessToken);
  if (authError || !userData.user) return NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });

  const adminClient = createClient(supabaseUrl, secretKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: adminProfile, error: adminError } = await adminClient.from("profiles").select("role").eq("id", userData.user.id).single();
  if (adminError || adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Only a super administrator can edit institutions." }, { status: 403 });
  }

  let payload: { id?: string; name?: string; county?: string; subcounty?: string; school_level?: string; head_name?: string; head_phone?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const id = payload.id?.trim();
  const name = payload.name?.trim();
  const county = payload.county?.trim();
  const subcounty = payload.subcounty?.trim();
  const schoolLevel = payload.school_level?.trim();
  const headName = payload.head_name?.trim();
  const headPhone = normalizeKenyanMobilePhone(payload.head_phone ?? "");
  if (!id || !name || !county || !subcounty || !schoolLevel || !headName || !headPhone) {
    return NextResponse.json({ error: "Enter the institution details, head name, and a valid Kenyan mobile number." }, { status: 400 });
  }
  if (!(KENYAN_COUNTIES as readonly string[]).includes(county)) {
    return NextResponse.json({ error: "Select a valid Kenyan county." }, { status: 400 });
  }
  if (!getSubCountiesInCounty(county).some((item) => item.name === subcounty)) {
    return NextResponse.json({ error: "Select a valid subcounty for the selected county." }, { status: 400 });
  }
  if (!(INSTITUTION_TYPES as readonly string[]).includes(schoolLevel)) {
    return NextResponse.json({ error: "Select a valid institution type." }, { status: 400 });
  }

  const { data: existingVacancies, error: existingVacanciesError } = await adminClient
    .from("vacancies")
    .select("school_level")
    .eq("institution_id", id);
  if (existingVacanciesError) {
    return NextResponse.json({ error: `Could not verify the institution's existing vacancies: ${existingVacanciesError.message}` }, { status: 502 });
  }
  const hasIncompatibleVacancy = (existingVacancies ?? []).some(({ school_level }) =>
    schoolLevel === "Primary + JSS"
      ? !["ECDE / Early Years", "Lower Primary", "Upper Primary", "JSS"].includes(school_level)
      : school_level !== "Senior School",
  );
  if (hasIncompatibleVacancy) {
    return NextResponse.json({
      error: "The institution type cannot be changed while it has vacancies for another school type. Close or remove those vacancies first.",
    }, { status: 409 });
  }

  const { data: institution, error: institutionError } = await adminClient
    .from("institutions")
    .update({ name, county, subcounty, school_level: schoolLevel })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (institutionError || !institution) {
    return NextResponse.json({ error: institutionError?.message ?? "Institution not found." }, { status: institutionError ? 502 : 404 });
  }
  const { error: vacancyUpdateError } = await adminClient
    .from("vacancies")
    .update({ county, subcounty })
    .eq("institution_id", id);
  if (vacancyUpdateError) {
    return NextResponse.json({
      error: `Institution details were saved, but its vacancies could not be updated: ${vacancyUpdateError.message}`,
    }, { status: 502 });
  }

  const { data: institutionHeads, error: headsError } = await adminClient
    .from("profiles")
    .select("id")
    .eq("role", "institution")
    .eq("institution_id", id);
  if (headsError) return NextResponse.json({ error: `Institution details were saved, but the head profile could not be loaded: ${headsError.message}` }, { status: 502 });
  if (institutionHeads?.[0]) {
    const headId = institutionHeads[0].id;
    const { error: profileUpdateError } = await adminClient.from("profiles").update({ full_name: headName }).eq("id", headId);
    if (profileUpdateError) {
      return NextResponse.json({ error: `Institution details were saved, but the head's name was not updated: ${profileUpdateError.message}` }, { status: 502 });
    }

    const { data: headUser, error: headUserError } = await adminClient.auth.admin.getUserById(headId);
    if (headUserError || !headUser.user) {
      return NextResponse.json({ error: `Institution details were saved, but the head's phone could not be updated: ${headUserError?.message ?? "Head account not found."}` }, { status: 502 });
    }
    const { error: metadataError } = await adminClient.auth.admin.updateUserById(headId, {
      user_metadata: { ...headUser.user.user_metadata, full_name: headName, phone: headPhone },
    });
    if (metadataError) {
      return NextResponse.json({ error: `Institution details and head name were saved, but the head's phone was not updated: ${metadataError.message}` }, { status: 502 });
    }
  }

  return NextResponse.json({ status: "updated" });
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "An institution ID is required." }, { status: 400 });

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const accessToken = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!supabaseUrl || !publishableKey || !secretKey || !accessToken) {
    return NextResponse.json({ error: "An authorized administrator session is required." }, { status: 401 });
  }

  const userClient = createClient(supabaseUrl, publishableKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: userData, error: authError } = await userClient.auth.getUser(accessToken);
  if (authError || !userData.user) return NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });

  const adminClient = createClient(supabaseUrl, secretKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: adminProfile, error: adminError } = await adminClient.from("profiles").select("role").eq("id", userData.user.id).single();
  if (adminError || adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Only a super administrator can delete institutions." }, { status: 403 });
  }

  const { data: heads, error: headsError } = await adminClient.from("profiles").select("id").eq("role", "institution").eq("institution_id", id);
  if (headsError) return NextResponse.json({ error: headsError.message }, { status: 502 });

  const { data: deletedInstitution, error: deleteError } = await adminClient.from("institutions").delete().eq("id", id).select("id").maybeSingle();
  if (deleteError || !deletedInstitution) {
    return NextResponse.json({ error: deleteError?.message ?? "Institution not found." }, { status: deleteError ? 502 : 404 });
  }

  const accountDeletionErrors: string[] = [];
  for (const head of heads ?? []) {
    const { error } = await adminClient.auth.admin.deleteUser(head.id);
    if (error) accountDeletionErrors.push(error.message);
  }

  return NextResponse.json({
    status: "deleted",
    warnings: accountDeletionErrors.length
      ? [`The institution and its vacancies and subscriptions were deleted, but ${accountDeletionErrors.length} linked head account(s) could not be deleted: ${accountDeletionErrors.join("; ")}`]
      : [],
  });
}
