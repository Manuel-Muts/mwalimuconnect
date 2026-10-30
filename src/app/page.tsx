"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getSubCountiesInCounty } from "kenya-locations/sub-counties";
import { getSupabase } from "@/lib/supabase";
import { getVacancyLevelsForInstitutionType, INSTITUTION_TYPES, KENYAN_COUNTIES } from "@/lib/school-options";
import LandingPage from "@/app/landing-page";

type Role = "teacher" | "institution" | "admin";
type SubscriptionPlanKey = "weekly" | "monthly" | "termly" | "yearly";
type SubscriptionPlan = {
  key: SubscriptionPlanKey;
  name: string;
  durationDays: number;
  amountKes: number | null;
};
type Vacancy = {
  id: string;
  title: string;
  description: string;
  institution: string;
  county: string;
  subcounty?: string;
  status: string;
  applicationDeadline: string;
  level: string;
  category: string;
  type: string;
  institutionId?: string;
  postedAt: string;
  color: string;
  initials: string;
};
type TeacherCv = {
  full_name: string;
  email: string;
  phone: string;
  professional_title: string;
  years_experience: string;
  education: string;
  experience: string;
  skills: string;
  candidate_statement: string;
};
type InstitutionApplicant = {
  id: string;
  vacancyId: string;
  vacancyTitle: string;
  appliedAt: string;
  cv: TeacherCv;
};
type InstitutionActiveVacancy = {
  id: string;
  title: string;
  applicationDeadline: string;
};
type RegisteredInstitution = {
  id: string;
  name: string;
  county: string;
  subcounty: string;
  school_level: string;
  head_email: string | null;
  head_phone: string | null;
  head_name: string | null;
};
type InstitutionPageCacheEntry = {
  institutions: RegisteredInstitution[];
  totalCount: number;
};
type PasskeyListItem = {
  id: string;
  friendly_name?: string;
  created_at: string;
  last_used_at?: string;
};
const passkeyInvitationIntervalMs = 30 * 24 * 60 * 60 * 1000;

const emptyTeacherCv: TeacherCv = {
  full_name: "",
  email: "",
  phone: "",
  professional_title: "",
  years_experience: "0",
  education: "",
  experience: "",
  skills: "",
  candidate_statement: "",
};

const roleInfo: Record<Role, { name: string; subtitle: string; nav: string[] }> = {
  teacher: { name: "Teacher", subtitle: "Find your next opportunity", nav: ["Discover", "My applications", "My CV", "Saved jobs", "Subscription"] },
  institution: { name: "Institution", subtitle: "Your school workspace", nav: ["Overview", "My vacancies", "Applications", "Subscription"] },
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
  eye: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>,
  eyeOff: <><path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.9 5.2A10.7 10.7 0 0 1 12 5c6.4 0 10 7 10 7a14.8 14.8 0 0 1-3.1 3.8M6.2 6.2C3.5 8 2 12 2 12s3.6 7 10 7a10.5 10.5 0 0 0 4-.8" /></>,
  passkey: <><circle cx="8" cy="8" r="5" /><path d="m11.5 11.5 9 9m-4-4 2-2m-5-1 2-2" /></>,
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

function phoneDigitsAfterKenyanPrefix(phone: string) {
  return phone.trim().replace(/[\s()-]/g, "").replace(/^(?:\+?254|0)/, "");
}

function wasPostedWithinLastWeek(postedAt: string) {
  const age = Date.now() - new Date(postedAt).getTime();
  return age >= 0 && age < 7 * 24 * 60 * 60 * 1000;
}

function nairobiDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = new Map(parts.map(({ type, value }) => [type, value]));
  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
}

function formatNairobiDate(dateString: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Nairobi", dateStyle: "medium" })
    .format(new Date(`${dateString}T00:00:00Z`));
}

function isVacancyOpen(applicationDeadline: string) {
  return applicationDeadline >= nairobiDateString();
}

function isRole(value: unknown): value is Role {
  return value === "teacher" || value === "institution" || value === "admin";
}

function passkeyBrowserError() {
  if (typeof window === "undefined") return "Passkeys are unavailable in this environment.";
  if (!window.isSecureContext) return "Passkeys require a secure connection. Open this site using HTTPS or localhost.";
  if (typeof PublicKeyCredential === "undefined") return "This browser does not support passkeys. Try a current browser or use password sign-in.";
  return null;
}

function shouldShowPasskeyInvitation(userId: string) {
  if (typeof window === "undefined" || !window.isSecureContext || typeof PublicKeyCredential === "undefined") return false;
  const storageKey = `mwalimuconnect:passkey-invitation:${userId}`;
  try {
    const lastInvitationAt = Number(window.localStorage.getItem(storageKey));
    if (lastInvitationAt > 0 && Date.now() - lastInvitationAt < passkeyInvitationIntervalMs) return false;
    window.localStorage.setItem(storageKey, String(Date.now()));
  } catch {
    return true;
  }
  return true;
}

function isSubscriptionPlan(value: unknown): value is SubscriptionPlan {
  if (!value || typeof value !== "object") return false;
  const plan = value as Record<string, unknown>;
  return (plan.key === "weekly" || plan.key === "monthly" || plan.key === "termly" || plan.key === "yearly")
    && typeof plan.name === "string"
    && Number.isInteger(plan.durationDays)
    && (plan.amountKes === null || (typeof plan.amountKes === "number" && Number.isInteger(plan.amountKes) && plan.amountKes > 0));
}

