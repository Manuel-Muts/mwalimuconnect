import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSubCountiesInCounty } from "kenya-locations/sub-counties";
import { INSTITUTION_TYPES, KENYAN_COUNTIES } from "@/lib/school-options";

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

  let payload: { name?: string; county?: string; subcounty?: string; school_level?: string; head_email?: string; head_name?: string };
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
  if (!name || !county || !subcounty || !schoolLevel || !headName || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter the institution name, county, subcounty, school level and a valid head-of-institution name and email." }, { status: 400 });
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
    return NextResponse.json({ error: institutionError?.message ?? "Could not register the institution." }, { status: 502 });
  }

  const redirectTo = process.env.NEXT_PUBLIC_SITE_URL
    ? `${process.env.NEXT_PUBLIC_SITE_URL}/`
    : new URL("/", request.url).toString();
  const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { full_name: headName },
    redirectTo,
  });
  if (inviteError || !inviteData.user) {
    const { error: cleanupError } = await adminClient.from("institutions").delete().eq("id", institution.id);
    return NextResponse.json({
      error: inviteError?.message ?? "The school was registered, but the invitation could not be sent.",
      cleanupWarning: cleanupError?.message,
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
    }, { status: 502 });
  }

  return NextResponse.json({ status: "created", institution_id: institution.id });
}
