"use client";

import { useEffect, useMemo, useState } from "react";
import { getSubCountiesInCounty } from "kenya-locations/sub-counties";
import { getSupabase } from "@/lib/supabase";
import { getVacancyLevelsForInstitutionType, INSTITUTION_TYPES, KENYAN_COUNTIES } from "@/lib/school-options";
import LandingPage from "@/app/landing-page";

type Role = "teacher" | "institution" | "admin";
type Vacancy = {
  id: string;
  title: string;
  institution: string;
  county: string;
  subcounty?: string;
  level: string;
  category: string;
  type: string;
  institutionId?: string;
  posted: string;
  color: string;
  initials: string;
};

const roleInfo: Record<Role, { name: string; subtitle: string; nav: string[] }> = {
  teacher: { name: "Teacher", subtitle: "Find your next opportunity", nav: ["Discover", "My applications", "Saved jobs", "My profile"] },
  institution: { name: "Institution", subtitle: "Your school workspace", nav: ["Overview", "My vacancies", "Applicants", "Subscription"] },
  admin: { name: "Super admin", subtitle: "Platform overview", nav: ["Overview", "Institutions", "Vacancies", "Subscriptions"] },
};

const iconPaths: Record<string, React.ReactNode> = {
  discover: <><circle cx="11" cy="11" r="7" /><path d="m16 16 4 4" /></>,
  applications: <><path d="M8 3h8l4 4v14H4V3z" /><path d="M8 3v5h8V3M8 13h8M8 17h5" /></>,
  saved: <><path d="M6 4h12v17l-6-4-6 4z" /></>,
  profile: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  overview: <><rect x="3" y="3" width="8" height="8" rx="2" /><rect x="13" y="3" width="8" height="5" rx="2" /><rect x="13" y="10" width="8" height="11" rx="2" /><rect x="3" y="13" width="8" height="8" rx="2" /></>,
  vacancies: <><path d="M3 7h18v13H3zM8 7V4h8v3M3 12h18M10 12v2h4v-2" /></>,
  applicants: <><circle cx="9" cy="8" r="4" /><path d="M2 21a7 7 0 0 1 14 0M16 4a4 4 0 0 1 0 8M18 15a6 6 0 0 1 4 6" /></>,
  subscription: <><rect x="3" y="5" width="18" height="15" rx="2" /><path d="M3 10h18M7 15h4" /></>,
  institutions: <><path d="M3 21h18M5 21V7l7-4 7 4v14M9 10h.01M15 10h.01M9 14h.01M15 14h.01M10 21v-3h4v3" /></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
  arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m16 16 4 4" /></>,
  location: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2" /></>,
  close: <><path d="m18 6-12 12M6 6l12 12" /></>,
};

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{iconPaths[name]}</svg>;
}

function navIcon(item: string) {
  const normalized = item.toLowerCase();
  if (normalized.includes("application")) return "applications";
  if (normalized.includes("saved")) return "saved";
  if (normalized.includes("profile")) return "profile";
  if (normalized.includes("overview")) return "overview";
  if (normalized.includes("vacanc")) return "vacancies";
  if (normalized.includes("applicant")) return "applicants";
  if (normalized.includes("subscription")) return "subscription";
  if (normalized.includes("institution")) return "institutions";
  return "discover";
}

function initialsFor(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0] ?? "").join("").toUpperCase();
}

function isRole(value: unknown): value is Role {
  return value === "teacher" || value === "institution" || value === "admin";
}