export default function Home() {
  const [role, setRole] = useState<Role>("teacher");
  const [activeNav, setActiveNav] = useState("Discover");
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [vacanciesLoading, setVacanciesLoading] = useState(false);
  const [vacancyLoadError, setVacancyLoadError] = useState("");
  const [vacanciesRefreshKey, setVacanciesRefreshKey] = useState(0);
  const [query, setQuery] = useState("");
  const [county, setCounty] = useState("All counties");
  const [subcounty, setSubcounty] = useState("All subcounties");
  const [level, setLevel] = useState("All levels");
  const [selectedVacancy, setSelectedVacancy] = useState<Vacancy | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const [applied, setApplied] = useState<string[]>([]);
  const [teacherCv, setTeacherCv] = useState<TeacherCv>(emptyTeacherCv);
  const [cvSaved, setCvSaved] = useState(false);
  const [hasSavedCv, setHasSavedCv] = useState(false);
  const [institutionApplicants, setInstitutionApplicants] = useState<InstitutionApplicant[]>([]);
  const [institutionActiveVacancies, setInstitutionActiveVacancies] = useState<InstitutionActiveVacancy[]>([]);
  const [selectedInstitutionVacancyId, setSelectedInstitutionVacancyId] = useState("");
  const [applicantsLoading, setApplicantsLoading] = useState(false);
  const [registeredInstitutions, setRegisteredInstitutions] = useState<RegisteredInstitution[]>([]);
  const [institutionTotalCount, setInstitutionTotalCount] = useState(0);
  const [institutionsLoading, setInstitutionsLoading] = useState(false);
  const [institutionsLoadError, setInstitutionsLoadError] = useState("");
  const [institutionsRefreshKey, setInstitutionsRefreshKey] = useState(0);
  const [institutionPage, setInstitutionPage] = useState(1);
  const institutionPageCache = useRef(new Map<number, InstitutionPageCacheEntry>());
  const [expandedApplicantId, setExpandedApplicantId] = useState("");
  const [modal, setModal] = useState<"auth" | "subscription" | "institution" | "edit-institution" | "delete-institution" | "vacancy" | "profile" | null>(null);
  const [institutionRegistrationError, setInstitutionRegistrationError] = useState("");
  const [editingInstitution, setEditingInstitution] = useState<RegisteredInstitution | null>(null);
  const [deletingInstitution, setDeletingInstitution] = useState<RegisteredInstitution | null>(null);
  const [editInstitutionSubcounty, setEditInstitutionSubcounty] = useState("");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signup" | "signin" | "forgot-password">("signup");
  const [showAuthPassword, setShowAuthPassword] = useState(false);
  const [showInvitationPassword, setShowInvitationPassword] = useState(false);
  const [showInvitationPasswordConfirmation, setShowInvitationPasswordConfirmation] = useState(false);
  const [passwordRecoveryRequired, setPasswordRecoveryRequired] = useState(false);
  const [showRecoveryPassword, setShowRecoveryPassword] = useState(false);
  const [showRecoveryPasswordConfirmation, setShowRecoveryPasswordConfirmation] = useState(false);
  const [loginChallenge, setLoginChallenge] = useState<{ id: string; email: string } | null>(null);
  const [loginOtp, setLoginOtp] = useState("");
  const loginOtpInputs = useRef<Array<HTMLInputElement | null>>([]);
  const loginOtpVerificationInProgress = useRef(false);
  const [passkeys, setPasskeys] = useState<PasskeyListItem[]>([]);
  const [passkeysLoading, setPasskeysLoading] = useState(false);
  const [passkeyBusy, setPasskeyBusy] = useState("");
  const [passkeyFeedback, setPasskeyFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [passkeyPendingRemoval, setPasskeyPendingRemoval] = useState<string | null>(null);
  const [passkeyInvitationVisible, setPasskeyInvitationVisible] = useState(false);
  const [authFeedback, setAuthFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [notice, setNoticeMessage] = useState("");
  const [noticeType, setNoticeType] = useState<"success" | "error">("success");
  const [loading, setLoading] = useState(false);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [passwordSetupRequired, setPasswordSetupRequired] = useState(false);
  const emailConfirmationHandled = useRef(false);
  const [backendConnected, setBackendConnected] = useState(false);
  const [, setNairobiDateTick] = useState(0);
  const [teacherId, setTeacherId] = useState("");
  const [teacherHasAccess, setTeacherHasAccess] = useState(false);
  const [teacherSubscriptionExpiresAt, setTeacherSubscriptionExpiresAt] = useState<string | null>(null);
  const [institutionId, setInstitutionId] = useState("");
  const [institutionHasAccess, setInstitutionHasAccess] = useState(false);
  const [subscriptionExpiresAt, setSubscriptionExpiresAt] = useState<string | null>(null);
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlanKey>("monthly");
  const [schoolCounty, setSchoolCounty] = useState("");
  const [schoolSubcounty, setSchoolSubcounty] = useState("");
  const [schoolLevel, setSchoolLevel] = useState("");
  const [schoolRegistrationCounty, setSchoolRegistrationCounty] = useState("");
  const [teacherCounty, setTeacherCounty] = useState("");
  const [countySetupRequired, setCountySetupRequired] = useState(false);
  const [enteredWorkspace, setEnteredWorkspace] = useState(false);
  const [landingMessage, setLandingMessage] = useState("");

  useEffect(() => {
    if (!selectedVacancy) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedVacancy(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [selectedVacancy]);

  useEffect(() => {
    if (!loginChallenge || loading || loginOtp !== "") return;
    const frameId = window.requestAnimationFrame(() => loginOtpInputs.current[0]?.focus());
    return () => window.cancelAnimationFrame(frameId);
  }, [loginChallenge, loading, loginOtp]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNairobiDateTick((tick) => tick + 1), 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  const accountDisplayName = userName || userEmail.split("@")[0] || "Your profile";
  const accountInitials = initialsFor(userName || userEmail || "Account");

  function setNotice(message: string) {
    setNoticeMessage(message);
    if (!message) {
      setNoticeType("success");
      return;
    }
    const successMessage = /^(Your password is set\.|Your password has been reset\.|Your county has been saved\.|Your CV has been updated\.|Your CV is saved|Application submitted successfully|STK push sent\.|Institution registered\.|Institution details updated\.|Institution and linked head account deleted\.|Your vacancy is now live)/i.test(message);
    setNoticeType(successMessage ? "success" : "error");
  }

  function updateTeacherCv(field: keyof TeacherCv, value: string) {
    setTeacherCv((current) => ({ ...current, [field]: value }));
    setCvSaved(false);
  }

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    const client = supabase;
    setBackendConnected(true);
    let active = true;

    async function loadAccount(user: { id: string; email?: string; user_metadata?: { full_name?: string } }) {
      setEnteredWorkspace(false);
      setWorkspaceLoading(true);
      if (new URLSearchParams(window.location.search).get("email_confirmed") === "1") {
        setWorkspaceLoading(false);
        if (!emailConfirmationHandled.current) {
          emailConfirmationHandled.current = true;
          window.setTimeout(async () => {
            const { error: signOutError } = await client.auth.signOut();
            if (!active) return;
            if (signOutError) {
              const message = `Email confirmed, but the automatic sign-out failed: ${signOutError.message}`;
              setLandingMessage(message);
              setAuthFeedback({ type: "error", message });
              return;
            }
            window.history.replaceState({}, "", window.location.pathname);
            setAuthMode("signin");
            setLoginChallenge(null);
            setAuthFeedback({ type: "success", message: "Your email is confirmed. Sign in to continue." });
            setModal("auth");
            setLandingMessage("");
          }, 0);
        }
        return;
      }
      if (new URLSearchParams(window.location.search).get("setup") === "password") {
        setWorkspaceLoading(false);
        setPasswordSetupRequired(true);
        setUserEmail(user.email ?? "");
        return;
      }
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
          setWorkspaceLoading(false);
          return;
        }
        if (!profile) {
          const message = "Your account profile is missing. Contact the platform administrator.";
          setLandingMessage(message);
          setAuthFeedback({ type: "error", message });
          setWorkspaceLoading(false);
          return;
        }
        if (!isRole(profile.role)) {
          const message = "Your account does not have an authorized workspace role. Contact the platform administrator.";
          setLandingMessage(message);
          setAuthFeedback({ type: "error", message });
          setWorkspaceLoading(false);
          return;
        }
        const accountName = profile.full_name?.trim() || user.user_metadata?.full_name?.trim() || "";
        setUserName(accountName);
        setUserEmail(user.email ?? "");
        setRole(profile.role);
        setActiveNav(roleInfo[profile.role].nav[0]);
        setTeacherId(profile.role === "teacher" ? user.id : "");
        setInstitutionId(profile.institution_id ?? "");
        if (profile.role === "admin") {
          setTeacherHasAccess(false);
          setInstitutionHasAccess(false);
          setTeacherSubscriptionExpiresAt(null);
          setSubscriptionExpiresAt(null);
        }
        if (profile.role === "teacher") {
          const { data: cv, error: cvError } = await client
            .from("teacher_cvs")
            .select("full_name,email,phone,professional_title,years_experience,education,experience,skills,candidate_statement")
            .eq("teacher_id", user.id)
            .maybeSingle();
          if (!active) return;
          if (cvError) {
            setNotice(`Could not load your CV: ${cvError.message}`);
          } else if (cv) {
            setTeacherCv({
              full_name: cv.full_name ?? accountName,
              email: cv.email ?? user.email ?? "",
              phone: cv.phone ?? "",
              professional_title: cv.professional_title ?? "",
              years_experience: String(cv.years_experience ?? 0),
              education: cv.education ?? "",
              experience: cv.experience ?? "",
              skills: cv.skills ?? "",
              candidate_statement: cv.candidate_statement ?? "",
            });
            setCvSaved(true);
            setHasSavedCv(true);
          } else {
            setTeacherCv({ ...emptyTeacherCv, full_name: accountName, email: user.email ?? "" });
            setCvSaved(false);
            setHasSavedCv(false);
          }
          setTeacherCounty(profile.county ?? "");
          setCountySetupRequired(!profile.county);
          const { data: subscription, error: subscriptionError } = await client
            .from("subscriptions")
            .select("expires_at")
            .eq("teacher_id", user.id)
            .eq("status", "active")
            .gt("expires_at", new Date().toISOString())
            .order("expires_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (!active) return;
          if (subscriptionError) {
            const message = `Could not load subscription access: ${subscriptionError.message}`;
            setLandingMessage(message);
            setAuthFeedback({ type: "error", message });
            setWorkspaceLoading(false);
            return;
          }
          setTeacherSubscriptionExpiresAt(subscription?.expires_at ?? null);
          setTeacherHasAccess(Boolean(subscription));
          if (subscription) setCounty("All counties");
          else if (profile.county) setCounty(profile.county);
        }
        if (profile.role === "institution") {
          if (!profile.institution_id) {
            const message = "Your school account is not linked to an institution. Contact the platform administrator.";
            setLandingMessage(message);
            setAuthFeedback({ type: "error", message });
            setWorkspaceLoading(false);
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
            setWorkspaceLoading(false);
            return;
          }
          setSchoolCounty(institution.county);
          setSchoolSubcounty(institution.subcounty ?? "");
          setSchoolLevel(institution.school_level ?? "");
          if (process.env.NODE_ENV === "development") {
            setInstitutionHasAccess(false);
            setSubscriptionExpiresAt(null);
          } else {
            const { data: subscription, error: subscriptionError } = await client
              .from("subscriptions")
              .select("expires_at")
              .eq("institution_id", profile.institution_id)
              .eq("status", "active")
              .gt("expires_at", new Date().toISOString())
              .order("expires_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            if (!active) return;
            if (subscriptionError) {
              const message = `Could not load subscription access: ${subscriptionError.message}`;
              setLandingMessage(message);
              setAuthFeedback({ type: "error", message });
              setWorkspaceLoading(false);
              return;
            }
            setSubscriptionExpiresAt(subscription?.expires_at ?? null);
            setInstitutionHasAccess(Boolean(subscription));
          }
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
        const { data: accountPasskeys, error: accountPasskeyError } = await client.auth.passkey.list();
        if (!active) return;
        if (accountPasskeyError) {
          setNotice(`Could not check your passkey setup: ${accountPasskeyError.message}`);
        } else {
          setPasskeys(accountPasskeys ?? []);
          if (accountPasskeys?.length === 0 && shouldShowPasskeyInvitation(user.id)) {
            setPasskeyFeedback(null);
            setPasskeyInvitationVisible(true);
          }
        }
        setUserEmail(user.email ?? "");
        setEnteredWorkspace(true);
        setWorkspaceLoading(false);
      } catch (error) {
        if (!active) return;
        const message = error instanceof Error ? `Could not load your workspace: ${error.message}` : "Could not load your workspace. Please try again.";
        setLandingMessage(message);
        setAuthFeedback({ type: "error", message });
        setWorkspaceLoading(false);
      }
    }

    const { data: authListener } = client.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      const isRecoveryCallback = event === "PASSWORD_RECOVERY"
        || (event === "INITIAL_SESSION" && new URLSearchParams(window.location.search).get("reset_password") === "1");
      if (session?.user && isRecoveryCallback) {
        setPasswordRecoveryRequired(true);
        setEnteredWorkspace(false);
        setWorkspaceLoading(false);
        setAuthFeedback(null);
        return;
      }
      if (session?.user) {
        setUserEmail(session.user.email ?? "");
        window.setTimeout(() => void loadAccount(session.user), 0);
      } else {
        setWorkspaceLoading(false);
        const searchParams = new URLSearchParams(window.location.search);
        const invalidInvitationLink = searchParams.get("setup") === "password";
        const invalidPasswordResetLink = searchParams.get("reset_password") === "1";
        if (invalidInvitationLink || invalidPasswordResetLink) {
          window.history.replaceState({}, "", window.location.pathname);
          setAuthMode("signin");
          setModal("auth");
        }
        setUserEmail("");
        setUserName("");
        setTeacherCv(emptyTeacherCv);
        setCvSaved(false);
        setHasSavedCv(false);
        setInstitutionApplicants([]);
        setPasswordSetupRequired(false);
        setPasswordRecoveryRequired(false);
        setLoginChallenge(null);
        setPasskeys([]);
        setPasskeyInvitationVisible(false);
        setEnteredWorkspace(false);
        setLandingMessage("");
        setAuthFeedback(null);
        if (invalidInvitationLink) {
          setAuthFeedback({
            type: "error",
            message: "This invitation link is invalid, expired, or has already been used. If you already set your password, sign in with it. Otherwise, ask the administrator to send a new invitation.",
          });
        } else if (invalidPasswordResetLink) {
          setAuthFeedback({ type: "error", message: "This password reset link is invalid or expired. Request a new reset link to continue." });
        }
        setRole("teacher");
        setActiveNav(roleInfo.teacher.nav[0]);
        setInstitutionId("");
        setTeacherId("");
        setTeacherHasAccess(false);
        setTeacherSubscriptionExpiresAt(null);
        setInstitutionHasAccess(false);
        setSubscriptionExpiresAt(null);
        setSchoolCounty("");
        setSchoolSubcounty("");
        setSchoolLevel("");
        setTeacherCounty("");
        setCountySetupRequired(false);
        setCounty("All counties");
        setSubcounty("All subcounties");
        setSelectedVacancy(null);
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
    if (!enteredWorkspace || role !== "admin" || activeNav !== "Institutions") return;
    let active = true;

    async function loadInstitutions() {
      const cachedPage = institutionPageCache.current.get(institutionPage);
      if (cachedPage) {
        setRegisteredInstitutions(cachedPage.institutions);
        setInstitutionTotalCount(cachedPage.totalCount);
        setInstitutionsLoadError("");
        setInstitutionsLoading(false);
        return;
      }

      setInstitutionsLoading(true);
      setInstitutionsLoadError("");
      try {
        const supabase = getSupabase();
        if (!supabase) throw new Error("The institution directory is unavailable because Supabase is not configured.");
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw new Error(`Could not verify your admin session: ${sessionError.message}`);
        if (!sessionData.session) throw new Error("Your session has expired. Please sign in again.");

        const response = await fetch(`/api/admin/institutions?page=${institutionPage}`, {
          cache: "no-store",
          headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
        });
        const result: { institutions?: RegisteredInstitution[]; totalCount?: number; error?: string } = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Could not load registered institutions.");
        if (!Array.isArray(result.institutions) || !Number.isInteger(result.totalCount) || (result.totalCount ?? -1) < 0) {
          throw new Error("The institution directory returned an invalid response.");
        }
        if (!active) return;
        const totalCount = result.totalCount ?? 0;
        institutionPageCache.current.set(institutionPage, {
          institutions: result.institutions,
          totalCount,
        });
        setRegisteredInstitutions(result.institutions);
        setInstitutionTotalCount(totalCount);
      } catch (error) {
        if (!active) return;
        setInstitutionsLoadError(error instanceof Error ? error.message : "Could not load registered institutions.");
      } finally {
        if (active) setInstitutionsLoading(false);
      }
    }

    void loadInstitutions();
    return () => {
      active = false;
    };
  }, [activeNav, enteredWorkspace, institutionPage, institutionsRefreshKey, role]);

  useEffect(() => {
    const supabase = getSupabase();
    if (!backendConnected || !enteredWorkspace || !userEmail || !supabase) return;
    let active = true;
    setVacanciesLoading(true);
    setVacancyLoadError("");

    void supabase
      .from("vacancies")
      .select("id,title,description,county,subcounty,status,application_deadline,school_level,employment_type,category,created_at,institution_id,institutions(name)")
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
            description: row.description,
            institution: name,
            county: row.county,
            subcounty: row.subcounty ?? undefined,
            status: row.status,
            applicationDeadline: row.application_deadline,
            level: row.school_level,
            category: row.category === "BOM" ? "Teaching" : row.category ?? "Teaching",
            type: row.employment_type === "BOM" ? "BOM-employed" : row.employment_type,
            institutionId: row.institution_id,
            postedAt: row.created_at,
            color: "mint",
            initials: initialsFor(name),
          };
        }));
        setVacanciesLoading(false);
      });

    return () => {
      active = false;
    };
  }, [backendConnected, enteredWorkspace, teacherCounty, teacherHasAccess, userEmail, vacanciesRefreshKey]);

  useEffect(() => {
    const supabase = getSupabase();
    if (!enteredWorkspace || !supabase || (role !== "teacher" && role !== "institution")) return;
    if (role === "institution" && process.env.NODE_ENV === "development") return;
    if ((role === "teacher" && !teacherId.trim()) || (role === "institution" && !institutionId.trim())) return;
    let active = true;
    const refreshSubscription = async () => {
      const ownerColumn = role === "teacher" ? "teacher_id" : "institution_id";
      const ownerId = role === "teacher" ? teacherId : institutionId;
      if (!ownerId.trim()) return;
      const { data: subscription, error } = await supabase
        .from("subscriptions")
        .select("expires_at")
        .eq(ownerColumn, ownerId)
        .eq("status", "active")
        .gt("expires_at", new Date().toISOString())
        .order("expires_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!active) return;
      if (error) {
        setNotice(`Could not refresh subscription access: ${error.message}`);
        return;
      }
      if (role === "teacher") {
        setTeacherSubscriptionExpiresAt(subscription?.expires_at ?? null);
        setTeacherHasAccess(Boolean(subscription));
        if (subscription && !teacherHasAccess) setCounty("All counties");
      } else {
        setSubscriptionExpiresAt(subscription?.expires_at ?? null);
        setInstitutionHasAccess(Boolean(subscription));
      }
    };
    void refreshSubscription();
    const intervalId = window.setInterval(() => void refreshSubscription(), 15000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [role, enteredWorkspace, institutionId, teacherId, teacherHasAccess]);

  useEffect(() => {
    const supabase = getSupabase();
    if (!enteredWorkspace || role !== "institution" || activeNav !== "Applications" || !institutionId || !supabase) return;
    let active = true;
    setApplicantsLoading(true);
    setInstitutionApplicants([]);
    setInstitutionActiveVacancies([]);
    setExpandedApplicantId("");
    void (async () => {
      const { data: vacancies, error: vacancyError } = await supabase
        .from("vacancies")
        .select("id,title,application_deadline")
        .eq("institution_id", institutionId)
        .eq("status", "published")
        .order("created_at", { ascending: false });
      if (!active) return;
      if (vacancyError) {
        setNotice(`Could not load active vacancies for your institution: ${vacancyError.message}`);
        setApplicantsLoading(false);
        return;
      }
      const activeVacancies = (vacancies ?? [])
        .filter((vacancy) => isVacancyOpen(vacancy.application_deadline))
        .map((vacancy) => ({
          id: vacancy.id,
          title: vacancy.title,
          applicationDeadline: vacancy.application_deadline,
        }));
      setInstitutionActiveVacancies(activeVacancies);
      const activeVacancyIds = new Set(activeVacancies.map((vacancy) => vacancy.id));
      setSelectedInstitutionVacancyId((current) => activeVacancyIds.has(current)
        ? current
        : activeVacancies[0]?.id ?? "");
      if (activeVacancies.length === 0) {
        setApplicantsLoading(false);
        return;
      }

      const vacancyTitles = new Map(activeVacancies.map((vacancy) => [vacancy.id, vacancy.title]));
      const { data: applications, error: applicationsError } = await supabase
        .from("applications")
        .select("id,vacancy_id,teacher_id,created_at")
        .in("vacancy_id", activeVacancies.map((vacancy) => vacancy.id))
        .order("created_at", { ascending: true });
      if (!active) return;
      if (applicationsError) {
        setNotice(`Could not load applications for your active vacancies: ${applicationsError.message}`);
        setInstitutionApplicants([]);
        setApplicantsLoading(false);
        return;
      }
      const rows = applications ?? [];
      const teacherIds = [...new Set(rows.map((application) => application.teacher_id))];
      if (teacherIds.length === 0) {
        setInstitutionApplicants([]);
        setApplicantsLoading(false);
        return;
      }
      const { data: cvs, error: cvError } = await supabase
        .from("teacher_cvs")
        .select("teacher_id,full_name,email,phone,professional_title,years_experience,education,experience,skills,candidate_statement")
        .in("teacher_id", teacherIds);
      if (!active) return;
      if (cvError) {
        setNotice(`Could not load applicant CVs: ${cvError.message}`);
        setApplicantsLoading(false);
        return;
      }
      const cvsByTeacher = new Map((cvs ?? []).map((cv) => [cv.teacher_id, cv]));
      setInstitutionApplicants(rows.flatMap((application) => {
        const cv = cvsByTeacher.get(application.teacher_id);
        const vacancyTitle = vacancyTitles.get(application.vacancy_id);
        if (!cv || !vacancyTitle) return [];
        return [{
          id: application.id,
          vacancyId: application.vacancy_id,
          vacancyTitle,
          appliedAt: application.created_at,
          cv: {
            full_name: cv.full_name,
            email: cv.email,
            phone: cv.phone ?? "",
            professional_title: cv.professional_title ?? "",
            years_experience: String(cv.years_experience ?? 0),
            education: cv.education ?? "",
            experience: cv.experience ?? "",
            skills: cv.skills ?? "",
            candidate_statement: cv.candidate_statement ?? "",
          },
        }];
      }));
      setApplicantsLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [activeNav, enteredWorkspace, role, institutionId]);

  useEffect(() => {
    if (!enteredWorkspace) return;
    let active = true;
    void fetch("/api/billing/plans")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Could not load subscription plans.");
        if (!Array.isArray(result.plans) || !result.plans.every(isSubscriptionPlan)) throw new Error("The subscription plan response was invalid.");
        if (active) setSubscriptionPlans(result.plans);
      })
      .catch((error: unknown) => {
        if (active) setNotice(error instanceof Error ? error.message : "Could not load subscription plans.");
      });
    return () => {
      active = false;
    };
  }, [enteredWorkspace]);

  const counties = useMemo(() => ["All counties", ...KENYAN_COUNTIES], []);
  const levels = useMemo(() => ["All levels", ...new Set(vacancies.map((job) => job.level))], [vacancies]);
  const subcounties = useMemo(
    () => county === "All counties" ? ["All subcounties"] : ["All subcounties", ...getSubCountiesInCounty(county).map((item) => item.name)],
    [county],
  );
  const filteredVacancies = vacancies.filter((job) => {
    const text = `${job.title} ${job.institution} ${job.county} ${job.subcounty ?? ""} ${job.category} ${job.level}`.toLowerCase();
    return text.includes(query.toLowerCase())
      && (role !== "teacher" || teacherHasAccess || job.county === teacherCounty)
      && (county === "All counties" || county === job.county)
      && (subcounty === "All subcounties" || subcounty === job.subcounty)
      && (level === "All levels" || level === job.level);
  });
  const visibleVacancies = activeNav === "My applications"
    ? vacancies.filter((job) => applied.includes(job.id))
    : filteredVacancies.filter((job) => activeNav === "Saved jobs" ? saved.includes(job.id) : true);
  const institutionVacancies = vacancies.filter((job) => institutionId && job.institutionId === institutionId);
  const selectedInstitutionVacancy = institutionActiveVacancies.find((vacancy) => vacancy.id === selectedInstitutionVacancyId);
  const selectedInstitutionApplicants = institutionApplicants.filter((applicant) => applicant.vacancyId === selectedInstitutionVacancyId);
  const accountHasFullAccess = role === "teacher" ? teacherHasAccess : institutionHasAccess;
  const accountSubscriptionExpiresAt = role === "teacher" ? teacherSubscriptionExpiresAt : subscriptionExpiresAt;
  const institutionSubscriptionBypassed = role === "institution" && process.env.NODE_ENV === "development";
  const institutionCanPublish = institutionHasAccess || institutionSubscriptionBypassed;
  const subscriptionPlanOptions = <section className="subscription-plans" aria-label="Subscription plans">
    <div className="section-heading"><div><h2>{role === "teacher" ? "Unlock nationwide opportunities" : "Choose your school subscription"}</h2><p>{role === "teacher" ? "Get full access to vacancies across Kenya." : "Keep your school's vacancies active and visible to teachers."}</p></div></div>
    <div className="subscription-plan-grid">
      {subscriptionPlans.filter((plan) => role === "teacher" || plan.key !== "weekly").map((plan) => <article className={`subscription-plan ${plan.amountKes === null ? "is-unconfigured" : ""}`} key={plan.key}>
        <span className="job-category">{plan.name.toUpperCase()}</span>
        <strong className="subscription-plan-price">{plan.amountKes === null ? "Price coming soon" : `KES ${plan.amountKes.toLocaleString()}`}</strong>
        <span className="subscription-plan-duration">{plan.durationDays} days of full access</span>
        <button className="primary-button" disabled={plan.amountKes === null || loading} onClick={() => { setSelectedPlan(plan.key); setModal("subscription"); }}>{plan.amountKes === null ? "Not available yet" : "Choose plan"} <Icon name="arrow" size={15} /></button>
      </article>)}
      {subscriptionPlans.length === 0 && <p className="empty-plan-message">Subscription plans could not be loaded. Please try again later.</p>}
    </div>
    {accountHasFullAccess && accountSubscriptionExpiresAt && <p className="subscription-current-access">Your current full access is active through {new Date(accountSubscriptionExpiresAt).toLocaleDateString()}.</p>}
  </section>;
  let emptyVacancyTitle = "No opportunities match your search.";
  let emptyVacancyDescription = "Try changing your search or school-level filters.";
  if (activeNav === "Discover") {
    if (vacanciesLoading) {
      emptyVacancyTitle = "Loading live opportunities…";
      emptyVacancyDescription = "Please wait while we fetch current listings.";
    } else if (vacancyLoadError) {
      emptyVacancyTitle = "Opportunities couldn’t be loaded.";
      emptyVacancyDescription = "Check your connection and try again.";
    } else if (vacancies.length === 0) {
      emptyVacancyTitle = "There are no live opportunities in your county yet.";
      emptyVacancyDescription = "New listings from verified schools will appear here when available.";
    }
  } else if (activeNav === "Saved jobs") {
    emptyVacancyTitle = saved.length === 0 ? "Your saved list is ready for its first role." : "No saved opportunities match these filters.";
    emptyVacancyDescription = saved.length === 0 ? "Tap the bookmark on any opportunity to keep it close." : "Try changing or clearing the location and keyword filters.";
  } else {
    emptyVacancyTitle = applied.length === 0 ? "Your next step starts with a great application." : "No applications match these filters.";
    emptyVacancyDescription = applied.length === 0 ? "Explore open opportunities and apply when you find the right fit." : "Try changing or clearing the location and keyword filters.";
  }
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

    if (authMode === "signin") {
      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Could not start sign-in.");
        if (typeof result.challenge_id !== "string" || typeof result.email !== "string") {
          throw new Error("The email verification response was invalid.");
        }
        setLoginOtp("");
        setLoginChallenge({ id: result.challenge_id, email: result.email });
        setAuthFeedback({ type: "success", message: `We sent a one-time code to ${result.email}.` });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not start sign-in.";
        setAuthFeedback({ type: "error", message });
      } finally {
        setLoading(false);
      }
      return;
    }

    const teacherCounty = String(form.get("county") ?? "");
    try {
      const result = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { county: teacherCounty, full_name: fullName },
          emailRedirectTo: `${window.location.origin}/?email_confirmed=1`,
        },
      });
      if (result.error) {
        setAuthFeedback({ type: "error", message: result.error.message });
      } else {
        if (result.data.session) {
          await supabase.auth.signOut();
          const message = "Email confirmation is not enabled for this Supabase project. Enable it before using teacher registration.";
          setAuthFeedback({ type: "error", message });
        } else {
          const message = "Account created. Check your email for the confirmation link, then sign in.";
          setAuthMode("signin");
          setAuthFeedback({ type: "success", message });
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not authenticate. Please try again.";
      setAuthFeedback({ type: "error", message });
    } finally {
      setLoading(false);
    }
  }

  async function signInWithPasskey() {
    if (loading) return;
    const unsupportedReason = passkeyBrowserError();
    if (unsupportedReason) {
      setAuthFeedback({ type: "error", message: unsupportedReason });
      return;
    }
    const supabase = getSupabase();
    if (!supabase) {
      setAuthFeedback({ type: "error", message: "Passkey sign-in is unavailable because Supabase is not configured." });
      return;
    }

    setLoading(true);
    setAuthFeedback(null);
    try {
      const { error } = await supabase.auth.signInWithPasskey();
      if (error) throw error;
      setLoginChallenge(null);
      setModal(null);
    } catch (error) {
      const cancelled = error instanceof Error && (error.name === "NotAllowedError" || error.name === "AbortError");
      setAuthFeedback({
        type: "error",
        message: cancelled
          ? "Passkey sign-in was cancelled or timed out. Please try again."
          : `Could not sign in with a passkey: ${error instanceof Error ? error.message : "Please try again."}`,
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadPasskeys(): Promise<boolean> {
    const supabase = getSupabase();
    if (!supabase) {
      setPasskeyFeedback({ type: "error", message: "Passkey management is unavailable because Supabase is not configured." });
      return false;
    }
    setPasskeysLoading(true);
    setPasskeyFeedback(null);
    try {
      const { data, error } = await supabase.auth.passkey.list();
      if (error) throw error;
      setPasskeys(data ?? []);
      return true;
    } catch (error) {
      setPasskeyFeedback({
        type: "error",
        message: `Could not load your passkeys: ${error instanceof Error ? error.message : "Please try again."}`,
      });
      return false;
    } finally {
      setPasskeysLoading(false);
    }
  }

  async function registerPasskey() {
    if (passkeyBusy) return;
    const unsupportedReason = passkeyBrowserError();
    if (unsupportedReason) {
      setPasskeyFeedback({ type: "error", message: unsupportedReason });
      return;
    }
    const supabase = getSupabase();
    if (!supabase) {
      setPasskeyFeedback({ type: "error", message: "Passkey registration is unavailable because Supabase is not configured." });
      return;
    }
    setPasskeyBusy("register");
    setPasskeyFeedback(null);
    try {
      const { error } = await supabase.auth.registerPasskey();
      if (error) throw error;
      setPasskeyInvitationVisible(false);
      setNoticeType("success");
      setNoticeMessage("Passkey added. You can now use it the next time you sign in.");
      if (await loadPasskeys()) {
        setPasskeyFeedback({ type: "success", message: "Passkey added to your account." });
      }
    } catch (error) {
      setPasskeyFeedback({
        type: "error",
        message: `Could not add a passkey: ${error instanceof Error ? error.message : "Please try again."}`,
      });
    } finally {
      setPasskeyBusy("");
    }
  }

  async function renamePasskey(event: React.FormEvent<HTMLFormElement>, passkeyId: string) {
    event.preventDefault();
    if (passkeyBusy) return;
    const formData = new FormData(event.currentTarget);
    const friendlyName = String(formData.get("friendly_name") ?? "").trim();
    if (!friendlyName || friendlyName.length > 120) {
      setPasskeyFeedback({ type: "error", message: "Enter a passkey name between 1 and 120 characters." });
      return;
    }
    const supabase = getSupabase();
    if (!supabase) {
      setPasskeyFeedback({ type: "error", message: "Passkey management is unavailable because Supabase is not configured." });
      return;
    }
    setPasskeyBusy(passkeyId);
    setPasskeyFeedback(null);
    try {
      const { data, error } = await supabase.auth.passkey.update({ passkeyId, friendlyName });
      if (error) throw error;
      setPasskeys((current) => current.map((passkey) => passkey.id === passkeyId ? data : passkey));
      setPasskeyFeedback({ type: "success", message: "Passkey name updated." });
    } catch (error) {
      setPasskeyFeedback({
        type: "error",
        message: `Could not rename this passkey: ${error instanceof Error ? error.message : "Please try again."}`,
      });
    } finally {
      setPasskeyBusy("");
    }
  }

  async function removePasskey(passkeyId: string) {
    if (passkeyBusy) return;
    const supabase = getSupabase();
    if (!supabase) {
      setPasskeyFeedback({ type: "error", message: "Passkey management is unavailable because Supabase is not configured." });
      return;
    }
    setPasskeyBusy(passkeyId);
    setPasskeyFeedback(null);
    try {
      const { error } = await supabase.auth.passkey.delete({ passkeyId });
      if (error) throw error;
      setPasskeys((current) => current.filter((passkey) => passkey.id !== passkeyId));
      setPasskeyPendingRemoval(null);
      setPasskeyFeedback({ type: "success", message: "Passkey removed from your account." });
    } catch (error) {
      setPasskeyFeedback({
        type: "error",
        message: `Could not remove this passkey: ${error instanceof Error ? error.message : "Please try again."}`,
      });
    } finally {
      setPasskeyBusy("");
    }
  }

  async function verifyLoginOtp(code: string) {
    if (!loginChallenge || loading || loginOtpVerificationInProgress.current) return;
    if (!/^\d{6}$/.test(code)) {
      setAuthFeedback({ type: "error", message: "Enter the six-digit code from your email." });
      return;
    }
    loginOtpVerificationInProgress.current = true;
    setLoading(true);
    setAuthFeedback(null);
    try {
      const response = await fetch("/api/auth/login/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenge_id: loginChallenge.id, code }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not verify the sign-in code.");
      const supabase = getSupabase();
      if (!supabase || !result.session?.access_token || !result.session?.refresh_token) {
        throw new Error("The verified session was incomplete. Please sign in again.");
      }
      const { error } = await supabase.auth.setSession(result.session);
      if (error) throw new Error(`Could not complete sign-in: ${error.message}`);
      setLoginChallenge(null);
      setModal(null);
    } catch (error) {
      setAuthFeedback({ type: "error", message: error instanceof Error ? error.message : "Could not verify the sign-in code." });
      setLoginOtp("");
      loginOtpInputs.current[0]?.focus();
    } finally {
      loginOtpVerificationInProgress.current = false;
      setLoading(false);
    }
  }

  function updateLoginOtp(index: number, value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 6);
    if (!digits) {
      const nextCode = loginOtp.split("");
      nextCode[index] = "";
      setLoginOtp(nextCode.join(""));
      return;
    }

    const nextCode = Array.from({ length: 6 }, (_, digitIndex) => loginOtp[digitIndex] ?? "");
    for (const [digitIndex, digit] of [...digits].entries()) {
      const targetIndex = index + digitIndex;
      if (targetIndex >= nextCode.length) break;
      nextCode[targetIndex] = digit;
    }

    const code = nextCode.join("");
    setLoginOtp(code);
    if (/^\d{6}$/.test(code)) {
      void verifyLoginOtp(code);
    } else {
      loginOtpInputs.current[Math.min(index + digits.length, 5)]?.focus();
    }
  }

  async function resendLoginOtp() {
    if (!loginChallenge) return;
    setLoading(true);
    setAuthFeedback(null);
    try {
      const response = await fetch("/api/auth/login/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenge_id: loginChallenge.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not resend the sign-in code.");
      setAuthFeedback({ type: "success", message: `A new code was sent to ${loginChallenge.email}.` });
    } catch (error) {
      setAuthFeedback({ type: "error", message: error instanceof Error ? error.message : "Could not resend the sign-in code." });
    } finally {
      setLoading(false);
    }
  }

  async function requestPasswordReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const supabase = getSupabase();
    if (!supabase) {
      setAuthFeedback({ type: "error", message: "Password reset is unavailable. Add your Supabase URL and publishable key to .env.local." });
      return;
    }

    setLoading(true);
    setAuthFeedback(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/?reset_password=1`,
      });
      if (error) {
        setAuthFeedback({ type: "error", message: `Could not send a password reset link: ${error.message}` });
        return;
      }
      setAuthFeedback({
        type: "success",
        message: "If an account exists for that email, we’ve sent a password reset link. Check your inbox and spam folder.",
      });
    } catch (error) {
      setAuthFeedback({ type: "error", message: error instanceof Error ? `Could not send a password reset link: ${error.message}` : "Could not send a password reset link. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  async function resetAccountPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("password_confirmation") ?? "");
    if (password.length < 8) {
      setAuthFeedback({ type: "error", message: "Use a password with at least 8 characters." });
      return;
    }
    if (password !== confirmation) {
      setAuthFeedback({ type: "error", message: "The passwords do not match." });
      return;
    }
    const supabase = getSupabase();
    if (!supabase) {
      setAuthFeedback({ type: "error", message: "Password reset is unavailable because Supabase is not configured." });
      return;
    }

    setLoading(true);
    setAuthFeedback(null);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setAuthFeedback({ type: "error", message: `Could not reset your password: ${error.message}` });
        return;
      }
      window.history.replaceState({}, "", window.location.pathname);
      setPasswordRecoveryRequired(false);
      setAuthFeedback(null);
      setNotice("Your password has been reset.");
    } catch (error) {
      setAuthFeedback({ type: "error", message: error instanceof Error ? `Could not reset your password: ${error.message}` : "Could not reset your password. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  async function setInvitationPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("password_confirmation") ?? "");
    if (password.length < 8) {
      setAuthFeedback({ type: "error", message: "Use a password with at least 8 characters." });
      return;
    }
    if (password !== confirmation) {
      setAuthFeedback({ type: "error", message: "The passwords do not match." });
      return;
    }
    const supabase = getSupabase();
    if (!supabase) {
      setAuthFeedback({ type: "error", message: "Password setup is unavailable because Supabase is not configured." });
      return;
    }
    setLoading(true);
    setAuthFeedback(null);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setAuthFeedback({ type: "error", message: `Could not set your password: ${error.message}` });
        return;
      }
      window.history.replaceState({}, "", window.location.pathname);
      setPasswordSetupRequired(false);
      setLandingMessage("");
      setNotice("Your password is set. Your institution workspace is loading.");
    } catch (error) {
      setAuthFeedback({ type: "error", message: error instanceof Error ? `Could not set your password: ${error.message}` : "Could not set your password. Please try again." });
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

  async function saveTeacherCv(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const yearsExperience = Number(form.get("years_experience"));
    if (!Number.isInteger(yearsExperience) || yearsExperience < 0 || yearsExperience > 60) {
      setNotice("Enter a valid number of years of experience (0–60).");
      return;
    }
    if (!teacherId) {
      setNotice("Sign in as a teacher to create your CV.");
      return;
    }
    const supabase = getSupabase();
    if (!supabase) {
      setNotice("Connect Supabase before saving your CV.");
      return;
    }
    const cv = {
      teacher_id: teacherId,
      full_name: String(form.get("full_name") ?? "").trim(),
      email: String(form.get("email") ?? "").trim(),
      phone: String(form.get("phone") ?? "").trim() ? `+254${phoneDigitsAfterKenyanPrefix(String(form.get("phone") ?? ""))}` : "",
      professional_title: String(form.get("professional_title") ?? "").trim(),
      years_experience: yearsExperience,
      education: String(form.get("education") ?? "").trim(),
      experience: String(form.get("experience") ?? "").trim(),
      skills: String(form.get("skills") ?? "").trim(),
      candidate_statement: String(form.get("candidate_statement") ?? "").trim(),
      updated_at: new Date().toISOString(),
    };
    if (!cv.full_name || !cv.email || !cv.professional_title || !cv.education || !cv.experience || !cv.skills || !cv.candidate_statement) {
      setNotice("Complete your name, email, professional title, education, work experience, skills, and candidate statement before saving.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("teacher_cvs").upsert(cv, { onConflict: "teacher_id" });
    setLoading(false);
    if (error) {
      setNotice(`Could not save your CV: ${error.message}`);
      return;
    }
    const wasExistingCv = hasSavedCv;
    setTeacherCv({
      full_name: cv.full_name,
      email: cv.email,
      phone: cv.phone,
      professional_title: cv.professional_title,
      years_experience: String(cv.years_experience),
      education: cv.education,
      experience: cv.experience,
      skills: cv.skills,
      candidate_statement: cv.candidate_statement,
    });
    setCvSaved(true);
    setHasSavedCv(true);
    setNotice(wasExistingCv ? "Your CV has been updated. Schools will see the latest saved details on your applications." : "Your CV is saved and will be included with every application.");
  }

  async function applyFor(job: Vacancy) {
    if (!isVacancyOpen(job.applicationDeadline)) {
      setNotice("This opportunity is closed because its application deadline has passed.");
      return;
    }
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
    if (!cvSaved) {
      setActiveNav("My CV");
      setNotice("Complete and save your CV before applying. It will be shared with the school receiving your application.");
      return;
    }
    if (!teacherCv.candidate_statement.trim()) {
      setActiveNav("My CV");
      setNotice("Add and save your candidate statement before applying. Explain why you are a good fit for the role.");
      return;
    }
    if (process.env.NODE_ENV === "development") {
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw new Error(`Could not verify your teacher session: ${sessionError.message}`);
        if (!sessionData.session) throw new Error("Your session has expired. Please sign in again.");
        const response = await fetch("/api/teacher/applications", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
          body: JSON.stringify({ vacancy_id: job.id }),
        });
        const result: { error?: string } = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Could not submit your application.");
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Could not submit your application.");
        return;
      }
    } else {
      const { error } = await supabase.from("applications").insert({ vacancy_id: job.id, teacher_id: user.user.id });
      if (error) {
        setNotice(error.code === "23505" ? "You have already applied for this vacancy." : `Application failed: ${error.message}`);
        return;
      }
    }
    setApplied((current) => [...current, job.id]);
    setActiveNav("My applications");
    setNotice(`Application submitted successfully for ${job.title}. If shortlisted, you will be contacted by the school.`);
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
        body: JSON.stringify({ phone_number: String(form.get("phone") ?? ""), plan_key: selectedPlan }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not start payment.");
      setNotice("STK push sent. Complete the payment on your phone; your access will activate when payment is confirmed.");
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
    setInstitutionRegistrationError("");
    setNotice("");
    const supabase = getSupabase();
    const { data: sessionData } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
    if (!sessionData.session) {
      setLoading(false);
      setInstitutionRegistrationError("Sign in with an authorized super admin account to register institutions.");
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
          head_phone: String(form.get("head_phone") ?? ""),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not register the institution.");
      setModal(null);
      institutionPageCache.current.clear();
      setInstitutionPage(1);
      setInstitutionsRefreshKey((key) => key + 1);
      setInstitutionRegistrationError("");
      setNotice("Institution registered. An invitation has been sent to its head.");
    } catch (error) {
      setInstitutionRegistrationError(error instanceof Error ? error.message : "Could not register the institution.");
    } finally {
      setLoading(false);
    }
  }

  async function editRegisteredInstitution(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingInstitution) return;
    const form = new FormData(event.currentTarget);
    setLoading(true);
    setNotice("");
    try {
      const supabase = getSupabase();
      const { data: sessionData, error: sessionError } = supabase ? await supabase.auth.getSession() : { data: { session: null }, error: null };
      if (sessionError) throw new Error(`Could not verify your admin session: ${sessionError.message}`);
      if (!sessionData.session) throw new Error("Your session has expired. Please sign in again.");

      const response = await fetch("/api/admin/institutions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionData.session.access_token}` },
        body: JSON.stringify({
          id: editingInstitution.id,
          name: String(form.get("institution_name") ?? ""),
          county: String(form.get("county") ?? ""),
          subcounty: String(form.get("subcounty") ?? ""),
          school_level: String(form.get("school_level") ?? ""),
          head_name: String(form.get("head_name") ?? ""),
          head_phone: String(form.get("head_phone") ?? ""),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not update the institution.");
      setModal(null);
      setEditingInstitution(null);
      institutionPageCache.current.clear();
      setInstitutionsRefreshKey((key) => key + 1);
      setNotice("Institution details updated.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not update the institution.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteRegisteredInstitution() {
    if (!deletingInstitution) return;
    setLoading(true);
    setNotice("");
    try {
      const supabase = getSupabase();
      const { data: sessionData, error: sessionError } = supabase ? await supabase.auth.getSession() : { data: { session: null }, error: null };
      if (sessionError) throw new Error(`Could not verify your admin session: ${sessionError.message}`);
      if (!sessionData.session) throw new Error("Your session has expired. Please sign in again.");

      const response = await fetch(`/api/admin/institutions?id=${encodeURIComponent(deletingInstitution.id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
      });
      const result: { error?: string; warnings?: string[] } = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not delete the institution.");
      const remainingCount = Math.max(0, institutionTotalCount - 1);
      setInstitutionPage((page) => Math.min(page, Math.max(1, Math.ceil(remainingCount / 10))));
      institutionPageCache.current.clear();
      setInstitutionsRefreshKey((key) => key + 1);
      setModal(null);
      setDeletingInstitution(null);
      setNotice(result.warnings?.length ? result.warnings.join(" ") : "Institution and linked head account deleted.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not delete the institution.");
    } finally {
      setLoading(false);
    }
  }

  async function createVacancy(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!institutionCanPublish) {
      setActiveNav("Subscription");
      setNotice("An active subscription is required to publish vacancies.");
      return;
    }
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
    const applicationDeadline = String(form.get("application_deadline") ?? "");
    if (!applicationDeadline || applicationDeadline < nairobiDateString()) {
      setLoading(false);
      setNotice("Choose an application closing date that is today or later.");
      return;
    }
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
      application_deadline: applicationDeadline,
      status: "published",
    };
    let createdVacancyId: string;
    if (institutionSubscriptionBypassed) {
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw new Error(`Could not verify your institution session: ${sessionError.message}`);
        if (!sessionData.session) throw new Error("Your session has expired. Please sign in again.");
        const response = await fetch("/api/institution/vacancies", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
          body: JSON.stringify(newVacancy),
        });
        const result: { vacancy?: { id?: string }; error?: string } = await response.json();
        if (!response.ok || typeof result.vacancy?.id !== "string") {
          throw new Error(result.error ?? "Could not publish the vacancy.");
        }
        createdVacancyId = result.vacancy.id;
      } catch (error) {
        setLoading(false);
        setNotice(error instanceof Error ? error.message : "Could not publish the vacancy.");
        return;
      }
    } else {
      const { data: createdVacancy, error } = await supabase
        .from("vacancies")
        .insert(newVacancy)
        .select("id")
        .single();
      if (error) {
        setLoading(false);
        setNotice(`Could not publish vacancy: ${error.message}`);
        return;
      }
      createdVacancyId = createdVacancy.id;
    }
    setLoading(false);
    setVacancies((current) => [{
      id: createdVacancyId,
      title: newVacancy.title,
      description: newVacancy.description,
      institution: "Your school",
      county: newVacancy.county,
      subcounty: newVacancy.subcounty,
      status: newVacancy.status,
      applicationDeadline: newVacancy.application_deadline,
      level: newVacancy.school_level,
      category: newVacancy.category,
      type: newVacancy.employment_type === "BOM" ? "BOM-employed" : newVacancy.employment_type,
      postedAt: new Date().toISOString(),
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
    ? activeNav === "My applications" ? "Your applications" : activeNav === "My CV" ? "Your professional CV" : activeNav === "Saved jobs" ? "Saved opportunities" : activeNav === "Subscription" ? "Your full access" : "Opportunities made for you"
    : role === "institution" ? activeNav === "Subscription" ? "Your school subscription" : activeNav === "Applications" ? "Applications" : activeNav === "My vacancies" ? "Your vacancies" : "Welcome to your workspace"
      : activeNav === "Institutions" ? "Institutions across Kenya" : activeNav === "Subscriptions" ? "Subscription overview" : activeNav === "Vacancies" ? "Vacancy oversight" : "A clearer view of the platform";
  const institutionPageCount = Math.max(1, Math.ceil(institutionTotalCount / 10));
  const adminActiveVacancies = useMemo(
    () => vacancies
    .filter((vacancy) => isVacancyOpen(vacancy.applicationDeadline))
    .sort((first, second) => new Date(second.postedAt).getTime() - new Date(first.postedAt).getTime()),
    [vacancies],
  );

  function authForm() {
    return (
      <>
        <button className="modal-close" onClick={() => { if (!loading) { setModal(null); setLoginChallenge(null); } }} aria-label="Close" disabled={loading}><Icon name="close" size={19} /></button>
        {authMode === "signin" && !loginChallenge ? <div className="auth-signin-heading">
          <div className="modal-mark"><span className="brand-mark"><span /></span></div>
          <div>
            <span className="job-category">WELCOME BACK</span>
            <h2 id="modal-heading">Good to see you again.</h2>
          </div>
        </div> : <>
          <div className="modal-mark"><span className="brand-mark"><span /></span></div>
          <span className="job-category">{loginChallenge ? "EMAIL VERIFICATION" : authMode === "signup" ? "YOUR NEXT CHAPTER" : "ACCOUNT RECOVERY"}</span>
          <h2 id="modal-heading">{loginChallenge ? "Enter your sign-in code." : authMode === "signup" ? "Join the community." : "Reset your password."}</h2>
        </>}
        <p className="modal-description">{loginChallenge ? `Enter the six-digit code sent to ${loginChallenge.email}.` : authMode === "signup" ? "Create a free teacher account to view and apply for opportunities across Kenya." : authMode === "forgot-password" ? "Enter the email address linked to your account. We’ll send you a secure link to choose a new password." : "Sign in with your password. We’ll email you a one-time code to finish signing in."}</p>
        {loginChallenge ? <>
          <form className="modal-form" onSubmit={(event) => { event.preventDefault(); void verifyLoginOtp(loginOtp); }} aria-busy={loading}>
            <label>Email one-time code<span className="auth-otp-inputs" role="group" aria-label="Six-digit sign-in code">
              {Array.from({ length: 6 }, (_, index) => (
                <input
                  key={index}
                  ref={(element) => { loginOtpInputs.current[index] = element; }}
                  className="auth-otp-digit"
                  name={index === 0 ? "otp" : undefined}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  autoComplete={index === 0 ? "one-time-code" : "off"}
                  aria-label={`Digit ${index + 1} of 6`}
                  value={loginOtp[index] ?? ""}
                  required
                  disabled={loading}
                  onChange={(event) => updateLoginOtp(index, event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowLeft" && index > 0) loginOtpInputs.current[index - 1]?.focus();
                    if (event.key === "ArrowRight" && index < 5) loginOtpInputs.current[index + 1]?.focus();
                    if (event.key === "Backspace" && !loginOtp[index] && index > 0) loginOtpInputs.current[index - 1]?.focus();
                  }}
                />
              ))}
            </span></label>
            <button className="primary-button modal-submit" disabled={loading || !/^\d{6}$/.test(loginOtp)}>{loading ? "Verifying…" : "Verify and sign in"} {!loading && <Icon name="arrow" size={15} />}</button>
          </form>
          <div className="switch-auth"><button disabled={loading} onClick={() => void resendLoginOtp()}>Resend code</button><span> · </span><button disabled={loading} onClick={() => { setLoginChallenge(null); setLoginOtp(""); setAuthFeedback(null); }}>Use a different sign-in</button></div>
        </> : authMode === "forgot-password" ? <>
          <form className="modal-form" onSubmit={(event) => void requestPasswordReset(event)} aria-busy={loading}>
            <label>Email address<input name="email" type="email" placeholder="you@example.com" autoComplete="email" required disabled={loading} /></label>
            <button className="primary-button modal-submit" disabled={loading}>
              {loading && <span className="button-spinner" aria-hidden="true" />}
              {loading ? "Sending reset link…" : "Send reset link"}
              {!loading && <Icon name="arrow" size={15} />}
            </button>
          </form>
          <p className="switch-auth">Remembered your password? <button disabled={loading} onClick={() => { setAuthMode("signin"); setAuthFeedback(null); }}>Back to sign in</button></p>
        </> : <>
          <form className={`modal-form${authMode === "signup" ? " auth-signup-form" : ""}`} onSubmit={(event) => void submitAuth(event)} aria-busy={loading}>
            {authMode === "signup" && <label>Full name<input name="full_name" placeholder="Your full name" autoComplete="name" required disabled={loading} /></label>}
            {authMode === "signup" && <label>Your county<select name="county" defaultValue="" required disabled={loading}><option value="" disabled>Select your county</option>{KENYAN_COUNTIES.map((countyName) => <option key={countyName} value={countyName}>{countyName}</option>)}</select></label>}
            <label>Email address<input name="email" type="email" placeholder="you@example.com" autoComplete="email" required disabled={loading} /></label>
            <label>Password<span className="password-input-wrap"><input id="auth-password" name="password" type={showAuthPassword ? "text" : "password"} placeholder="At least 8 characters" minLength={8} autoComplete={authMode === "signup" ? "new-password" : "current-password"} required disabled={loading} /><button className="password-visibility-toggle" type="button" aria-label={showAuthPassword ? "Hide password" : "Show password"} aria-pressed={showAuthPassword} aria-controls="auth-password" onClick={() => setShowAuthPassword((visible) => !visible)}><Icon name={showAuthPassword ? "eyeOff" : "eye"} size={17} /></button></span></label>
            {authMode === "signin" && <button className="forgot-password-link" type="button" disabled={loading} onClick={() => { setAuthMode("forgot-password"); setAuthFeedback(null); }}>Forgot password?</button>}
            <button className="primary-button modal-submit" disabled={loading}>
              {loading && <span className="button-spinner" aria-hidden="true" />}
              {loading ? "Please wait…" : authMode === "signup" ? "Create teacher account" : "Sign in"}
              {!loading && <Icon name="arrow" size={15} />}
            </button>
          </form>
          {authMode === "signin" && <div className="passkey-signin">
            <span className="passkey-divider">or</span>
            <button className="outline-button passkey-signin-button" type="button" onClick={() => void signInWithPasskey()} disabled={loading}>
              {loading ? <span className="button-spinner" aria-hidden="true" /> : <Icon name="passkey" size={16} />}
              Sign in with a passkey
            </button>
          </div>}
          <p className="switch-auth">{authMode === "signup" ? "Already have an account?" : "New to MwalimuConnect?"} <button disabled={loading} onClick={() => { setAuthMode(authMode === "signup" ? "signin" : "signup"); setAuthFeedback(null); setLoginChallenge(null); }}>{authMode === "signup" ? "Sign in" : "Create account"}</button></p>
        </>}
      </>
    );
  }

  if (!enteredWorkspace) {
    if (passwordRecoveryRequired) {
      return (
        <div className="modal-backdrop">
          <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="password-recovery-heading">
            <div className="modal-mark"><span className="brand-mark"><span /></span></div>
            <span className="job-category">ACCOUNT RECOVERY</span>
            <h2 id="password-recovery-heading">Choose a new password.</h2>
            <p className="modal-description">Use at least 8 characters. Your new password will secure your MwalimuConnect account.</p>
            {authFeedback && <p className={`auth-feedback ${authFeedback.type}`} role={authFeedback.type === "error" ? "alert" : "status"}>{authFeedback.message}</p>}
            <form className="modal-form" onSubmit={(event) => void resetAccountPassword(event)} aria-busy={loading}>
              <label>New password<span className="password-input-wrap"><input id="recovery-password" name="password" type={showRecoveryPassword ? "text" : "password"} minLength={8} autoComplete="new-password" required disabled={loading} /><button className="password-visibility-toggle" type="button" aria-label={showRecoveryPassword ? "Hide new password" : "Show new password"} aria-pressed={showRecoveryPassword} aria-controls="recovery-password" onClick={() => setShowRecoveryPassword((visible) => !visible)}><Icon name={showRecoveryPassword ? "eyeOff" : "eye"} size={17} /></button></span></label>
              <label>Confirm new password<span className="password-input-wrap"><input id="recovery-password-confirmation" name="password_confirmation" type={showRecoveryPasswordConfirmation ? "text" : "password"} minLength={8} autoComplete="new-password" required disabled={loading} /><button className="password-visibility-toggle" type="button" aria-label={showRecoveryPasswordConfirmation ? "Hide password confirmation" : "Show password confirmation"} aria-pressed={showRecoveryPasswordConfirmation} aria-controls="recovery-password-confirmation" onClick={() => setShowRecoveryPasswordConfirmation((visible) => !visible)}><Icon name={showRecoveryPasswordConfirmation ? "eyeOff" : "eye"} size={17} /></button></span></label>
              <button className="primary-button modal-submit" disabled={loading}>
                {loading && <span className="button-spinner" aria-hidden="true" />}
                {loading ? "Updating password…" : "Update password"}
                {!loading && <Icon name="arrow" size={15} />}
              </button>
            </form>
          </section>
        </div>
      );
    }
    if (passwordSetupRequired) {
      return (
        <div className="modal-backdrop">
          <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="password-setup-heading">
            <div className="modal-mark"><span className="brand-mark"><span /></span></div>
            <span className="job-category">INSTITUTION ACCOUNT</span>
            <h2 id="password-setup-heading">Set your login password.</h2>
            <p className="modal-description">Choose a password to finish setting up your institution account.</p>
            {authFeedback && <p className={`auth-feedback ${authFeedback.type}`} role={authFeedback.type === "error" ? "alert" : "status"}>{authFeedback.message}</p>}
            <form className="modal-form" onSubmit={(event) => void setInvitationPassword(event)} aria-busy={loading}>
              <label>Password<span className="password-input-wrap"><input id="invitation-password" name="password" type={showInvitationPassword ? "text" : "password"} minLength={8} autoComplete="new-password" required disabled={loading} /><button className="password-visibility-toggle" type="button" aria-label={showInvitationPassword ? "Hide password" : "Show password"} aria-pressed={showInvitationPassword} aria-controls="invitation-password" onClick={() => setShowInvitationPassword((visible) => !visible)}><Icon name={showInvitationPassword ? "eyeOff" : "eye"} size={17} /></button></span></label>
              <label>Confirm password<span className="password-input-wrap"><input id="invitation-password-confirmation" name="password_confirmation" type={showInvitationPasswordConfirmation ? "text" : "password"} minLength={8} autoComplete="new-password" required disabled={loading} /><button className="password-visibility-toggle" type="button" aria-label={showInvitationPasswordConfirmation ? "Hide confirmation password" : "Show confirmation password"} aria-pressed={showInvitationPasswordConfirmation} aria-controls="invitation-password-confirmation" onClick={() => setShowInvitationPasswordConfirmation((visible) => !visible)}><Icon name={showInvitationPasswordConfirmation ? "eyeOff" : "eye"} size={17} /></button></span></label>
              <button className="primary-button modal-submit" disabled={loading}>{loading ? "Setting password…" : "Set password and continue"} <Icon name="arrow" size={15} /></button>
            </form>
          </section>
        </div>
      );
    }
    return (
      <>
      {workspaceLoading && <div className="workspace-loading-strip" role="status"><span>Loading your secure workspace…</span></div>}
      <LandingPage
          message=""
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
        {(authFeedback || landingMessage) && <div className={`auth-toast ${(authFeedback?.type ?? "error")}`} role={authFeedback?.type === "error" ? "alert" : "status"} aria-live={authFeedback?.type === "error" ? "assertive" : "polite"}>
          <span>{authFeedback?.message ?? landingMessage}</span>
          <button onClick={() => { setAuthFeedback(null); setLandingMessage(""); }} aria-label="Dismiss notification"><Icon name="close" size={17} /></button>
        </div>}
        {modal === "auth" && <div className="modal-backdrop" onMouseDown={(event) => { if (!loading && event.target === event.currentTarget) setModal(null); }}><section className={`modal-card auth-modal-card${authMode === "signup" && !loginChallenge ? " is-signup" : ""}`} role="dialog" aria-modal="true" aria-labelledby="modal-heading">{authForm()}</section></div>}
      </>
    );
  }

  return (
    <>
      <header className="topbar">
        <div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><strong>{role === "institution" && activeNav === "My vacancies" ? "Vacancies" : activeNav}</strong></div>
        <div className="topbar-actions">
          <span className="connection-pill connected"><i />Secure workspace</span>
          <button className="icon-button notification-button" aria-label="Notifications"><Icon name="bell" size={19} /></button>
          <div className="account-menu">
            <button className="account-trigger" aria-label={`Account menu for ${roleInfo[role].name}`} aria-haspopup="menu" aria-expanded={accountMenuOpen} onClick={() => setAccountMenuOpen((open) => !open)}>
              <Icon name="profile" size={19} />
            </button>
            {accountMenuOpen && <div className="account-dropdown" role="menu">
              <div className="account-dropdown-role">{roleInfo[role].name}</div>
              <button role="menuitem" onClick={() => { setAccountMenuOpen(false); setPasskeyPendingRemoval(null); setModal("profile"); void loadPasskeys(); }}><Icon name="profile" size={16} /> Profile</button>
              <button role="menuitem" onClick={() => { setAccountMenuOpen(false); void signOut(); }}><span aria-hidden="true">↪</span> Log out</button>
            </div>}
          </div>
        </div>
      </header>
    <main className="app-shell">
      {workspaceLoading && <div className="workspace-loading-strip" role="status"><span>Loading your secure workspace…</span></div>}
      {notice && <div className={`notice-toast ${noticeType}`} role={noticeType === "error" ? "alert" : "status"} aria-live={noticeType === "error" ? "assertive" : "polite"}>
        <div><strong>{noticeType === "success" ? "Done" : "Please check this"}</strong><span>{notice}</span></div>
        <button onClick={() => setNotice("")} aria-label="Dismiss notification"><Icon name="close" size={17} /></button>
      </div>}
      {role === "teacher" && countySetupRequired && <div className="modal-backdrop"><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="county-setup-heading"><div className="modal-mark"><span className="brand-mark"><span /></span></div><span className="job-category">YOUR LOCAL OPPORTUNITIES</span><h2 id="county-setup-heading">Choose your county.</h2><p className="modal-description">Your free teacher account includes vacancies in one county. This setting can only be chosen once.</p><form className="modal-form" onSubmit={(event) => void saveTeacherCounty(event)}><label>Your county<select name="teacher_county" defaultValue="" required><option value="" disabled>Select your county</option>{KENYAN_COUNTIES.map((countyName) => <option key={countyName} value={countyName}>{countyName}</option>)}</select></label><button className="primary-button modal-submit" disabled={loading}>{loading ? "Saving…" : "Save my county"} <Icon name="arrow" size={15} /></button></form></section></div>}
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="MwalimuConnect home">
          <span className="brand-mark"><span /></span>
          <span className="brand-name">mwalimu<span>connect</span></span>
        </a>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          {roleInfo[role].nav.map((item) => {
            const label = role === "teacher" && item === "Discover"
              ? "Opportunities"
              : role === "institution" && item === "My vacancies" ? "Vacancies" : item;
            return (
              <button key={item} className={`nav-item ${activeNav === item ? "active" : ""}`} onClick={() => setActiveNav(item)}>
                <Icon name={navIcon(item)} size={18} /><span>{label}</span>
                {item === "My applications" && <span className="nav-count">{applied.length}</span>}
              </button>
            );
          })}
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
        <div className="page-content">
          <div className="welcome-row">
            <div>
              <p className="welcome-greeting">👋 Welcome back, {userName || "there"}.</p>
              <div className="eyebrow"><span className="eyebrow-dot" /> KENYA&apos;S EDUCATION COMMUNITY</div>
              <h1>{heading}<span className="title-period">.</span></h1>
              <p className="page-subtitle">{role === "teacher" ? "A meaningful role can change everything. Let’s find yours." : role === "institution" ? "Find the right people to help your learners flourish." : "Helping great schools and great educators find each other."}</p>
            </div>
            <div className="welcome-actions">
              {role === "teacher" ? <><button className="outline-button" onClick={() => setActiveNav("Saved jobs")}><Icon name="saved" size={17} /> Saved <span className="saved-bubble">{saved.length}</span></button><button className="primary-button" onClick={() => setActiveNav("Subscription")}>{teacherHasAccess ? "Manage full access" : "Full access"} <Icon name="arrow" size={15} /></button></>
                : role === "institution" ? institutionCanPublish ? <button className="primary-button" onClick={() => setModal("vacancy")}><span className="plus">+</span> Post a vacancy</button> : <button className="primary-button" onClick={() => setActiveNav("Subscription")}>Subscribe to post vacancies <Icon name="arrow" size={15} /></button>
                  : activeNav === "Institutions" ? <button className="primary-button" onClick={() => { setInstitutionRegistrationError(""); setSchoolRegistrationCounty(""); setModal("institution"); }}><span className="plus">+</span> Add institution</button> : null}
            </div>
          </div>
          {passkeyInvitationVisible && passkeys.length === 0 && <section className="passkey-invitation" aria-labelledby="passkey-invitation-heading">
            <span className="passkey-invitation-icon"><Icon name="passkey" size={19} /></span>
            <div className="passkey-invitation-copy">
              <strong id="passkey-invitation-heading">Make your next sign-in easier.</strong>
              <p>Set up a passkey with your fingerprint, face unlock, or device PIN. It takes a moment and stays on your device.</p>
              {passkeyFeedback?.type === "error" && <span className="passkey-invitation-error" role="alert">{passkeyFeedback.message}</span>}
            </div>
            <button className="primary-button passkey-invitation-action" type="button" onClick={() => void registerPasskey()} disabled={Boolean(passkeyBusy)}>
              {passkeyBusy === "register" ? "Setting up…" : "Set up passkey"}
            </button>
            <button className="passkey-invitation-dismiss" type="button" onClick={() => setPasskeyInvitationVisible(false)}>Not now</button>
          </section>}
          {role === "institution" && <div className={`subscription-access-note ${institutionCanPublish ? "is-active" : "is-readonly"}`}>
            <span className="status-badge">{institutionSubscriptionBypassed ? "Development access" : institutionHasAccess ? "Subscription active" : "Read-only access"}</span>
            <span>{institutionSubscriptionBypassed ? "Subscription checks are disabled in development." : institutionHasAccess && subscriptionExpiresAt ? `Access through ${new Date(subscriptionExpiresAt).toLocaleDateString()}.` : "An active subscription is required to publish vacancies."}</span>
            <button className="text-button" onClick={() => setActiveNav("Subscription")}>{institutionSubscriptionBypassed ? "View subscription plans" : institutionHasAccess ? "Renew subscription" : "Subscribe"} <Icon name="arrow" size={15} /></button>
          </div>}

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

          {role === "teacher" && activeNav === "Subscription" && <section className="panel-card subscription-panel">
            <div className="subscription-access-note">
              <span className={`status-badge ${teacherHasAccess ? "" : "status-inactive"}`}>{teacherHasAccess ? "Full access active" : "County access"}</span>
              <span>{teacherHasAccess && teacherSubscriptionExpiresAt ? `Nationwide access through ${new Date(teacherSubscriptionExpiresAt).toLocaleDateString()}.` : `Your free account currently covers ${teacherCounty || "your selected county"}.`}</span>
              {teacherHasAccess && <button className="text-button" onClick={() => setActiveNav("Discover")}>Browse vacancies <Icon name="arrow" size={15} /></button>}
            </div>
            {subscriptionPlanOptions}
          </section>}

          {role === "teacher" && activeNav === "My CV" && <section className="panel-card cv-panel">
            <div className="role-panel-head">
              <div className="panel-icon"><Icon name="applications" size={22} /></div>
              <div><span className="job-category">YOUR APPLICATION PROFILE</span><h2>{hasSavedCv ? "Update your teaching CV." : "Build your teaching CV."}</h2><p>Keep your professional details up to date. Schools see the latest saved CV details on applications you send them.</p><small>This is a details-only CV; no file upload is needed. You can update it anytime.</small></div>
            </div>
            <div className={`cv-sharing-note ${cvSaved ? "is-saved" : ""}`} role="status">
              <span className="status-badge">{cvSaved ? "CV saved" : hasSavedCv ? "Unsaved changes" : "Not saved yet"}</span>
              <span>{cvSaved ? "Schools can view your latest saved CV details on your applications." : hasSavedCv ? "Save your changes to update the CV schools see." : "A saved CV is required before you can apply for opportunities."}</span>
            </div>
            <form className="modal-form cv-form" onSubmit={(event) => void saveTeacherCv(event)}>
              <div className="form-pair">
                <label>Full name<input name="full_name" value={teacherCv.full_name} onChange={(event) => updateTeacherCv("full_name", event.target.value)} autoComplete="name" required /></label>
                <label>Email address<input name="email" type="email" value={teacherCv.email} onChange={(event) => updateTeacherCv("email", event.target.value)} autoComplete="email" required /></label>
              </div>
              <div className="form-pair">
                <label>Phone number<span className="phone-number-input"><span aria-hidden="true">+254</span><input name="phone" type="tel" inputMode="numeric" value={phoneDigitsAfterKenyanPrefix(teacherCv.phone)} onChange={(event) => updateTeacherCv("phone", event.target.value.replace(/\D/g, "").slice(0, 9))} autoComplete="tel-national" placeholder="712345678" maxLength={9} pattern="7\d{8}" title="Enter 9 digits starting with 7." /></span></label>
                <label>Professional title<input name="professional_title" value={teacherCv.professional_title} onChange={(event) => updateTeacherCv("professional_title", event.target.value)} placeholder="e.g. Mathematics teacher" required /></label>
              </div>
              <label>Years of teaching experience<input name="years_experience" type="number" min="0" max="60" step="1" value={teacherCv.years_experience} onChange={(event) => updateTeacherCv("years_experience", event.target.value)} required /></label>
              <label>Education and qualifications<textarea name="education" rows={3} value={teacherCv.education} onChange={(event) => updateTeacherCv("education", event.target.value)} placeholder="List your teaching qualifications, institutions, and graduation years." required /></label>
              <label>Teaching and work experience<textarea name="experience" rows={5} value={teacherCv.experience} onChange={(event) => updateTeacherCv("experience", event.target.value)} placeholder="Describe roles, schools, dates, and key responsibilities." required /></label>
              <label>Skills<textarea name="skills" rows={3} value={teacherCv.skills} onChange={(event) => updateTeacherCv("skills", event.target.value)} placeholder="Subject expertise, classroom management, assessment…" required /></label>
              <label>Why are you the right candidate for this position?<textarea name="candidate_statement" rows={4} value={teacherCv.candidate_statement} onChange={(event) => updateTeacherCv("candidate_statement", event.target.value)} placeholder="Explain how your experience, teaching strengths, and approach make you a strong fit for the role." required /></label>
              <button className="primary-button modal-submit" disabled={loading}>{loading ? hasSavedCv ? "Updating CV…" : "Saving CV…" : hasSavedCv ? "Update my CV" : "Save my CV"} <Icon name="arrow" size={15} /></button>
            </form>
          </section>}

          {(role === "teacher" && ["Discover", "Saved jobs", "My applications"].includes(activeNav)) && <section className="jobs-section">
            <div className="section-heading">
              <div><h2>{activeNav === "Saved jobs" ? "Saved for later" : activeNav === "My applications" ? "Jobs you have applied for" : "Fresh opportunities"}</h2><p>{activeNav === "Discover" ? "Published opportunities, newest first." : activeNav === "My applications" ? "Only opportunities you have applied to are shown here." : "Keep track of the opportunities that matter to you."}</p></div>
              <button className="text-button" onClick={() => { setQuery(""); setCounty("All counties"); setSubcounty("All subcounties"); setLevel("All levels"); setSelectedVacancy(null); }}>View all <Icon name="arrow" size={15} /></button>
            </div>
            {activeNav === "Discover" && teacherCounty && <div className="subscription-note"><span className="subscription-check"><Icon name="location" size={15} /></span><span><strong>{teacherHasAccess ? "Nationwide full access" : `Free access: ${teacherCounty}`}</strong><small>{teacherHasAccess ? "Browse and apply to opportunities across Kenya." : "Upgrade to access opportunities in every county."}</small></span>{!teacherHasAccess && <button className="text-button" onClick={() => setActiveNav("Subscription")}>Full access <Icon name="arrow" size={15} /></button>}</div>}
            <div className="filter-bar">
              <label className="search-field" htmlFor="vacancy-search"><Icon name="search" size={18} /><input id="vacancy-search" placeholder="Job title, school or keyword" value={query} onChange={(event) => { setQuery(event.target.value); setSelectedVacancy(null); }} /><kbd>⌘ K</kbd></label>
              <label className="select-field"><Icon name="location" size={17} /><select aria-label="Filter by county" value={county} onChange={(event) => { setCounty(event.target.value); setSubcounty("All subcounties"); setSelectedVacancy(null); }}>{counties.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label className="select-field"><select aria-label="Filter by subcounty" value={subcounty} onChange={(event) => { setSubcounty(event.target.value); setSelectedVacancy(null); }} disabled={county === "All counties"}>{subcounties.map((item) => <option key={item}>{item}</option>)}</select><span className="select-chevron">⌄</span></label>
              <label className="select-field level-select"><select aria-label="Filter by school level" value={level} onChange={(event) => { setLevel(event.target.value); setSelectedVacancy(null); }}>{levels.map((item) => <option key={item}>{item}</option>)}</select><span className="select-chevron">⌄</span></label>
            </div>
            <div className="opportunity-table-wrap">
              <table className="opportunity-table">
                <thead><tr><th scope="col">Opportunity</th><th scope="col">School</th><th scope="col">Location</th><th scope="col">Level</th><th scope="col">Posted</th><th scope="col">Applications</th><th scope="col"><span className="visually-hidden">Actions</span></th></tr></thead>
                <tbody>
                  {visibleVacancies.map((job) => (
                    <tr key={job.id}>
                      <td><button className="opportunity-title" aria-haspopup="dialog" onClick={() => setSelectedVacancy(job)}>{job.title}</button><span className="opportunity-category">{job.category} · {job.type}</span></td>
                      <td>{job.institution}</td>
                      <td>{job.subcounty ? `${job.subcounty}, ` : ""}{job.county}</td>
                      <td>{job.level}</td>
                      <td><span className="posted-date-badge">{new Date(job.postedAt).toLocaleDateString()}{wasPostedWithinLastWeek(job.postedAt) && <span className="new-opportunity-badge">NEW</span>}</span></td>
                      <td><span className={`status-badge ${isVacancyOpen(job.applicationDeadline) ? "status-open" : "status-closed"}`}>{isVacancyOpen(job.applicationDeadline) ? "Open" : "Closed"}</span></td>
                      <td className="opportunity-actions"><button className={`bookmark-button ${saved.includes(job.id) ? "is-saved" : ""}`} aria-label={saved.includes(job.id) ? `Remove ${job.title} from saved opportunities` : `Save ${job.title}`} aria-pressed={saved.includes(job.id)} onClick={() => setSaved((current) => current.includes(job.id) ? current.filter((id) => id !== job.id) : [...current, job.id])}><Icon name="saved" size={16} /></button><button className="details-link" aria-label={`View details for ${job.title}`} aria-haspopup="dialog" onClick={() => setSelectedVacancy(job)}>Details</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
              {visibleVacancies.length === 0 && <div className="empty-state"><span>✳</span><strong>{emptyVacancyTitle}</strong><p>{emptyVacancyDescription}</p>{activeNav !== "Discover" && <button className="text-button" onClick={() => setActiveNav("Discover")}>Explore opportunities <Icon name="arrow" size={15} /></button>}</div>}
          </section>}

          {role === "institution" && <section className="panel-card role-panel">
            <div className="role-panel-head"><div className="panel-icon"><Icon name={activeNav === "Subscription" ? "subscription" : activeNav === "Applications" ? "applicants" : "vacancies"} size={22} /></div><div><span className="job-category">SCHOOL WORKSPACE</span><h2>{activeNav === "Subscription" ? "Connect your school to opportunity." : activeNav === "Applications" ? "Review applications." : "The right educator changes everything."}</h2><p>{activeNav === "Subscription" ? "Activate a subscription to keep your school’s opportunities visible to teachers." : activeNav === "Applications" ? "Review applicants for any of your active vacancies." : "Post a vacancy and help talented educators find their way to your school."}</p></div></div>
            {activeNav !== "Subscription" && <div className="institution-levels"><strong>{schoolLevel || "Institution type"}</strong><span>Teaching levels: {getVacancyLevelsForInstitutionType(schoolLevel).join(" · ") || "Not configured"}</span></div>}
            {activeNav === "Subscription" ? subscriptionPlanOptions : <div className="role-actions"><button className="primary-button" onClick={() => activeNav === "My vacancies" && !institutionCanPublish ? setActiveNav("Subscription") : activeNav === "Applications" ? setActiveNav("My vacancies") : setModal("vacancy")}>{activeNav === "My vacancies" && !institutionCanPublish ? "Subscribe with M-Pesa" : activeNav === "Applications" ? "View vacancies" : "Post a vacancy"} <Icon name="arrow" size={15} /></button><button className="outline-button" onClick={() => setActiveNav("Subscription")}>Manage subscription</button></div>}
            {activeNav === "Applications" && <div className="applicant-list">
              {institutionActiveVacancies.length > 0 && <label className="applicant-vacancy-picker">Active vacancy<select value={selectedInstitutionVacancyId} onChange={(event) => { setSelectedInstitutionVacancyId(event.target.value); setExpandedApplicantId(""); }}>{institutionActiveVacancies.map((vacancy) => <option key={vacancy.id} value={vacancy.id}>{vacancy.title} · Apply by {formatNairobiDate(vacancy.applicationDeadline)}</option>)}</select></label>}
              <div className="applicant-list-heading"><div><span className="job-category">ACTIVE OPPORTUNITY</span><h3>{selectedInstitutionVacancy?.title ?? "No active vacancies"}</h3></div>{selectedInstitutionVacancy && <span className="status-badge">{selectedInstitutionApplicants.length} {selectedInstitutionApplicants.length === 1 ? "application" : "applications"}</span>}</div>
              {selectedInstitutionVacancy && <p className="applicant-sort-note">Showing applications for this vacancy, with the earliest applications first.</p>}
              {applicantsLoading && <p className="no-vacancies">Loading applications…</p>}
              {!applicantsLoading && institutionActiveVacancies.length === 0 && <p className="no-vacancies">Your institution has no active vacancies currently accepting applications. Post a vacancy to receive applicants.</p>}
              {!applicantsLoading && selectedInstitutionVacancy && selectedInstitutionApplicants.length === 0 && <p className="no-vacancies">No applications have arrived for this vacancy yet.</p>}
              {selectedInstitutionApplicants.length > 0 && <div className="applicant-table-wrap">
                <table className="applicant-table">
                  <thead><tr><th scope="col">Applicant</th><th scope="col">Contact</th><th scope="col">Experience</th><th scope="col">Applied</th><th scope="col"><span className="visually-hidden">CV details</span></th></tr></thead>
                  <tbody>{selectedInstitutionApplicants.map((applicant) => <Fragment key={applicant.id}>
                    <tr>
                      <td><div className="applicant-table-name"><span>{applicant.cv.professional_title || "TEACHER APPLICANT"}</span><strong>{applicant.cv.full_name}</strong></div></td>
                      <td><div className="applicant-table-contact"><a href={`mailto:${applicant.cv.email}`}>{applicant.cv.email}</a>{applicant.cv.phone && <a href={`tel:${applicant.cv.phone}`}>{applicant.cv.phone}</a>}</div></td>
                      <td>{applicant.cv.years_experience} years</td>
                      <td>{new Date(applicant.appliedAt).toLocaleString()}</td>
                      <td><button className="outline-button applicant-cv-button" aria-expanded={expandedApplicantId === applicant.id} aria-controls={`applicant-cv-${applicant.id}`} onClick={() => setExpandedApplicantId((current) => current === applicant.id ? "" : applicant.id)}>{expandedApplicantId === applicant.id ? "Hide CV" : "View CV"}</button></td>
                    </tr>
                    {expandedApplicantId === applicant.id && <tr className="applicant-details-row" id={`applicant-cv-${applicant.id}`}><td colSpan={5}>
                      <div className="applicant-cv-grid">
                        <div><strong>Education & qualifications</strong><p>{applicant.cv.education || "Not provided"}</p></div>
                        <div><strong>Teaching & work experience</strong><p>{applicant.cv.experience || "Not provided"}</p></div>
                        <div><strong>Skills</strong><p>{applicant.cv.skills || "Not provided"}</p></div>
                        <div><strong>Why they are the right candidate</strong><p>{applicant.cv.candidate_statement || "Not provided"}</p></div>
                      </div>
                    </td></tr>}
                  </Fragment>)}</tbody>
                </table>
              </div>}
            </div>}
            {activeNav === "My vacancies" && <div className="institution-vacancy-list">
              <div className="institution-vacancy-heading"><h3>Your vacancies</h3><span>{institutionVacancies.length} {institutionVacancies.length === 1 ? "vacancy" : "vacancies"}</span></div>
              {institutionVacancies.length > 0 ? <div className="applicant-table-wrap institution-vacancy-table-wrap">
                <table className="applicant-table institution-vacancy-table">
                  <thead><tr><th scope="col">Vacancy</th><th scope="col">Teaching level</th><th scope="col">Location</th><th scope="col">Apply by</th><th scope="col">Status</th></tr></thead>
                  <tbody>{institutionVacancies.map((job) => <tr key={job.id}>
                    <td><div className="institution-vacancy-name"><span className="school-avatar mint">{job.initials}</span><strong>{job.title}</strong></div></td>
                    <td>{job.level}</td>
                    <td>{job.subcounty ? `${job.subcounty}, ` : ""}{job.county}</td>
                    <td>{formatNairobiDate(job.applicationDeadline)}</td>
                    <td><span className={`status-badge ${isVacancyOpen(job.applicationDeadline) ? "status-open" : "status-closed"}`}>{isVacancyOpen(job.applicationDeadline) ? "Open" : "Closed"}</span></td>
                  </tr>)}</tbody>
                </table>
              </div> : <p className="no-vacancies">No vacancies yet. Post your first role to reach educators.</p>}
            </div>}
          </section>}

          {role === "admin" && <section className="panel-card role-panel">
            <div className="role-panel-head"><div className="panel-icon admin-icon"><Icon name={navIcon(activeNav)} size={22} /></div><div><span className="job-category">PLATFORM ADMINISTRATION</span><h2>{activeNav === "Institutions" ? "Bring another school on board." : activeNav === "Subscriptions" ? "Keep every subscription in view." : activeNav === "Vacancies" ? "Keep opportunities verified and visible." : "A connected community starts here."}</h2><p>{activeNav === "Institutions" ? "Register schools and invite their heads of institution to manage vacancies." : activeNav === "Subscriptions" ? "Monitor school access and M-Pesa subscription activity." : activeNav === "Vacancies" ? "Review published roles from participating institutions." : "A home for schools and educators, in every county."}</p></div></div>
            {activeNav === "Institutions" && <div className="role-actions"><button className="primary-button" onClick={() => { setInstitutionRegistrationError(""); setSchoolRegistrationCounty(""); setModal("institution"); }}><span className="plus">+</span> Register an institution</button></div>}
            {activeNav === "Institutions" && <section className="institution-directory" aria-labelledby="registered-institutions-heading">
              <div className="institution-directory-heading"><div><h3 id="registered-institutions-heading">Registered institutions</h3><p>Institution and head-of-institution contact details.</p></div><div className="institution-directory-tools"><span>{institutionTotalCount} {institutionTotalCount === 1 ? "institution" : "institutions"}</span><button className="text-button" onClick={() => { institutionPageCache.current.clear(); setInstitutionsRefreshKey((key) => key + 1); }} disabled={institutionsLoading}>{institutionsLoading ? "Refreshing…" : "Refresh"}</button></div></div>
              {institutionsLoading ? <p className="institution-directory-message" role="status">Loading institutions…</p>
                : institutionsLoadError ? <div className="institution-directory-message institution-directory-error" role="alert"><span>{institutionsLoadError}</span><button className="text-button" onClick={() => { institutionPageCache.current.clear(); setInstitutionsRefreshKey((key) => key + 1); }}>Try again</button></div>
                  : institutionTotalCount === 0 ? <p className="institution-directory-message">No institutions have been registered yet.</p>
                    : <>
                      <div className="opportunity-table-wrap institution-table-wrap">
                        <table className="opportunity-table institution-table">
                          <thead><tr><th scope="col">Institution name</th><th scope="col">County</th><th scope="col">Email address</th><th scope="col">Phone number</th><th scope="col">Head of institution</th><th scope="col">Actions</th></tr></thead>
                          <tbody>{registeredInstitutions.map((institution) => <tr key={institution.id}>
                            <td><strong className="institution-name">{institution.name}</strong></td>
                            <td>{institution.county}</td>
                            <td>{institution.head_email ? <a href={`mailto:${institution.head_email}`}>{institution.head_email}</a> : "Not provided"}</td>
                            <td>{institution.head_phone ? <a href={`tel:${institution.head_phone}`}>{institution.head_phone}</a> : "Not provided"}</td>
                            <td>{institution.head_name || "Not provided"}</td>
                            <td><div className="institution-row-actions">
                              <button className="outline-button" onClick={() => {
                                setEditingInstitution(institution);
                                setSchoolRegistrationCounty(institution.county);
                                setEditInstitutionSubcounty(institution.subcounty);
                                setModal("edit-institution");
                              }}>Edit</button>
                              <button className="outline-button institution-delete-button" onClick={() => {
                                setDeletingInstitution(institution);
                                setModal("delete-institution");
                              }}>Delete</button>
                            </div></td>
                          </tr>)}</tbody>
                        </table>
                      </div>
                      <div className="institution-pagination" aria-label="Institution table pagination">
                        <span>Showing {(institutionPage - 1) * 10 + 1}–{Math.min(institutionPage * 10, institutionTotalCount)} of {institutionTotalCount}</span>
                        <div><button className="outline-button" onClick={() => setInstitutionPage((page) => Math.max(1, page - 1))} disabled={institutionPage === 1} aria-label="Previous page">Previous</button><span>Page {institutionPage} of {institutionPageCount}</span><button className="outline-button" onClick={() => setInstitutionPage((page) => Math.min(institutionPageCount, page + 1))} disabled={institutionPage === institutionPageCount} aria-label="Next page">Next</button></div>
                      </div>
                    </>}
            </section>}
            {activeNav === "Vacancies" && <section className="institution-directory admin-vacancy-directory" aria-labelledby="active-vacancies-heading">
              <div className="institution-directory-heading"><div><h3 id="active-vacancies-heading">Latest active opportunities</h3><p>Published vacancies that are still accepting applications, newest first.</p></div><div className="institution-directory-tools"><span>{adminActiveVacancies.length} {adminActiveVacancies.length === 1 ? "active vacancy" : "active vacancies"}</span><button className="text-button" onClick={() => setVacanciesRefreshKey((key) => key + 1)} disabled={vacanciesLoading}>{vacanciesLoading ? "Refreshing…" : "Refresh"}</button></div></div>
              {vacanciesLoading ? <p className="institution-directory-message" role="status">Loading active vacancies…</p>
                : vacancyLoadError ? <div className="institution-directory-message institution-directory-error" role="alert">{vacancyLoadError}</div>
                  : adminActiveVacancies.length === 0 ? <p className="institution-directory-message">There are no active vacancies at the moment.</p>
                    : <div className="opportunity-table-wrap">
                      <table className="opportunity-table admin-vacancy-table">
                        <thead><tr><th scope="col">Opportunity</th><th scope="col">Institution</th><th scope="col">County</th><th scope="col">Level</th><th scope="col">Posted</th><th scope="col">Application deadline</th></tr></thead>
                        <tbody>{adminActiveVacancies.map((vacancy) => <tr key={vacancy.id}>
                          <td><strong className="institution-name">{vacancy.title}</strong></td>
                          <td>{vacancy.institution}</td>
                          <td>{vacancy.county}</td>
                          <td>{vacancy.level}</td>
                          <td>{new Intl.DateTimeFormat("en-KE", { timeZone: "Africa/Nairobi", dateStyle: "medium" }).format(new Date(vacancy.postedAt))}</td>
                          <td>{formatNairobiDate(vacancy.applicationDeadline)}</td>
                        </tr>)}</tbody>
                      </table>
                    </div>}
            </section>}
          </section>}

          <footer className="page-footer"><span>© {new Date().getFullYear()} MwalimuConnect</span><span>Built for the people who shape tomorrow. <span className="footer-spark">✳</span></span></footer>
        </div>
      </section>

    </main>

      {selectedVacancy && <div className="vacancy-details-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedVacancy(null); }}>
        <section className="vacancy-details-modal" role="dialog" aria-modal="true" aria-labelledby="selected-opportunity-title">
          <button className="vacancy-details-close" autoFocus onClick={() => setSelectedVacancy(null)} aria-label="Close opportunity details"><Icon name="close" size={19} /></button>
          <header className="vacancy-details-header">
            <span className="job-category">{selectedVacancy.category} opportunity</span>
            <span className={`status-badge ${isVacancyOpen(selectedVacancy.applicationDeadline) ? "status-open" : "status-closed"}`}>{isVacancyOpen(selectedVacancy.applicationDeadline) ? "Open" : "Closed"}</span>
            <h2 id="selected-opportunity-title">{selectedVacancy.title}</h2>
            <p>{selectedVacancy.institution}</p>
          </header>
          <dl className="vacancy-details-meta">
            <div><dt>Location</dt><dd>{selectedVacancy.subcounty ? `${selectedVacancy.subcounty}, ` : ""}{selectedVacancy.county}</dd></div>
            <div><dt>Teaching level</dt><dd>{selectedVacancy.level}</dd></div>
            <div><dt>Employment</dt><dd>{selectedVacancy.type}</dd></div>
            <div><dt>Apply by</dt><dd>{formatNairobiDate(selectedVacancy.applicationDeadline)}</dd></div>
          </dl>
          <div className="vacancy-details-description">
            <h3>Role description</h3>
            <p>{selectedVacancy.description.trim() || "The school has not added a role description yet."}</p>
          </div>
          <footer className="vacancy-details-footer">
            <span>{applied.includes(selectedVacancy.id) ? "You have applied for this opportunity." : "Review the role details before applying."}</span>
            <button className={`apply-button ${applied.includes(selectedVacancy.id) ? "applied" : ""}`} disabled={applied.includes(selectedVacancy.id) || !isVacancyOpen(selectedVacancy.applicationDeadline)} onClick={() => { const job = selectedVacancy; setSelectedVacancy(null); void applyFor(job); }}>
              {applied.includes(selectedVacancy.id) ? "Applied" : isVacancyOpen(selectedVacancy.applicationDeadline) ? "Apply now" : "Closed"}
              {isVacancyOpen(selectedVacancy.applicationDeadline) && !applied.includes(selectedVacancy.id) && <Icon name="arrow" size={15} />}
            </button>
          </footer>
        </section>
      </div>}

      {typeof document !== "undefined" && createPortal(
        <nav className="mobile-nav" aria-label="Mobile navigation">{roleInfo[role].nav.map((item) => <button key={item} className={activeNav === item ? "active" : ""} onClick={() => setActiveNav(item)}><Icon name={navIcon(item)} size={19} /><span>{role === "institution" && item === "My vacancies" ? "Vacancies" : item.replace(/^My\s+/, "").replace(/^\w/, (letter) => letter.toUpperCase())}</span></button>)}</nav>,
        document.body,
      )}

      {modal && <div className="modal-backdrop" onMouseDown={(event) => { if (!loading && event.target === event.currentTarget) setModal(null); }}>
        <section className={`modal-card${modal === "institution" || modal === "edit-institution" ? " institution-modal-card" : modal === "vacancy" ? " vacancy-modal-card" : modal === "auth" ? ` auth-modal-card${authMode === "signup" && !loginChallenge ? " is-signup" : ""}` : ""}`} role="dialog" aria-modal="true" aria-labelledby="modal-heading">
          {modal === "auth" ? authForm() : <>
            <button className="modal-close" onClick={() => setModal(null)} aria-label="Close" disabled={loading}><Icon name="close" size={19} /></button>
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
              <section className="account-passkeys" aria-labelledby="passkeys-heading">
                <div className="account-passkeys-heading">
                  <h3 id="passkeys-heading">Passkeys</h3>
                  <p>Use your device’s fingerprint, face, or screen lock to sign in securely.</p>
                </div>
                {passkeyFeedback && <p className={`auth-feedback ${passkeyFeedback.type}`} role={passkeyFeedback.type === "error" ? "alert" : "status"}>{passkeyFeedback.message}</p>}
                {passkeysLoading ? <p className="passkey-empty" role="status">Loading your passkeys…</p> : passkeys.length > 0 ? <ul className="passkey-list">
                  {passkeys.map((passkey) => <li key={passkey.id} className="passkey-item">
                    <form className="passkey-rename-form" onSubmit={(event) => void renamePasskey(event, passkey.id)}>
                      <label>Passkey name<input name="friendly_name" defaultValue={passkey.friendly_name ?? ""} placeholder="Name this passkey" maxLength={120} required disabled={Boolean(passkeyBusy)} /></label>
                      <button className="outline-button" type="submit" disabled={Boolean(passkeyBusy)}>{passkeyBusy === passkey.id ? "Saving…" : "Save name"}</button>
                    </form>
                    <p className="passkey-date">Added {new Date(passkey.created_at).toLocaleDateString()}{passkey.last_used_at ? ` · Last used ${new Date(passkey.last_used_at).toLocaleDateString()}` : ""}</p>
                    {passkeyPendingRemoval === passkey.id ? <div className="passkey-remove-confirm">
                      <span>Remove this passkey? You can’t use it to sign in afterward.</span>
                      <button className="outline-button" type="button" onClick={() => setPasskeyPendingRemoval(null)} disabled={Boolean(passkeyBusy)}>Cancel</button>
                      <button className="outline-button passkey-remove-button" type="button" onClick={() => void removePasskey(passkey.id)} disabled={Boolean(passkeyBusy)}>{passkeyBusy === passkey.id ? "Removing…" : "Remove passkey"}</button>
                    </div> : <button className="passkey-remove-link" type="button" onClick={() => setPasskeyPendingRemoval(passkey.id)} disabled={Boolean(passkeyBusy)}>Remove passkey</button>}
                  </li>)}
                </ul> : <p className="passkey-empty">No passkeys are registered yet. Add one to sign in without a password.</p>}
                <button className="primary-button passkey-add-button" type="button" onClick={() => void registerPasskey()} disabled={Boolean(passkeyBusy) || passkeysLoading}>
                  {passkeyBusy === "register" ? <span className="button-spinner" aria-hidden="true" /> : <Icon name="passkey" size={16} />}
                  {passkeyBusy === "register" ? "Adding passkey…" : "Add a passkey"}
                </button>
              </section>
            </> : modal === "subscription" ? <>
              <span className="job-category">{role === "teacher" ? "NATIONWIDE TEACHER ACCESS" : "SCHOOL SUBSCRIPTION"}</span><h2 id="modal-heading">Start your {subscriptionPlans.find((plan) => plan.key === selectedPlan)?.name.toLowerCase() ?? selectedPlan} plan.</h2><p className="modal-description">Pay securely with M-Pesa to activate {subscriptionPlans.find((plan) => plan.key === selectedPlan)?.durationDays ?? 0} days of {role === "teacher" ? "nationwide vacancy access" : "school workspace access"}.</p>
              <div className="selected-plan-summary"><strong>{subscriptionPlans.find((plan) => plan.key === selectedPlan)?.name}</strong><span>{subscriptionPlans.find((plan) => plan.key === selectedPlan)?.amountKes?.toLocaleString("en-KE", { style: "currency", currency: "KES" }) ?? "Price unavailable"}</span></div>
              <form className="modal-form" onSubmit={(event) => void startSubscription(event)}><label>M-Pesa phone number<input name="phone" type="tel" placeholder="254 7XX XXX XXX" pattern="^(?:\+?254|0)?7\d{8}$" required /></label><button className="primary-button modal-submit" disabled={loading}>{loading ? "Sending request…" : "Send STK push"} <Icon name="arrow" size={15} /></button></form>
              <p className="secure-note"><Icon name="subscription" size={15} /> Payments processed securely by IntaSend.</p>
            </> : modal === "institution" ? <>
              <span className="job-category">SUPER ADMINISTRATION</span><h2 id="modal-heading">Welcome a new school.</h2><p className="modal-description">Register the school’s location and institution type. Its head can select the teaching level for each vacancy.</p>
              <form className="modal-form institution-form" onSubmit={(event) => void registerInstitution(event)}>
                {institutionRegistrationError && <p className="auth-feedback error institution-form-error" role="alert">{institutionRegistrationError}</p>}
                <label>Institution name<input name="institution_name" placeholder="Enter institution name" required /></label>
                <label>Institution type<select name="school_level" defaultValue="" required><option value="" disabled>Select institution type</option>{INSTITUTION_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
                <label>County<select name="county" value={schoolRegistrationCounty} onChange={(event) => setSchoolRegistrationCounty(event.target.value)} required><option value="" disabled>Select county</option>{KENYAN_COUNTIES.map((countyName) => <option key={countyName} value={countyName}>{countyName}</option>)}</select></label>
                <label>Subcounty<select key={schoolRegistrationCounty} name="subcounty" defaultValue="" disabled={!schoolRegistrationCounty} required><option value="" disabled>{schoolRegistrationCounty ? "Select subcounty" : "Select county first"}</option>{getSubCountiesInCounty(schoolRegistrationCounty).map((item) => <option key={item.code} value={item.name}>{item.name}</option>)}</select></label>
                <label>Head of institution<input name="head_name" placeholder="Full name" required /></label>
                <label>Invitation email<input name="head_email" type="email" placeholder="head@school.ac.ke" required /></label>
                <label>Head&apos;s phone number<span className="phone-number-input"><span aria-hidden="true">+254</span><input name="head_phone" type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="712345678" maxLength={9} pattern="7\d{8}" title="Enter 9 digits starting with 7." required /></span></label>
                <button className="primary-button modal-submit" disabled={loading}>{loading ? "Registering school…" : "Register & send invitation"} <Icon name="arrow" size={15} /></button>
              </form>
            </> : modal === "edit-institution" && editingInstitution ? <>
              <span className="job-category">SUPER ADMINISTRATION</span><h2 id="modal-heading">Edit institution details.</h2><p className="modal-description">Update the institution profile and its head’s name or phone. The head’s sign-in email cannot be changed here.</p>
              <form className="modal-form institution-form" onSubmit={(event) => void editRegisteredInstitution(event)}>
                <label>Institution name<input name="institution_name" defaultValue={editingInstitution.name} required /></label>
                <label>Institution type<select name="school_level" defaultValue={editingInstitution.school_level} required><option value="" disabled>Select institution type</option>{INSTITUTION_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
                <label>County<select name="county" value={schoolRegistrationCounty} onChange={(event) => { setSchoolRegistrationCounty(event.target.value); setEditInstitutionSubcounty(""); }} required><option value="" disabled>Select county</option>{KENYAN_COUNTIES.map((countyName) => <option key={countyName} value={countyName}>{countyName}</option>)}</select></label>
                <label>Subcounty<select name="subcounty" value={editInstitutionSubcounty} onChange={(event) => setEditInstitutionSubcounty(event.target.value)} disabled={!schoolRegistrationCounty} required><option value="" disabled>{schoolRegistrationCounty ? "Select subcounty" : "Select county first"}</option>{getSubCountiesInCounty(schoolRegistrationCounty).map((item) => <option key={item.code} value={item.name}>{item.name}</option>)}</select></label>
                <label>Head of institution<input name="head_name" defaultValue={editingInstitution.head_name ?? ""} required /></label>
                <label>Head&apos;s email address<input value={editingInstitution.head_email ?? "Not provided"} disabled readOnly /></label>
                <label>Head&apos;s phone number<span className="phone-number-input"><span aria-hidden="true">+254</span><input name="head_phone" type="tel" inputMode="numeric" autoComplete="tel-national" defaultValue={phoneDigitsAfterKenyanPrefix(editingInstitution.head_phone ?? "")} placeholder="712345678" maxLength={9} pattern="7\d{8}" title="Enter 9 digits starting with 7." required /></span></label>
                <button className="primary-button modal-submit" disabled={loading}>{loading ? "Saving changes…" : "Save institution changes"} <Icon name="arrow" size={15} /></button>
              </form>
            </> : modal === "delete-institution" && deletingInstitution ? <>
              <span className="job-category">PERMANENT ACTION</span><h2 id="modal-heading">Delete {deletingInstitution.name}?</h2>
              <p className="modal-description">This permanently deletes the institution, all its vacancies and subscriptions, and the linked head’s login account. This cannot be undone.</p>
              <div className="institution-delete-actions"><button className="outline-button" onClick={() => { setModal(null); setDeletingInstitution(null); }} disabled={loading}>Cancel</button><button className="primary-button institution-delete-confirm" onClick={() => void deleteRegisteredInstitution()} disabled={loading}>{loading ? "Deleting institution…" : "Delete institution"}</button></div>
            </> : <>
              <span className="job-category">NEW OPPORTUNITY</span><h2 id="modal-heading">Find your next great educator.</h2><p className="modal-description">Your school’s location and learning level are applied automatically to its vacancies.</p>
              <div className="vacancy-school-details"><span><small>County</small><strong>{schoolCounty || "Loading…"}</strong></span><i /><span><small>Subcounty</small><strong>{schoolSubcounty || "Loading…"}</strong></span><i /><span><small>Institution type</small><strong>{schoolLevel || "Loading…"}</strong></span></div>
              <form className="modal-form vacancy-form" onSubmit={(event) => void createVacancy(event)}><label>Job title<input name="title" placeholder="Enter teaching vacancy title" required /></label><label>Teaching level<select name="vacancy_level" defaultValue="" required><option value="" disabled>Select teaching level</option>{getVacancyLevelsForInstitutionType(schoolLevel).map((levelName) => <option key={levelName} value={levelName}>{levelName}</option>)}</select></label><div className="form-pair"><label>Employment arrangement<select name="employment_type"><option>Full-time</option><option>Part-time</option><option>Internship</option><option value="BOM">Employed by Board of Management (BOM)</option></select></label><label>Category<select name="category"><option>Teaching</option><option>Internship</option></select></label></div><label>Application closing date<input type="date" name="application_deadline" min={nairobiDateString()} defaultValue={nairobiDateString(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))} required /></label><label className="vacancy-description-field">Role description<textarea name="description" rows={4} placeholder="What should applicants know?" /></label><button className="primary-button modal-submit" disabled={loading || !schoolCounty || !schoolSubcounty || !schoolLevel}>{loading ? "Publishing…" : "Publish vacancy"} <Icon name="arrow" size={15} /></button></form>
            </>}
          </>}
        </section>
      </div>}
    </>
  );
}