export default function Home() {
  const [role, setRole] = useState<Role>("teacher");
  const [activeNav, setActiveNav] = useState("Discover");
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [vacanciesLoading, setVacanciesLoading] = useState(false);
  const [vacancyLoadError, setVacancyLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [county, setCounty] = useState("All counties");
  const [level, setLevel] = useState("All levels");
  const [saved, setSaved] = useState<string[]>([]);
  const [applied, setApplied] = useState<string[]>([]);
  const [modal, setModal] = useState<"auth" | "subscription" | "institution" | "vacancy" | "profile" | null>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signup" | "signin">("signup");
  const [authFeedback, setAuthFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [backendConnected, setBackendConnected] = useState(false);
  const [institutionId, setInstitutionId] = useState("");
  const [schoolCounty, setSchoolCounty] = useState("");
  const [schoolSubcounty, setSchoolSubcounty] = useState("");
  const [schoolLevel, setSchoolLevel] = useState("");
  const [schoolRegistrationCounty, setSchoolRegistrationCounty] = useState("");
  const [teacherCounty, setTeacherCounty] = useState("");
  const [countySetupRequired, setCountySetupRequired] = useState(false);
  const [enteredWorkspace, setEnteredWorkspace] = useState(false);
  const [landingMessage, setLandingMessage] = useState("");

  const accountDisplayName = userName || userEmail.split("@")[0] || "Your profile";
  const accountInitials = initialsFor(userName || userEmail || "Account");

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    const client = supabase;
    setBackendConnected(true);
    let active = true;

    async function loadAccount(user: { id: string; email?: string; user_metadata?: { full_name?: string } }) {
      setEnteredWorkspace(false);
      try {
        const { data: profile, error } = await client
          .from("profiles")
          .select("role,institution_id,county,full_name")
          .eq("id", user.id)
          .maybeSingle();
        if (!active) return;
        if (error) {
          const message = `Could not load account access: ${error.message}`;
          setLandingMessage(message);
          setAuthFeedback({ type: "error", message });
          return;
        }
        if (!profile) {
          const message = "Your account profile is missing. Contact the platform administrator.";
          setLandingMessage(message);
          setAuthFeedback({ type: "error", message });
          return;
        }
        if (!isRole(profile.role)) {
          const message = "Your account does not have an authorized workspace role. Contact the platform administrator.";
          setLandingMessage(message);
          setAuthFeedback({ type: "error", message });
          return;
        }
        const accountName = profile.full_name?.trim() || user.user_metadata?.full_name?.trim() || "";
        setUserName(accountName);
        setRole(profile.role);
        setActiveNav(roleInfo[profile.role].nav[0]);
        setInstitutionId(profile.institution_id ?? "");
        if (profile.role === "teacher") {
          setTeacherCounty(profile.county ?? "");
          setCountySetupRequired(!profile.county);
          if (profile.county) setCounty(profile.county);
        }
        if (profile.role === "institution") {
          if (!profile.institution_id) {
            const message = "Your school account is not linked to an institution. Contact the platform administrator.";
            setLandingMessage(message);
            setAuthFeedback({ type: "error", message });
            return;
          }
          const { data: institution, error: institutionError } = await client
            .from("institutions")
            .select("county,subcounty,school_level")
            .eq("id", profile.institution_id)
            .single();
          if (!active) return;
          if (institutionError) {
            const message = `Could not load school details: ${institutionError.message}`;
            setLandingMessage(message);
            setAuthFeedback({ type: "error", message });
            return;
          }
          setSchoolCounty(institution.county);
          setSchoolSubcounty(institution.subcounty ?? "");
          setSchoolLevel(institution.school_level ?? "");
        }
        if (profile.role === "teacher") {
          const { data: applications, error: applicationError } = await client
            .from("applications")
            .select("vacancy_id")
            .eq("teacher_id", user.id);
          if (!active) return;
          if (applicationError) {
            setNotice(`Could not load your applications: ${applicationError.message}`);
          } else {
            setApplied(applications.map((application) => application.vacancy_id));
          }
        }
        setUserEmail(user.email ?? "");
        setEnteredWorkspace(true);
      } catch (error) {
        if (!active) return;
        const message = error instanceof Error ? `Could not load your workspace: ${error.message}` : "Could not load your workspace. Please try again.";
        setLandingMessage(message);
        setAuthFeedback({ type: "error", message });
      }
    }

    const { data: authListener } = client.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (session?.user) {
        setUserEmail(session.user.email ?? "");
        window.setTimeout(() => void loadAccount(session.user), 0);
      } else {
        setUserEmail("");
        setUserName("");
        setEnteredWorkspace(false);
        setLandingMessage("");
        setAuthFeedback(null);
        setRole("teacher");
        setActiveNav(roleInfo.teacher.nav[0]);
        setInstitutionId("");
        setSchoolCounty("");
        setSchoolSubcounty("");
        setSchoolLevel("");
        setTeacherCounty("");
        setCountySetupRequired(false);
        setCounty("All counties");
        setVacancies([]);
        setVacanciesLoading(false);
        setVacancyLoadError("");
        setApplied([]);
      }
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const supabase = getSupabase();
    if (!backendConnected || !enteredWorkspace || !userEmail || !supabase) return;
    let active = true;
    setVacanciesLoading(true);
    setVacancyLoadError("");

    void supabase
      .from("vacancies")
      .select("id,title,county,subcounty,school_level,employment_type,category,created_at,institution_id,institutions(name)")
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setVacancyLoadError(error.message);
          setNotice(`Could not load live vacancies: ${error.message}`);
          setVacanciesLoading(false);
          return;
        }
        setVacancies((data ?? []).map((row) => {
          const institution = Array.isArray(row.institutions) ? row.institutions[0] : row.institutions;
          const name = institution?.name ?? "Verified school";
          return {
            id: row.id,
            title: row.title,
            institution: name,
            county: row.county,
            subcounty: row.subcounty ?? undefined,
            level: row.school_level,
            category: row.category === "BOM" ? "Teaching" : row.category ?? "Teaching",
            type: row.employment_type === "BOM" ? "BOM-employed" : row.employment_type,
            institutionId: row.institution_id,
            posted: `Posted ${new Date(row.created_at).toLocaleDateString()}`,
            color: "mint",
            initials: initialsFor(name),
          };
        }));
        setVacanciesLoading(false);
      });

    return () => {
      active = false;
    };
  }, [backendConnected, enteredWorkspace, teacherCounty, userEmail]);

  const counties = useMemo(() => ["All counties", ...new Set(vacancies.map((job) => job.county))], [vacancies]);
  const levels = useMemo(() => ["All levels", ...new Set(vacancies.map((job) => job.level))], [vacancies]);
  const filteredVacancies = vacancies.filter((job) => {
    const text = `${job.title} ${job.institution} ${job.county} ${job.category}`.toLowerCase();
    return text.includes(query.toLowerCase()) && (county === "All counties" || county === job.county) && (level === "All levels" || level === job.level);
  });
  async function submitAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setAuthFeedback(null);
    setNotice("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const fullName = String(form.get("full_name") ?? "").trim();
    const supabase = getSupabase();
    if (!supabase) {
      setAuthFeedback({ type: "error", message: "Sign-in is unavailable. Add your Supabase URL and publishable key to .env.local." });
      setLoading(false);
      return;
    }

    const teacherCounty = String(form.get("county") ?? "");
    try {
      const result = authMode === "signup"
        ? await supabase.auth.signUp({ email, password, options: { data: { county: teacherCounty, full_name: fullName } } })
        : await supabase.auth.signInWithPassword({ email, password });
      if (result.error) {
        setAuthFeedback({ type: "error", message: result.error.message });
        setLandingMessage(result.error.message);
      } else {
        if (result.data.session) {
          const message = authMode === "signup"
            ? "Your account was created. Loading your secure workspace…"
            : "Signed in successfully. Loading your secure workspace…";
          setAuthFeedback({ type: "success", message });
          setNotice(message);
          setModal(null);
        } else {
          const message = "Your account was created. Check your email to confirm your address, then log in.";
          setAuthFeedback({ type: "success", message });
          setLandingMessage(message);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not authenticate. Please try again.";
      setAuthFeedback({ type: "error", message });
      setLandingMessage(message);
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    const supabase = getSupabase();
    if (!supabase) {
      setNotice("Could not sign out because Supabase is not configured.");
      return;
    }

    const { error } = await supabase.auth.signOut();
    if (error) setNotice(`Could not sign out: ${error.message}`);
  }

  async function saveTeacherCounty(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setNotice("");
    const form = new FormData(event.currentTarget);
    const selectedCounty = String(form.get("teacher_county") ?? "");
    const supabase = getSupabase();
    if (!supabase) {
      setLoading(false);
      setNotice("Connect Supabase before setting your teacher county.");
      return;
    }

    const { error } = await supabase.rpc("set_teacher_county", { p_county: selectedCounty });
    setLoading(false);
    if (error) {
      setNotice(`Could not save your county: ${error.message}`);
      return;
    }

    setTeacherCounty(selectedCounty);
    setCounty(selectedCounty);
    setCountySetupRequired(false);
    setNotice("Your county has been saved. Free access includes opportunities in this county.");
  }

  async function applyFor(job: Vacancy) {
    if (!userEmail) {
      setAuthMode("signup");
      setModal("auth");
      return;
    }
    const supabase = getSupabase();
    if (!supabase) {
      setNotice("Sign in to a connected account before applying.");
      return;
    }
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      setAuthMode("signin");
      setModal("auth");
      return;
    }
    const { error } = await supabase.from("applications").insert({ vacancy_id: job.id, teacher_id: user.user.id });
    if (error) {
      setNotice(error.code === "23505" ? "You have already applied for this vacancy." : `Application failed: ${error.message}`);
      return;
    }
    setApplied((current) => [...current, job.id]);
    setNotice(`Your application for ${job.title} has been submitted.`);
  }

  async function startSubscription(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setNotice("");
    const form = new FormData(event.currentTarget);
    try {
      const supabase = getSupabase();
      const { data: sessionData } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
      if (!sessionData.session) throw new Error("Sign in with the institution account invited by your super admin.");
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionData.session.access_token}` },
        body: JSON.stringify({ phone_number: String(form.get("phone") ?? "") }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not start payment.");
      setNotice("STK push sent. Complete the payment on your phone.");
      setModal(null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not start payment.");
    } finally {
      setLoading(false);
    }
  }

  async function registerInstitution(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLoading(true);
    setNotice("");
    const supabase = getSupabase();
    const { data: sessionData } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
    if (!sessionData.session) {
      setLoading(false);
      setNotice("Sign in with an authorized super admin account to register institutions.");
      return;
    }
    try {
      const response = await fetch("/api/admin/institutions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionData.session.access_token}` },
        body: JSON.stringify({
          name: String(form.get("institution_name") ?? ""),
          county: String(form.get("county") ?? ""),
          subcounty: String(form.get("subcounty") ?? ""),
          school_level: String(form.get("school_level") ?? ""),
          head_name: String(form.get("head_name") ?? ""),
          head_email: String(form.get("head_email") ?? ""),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not register the institution.");
      setModal(null);
      setNotice("Institution registered. An invitation has been sent to its head.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not register the institution.");
    } finally {
      setLoading(false);
    }
  }

  async function createVacancy(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setNotice("");
    const supabase = getSupabase();
    if (!supabase) {
      setLoading(false);
      setModal(null);
      setNotice("Connect Supabase and sign in with an institution account to publish vacancies.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setLoading(false);
      setModal(null);
      setNotice("Sign in with the institution account invited by your super admin to publish vacancies.");
      return;
    }
    const { data: profile, error: profileError } = await supabase.from("profiles").select("institution_id").eq("id", userData.user.id).single();
    if (profileError) {
      setLoading(false);
      setNotice(`Could not load your school profile: ${profileError.message}`);
      return;
    }
    if (!profile?.institution_id) {
      setLoading(false);
      setModal(null);
      setNotice("This account is not linked to an institution.");
      return;
    }
    const { data: institution, error: institutionError } = await supabase
      .from("institutions")
      .select("county,subcounty,school_level")
      .eq("id", profile.institution_id)
      .single();
    if (institutionError || !institution?.county || !institution.subcounty || !institution.school_level) {
      setLoading(false);
      setNotice("Your school profile needs a county, subcounty and school level before vacancies can be posted. Ask your super admin to update its details.");
      return;
    }
    const selectedVacancyLevel = String(form.get("vacancy_level") ?? "");
    if (!getVacancyLevelsForInstitutionType(institution.school_level).includes(selectedVacancyLevel)) {
      setLoading(false);
      setNotice("Select a teaching level that matches your institution type.");
      return;
    }
    setSchoolCounty(institution.county);
    setSchoolSubcounty(institution.subcounty);
    setSchoolLevel(institution.school_level);
    const newVacancy = {
      institution_id: profile.institution_id,
      title: String(form.get("title") ?? ""),
      county: institution.county,
      subcounty: institution.subcounty,
      school_level: selectedVacancyLevel,
      employment_type: String(form.get("employment_type") ?? ""),
      category: String(form.get("category") ?? ""),
      description: String(form.get("description") ?? ""),
      status: "published",
    };
    const { data: createdVacancy, error } = await supabase
      .from("vacancies")
      .insert(newVacancy)
      .select("id")
      .single();
    setLoading(false);
    if (error) {
      setNotice(`Could not publish vacancy: ${error.message}`);
      return;
    }
    setVacancies((current) => [{
      id: createdVacancy.id,
      title: newVacancy.title,
      institution: "Your school",
      county: newVacancy.county,
      subcounty: newVacancy.subcounty,
      level: newVacancy.school_level,
      category: newVacancy.category,
      type: newVacancy.employment_type === "BOM" ? "BOM-employed" : newVacancy.employment_type,
      posted: "Just now",
      color: "mint",
      initials: "SC",
      institutionId: newVacancy.institution_id,
    }, ...current]);
    setModal(null);
    setActiveNav("My vacancies");
    setNotice("Your vacancy is now live for educators to discover.");
  }

  function showVacancyArea() {
    setActiveNav(role === "teacher" ? "Discover" : role === "institution" ? "My vacancies" : "Vacancies");
  }

  const heading = role === "teacher"
    ? activeNav === "My applications" ? "Your applications" : activeNav === "Saved jobs" ? "Saved opportunities" : activeNav === "My profile" ? "Your profile" : "Opportunities made for you"
    : role === "institution" ? activeNav === "Subscription" ? "Your school subscription" : activeNav === "Applicants" ? "Your applicants" : activeNav === "My vacancies" ? "Your vacancies" : "Welcome to your workspace"
      : activeNav === "Institutions" ? "Institutions across Kenya" : activeNav === "Subscriptions" ? "Subscription overview" : activeNav === "Vacancies" ? "Vacancy oversight" : "A clearer view of the platform";

  function authForm() {
    return (
      <>
        <button className="modal-close" onClick={() => { if (!loading) setModal(null); }} aria-label="Close" disabled={loading}><Icon name="close" size={19} /></button>
        <div className="modal-mark"><span className="brand-mark"><span /></span></div>
        <span className="job-category">{authMode === "signup" ? "YOUR NEXT CHAPTER" : "WELCOME BACK"}</span>
        <h2 id="modal-heading">{authMode === "signup" ? "Join the community." : "Good to see you again."}</h2>
        <p className="modal-description">{authMode === "signup" ? "Create a free teacher account to view and apply for opportunities in your county." : "Sign in to pick up where you left off."}</p>
        {authFeedback && <p className={`auth-feedback ${authFeedback.type}`} role={authFeedback.type === "error" ? "alert" : "status"} aria-live={authFeedback.type === "error" ? "assertive" : "polite"}>{authFeedback.message}</p>}
        <form className="modal-form" onSubmit={(event) => void submitAuth(event)} aria-busy={loading}>
          {authMode === "signup" && <label>Full name<input name="full_name" placeholder="Your full name" autoComplete="name" required disabled={loading} /></label>}
          {authMode === "signup" && <label>Your county<select name="county" defaultValue="" required disabled={loading}><option value="" disabled>Select your county</option>{KENYAN_COUNTIES.map((countyName) => <option key={countyName} value={countyName}>{countyName}</option>)}</select></label>}
          <label>Email address<input name="email" type="email" placeholder="you@example.com" autoComplete="email" required disabled={loading} /></label>
          <label>Password<input name="password" type="password" placeholder="At least 8 characters" minLength={8} autoComplete={authMode === "signup" ? "new-password" : "current-password"} required disabled={loading} /></label>
          <button className="primary-button modal-submit" disabled={loading}>
            {loading && <span className="button-spinner" aria-hidden="true" />}
            {loading ? "Please wait…" : authMode === "signup" ? "Create teacher account" : "Sign in"}
            {!loading && <Icon name="arrow" size={15} />}
          </button>
        </form>
        <p className="switch-auth">{authMode === "signup" ? "Already have an account?" : "New to MwalimuConnect?"} <button disabled={loading} onClick={() => { setAuthMode(authMode === "signup" ? "signin" : "signup"); setAuthFeedback(null); }}>{authMode === "signup" ? "Sign in" : "Create account"}</button></p>
      </>
    );
  }

  if (!enteredWorkspace) {
    return (
      <>
        <LandingPage
          message={landingMessage}
          onBrowse={() => {
            setAuthMode("signin");
            setAuthFeedback(null);
            setModal("auth");
            setLandingMessage("");
          }}
          onSchools={() => {
            setAuthMode("signin");
            setAuthFeedback(null);
            setModal("auth");
            setLandingMessage("");
          }}
          onSignIn={() => {
            setAuthMode("signin");
            setAuthFeedback(null);
            setModal("auth");
            setLandingMessage("");
          }}
          onJoin={() => {
            setAuthMode("signup");
            setAuthFeedback(null);
            setModal("auth");
            setLandingMessage("");
          }}
        />
        {modal === "auth" && <div className="modal-backdrop" onMouseDown={(event) => { if (!loading && event.target === event.currentTarget) setModal(null); }}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-heading">{authForm()}</section></div>}
      </>
    );
  }

  return (
    <main className="app-shell">
      {role === "teacher" && countySetupRequired && <div className="modal-backdrop"><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="county-setup-heading"><div className="modal-mark"><span className="brand-mark"><span /></span></div><span className="job-category">YOUR LOCAL OPPORTUNITIES</span><h2 id="county-setup-heading">Choose your county.</h2><p className="modal-description">Your free teacher account includes vacancies in one county. This setting can only be chosen once.</p><form className="modal-form" onSubmit={(event) => void saveTeacherCounty(event)}><label>Your county<select name="teacher_county" defaultValue="" required><option value="" disabled>Select your county</option>{KENYAN_COUNTIES.map((countyName) => <option key={countyName} value={countyName}>{countyName}</option>)}</select></label><button className="primary-button modal-submit" disabled={loading}>{loading ? "Saving…" : "Save my county"} <Icon name="arrow" size={15} /></button></form></section></div>}
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="MwalimuConnect home">
          <span className="brand-mark"><span /></span>
          <span className="brand-name">mwalimu<span>connect</span></span>
        </a>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          {roleInfo[role].nav.map((item) => (
            <button key={item} className={`nav-item ${activeNav === item ? "active" : ""}`} onClick={() => setActiveNav(item)}>
              <Icon name={navIcon(item)} size={18} /><span>{item}</span>
              {item === "My applications" && <span className="nav-count">{applied.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <span className="help-spark">✳</span>
            <strong>Here for your next chapter.</strong>
            <p>Good work should find its way to good people.</p>
            <button onClick={showVacancyArea}>Explore opportunities <Icon name="arrow" size={15} /></button>
          </div>
        </div>
      </aside>

      <section className="content-area">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><strong>{activeNav}</strong></div>
          <div className="topbar-actions">
            <span className="connection-pill connected"><i />Secure workspace</span>
            <button className="icon-button notification-button" aria-label="Notifications"><Icon name="bell" size={19} /></button>
            <div className="account-menu">
              <button className="account-trigger" aria-label={`Account: ${accountDisplayName}, ${userEmail}, ${roleInfo[role].name}`} aria-haspopup="menu" aria-expanded={accountMenuOpen} onClick={() => setAccountMenuOpen((open) => !open)}>
                <Icon name="profile" size={19} />
              </button>
              {accountMenuOpen && <div className="account-dropdown" role="menu">
                <div className="account-dropdown-identity">
                  <span className="avatar">{accountInitials}</span>
                  <span><strong>{accountDisplayName}</strong><small>{userEmail}</small><small>{roleInfo[role].name}</small></span>
                </div>
                <button role="menuitem" onClick={() => { setAccountMenuOpen(false); setModal("profile"); }}><Icon name="profile" size={16} /> Profile</button>
                <button role="menuitem" onClick={() => { setAccountMenuOpen(false); void signOut(); }}><span aria-hidden="true">↪</span> Log out</button>
              </div>}
            </div>
          </div>
        </header>

        <div className="page-content">
          {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss message"><Icon name="close" size={16} /></button></div>}
          <div className="welcome-row">
            <div>
              <div className="eyebrow"><span className="eyebrow-dot" /> KENYA&apos;S EDUCATION COMMUNITY</div>
              <h1>{heading}<span className="title-period">.</span></h1>
              <p className="page-subtitle">{role === "teacher" ? "A meaningful role can change everything. Let’s find yours." : role === "institution" ? "Find the right people to help your learners flourish." : "Helping great schools and great educators find each other."}</p>
            </div>
            <div className="welcome-actions">
              {role === "teacher" ? <button className="outline-button" onClick={() => setActiveNav("Saved jobs")}><Icon name="saved" size={17} /> Saved <span className="saved-bubble">{saved.length}</span></button>
                : role === "institution" ? <button className="primary-button" onClick={() => setModal("vacancy")}><span className="plus">+</span> Post a vacancy</button>
                  : <button className="primary-button" onClick={() => { setActiveNav("Institutions"); setSchoolRegistrationCounty(""); setModal("institution"); }}><span className="plus">+</span> Add institution</button>}
            </div>
          </div>

          {role === "teacher" && activeNav === "Discover" && <>
            <section className="hero-card">
              <div className="hero-content">
                <span className="hero-kicker">YOUR NEXT CHAPTER STARTS HERE</span>
                <h2>Do work that<br />makes a difference.</h2>
                <p>Discover opportunities in schools shaping<br className="desktop-break" /> the future of Kenya.</p>
                <button className="hero-button" onClick={() => document.getElementById("vacancy-search")?.focus()}>Find your opportunity <Icon name="arrow" size={16} /></button>
              </div>
              <div className="hero-art" aria-hidden="true">
                <div className="art-sun" /><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
                <div className="art-book"><span /><span /><span /></div>
                <div className="art-flower flower-one">✳</div><div className="art-flower flower-two">✳</div>
                <div className="art-note">A little<br />goes a long<br />way <span>↗</span></div>
              </div>
              <div className="hero-index">01 <span>/</span> 03</div>
            </section>
          </>}

          {(role === "teacher" && ["Discover", "Saved jobs", "My applications"].includes(activeNav)) && <section className="jobs-section">
            <div className="section-heading">
              <div><h2>{activeNav === "Saved jobs" ? "Saved for later" : activeNav === "My applications" ? "Your recent applications" : "Fresh opportunities"}</h2><p>{activeNav === "Discover" ? "Handpicked roles from schools looking for someone like you." : "Keep track of the opportunities that matter to you."}</p></div>
              <button className="text-button" onClick={() => { setQuery(""); setCounty("All counties"); setLevel("All levels"); }}>View all <Icon name="arrow" size={15} /></button>
            </div>
            {activeNav === "Discover" && teacherCounty && <div className="subscription-note"><span className="subscription-check"><Icon name="location" size={15} /></span><span><strong>Free access: {teacherCounty}</strong><small>Nationwide teacher access will be available as a separate subscription. Pricing is not set yet.</small></span></div>}
            <div className="filter-bar">
              <label className="search-field" htmlFor="vacancy-search"><Icon name="search" size={18} /><input id="vacancy-search" placeholder="Job title, school or keyword" value={query} onChange={(event) => setQuery(event.target.value)} /><kbd>⌘ K</kbd></label>
              <label className="select-field"><Icon name="location" size={17} /><select aria-label="Filter by county" value={county} onChange={(event) => setCounty(event.target.value)}>{counties.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label className="select-field level-select"><select aria-label="Filter by school level" value={level} onChange={(event) => setLevel(event.target.value)}>{levels.map((item) => <option key={item}>{item}</option>)}</select><span className="select-chevron">⌄</span></label>
              <button className="filter-button" aria-label="Filters"><span className="filter-lines">☷</span></button>
            </div>
            <div className="job-list">
              {filteredVacancies.filter((job) => activeNav === "Saved jobs" ? saved.includes(job.id) : activeNav === "My applications" ? applied.includes(job.id) : true).map((job) => (
                <article className="job-card" key={job.id}>
                  <div className={`school-avatar ${job.color}`}>{job.initials}</div>
                  <div className="job-main">
                    <div className="job-topline"><span className="job-category">{job.category}</span><span className="job-dot">·</span><span className="job-posted">{job.posted}</span></div>
                    <h3>{job.title}</h3>
                    <div className="job-meta"><span>{job.institution}</span><i /><span>{job.level}</span><i /><span><Icon name="location" size={13} /> {job.subcounty ? `${job.subcounty}, ` : ""}{job.county}</span></div>
                  </div>
                  <div className="job-side"><span className="job-type">{job.type}</span></div>
                  <div className="job-actions">
                    <button className={`bookmark-button ${saved.includes(job.id) ? "is-saved" : ""}`} aria-label={saved.includes(job.id) ? "Remove saved job" : "Save job"} onClick={() => setSaved((current) => current.includes(job.id) ? current.filter((id) => id !== job.id) : [...current, job.id])}><Icon name="saved" size={18} /></button>
                    <button className={`apply-button ${applied.includes(job.id) ? "applied" : ""}`} onClick={() => void applyFor(job)}>{applied.includes(job.id) ? "Applied" : "Apply now"} <Icon name="arrow" size={15} /></button>
                  </div>
                </article>
              ))}
              {activeNav === "Discover" && filteredVacancies.length === 0 && <div className="empty-state"><span>✳</span><strong>{vacanciesLoading ? "Loading live opportunities…" : vacancyLoadError ? "Opportunities couldn’t be loaded." : vacancies.length === 0 ? "There are no live opportunities in your county yet." : "No opportunities match your search."}</strong><p>{vacanciesLoading ? "Please wait while we fetch current listings." : vacancyLoadError ? "Check your connection and try again." : vacancies.length === 0 ? "New listings from verified schools will appear here when available." : "Try changing your search or school-level filters."}</p></div>}
              {(activeNav === "Saved jobs" && saved.length === 0 || activeNav === "My applications" && applied.length === 0) && <div className="empty-state"><span>✳</span><strong>{activeNav === "Saved jobs" ? "Your saved list is ready for its first role." : "Your next step starts with a great application."}</strong><p>{activeNav === "Saved jobs" ? "Tap the bookmark on any opportunity to keep it close." : "Explore open opportunities and apply when you find the right fit."}</p><button className="text-button" onClick={() => setActiveNav("Discover")}>Explore opportunities <Icon name="arrow" size={15} /></button></div>}
            </div>
          </section>}

          {role === "teacher" && activeNav === "My profile" && <section className="panel-card profile-panel"><div className="profile-large">{initialsFor(userEmail || "Account")}</div><div><span className="job-category">YOUR EDUCATOR PROFILE</span><h2>{userEmail}</h2><p>Your free access is currently set to {teacherCounty || "a county not yet selected"}.</p></div></section>}

          {role === "institution" && <section className="panel-card role-panel">
            <div className="role-panel-head"><div className="panel-icon"><Icon name={activeNav === "Subscription" ? "subscription" : activeNav === "Applicants" ? "applicants" : "vacancies"} size={22} /></div><div><span className="job-category">SCHOOL WORKSPACE</span><h2>{activeNav === "Subscription" ? "Connect your school to opportunity." : activeNav === "Applicants" ? "Meet your next great educator." : "The right educator changes everything."}</h2><p>{activeNav === "Subscription" ? "Activate a subscription to keep your school’s opportunities visible to teachers." : activeNav === "Applicants" ? "Applications to your published vacancies will appear here." : "Post a vacancy and help talented educators find their way to your school."}</p></div></div>
            {activeNav !== "Subscription" && <div className="institution-levels"><strong>{schoolLevel || "Institution type"}</strong><span>Teaching levels: {getVacancyLevelsForInstitutionType(schoolLevel).join(" · ") || "Not configured"}</span></div>}
            <div className="role-actions"><button className="primary-button" onClick={() => activeNav === "Subscription" ? setModal("subscription") : activeNav === "Applicants" ? setActiveNav("My vacancies") : setModal("vacancy")}>{activeNav === "Subscription" ? "Subscribe with M-Pesa" : activeNav === "Applicants" ? "View vacancies" : "Post a vacancy"} <Icon name="arrow" size={15} /></button>{activeNav !== "Subscription" && <button className="outline-button" onClick={() => setActiveNav("Subscription")}>Manage subscription</button>}</div>
            {activeNav === "Subscription" && <div className="subscription-note"><span className="subscription-check">✓</span><span><strong>Secure M-Pesa STK push</strong><small>Your subscription rate will be configured by the platform administrator.</small></span></div>}
            {activeNav === "My vacancies" && <div className="institution-vacancy-list"><h3>Your recent vacancies</h3>{vacancies.filter((job) => institutionId && job.institutionId === institutionId).map((job) => <div className="institution-vacancy" key={job.id}><span className="school-avatar mint">{job.initials}</span><span className="institution-vacancy-copy"><strong>{job.title}</strong><small>{job.level} · {job.subcounty ? `${job.subcounty}, ` : ""}{job.county}</small></span><span className="published-label"><i /> Live</span></div>)}{vacancies.filter((job) => institutionId && job.institutionId === institutionId).length === 0 && <p className="no-vacancies">No vacancies yet. Post your first role to reach educators.</p>}</div>}
          </section>}

          {role === "admin" && <section className="panel-card role-panel">
            <div className="role-panel-head"><div className="panel-icon admin-icon"><Icon name={navIcon(activeNav)} size={22} /></div><div><span className="job-category">PLATFORM ADMINISTRATION</span><h2>{activeNav === "Institutions" ? "Bring another school on board." : activeNav === "Subscriptions" ? "Keep every subscription in view." : activeNav === "Vacancies" ? "Keep opportunities verified and visible." : "A connected community starts here."}</h2><p>{activeNav === "Institutions" ? "Register schools and invite their heads of institution to manage vacancies." : activeNav === "Subscriptions" ? "Monitor school access and M-Pesa subscription activity." : activeNav === "Vacancies" ? "Review published roles from participating institutions." : "A home for schools and educators, in every county."}</p></div></div>
            <div className="role-actions"><button className="primary-button"             onClick={() => activeNav === "Institutions" ? (setSchoolRegistrationCounty(""), setModal("institution")) : setActiveNav("Institutions")}><span className="plus">+</span> {activeNav === "Institutions" ? "Register an institution" : "Manage institutions"}</button><button className="outline-button" onClick={() => setActiveNav("Subscriptions")}>Subscription overview</button></div>
          </section>}

          <footer className="page-footer"><span>© 2025 MwalimuConnect</span><span>Built for the people who shape tomorrow. <span className="footer-spark">✳</span></span></footer>
        </div>
      </section>

      <nav className="mobile-nav" aria-label="Mobile navigation">{roleInfo[role].nav.slice(0, 4).map((item) => <button key={item} className={activeNav === item ? "active" : ""} onClick={() => setActiveNav(item)}><Icon name={navIcon(item)} size={19} /><span>{item.split(" ")[0]}</span></button>)}</nav>

      {modal && <div className="modal-backdrop" onMouseDown={(event) => { if (!loading && event.target === event.currentTarget) setModal(null); }}>
        <section className={`modal-card${modal === "institution" ? " institution-modal-card" : ""}`} role="dialog" aria-modal="true" aria-labelledby="modal-heading">
          {modal === "auth" ? authForm() : <>
            <button className="modal-close" onClick={() => setModal(null)} aria-label="Close"><Icon name="close" size={19} /></button>
            <div className="modal-mark"><span className="brand-mark"><span /></span></div>
            {modal === "profile" ? <>
              <span className="job-category">YOUR ACCOUNT</span><h2 id="modal-heading">Profile</h2><p className="modal-description">Your account details and workspace access.</p>
              <div className="account-profile">
                <div className="account-profile-identity"><span className="profile-large">{accountInitials}</span><div><strong>{accountDisplayName}</strong><small>{roleInfo[role].name}</small></div></div>
                <dl>
                  <div><dt>Name</dt><dd>{userName || "Not set"}</dd></div>
                  <div><dt>Email</dt><dd>{userEmail || "Not available"}</dd></div>
                  <div><dt>Workspace</dt><dd>{roleInfo[role].name}</dd></div>
                  {role === "teacher" && <div><dt>County</dt><dd>{teacherCounty || "Not selected"}</dd></div>}
                  {role === "institution" && <><div><dt>County</dt><dd>{schoolCounty || "Not available"}</dd></div><div><dt>Subcounty</dt><dd>{schoolSubcounty || "Not available"}</dd></div><div><dt>Institution type</dt><dd>{schoolLevel || "Not available"}</dd></div></>}
                </dl>
              </div>
            </> : modal === "subscription" ? <>
              <span className="job-category">SCHOOL SUBSCRIPTION</span><h2 id="modal-heading">Pay securely with M-Pesa.</h2><p className="modal-description">We’ll send an STK push to your number. The subscription amount is set by your platform administrator.</p>
              <form className="modal-form" onSubmit={(event) => void startSubscription(event)}><label>M-Pesa phone number<input name="phone" type="tel" placeholder="254 7XX XXX XXX" pattern="^(?:\+?254|0)?7\d{8}$" required /></label><button className="primary-button modal-submit" disabled={loading}>{loading ? "Sending request…" : "Send STK push"} <Icon name="arrow" size={15} /></button></form>
              <p className="secure-note"><Icon name="subscription" size={15} /> Payments processed securely by IntaSend.</p>
            </> : modal === "institution" ? <>
              <span className="job-category">SUPER ADMINISTRATION</span><h2 id="modal-heading">Welcome a new school.</h2><p className="modal-description">Register the school’s location and institution type. Its head can select the teaching level for each vacancy.</p>
              <form className="modal-form institution-form" onSubmit={(event) => void registerInstitution(event)}>
                <label>Institution name<input name="institution_name" placeholder="Enter institution name" required /></label>
                <label>Institution type<select name="school_level" defaultValue="" required><option value="" disabled>Select institution type</option>{INSTITUTION_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
                <label>County<select name="county" value={schoolRegistrationCounty} onChange={(event) => setSchoolRegistrationCounty(event.target.value)} required><option value="" disabled>Select county</option>{KENYAN_COUNTIES.map((countyName) => <option key={countyName} value={countyName}>{countyName}</option>)}</select></label>
                <label>Subcounty<select key={schoolRegistrationCounty} name="subcounty" defaultValue="" disabled={!schoolRegistrationCounty} required><option value="" disabled>{schoolRegistrationCounty ? "Select subcounty" : "Select county first"}</option>{getSubCountiesInCounty(schoolRegistrationCounty).map((item) => <option key={item.code} value={item.name}>{item.name}</option>)}</select></label>
                <label>Head of institution<input name="head_name" placeholder="Full name" required /></label>
                <label>Invitation email<input name="head_email" type="email" placeholder="head@school.ac.ke" required /></label>
                <button className="primary-button modal-submit" disabled={loading}>{loading ? "Registering school…" : "Register & send invitation"} <Icon name="arrow" size={15} /></button>
              </form>
            </> : <>
              <span className="job-category">NEW OPPORTUNITY</span><h2 id="modal-heading">Find your next great educator.</h2><p className="modal-description">Your school’s location and learning level are applied automatically to its vacancies.</p>
              <div className="vacancy-school-details"><span><small>County</small><strong>{schoolCounty || "Loading…"}</strong></span><i /><span><small>Subcounty</small><strong>{schoolSubcounty || "Loading…"}</strong></span><i /><span><small>Institution type</small><strong>{schoolLevel || "Loading…"}</strong></span></div>
              <form className="modal-form" onSubmit={(event) => void createVacancy(event)}><label>Job title<input name="title" placeholder="Enter teaching vacancy title" required /></label><label>Teaching level<select name="vacancy_level" defaultValue="" required><option value="" disabled>Select teaching level</option>{getVacancyLevelsForInstitutionType(schoolLevel).map((levelName) => <option key={levelName} value={levelName}>{levelName}</option>)}</select></label><div className="form-pair"><label>Employment arrangement<select name="employment_type"><option>Full-time</option><option>Part-time</option><option>Internship</option><option value="BOM">Employed by Board of Management (BOM)</option></select></label><label>Category<select name="category"><option>Teaching</option><option>Internship</option></select></label></div><label>Role description<textarea name="description" rows={3} placeholder="What should applicants know?" /></label><button className="primary-button modal-submit" disabled={loading || !schoolCounty || !schoolSubcounty || !schoolLevel}>{loading ? "Publishing…" : "Publish vacancy"} <Icon name="arrow" size={15} /></button></form>
            </>}
          </>}
        </section>
      </div>}
    </main>
  );
}
